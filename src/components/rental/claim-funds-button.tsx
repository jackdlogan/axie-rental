"use client";

import { useState, useEffect } from "react";
import { useWriteContract, usePublicClient } from "wagmi";
import { keccak256, toBytes, BaseError } from "viem";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { rentalEscrowAbi, CONTRACTS } from "@/lib/contracts";
import { useQueryClient } from "@tanstack/react-query";

interface ClaimFundsButtonProps {
  rentalId: string;
  rentalStart: string;   // ISO date string
  rentalDays: number;
}

function useCountdown(targetMs: number) {
  const [remaining, setRemaining] = useState(targetMs - Date.now());
  useEffect(() => {
    const id = setInterval(() => setRemaining(targetMs - Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetMs]);
  return remaining;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Ready to claim";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h remaining`;
  if (h > 0) return `${h}h ${m}m remaining`;
  return `${m}m remaining`;
}

export function ClaimFundsButton({ rentalId, rentalStart, rentalDays }: ClaimFundsButtonProps) {
  const qc = useQueryClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const publicClient = usePublicClient();

  const rentalEndMs = new Date(rentalStart).getTime() + rentalDays * 86400_000;
  const remaining = useCountdown(rentalEndMs);
  const isReady = remaining <= 0;

  const handleClaim = async () => {
    const rentalIdBytes32 = keccak256(toBytes(rentalId));
    try {
      const txHash = await writeContractAsync({
        address: CONTRACTS.RENTAL_ESCROW,
        abi: rentalEscrowAbi,
        functionName: "claimFunds",
        args: [rentalIdBytes32],
      });

      toast.info("Transaction submitted, waiting for confirmation...");
      const receipt = await publicClient!.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status !== "success") throw new Error("Transaction reverted on-chain");

      await fetch(`/api/rentals/${rentalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED", releaseTxHash: txHash }),
      });

      toast.success("Funds claimed!");
      qc.invalidateQueries({ queryKey: ["pending-rentals"] });
    } catch (err: unknown) {
      const msg = err instanceof BaseError ? err.shortMessage : err instanceof Error ? err.message : String(err);
      toast.error("Failed: " + msg.slice(0, 100));
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      {!isReady && (
        <p className="text-xs text-muted-foreground">{formatCountdown(remaining)}</p>
      )}
      <Button
        size="sm"
        onClick={handleClaim}
        disabled={isPending || !isReady}
      >
        {isPending ? "Claiming..." : "Claim Funds"}
      </Button>
    </div>
  );
}
