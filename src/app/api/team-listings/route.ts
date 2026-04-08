import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { queryAxieGraphQL, GET_AXIE_DETAIL } from "@/lib/graphql";
import type { AxieDetailResponse } from "@/lib/graphql";
import { publicClient } from "@/lib/chain/client";
import { erc721Abi, CONTRACTS } from "@/lib/contracts";
import { rateLimit, getIp } from "@/lib/ratelimit";

const MIN_PRICE_PER_DAY = 0.1;
const MAX_AXIES = 50;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mine = searchParams.get("mine") === "true";
  const search = searchParams.get("search");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (mine) {
    const session = await getSession();
    if (!session.walletAddress) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    where.owner = { walletAddress: session.walletAddress };
  } else {
    where.status = "ACTIVE";
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { axies: { some: { axieName: { contains: search, mode: "insensitive" } } } },
      { axies: { some: { axieId: { contains: search } } } },
    ];
  }

  const listings = await prisma.teamListing.findMany({
    where,
    include: {
      owner: { select: { walletAddress: true } },
      axies: { orderBy: { axieId: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  const offerCounts = await prisma.teamRental.groupBy({
    by: ["teamListingId"],
    where: {
      teamListingId: { in: listings.map((l) => l.id) },
      status: "PAYMENT_DEPOSITED",
    },
    _count: { id: true },
  });
  const offerCountMap = new Map(offerCounts.map((o) => [o.teamListingId, o._count.id]));
  const listingsWithOffers = listings.map((l) => ({
    ...l,
    pendingOfferCount: offerCountMap.get(l.id) ?? 0,
  }));

  return NextResponse.json({ listings: listingsWithOffers });
}

export async function POST(req: NextRequest) {
  if (!rateLimit(`team-listing:${getIp(req)}`, 5, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const session = await getSession();
  if (!session.walletAddress) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { axieIds, name, pricePerDay, minDays = 1, maxDays = 30 } = body;

  if (!axieIds || !Array.isArray(axieIds) || axieIds.length === 0) {
    return NextResponse.json({ error: "At least one Axie is required" }, { status: 400 });
  }
  if (axieIds.length > MAX_AXIES) {
    return NextResponse.json({ error: `Maximum ${MAX_AXIES} Axies per team` }, { status: 400 });
  }
  if (!pricePerDay || typeof pricePerDay !== "number" || pricePerDay < MIN_PRICE_PER_DAY || pricePerDay > 100_000) {
    return NextResponse.json(
      { error: `pricePerDay must be between ${MIN_PRICE_PER_DAY} and 100,000 USDC` },
      { status: 400 }
    );
  }

  // Verify on-chain ownership for all axies
  for (const axieId of axieIds) {
    try {
      const onChainOwner = await publicClient.readContract({
        address: CONTRACTS.AXIE_NFT,
        abi: erc721Abi,
        functionName: "ownerOf",
        args: [BigInt(axieId)],
      });
      if (onChainOwner.toLowerCase() !== session.walletAddress.toLowerCase()) {
        return NextResponse.json(
          { error: `You do not own Axie #${axieId}` },
          { status: 403 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: `Could not verify ownership of Axie #${axieId}` },
        { status: 400 }
      );
    }
  }

  const user = await prisma.user.findUnique({
    where: { walletAddress: session.walletAddress },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Check no axie is already in an active single or team listing
  const alreadyListed = await prisma.listing.findFirst({
    where: { axieId: { in: axieIds }, ownerId: user.id, status: { in: ["ACTIVE", "RENTED"] } },
  });
  if (alreadyListed) {
    return NextResponse.json(
      { error: `Axie #${alreadyListed.axieId} already has an active single listing` },
      { status: 409 }
    );
  }
  const alreadyInTeam = await prisma.teamListingAxie.findFirst({
    where: {
      axieId: { in: axieIds },
      teamListing: { ownerId: user.id, status: { in: ["ACTIVE", "RENTED"] } },
    },
  });
  if (alreadyInTeam) {
    return NextResponse.json(
      { error: `Axie #${alreadyInTeam.axieId} is already in an active team listing` },
      { status: 409 }
    );
  }

  // Fetch metadata for each axie from GraphQL
  const axieData: {
    axieId: string;
    axieClass: string | null;
    axieName: string | null;
    axieGenes: string | null;
    fortuneSlips: number | null;
  }[] = [];

  for (const axieId of axieIds) {
    let axieClass: string | null = null;
    let axieName: string | null = null;
    let axieGenes: string | null = null;
    let fortuneSlips: number | null = null;
    try {
      const data = await queryAxieGraphQL<AxieDetailResponse>(GET_AXIE_DETAIL, { axieId });
      if (data.axie) {
        axieClass = data.axie.class ?? null;
        axieName = data.axie.name ?? null;
        axieGenes = data.axie.newGenes ?? null;
        fortuneSlips = data.axie.fortuneSlips?.total ?? null;
      }
    } catch {
      // continue without metadata
    }
    axieData.push({ axieId, axieClass, axieName, axieGenes, fortuneSlips });
  }

  const listing = await prisma.teamListing.create({
    data: {
      name: name ?? null,
      pricePerDay,
      minDays,
      maxDays,
      ownerId: user.id,
      axies: {
        create: axieData,
      },
    },
    include: {
      axies: true,
      owner: { select: { walletAddress: true } },
    },
  });

  return NextResponse.json({ listing }, { status: 201 });
}
