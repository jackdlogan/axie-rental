import { NextRequest, NextResponse } from "next/server";
import { queryAxieGraphQL, GET_AXIES_BY_OWNER } from "@/lib/graphql";
import type { AxiesResponse } from "@/lib/graphql";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const owner = searchParams.get("owner");

  if (!owner) {
    return NextResponse.json({ error: "Owner address required" }, { status: 400 });
  }

  try {
    const data = await queryAxieGraphQL<AxiesResponse>(GET_AXIES_BY_OWNER, {
      owner,
      from: 0,
      size: 100,
    });
    return NextResponse.json({
      axies: data.axies.results,
      total: data.axies.total,
    });
  } catch (error) {
    console.error("Failed to fetch axies:", error);
    return NextResponse.json({ error: "Failed to fetch axies" }, { status: 500 });
  }
}
