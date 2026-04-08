import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { queryAxieGraphQL, GET_AXIE_DETAIL } from "@/lib/graphql";
import type { AxieDetailResponse } from "@/lib/graphql";
import { publicClient } from "@/lib/chain/client";
import { erc721Abi, CONTRACTS } from "@/lib/contracts";
import { rateLimit, getIp } from "@/lib/ratelimit";

const MIN_PRICE_PER_DAY = 0.1; // USDC

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mine = searchParams.get("mine") === "true";
  const axieId = searchParams.get("axieId");
  const axieClass = searchParams.get("class");
  const search = searchParams.get("search");
  const minFortuneSlips = searchParams.get("minFortuneSlips");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (mine) {
    const session = await getSession();
    if (!session.walletAddress) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    where.owner = { walletAddress: session.walletAddress };
  } else {
    if (!axieId) where.status = "ACTIVE";
  }

  if (axieId) where.axieId = axieId;
  if (axieClass && axieClass !== "All") where.axieClass = axieClass;
  if (minFortuneSlips) where.fortuneSlips = { gte: Number(minFortuneSlips) };
  if (search) {
    where.OR = [
      { axieId: { contains: search } },
      { axieName: { contains: search, mode: "insensitive" } },
    ];
  }

  const listings = await prisma.listing.findMany({
    where,
    include: { owner: { select: { walletAddress: true } } },
    orderBy: { createdAt: "desc" },
  });

  // Attach pending offer count to each listing (parallel query)
  const offerCounts = await prisma.rental.groupBy({
    by: ["listingId"],
    where: {
      listingId: { in: listings.map((l) => l.id) },
      status: "PAYMENT_DEPOSITED",
    },
    _count: { id: true },
  });
  const offerCountMap = new Map(offerCounts.map((o) => [o.listingId, o._count.id]));
  const listingsWithOffers = listings.map((l) => ({
    ...l,
    pendingOfferCount: offerCountMap.get(l.id) ?? 0,
  }));

  return NextResponse.json({ listings: listingsWithOffers }, {
    headers: {
      "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
    },
  });
}

export async function POST(req: NextRequest) {
  // Rate limit: 5 listings per minute per IP
  if (!rateLimit(`listing:${getIp(req)}`, 5, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const session = await getSession();
  if (!session.walletAddress) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { axieId, pricePerDay, minDays = 1, maxDays = 30 } = body;

  if (!axieId || !pricePerDay) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (typeof pricePerDay !== "number" || pricePerDay < MIN_PRICE_PER_DAY || pricePerDay > 10_000) {
    return NextResponse.json(
      { error: `pricePerDay must be between ${MIN_PRICE_PER_DAY} and 10,000 USDC` },
      { status: 400 }
    );
  }

  // Verify on-chain ownership before accepting the listing
  try {
    const onChainOwner = await publicClient.readContract({
      address: CONTRACTS.AXIE_NFT,
      abi: erc721Abi,
      functionName: "ownerOf",
      args: [BigInt(axieId)],
    });
    if (onChainOwner.toLowerCase() !== session.walletAddress.toLowerCase()) {
      return NextResponse.json({ error: "You do not own this Axie" }, { status: 403 });
    }
  } catch {
    return NextResponse.json(
      { error: "Could not verify Axie ownership on-chain. Check the Axie ID." },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { walletAddress: session.walletAddress },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Fetch Axie metadata from GraphQL to cache it
  let axieClass: string | null = null;
  let axieName: string | null = null;
  let axieGenes: string | null = null;
  let fortuneSlips: number | null = null;
  try {
    const data = await queryAxieGraphQL<AxieDetailResponse>(GET_AXIE_DETAIL, {
      axieId,
    });
    if (data.axie) {
      axieClass = data.axie.class ?? null;
      axieName = data.axie.name ?? null;
      axieGenes = data.axie.newGenes ?? null;
      fortuneSlips = data.axie.fortuneSlips?.total ?? null;
    }
  } catch (err) {
    console.error("Failed to fetch axie metadata:", err);
  }

  const existing = await prisma.listing.findFirst({
    where: {
      axieId,
      ownerId: user.id,
      status: { in: ["ACTIVE", "RENTED"] },
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Axie already has an active listing" },
      { status: 409 }
    );
  }

  const listing = await prisma.listing.create({
    data: {
      axieId,
      axieClass,
      axieName,
      axieGenes,
      fortuneSlips,
      pricePerDay,
      minDays,
      maxDays,
      ownerId: user.id,
    },
  });

  return NextResponse.json({ listing }, { status: 201 });
}
