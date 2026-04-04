"use client";

import { useWriteContract, usePublicClient } from "wagmi";
import { keccak256, toBytes, BaseError } from "viem";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { rentalEscrowAbi, CONTRACTS } from "@/lib/contracts";
import { useQueryClient } from "@tanstack/react-query";

interface ClaimRefundButtonProps {
  rentalId: string; // DB rental ID
  delegationDeadline: string | null;
}

export function ClaimRefundButton({
  rentalId,
  delegationDeadline,
}: ClaimRefundButtonProps) {
  const qc = useQueryClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const publicClient = usePublicClient();

  const isPastDeadline =
    delegationDeadline && new Date(delegationDeadline) < new Date();

  const handleClaim = async () => {
    const rentalIdBytes32 = keccak256(toBytes(rentalId));
    try {
      const txHash = await writeContractAsync({
        address: CONTRACTS.RENTAL_ESCROW,
        abi: rentalEscrowAbi,
        functionName: "claimRefund",
        args: [rentalIdBytes32],
      });

      toast.info("Transaction submitted, waiting for confirmation...");
      const receipt = await publicClient!.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status !== "success") throw new Error("Refund transaction reverted on-chain");

      await fetch(`/api/rentals/${rentalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REFUNDED", refundTxHash: txHash }),
      });

      toast.success("Refund claimed!");
      qc.invalidateQueries({ queryKey: ["my-rentals"] });
    } catch (err: unknown) {
      const msg = err instanceof BaseError ? err.shortMessage : err instanceof Error ? err.message : String(err);
      toast.error("Failed: " + msg.slice(0, 100));
    }
  };

  if (!isPastDeadline) return null;

  return (
    <Button
      variant="destructive"
      size="sm"
      onClick={handleClaim}
      disabled={isPending}
    >
      {isPending ? "Claiming..." : "Claim Refund"}
    </Button>
  );
}
