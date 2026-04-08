import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { rateLimit, getIp } from "@/lib/ratelimit";
import { publicClient } from "@/lib/chain/client";
import { erc721Abi, CONTRACTS } from "@/lib/contracts";

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

  const rentals = await prisma.teamRental.findMany({
    where,
    include: {
      teamListing: {
        select: {
          id: true,
          name: true,
          pricePerDay: true,
          axies: { orderBy: { axieId: "asc" } },
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
  if (!rateLimit(`team-rental:${getIp(req)}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const session = await getSession();
  if (!session.walletAddress) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { teamListingId, rentalDays } = body;

  if (!teamListingId || !rentalDays) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const borrower = await prisma.user.findUnique({
    where: { walletAddress: session.walletAddress },
  });
  if (!borrower) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const listing = await prisma.teamListing.findUnique({
    where: { id: teamListingId },
    include: { owner: true, axies: { select: { axieId: true } } },
  });
  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }
  if (listing.status !== "ACTIVE") {
    return NextResponse.json({ error: "Listing not available" }, { status: 400 });
  }
  if (listing.owner.walletAddress === session.walletAddress) {
    return NextResponse.json({ error: "Cannot rent your own team" }, { status: 400 });
  }

  // Re-verify on-chain ownership for all Axies in the team
  try {
    const ownerChecks = await Promise.all(
      listing.axies.map((axie) =>
        publicClient.readContract({
          address: CONTRACTS.AXIE_NFT,
          abi: erc721Abi,
          functionName: "ownerOf",
          args: [BigInt(axie.axieId)],
        })
      )
    );
    const notOwned = listing.axies.filter(
      (_, i) => ownerChecks[i].toLowerCase() !== listing.owner.walletAddress.toLowerCase()
    );
    if (notOwned.length > 0) {
      await prisma.teamListing.update({
        where: { id: listing.id },
        data: { status: "CANCELLED" },
      });
      return NextResponse.json(
        { error: `Listing invalid — owner no longer holds Axie #${notOwned[0].axieId}` },
        { status: 410 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Could not verify Axie ownership on-chain" },
      { status: 502 }
    );
  }

  if (rentalDays < listing.minDays || rentalDays > listing.maxDays) {
    return NextResponse.json({ error: "Invalid rental duration" }, { status: 400 });
  }

  const existingOffer = await prisma.teamRental.findFirst({
    where: {
      teamListingId: listing.id,
      borrowerId: borrower.id,
      status: { in: ["PENDING_PAYMENT", "PAYMENT_DEPOSITED"] },
    },
  });
  if (existingOffer) {
    return NextResponse.json(
      { error: "You already have a pending offer on this team" },
      { status: 409 }
    );
  }

  const totalPrice = listing.pricePerDay.toNumber() * rentalDays;
  const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const rental = await prisma.teamRental.create({
    data: {
      totalPrice,
      rentalDays,
      delegationDeadline: deadline,
      status: "PENDING_PAYMENT",
      teamListingId: listing.id,
      ownerId: listing.ownerId,
      borrowerId: borrower.id,
    },
  });

  return NextResponse.json({ rental }, { status: 201 });
}
