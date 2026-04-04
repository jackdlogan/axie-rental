import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { SiweMessage } from "siwe";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { message, signature } = await req.json();
    const session = await getSession();

    const siweMessage = new SiweMessage(message);
    const { data: fields } = await siweMessage.verify({
      signature,
      nonce: session.nonce,
    });

    if (fields.nonce !== session.nonce) {
      return NextResponse.json({ error: "Invalid nonce" }, { status: 422 });
    }

    // Invalidate nonce immediately to prevent replay attacks
    session.nonce = undefined;

    await prisma.user.upsert({
      where: { walletAddress: fields.address.toLowerCase() },
      update: {},
      create: { walletAddress: fields.address.toLowerCase() },
    });

    session.walletAddress = fields.address.toLowerCase();
    session.isLoggedIn = true;
    await session.save();

    return NextResponse.json({ ok: true, address: fields.address });
  } catch (error) {
    console.error("SIWE verification failed:", error);
    return NextResponse.json({ error: "Verification failed" }, { status: 400 });
  }
}
