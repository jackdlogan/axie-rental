import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Protect with CRON_SECRET so this isn't publicly callable
function isAuthorized(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return auth === `Bearer ${secret}`;
}

/**
 * GET  — dry run: shows what would be cancelled, no changes made
 * POST — executes the cleanup
 *
 * A rental is "stuck" if:
 *   - status = PAYMENT_DEPOSITED and delegationDeadline has passed
 *     (funds deposited into old contract, deadline expired, never resolved)
 *   - status = PENDING_PAYMENT and created > 48h ago
 *     (rental was created in DB but borrower never deposited — stale record)
 *
 * For each stuck rental:
 *   - Set rental status → CANCELLED
 *   - If the listing has no other non-terminal rental → restore listing → ACTIVE
 */
async function findStuckRentals() {
  const now = new Date();
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  const stuck = await prisma.rental.findMany({
    where: {
      OR: [
        // Paid into escrow but deadline passed and never resolved
        {
          status: "PAYMENT_DEPOSITED",
          delegationDeadline: { lt: now },
        },
        // Created but never paid — older than 48h
        {
          status: "PENDING_PAYMENT",
          createdAt: { lt: fortyEightHoursAgo },
        },
      ],
    },
    include: {
      listing: { select: { id: true, axieId: true, axieName: true, status: true } },
      borrower: { select: { walletAddress: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return stuck;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stuck = await findStuckRentals();

  // For each stuck rental, check if restoring the listing is safe
  const preview = await Promise.all(
    stuck.map(async (r) => {
      const otherActiveRentals = await prisma.rental.count({
        where: {
          listingId: r.listingId,
          id: { not: r.id },
          status: { in: ["PAYMENT_DEPOSITED", "DELEGATION_CONFIRMED", "ACTIVE"] },
        },
      });

      return {
        rentalId: r.id,
        rentalStatus: r.status,
        borrower: r.borrower.walletAddress,
        axie: r.listing.axieName || `Axie #${r.listing.axieId}`,
        listingId: r.listingId,
        currentListingStatus: r.listing.status,
        willRestoreListing: otherActiveRentals === 0 && r.listing.status !== "ACTIVE",
        delegationDeadline: r.delegationDeadline,
        createdAt: r.createdAt,
      };
    })
  );

  return NextResponse.json({
    dryRun: true,
    count: preview.length,
    rentals: preview,
    message:
      preview.length === 0
        ? "No stuck rentals found."
        : `Found ${preview.length} stuck rental(s). POST to this endpoint to execute cleanup.`,
  });
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stuck = await findStuckRentals();

  if (stuck.length === 0) {
    return NextResponse.json({ message: "No stuck rentals found. Nothing to do." });
  }

  const results = [];

  for (const rental of stuck) {
    // Check if it's safe to restore the listing
    const otherActiveRentals = await prisma.rental.count({
      where: {
        listingId: rental.listingId,
        id: { not: rental.id },
        status: { in: ["PAYMENT_DEPOSITED", "DELEGATION_CONFIRMED", "ACTIVE"] },
      },
    });

    const shouldRestoreListing =
      otherActiveRentals === 0 && rental.listing.status !== "ACTIVE";

    await prisma.$transaction(async (tx) => {
      await tx.rental.update({
        where: { id: rental.id },
        data: { status: "CANCELLED" },
      });

      if (shouldRestoreListing) {
        await tx.listing.update({
          where: { id: rental.listingId },
          data: { status: "ACTIVE" },
        });
      }
    });

    results.push({
      rentalId: rental.id,
      axie: rental.listing.axieName || `Axie #${rental.listing.axieId}`,
      previousStatus: rental.status,
      newStatus: "CANCELLED",
      listingRestored: shouldRestoreListing,
    });
  }

  return NextResponse.json({
    success: true,
    processed: results.length,
    results,
  });
}
