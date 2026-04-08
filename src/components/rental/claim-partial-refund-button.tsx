"use client";

import { useWriteContract, usePublicClient, useReadContract, useAccount } from "wagmi";
import { keccak256, toBytes, BaseError } from "viem";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { rentalEscrowAbi, axieDelegationAbi, CONTRACTS } from "@/lib/contracts";
import { useQueryClient } from "@tanstack/react-query";

interface ClaimPartialRefundButtonProps {
  rentalId: string;
  axieId: string;
  rentalStart: string;   // ISO date string
  rentalDays: number;
}

export function ClaimPartialRefundButton({
  rentalId,
  axieId,
  rentalStart,
  rentalDays,
}: ClaimPartialRefundButtonProps) {
  const qc = useQueryClient();
  const { address } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();
  const publicClient = usePublicClient();

  // Check if delegation is still active for this borrower
  const { data: delegationInfo } = useReadContract({
    address: CONTRACTS.AXIE_DELEGATION,
    abi: axieDelegationAbi,
    functionName: "getDelegationInfo",
    args: [BigInt(axieId)],
    query: { refetchInterval: 30_000 },
  });

  const rentalEndMs = new Date(rentalStart).getTime() + rentalDays * 86400_000;
  const rentalOver = Date.now() >= rentalEndMs;

  // Show only if rental period is still active and delegation is gone
  if (rentalOver) return null;

  const [delegatee, , expiryTs] = delegationInfo ?? ["0x0000000000000000000000000000000000000000", 0n, 0n];
  const stillDelegated =
    address &&
    delegatee.toLowerCase() === address.toLowerCase() &&
    BigInt(Math.floor(Date.now() / 1000)) < expiryTs;

  if (stillDelegated) return null;

  const handleClaim = async () => {
    const rentalIdBytes32 = keccak256(toBytes(rentalId));
    try {
      const txHash = await writeContractAsync({
        address: CONTRACTS.RENTAL_ESCROW,
        abi: rentalEscrowAbi,
        functionName: "claimProRatedRefund",
        args: [rentalIdBytes32],
      });

      toast.info("Transaction submitted, waiting for confirmation...");
      const receipt = await publicClient!.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status !== "success") throw new Error("Transaction reverted on-chain");

      await fetch(`/api/rentals/${rentalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REFUNDED", refundTxHash: txHash }),
      });

      toast.success("Partial refund claimed for unused rental days.");
      qc.invalidateQueries({ queryKey: ["my-rentals"] });
    } catch (err: unknown) {
      const msg = err instanceof BaseError ? err.shortMessage : err instanceof Error ? err.message : String(err);
      toast.error("Failed: " + msg.slice(0, 100));
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleClaim} disabled={isPending}>
      {isPending ? "Claiming..." : "Claim Partial Refund"}
    </Button>
  );
}
