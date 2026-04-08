"use client";

import { useWriteContract, usePublicClient } from "wagmi";
import { keccak256, toBytes } from "viem";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { teamRentalEscrowAbi, CONTRACTS } from "@/lib/contracts";
import { useQueryClient } from "@tanstack/react-query";

interface TeamClaimFundsButtonProps {
  rentalId: string;
  rentalStart: string;
  rentalDays: number;
}

export function TeamClaimFundsButton({ rentalId, rentalStart, rentalDays }: TeamClaimFundsButtonProps) {
  const qc = useQueryClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const publicClient = usePublicClient();

  const rentalEnd = new Date(rentalStart).getTime() + rentalDays * 86400000;
  const canClaim = Date.now() >= rentalEnd;

  const handleClaim = async () => {
    try {
      const rentalIdBytes32 = keccak256(toBytes(rentalId));
      const txHash = await writeContractAsync({
        address: CONTRACTS.TEAM_RENTAL_ESCROW,
        abi: teamRentalEscrowAbi,
        functionName: "claimFunds",
        args: [rentalIdBytes32],
      });
      toast.info("Transaction submitted, waiting for confirmation...");
      const receipt = await publicClient!.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status !== "success") throw new Error("Transaction reverted on-chain");

      await fetch(`/api/team-rentals/${rentalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED", releaseTxHash: txHash }),
      });

      toast.success("Funds claimed!");
      qc.invalidateQueries({ queryKey: ["pending-team-rentals"] });
    } catch (err) {
      toast.error("Failed: " + (err instanceof Error ? err.message.slice(0, 100) : String(err)));
    }
  };

  if (!canClaim) return null;

  return (
    <Button size="sm" onClick={handleClaim} disabled={isPending}>
      {isPending ? "Claiming..." : "Claim Funds"}
    </Button>
  );
}
