import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, parseAbiItem } from "viem";
import { prisma } from "@/lib/db";
import { CONTRACTS } from "@/lib/contracts";
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
        await prisma.$transaction([
          prisma.rental.update({
            where: { id: rental.id },
            data: { status: "PAYMENT_DEPOSITED", escrowTxHash: txHash },
          }),
          prisma.listing.update({
            where: { id: rental.listingId },
            data: { status: "RENTED" },
          }),
        ]);
        depositsProcessed++;
      }
    }

    // ── AxieDelegated → DELEGATION_CONFIRMED ─────────────────────────────────
    const delegationLogs = await publicClient.getLogs({
      address: CONTRACTS.AXIE_DELEGATION,
      event: parseAbiItem(
        "event AxieDelegated(uint256 indexed tokenId, address indexed owner, address indexed delegatee, uint256 expiryTs)"
      ),
      fromBlock,
      toBlock: latest,
    });

    let delegationsProcessed = 0;
    for (const log of delegationLogs) {
      const tokenId = log.args.tokenId?.toString();
      const delegatee = log.args.delegatee?.toLowerCase();
      const onChainOwner = log.args.owner?.toLowerCase();
      if (!tokenId || !delegatee || !onChainOwner) continue;

      const rental = await prisma.rental.findFirst({
        where: {
          listing: { axieId: tokenId },
          status: "PAYMENT_DEPOSITED",
          borrower: { walletAddress: delegatee },
          owner: { walletAddress: onChainOwner },
        },
      });

      if (rental) {
        await prisma.rental.update({
          where: { id: rental.id },
          data: {
            status: "DELEGATION_CONFIRMED",
            delegationTxHash: log.transactionHash,
            startDate: new Date(),
            endDate: new Date(Date.now() + rental.rentalDays * 86400000),
          },
        });
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
          prisma.listing.update({
            where: { id: rental.listingId },
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
          prisma.listing.update({
            where: { id: rental.listingId },
            data: { status: "ACTIVE" },
          }),
        ]);
        refundsProcessed++;
      }
    }

    return NextResponse.json({
      ok: true,
      synced: {
        deposits: depositsProcessed,
        delegations: delegationsProcessed,
        releases: releasesProcessed,
        refunds: refundsProcessed,
      },
      blockRange: { from: fromBlock.toString(), to: latest.toString() },
    });
  } catch (error) {
    console.error("Sync failed:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
