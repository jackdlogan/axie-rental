import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, parseAbiItem } from "viem";
import { prisma } from "@/lib/db";
import { CONTRACTS, erc721Abi } from "@/lib/contracts";
import { activeChain } from "@/lib/wallet/config";

const publicClient = createPublicClient({
  chain: activeChain,
  transport: http(),
});

const BLOCK_RANGE = 499n;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  // Vercel Cron sends: Authorization: Bearer <secret>
  const authHeader = req.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;
  // Manual / external cron: x-cron-secret header
  const cronHeader = req.headers.get("x-cron-secret");
  if (cronHeader === secret) return true;
  return false;
}

// GET — called by Vercel Cron
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runSync();
}

// POST — called manually or by external cron (cron-job.org etc)
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runSync();
}

async function runSync() {
  try {
    const latest = await publicClient.getBlockNumber();
    const fromBlock = latest - BLOCK_RANGE;

    // ── Deposited → PAYMENT_DEPOSITED + listing RENTED ───────────────────────
    const depositLogs = await publicClient.getLogs({
      address: CONTRACTS.RENTAL_ESCROW,
      event: parseAbiItem(
        "event Deposited(bytes32 indexed rentalId, address indexed borrower, address indexed owner, uint256 amount)"
      ),
      fromBlock,
      toBlock: latest,
    });

    let depositsProcessed = 0;
    for (const log of depositLogs) {
      const txHash = log.transactionHash;
      if (!txHash) continue;
      const borrowerAddr = log.args.borrower?.toLowerCase();
      const ownerAddr = log.args.owner?.toLowerCase();
      if (!borrowerAddr || !ownerAddr) continue;

      const rental = await prisma.rental.findFirst({
        where: {
          status: "PENDING_PAYMENT",
          borrower: { walletAddress: borrowerAddr },
          owner: { walletAddress: ownerAddr },
        },
      });

      if (rental) {
        // Listing stays ACTIVE — multiple offers are allowed until owner picks one.
        await prisma.rental.update({
          where: { id: rental.id },
          data: { status: "PAYMENT_DEPOSITED", escrowTxHash: txHash },
        });
        depositsProcessed++;
      }
    }

    // ── DelegationConfirmed (escrow) → DELEGATION_CONFIRMED ──────────────────
    // Fired by RentalEscrow.confirmDelegation() — contains borrower + owner + axieId
    const delegationLogs = await publicClient.getLogs({
      address: CONTRACTS.RENTAL_ESCROW,
      event: parseAbiItem(
        "event DelegationConfirmed(bytes32 indexed rentalId, address indexed borrower, address indexed owner, uint256 axieId, uint256 rentalStart)"
      ),
      fromBlock,
      toBlock: latest,
    });

    let delegationsProcessed = 0;
    for (const log of delegationLogs) {
      const borrowerAddr  = log.args.borrower?.toLowerCase();
      const ownerAddr     = log.args.owner?.toLowerCase();
      const tokenId       = log.args.axieId?.toString();
      const rentalStartTs = log.args.rentalStart ? Number(log.args.rentalStart) * 1000 : Date.now();
      if (!borrowerAddr || !ownerAddr || !tokenId) continue;

      const rental = await prisma.rental.findFirst({
        where: {
          listing: { axieId: tokenId },
          status: "PAYMENT_DEPOSITED",
          borrower: { walletAddress: borrowerAddr },
          owner:    { walletAddress: ownerAddr },
        },
      });

      if (rental) {
        const rentalStart = new Date(rentalStartTs);
        await prisma.$transaction([
          prisma.rental.update({
            where: { id: rental.id },
            data: {
              status: "DELEGATION_CONFIRMED",
              delegationTxHash: log.transactionHash,
              startDate: rentalStart,
              endDate: new Date(rentalStartTs + rental.rentalDays * 86400000),
            },
          }),
          prisma.listing.update({
            where: { id: rental.listingId },
            data: { status: "RENTED" },
          }),
          prisma.rental.updateMany({
            where: {
              listingId: rental.listingId,
              id: { not: rental.id },
              status: "PAYMENT_DEPOSITED",
            },
            data: { status: "REFUNDED" },
          }),
        ]);
        delegationsProcessed++;
      }
    }

    // ── Released → COMPLETED + listing ACTIVE ────────────────────────────────
    const releaseLogs = await publicClient.getLogs({
      address: CONTRACTS.RENTAL_ESCROW,
      event: parseAbiItem(
        "event Released(bytes32 indexed rentalId, address indexed owner, uint256 amount)"
      ),
      fromBlock,
      toBlock: latest,
    });

    let releasesProcessed = 0;
    for (const log of releaseLogs) {
      const txHash = log.transactionHash;
      if (!txHash) continue;
      const ownerAddr = log.args.owner?.toLowerCase();
      if (!ownerAddr) continue;

      const rental = await prisma.rental.findFirst({
        where: {
          status: { in: ["DELEGATION_CONFIRMED", "ACTIVE"] },
          owner: { walletAddress: ownerAddr },
          releaseTxHash: null,
        },
      });

      if (rental) {
        await prisma.$transaction([
          prisma.rental.update({
            where: { id: rental.id },
            data: { status: "COMPLETED", releaseTxHash: txHash },
          }),
          // Only re-open the listing if it was locked by this rental
          prisma.listing.updateMany({
            where: { id: rental.listingId, status: "RENTED" },
            data: { status: "ACTIVE" },
          }),
        ]);
        releasesProcessed++;
      }
    }

    // ── Refunded → REFUNDED + listing ACTIVE ─────────────────────────────────
    const refundLogs = await publicClient.getLogs({
      address: CONTRACTS.RENTAL_ESCROW,
      event: parseAbiItem(
        "event Refunded(bytes32 indexed rentalId, address indexed borrower, uint256 amount)"
      ),
      fromBlock,
      toBlock: latest,
    });

    let refundsProcessed = 0;
    for (const log of refundLogs) {
      const txHash = log.transactionHash;
      if (!txHash) continue;
      const borrowerAddr = log.args.borrower?.toLowerCase();
      if (!borrowerAddr) continue;

      const rental = await prisma.rental.findFirst({
        where: {
          status: { in: ["PAYMENT_DEPOSITED", "DELEGATION_CONFIRMED"] },
          borrower: { walletAddress: borrowerAddr },
          refundTxHash: null,
        },
      });

      if (rental) {
        await prisma.$transaction([
          prisma.rental.update({
            where: { id: rental.id },
            data: { status: "REFUNDED", refundTxHash: txHash },
          }),
          // Only re-open the listing if it was locked by this rental (not a rejected offer)
          prisma.listing.updateMany({
            where: { id: rental.listingId, status: "RENTED" },
            data: { status: "ACTIVE" },
          }),
        ]);
        refundsProcessed++;
      }
    }

    // ── ProRatedRefund → REFUNDED + listing ACTIVE ───────────────────────────
    const proRatedLogs = await publicClient.getLogs({
      address: CONTRACTS.RENTAL_ESCROW,
      event: parseAbiItem(
        "event ProRatedRefund(bytes32 indexed rentalId, address indexed borrower, uint256 borrowerAmount, uint256 ownerAmount)"
      ),
      fromBlock,
      toBlock: latest,
    });

    let proRatedProcessed = 0;
    for (const log of proRatedLogs) {
      const txHash      = log.transactionHash;
      const borrowerAddr = log.args.borrower?.toLowerCase();
      if (!txHash || !borrowerAddr) continue;

      const rental = await prisma.rental.findFirst({
        where: {
          status: "DELEGATION_CONFIRMED",
          borrower: { walletAddress: borrowerAddr },
          refundTxHash: null,
        },
      });

      if (rental) {
        await prisma.$transaction([
          prisma.rental.update({
            where: { id: rental.id },
            data: { status: "REFUNDED", refundTxHash: txHash },
          }),
          prisma.listing.updateMany({
            where: { id: rental.listingId, status: "RENTED" },
            data: { status: "ACTIVE" },
          }),
        ]);
        proRatedProcessed++;
      }
    }

    // ── Stale listing cleanup — cancel listings where owner no longer holds the Axie ──
    let staleListingsCancelled = 0;

    const activeListings = await prisma.listing.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, axieId: true, owner: { select: { walletAddress: true } } },
    });

    for (const listing of activeListings) {
      try {
        const onChainOwner = await publicClient.readContract({
          address: CONTRACTS.AXIE_NFT,
          abi: erc721Abi,
          functionName: "ownerOf",
          args: [BigInt(listing.axieId)],
        });
        if (onChainOwner.toLowerCase() !== listing.owner.walletAddress.toLowerCase()) {
          await prisma.listing.update({
            where: { id: listing.id },
            data: { status: "CANCELLED" },
          });
          staleListingsCancelled++;
        }
      } catch {
        // RPC failure for this axie — skip, will retry next cron run
      }
    }

    // Also check active team listings
    let staleTeamListingsCancelled = 0;

    const activeTeamListings = await prisma.teamListing.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        owner: { select: { walletAddress: true } },
        axies: { select: { axieId: true } },
      },
    });

    for (const teamListing of activeTeamListings) {
      try {
        const ownerChecks = await Promise.all(
          teamListing.axies.map((axie) =>
            publicClient.readContract({
              address: CONTRACTS.AXIE_NFT,
              abi: erc721Abi,
              functionName: "ownerOf",
              args: [BigInt(axie.axieId)],
            })
          )
        );
        const hasStale = ownerChecks.some(
          (owner) => owner.toLowerCase() !== teamListing.owner.walletAddress.toLowerCase()
        );
        if (hasStale) {
          await prisma.teamListing.update({
            where: { id: teamListing.id },
            data: { status: "CANCELLED" },
          });
          staleTeamListingsCancelled++;
        }
      } catch {
        // skip — retry next run
      }
    }

    return NextResponse.json({
      ok: true,
      synced: {
        deposits: depositsProcessed,
        delegations: delegationsProcessed,
        releases: releasesProcessed,
        refunds: refundsProcessed,
        proRatedRefunds: proRatedProcessed,
        staleListingsCancelled,
        staleTeamListingsCancelled,
      },
      blockRange: { from: fromBlock.toString(), to: latest.toString() },
    });
  } catch (error) {
    console.error("Sync failed:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
