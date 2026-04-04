import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  return NextResponse.json({
    isLoggedIn: session.isLoggedIn || false,
    walletAddress: session.walletAddress || null,
  });
}
