import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.walletAddress) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const role = searchParams.get("role") || "borrower";
  const status = searchParams.get("status");

  const user = await prisma.user.findUnique({
    where: { walletAddress: session.walletAddress },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (role === "owner") {
    where.ownerId = user.id;
  } else {
    where.borrowerId = user.id;
  }
  if (status) {
    const statuses = status.split(",").map((s) => s.trim());
    where.status = statuses.length === 1 ? statuses[0] : { in: statuses };
  }

  const rentals = await prisma.rental.findMany({
    where,
    include: {
      listing: {
        select: {
          axieId: true,
          axieName: true,
          pricePerDay: true,
        },
      },
      owner: { select: { walletAddress: true } },
      borrower: { select: { walletAddress: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ rentals });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.walletAddress) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { listingId, rentalDays } = body;

  if (!listingId || !rentalDays) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const borrower = await prisma.user.findUnique({
    where: { walletAddress: session.walletAddress },
  });
  if (!borrower) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { owner: true },
  });
  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }
  if (listing.status !== "ACTIVE") {
    return NextResponse.json({ error: "Listing not available" }, { status: 400 });
  }
  if (listing.owner.walletAddress === session.walletAddress) {
    return NextResponse.json({ error: "Cannot rent your own axie" }, { status: 400 });
  }
  if (rentalDays < listing.minDays || rentalDays > listing.maxDays) {
    return NextResponse.json({ error: "Invalid rental duration" }, { status: 400 });
  }

  const totalPrice = listing.pricePerDay.toNumber() * rentalDays;
  const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const rental = await prisma.rental.create({
    data: {
      totalPrice,
      rentalDays,
      delegationDeadline: deadline,
      status: "PENDING_PAYMENT",
      listingId: listing.id,
      ownerId: listing.ownerId,
      borrowerId: borrower.id,
    },
  });

  // Don't lock listing until payment is confirmed — locking happens on PAYMENT_DEPOSITED PATCH

  return NextResponse.json({ rental }, { status: 201 });
}
