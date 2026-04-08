"use client";

import { useWriteContract, usePublicClient } from "wagmi";
import { keccak256, toBytes, BaseError } from "viem";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { teamRentalEscrowAbi, CONTRACTS } from "@/lib/contracts";
import { useQueryClient } from "@tanstack/react-query";

interface TeamClaimRefundButtonProps {
  rentalId: string;
  delegationDeadline: string | null;
  forceShow?: boolean;
}

export function TeamClaimRefundButton({ rentalId, delegationDeadline, forceShow = false }: TeamClaimRefundButtonProps) {
  const qc = useQueryClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const publicClient = usePublicClient();

  const isPastDeadline = delegationDeadline && new Date(delegationDeadline) < new Date();

  const handleClaim = async () => {
    try {
      const rentalIdBytes32 = keccak256(toBytes(rentalId));
      const txHash = await writeContractAsync({
        address: CONTRACTS.TEAM_RENTAL_ESCROW,
        abi: teamRentalEscrowAbi,
        functionName: "claimRefund",
        args: [rentalIdBytes32],
      });
      toast.info("Transaction submitted, waiting for confirmation...");
      const receipt = await publicClient!.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status !== "success") throw new Error("Refund transaction reverted on-chain");

      await fetch(`/api/team-rentals/${rentalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REFUNDED", refundTxHash: txHash }),
      });

      toast.success("Refund claimed!");
      qc.invalidateQueries({ queryKey: ["my-team-rentals"] });
    } catch (err) {
      const msg = err instanceof BaseError ? err.shortMessage : err instanceof Error ? err.message : String(err);
      toast.error("Failed: " + msg.slice(0, 100));
    }
  };

  if (!isPastDeadline && !forceShow) return null;

  return (
    <Button variant="destructive" size="sm" onClick={handleClaim} disabled={isPending}>
      {isPending ? "Claiming..." : "Claim Refund"}
    </Button>
  );
}
