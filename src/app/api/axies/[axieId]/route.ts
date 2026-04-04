import { NextRequest, NextResponse } from "next/server";
import { queryAxieGraphQL, GET_AXIE_DETAIL } from "@/lib/graphql";
import type { AxieDetailResponse } from "@/lib/graphql";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ axieId: string }> }
) {
  const { axieId } = await params;
  try {
    const data = await queryAxieGraphQL<AxieDetailResponse>(GET_AXIE_DETAIL, {
      axieId,
    });
    if (!data.axie) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(data.axie);
  } catch (error) {
    console.error("Failed to fetch axie:", error);
    return NextResponse.json({ error: "Failed to fetch axie" }, { status: 500 });
  }
}
