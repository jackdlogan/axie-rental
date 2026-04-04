import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { generateNonce } from "siwe";

export async function GET() {
  const session = await getSession();
  session.nonce = generateNonce();
  await session.save();
  return NextResponse.json({ nonce: session.nonce });
}
