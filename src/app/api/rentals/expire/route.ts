import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Expire PENDING_PAYMENT rentals older than 1 hour.
// Called by cron or manually via POST /api/rentals/expire
export async function POST(req: NextRequest) {
  // Simple secret check so this isn't publicly abusable
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

  const stuckRentals = await prisma.rental.findMany({
    where: {
      status: "PENDING_PAYMENT",
      createdAt: { lt: cutoff },
    },
    select: { id: true, listingId: true },
  });

  if (stuckRentals.length === 0) {
    return NextResponse.json({ expired: 0 });
  }

  // Cancel all stuck rentals and restore listings to ACTIVE
  await prisma.$transaction([
    prisma.rental.updateMany({
      where: { id: { in: stuckRentals.map((r) => r.id) } },
      data: { status: "CANCELLED" },
    }),
    prisma.listing.updateMany({
      where: { id: { in: stuckRentals.map((r) => r.listingId) } },
      data: { status: "ACTIVE" },
    }),
  ]);

  console.log(`[expire] Cancelled ${stuckRentals.length} stuck PENDING_PAYMENT rentals`);
  return NextResponse.json({ expired: stuckRentals.length });
}
