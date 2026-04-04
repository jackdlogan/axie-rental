import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { queryAxieGraphQL, GET_AXIE_DETAIL } from "@/lib/graphql";
import type { AxieDetailResponse } from "@/lib/graphql";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mine = searchParams.get("mine") === "true";
  const axieId = searchParams.get("axieId");
  const axieClass = searchParams.get("class");
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
    if (!axieId) where.status = "ACTIVE";
  }

  if (axieId) where.axieId = axieId;
  if (axieClass && axieClass !== "All") where.axieClass = axieClass;
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

  return NextResponse.json({ listings });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.walletAddress) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { axieId, pricePerDay, minDays = 1, maxDays = 30 } = body;

  if (!axieId || !pricePerDay) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
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
  try {
    const data = await queryAxieGraphQL<AxieDetailResponse>(GET_AXIE_DETAIL, {
      axieId,
    });
    if (data.axie) {
      axieClass = data.axie.class ?? null;
      axieName = data.axie.name ?? null;
      axieGenes = data.axie.newGenes ?? null;
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
      pricePerDay,
      minDays,
      maxDays,
      ownerId: user.id,
    },
  });

  return NextResponse.json({ listing }, { status: 201 });
}
