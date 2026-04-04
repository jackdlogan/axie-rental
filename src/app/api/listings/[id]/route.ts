import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: { owner: { select: { walletAddress: true } } },
  });
  if (!listing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ listing });
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
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: { owner: true },
  });
  if (!listing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (listing.owner.walletAddress !== session.walletAddress) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { status, pricePerDay, minDays, maxDays } = body;

  const ALLOWED_STATUSES = ["ACTIVE", "PAUSED", "CANCELLED"];
  if (status !== undefined && !ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if (pricePerDay !== undefined && (typeof pricePerDay !== "number" || pricePerDay <= 0 || pricePerDay > 10000)) {
    return NextResponse.json({ error: "pricePerDay must be between 0 and 10000" }, { status: 400 });
  }
  if (minDays !== undefined && (!Number.isInteger(minDays) || minDays < 1 || minDays > 365)) {
    return NextResponse.json({ error: "minDays must be between 1 and 365" }, { status: 400 });
  }
  if (maxDays !== undefined && (!Number.isInteger(maxDays) || maxDays < 1 || maxDays > 365)) {
    return NextResponse.json({ error: "maxDays must be between 1 and 365" }, { status: 400 });
  }
  if (minDays !== undefined && maxDays !== undefined && minDays > maxDays) {
    return NextResponse.json({ error: "minDays cannot exceed maxDays" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (status !== undefined) data.status = status;
  if (pricePerDay !== undefined) data.pricePerDay = pricePerDay;
  if (minDays !== undefined) data.minDays = minDays;
  if (maxDays !== undefined) data.maxDays = maxDays;

  const updated = await prisma.listing.update({ where: { id }, data });
  return NextResponse.json({ listing: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.walletAddress) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: { owner: true },
  });
  if (!listing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (listing.owner.walletAddress !== session.walletAddress) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.listing.update({
    where: { id },
    data: { status: "CANCELLED" },
  });
  return NextResponse.json({ ok: true });
}
