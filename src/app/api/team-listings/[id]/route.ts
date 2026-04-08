import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const listing = await prisma.teamListing.findUnique({
    where: { id },
    include: {
      owner: { select: { walletAddress: true } },
      axies: { orderBy: { axieId: "asc" } },
    },
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
  const listing = await prisma.teamListing.findUnique({
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
  const { status, pricePerDay, minDays, maxDays, name } = body;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (status) data.status = status;
  if (pricePerDay !== undefined) data.pricePerDay = pricePerDay;
  if (minDays !== undefined) data.minDays = minDays;
  if (maxDays !== undefined) data.maxDays = maxDays;
  if (name !== undefined) data.name = name;

  const updated = await prisma.teamListing.update({ where: { id }, data });
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
  const listing = await prisma.teamListing.findUnique({
    where: { id },
    include: { owner: true },
  });
  if (!listing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (listing.owner.walletAddress !== session.walletAddress) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (listing.status === "RENTED") {
    return NextResponse.json({ error: "Cannot delete an active rental" }, { status: 400 });
  }

  await prisma.teamListing.update({ where: { id }, data: { status: "CANCELLED" } });
  return NextResponse.json({ ok: true });
}
