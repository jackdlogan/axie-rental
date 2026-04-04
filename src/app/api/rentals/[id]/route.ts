import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import type { RentalStatus } from "@prisma/client";

// Allowed status transitions: who can move from → to
const TRANSITIONS: Record<RentalStatus, { to: RentalStatus; actor: "owner" | "borrower" | "either" }[]> = {
  PENDING_PAYMENT:     [{ to: "PAYMENT_DEPOSITED", actor: "borrower" }, { to: "CANCELLED", actor: "either" }],
  PAYMENT_DEPOSITED:   [{ to: "DELEGATION_CONFIRMED", actor: "owner" }, { to: "REFUNDED", actor: "borrower" }],
  DELEGATION_CONFIRMED:[{ to: "COMPLETED", actor: "either" }],
  ACTIVE:              [{ to: "COMPLETED", actor: "either" }],
  COMPLETED:           [],
  REFUNDED:            [],
  CANCELLED:           [],
};

const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.walletAddress) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const rental = await prisma.rental.findUnique({
    where: { id },
    include: {
      listing: true,
      owner: { select: { walletAddress: true } },
      borrower: { select: { walletAddress: true } },
    },
  });
  if (!rental) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only owner or borrower may read the rental details
  const isOwner = rental.owner.walletAddress === session.walletAddress;
  const isBorrower = rental.borrower.walletAddress === session.walletAddress;
  if (!isOwner && !isBorrower) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ rental });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.walletAddress) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const rental = await prisma.rental.findUnique({
    where: { id },
    include: { owner: true, borrower: true },
  });
  if (!rental) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isOwner = rental.owner.walletAddress === session.walletAddress;
  const isBorrower = rental.borrower.walletAddress === session.walletAddress;
  if (!isOwner && !isBorrower) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { status, escrowTxHash, delegationTxHash, releaseTxHash, refundTxHash } = body;

  // Validate status transition
  if (status !== undefined) {
    const allowed = TRANSITIONS[rental.status as RentalStatus] ?? [];
    const transition = allowed.find((t) => t.to === status);
    if (!transition) {
      return NextResponse.json(
        { error: `Cannot transition from ${rental.status} to ${status}` },
        { status: 400 }
      );
    }
    const actorOk =
      transition.actor === "either" ||
      (transition.actor === "owner" && isOwner) ||
      (transition.actor === "borrower" && isBorrower);
    if (!actorOk) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Validate tx hash formats
  for (const [field, hash] of [
    ["escrowTxHash", escrowTxHash],
    ["delegationTxHash", delegationTxHash],
    ["releaseTxHash", releaseTxHash],
    ["refundTxHash", refundTxHash],
  ] as const) {
    if (hash !== undefined && !TX_HASH_RE.test(hash)) {
      return NextResponse.json({ error: `Invalid ${field}` }, { status: 400 });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (status !== undefined) {
    data.status = status;
    if (status === "DELEGATION_CONFIRMED") {
      data.startDate = new Date();
      data.endDate = new Date(Date.now() + rental.rentalDays * 86400000);
    }
    if (status === "PAYMENT_DEPOSITED") {
      await prisma.listing.update({
        where: { id: rental.listingId },
        data: { status: "RENTED" },
      });
    }
    if (status === "COMPLETED" || status === "CANCELLED" || status === "REFUNDED") {
      await prisma.listing.update({
        where: { id: rental.listingId },
        data: { status: "ACTIVE" },
      });
    }
  }
  if (escrowTxHash) data.escrowTxHash = escrowTxHash;
  if (delegationTxHash) data.delegationTxHash = delegationTxHash;
  if (releaseTxHash) data.releaseTxHash = releaseTxHash;
  if (refundTxHash) data.refundTxHash = refundTxHash;

  const updated = await prisma.rental.update({ where: { id }, data });
  return NextResponse.json({ rental: updated });
}
