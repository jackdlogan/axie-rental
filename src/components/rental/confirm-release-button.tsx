"use client";

import { useState } from "react";
import { useWriteContract, usePublicClient, useAccount } from "wagmi";
import { keccak256, toBytes, BaseError } from "viem";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { rentalEscrowAbi, axieDelegationAbi, CONTRACTS } from "@/lib/contracts";
import { useQueryClient } from "@tanstack/react-query";

interface ConfirmReleaseButtonProps {
  rentalId: string; // DB rental ID
}

export function ConfirmReleaseButton({ rentalId }: ConfirmReleaseButtonProps) {
  const [isPending, setIsPending] = useState(false);
  const qc = useQueryClient();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const { address } = useAccount();

  const handleConfirm = async () => {
    setIsPending(true);
    const rentalIdBytes32 = keccak256(toBytes(rentalId));

    try {
      // Pre-check 1: does the escrow have a record for this rental?
      // Ronin's RPC doesn't return revert data, so we diagnose with reads instead of simulateContract.
      const rental = await publicClient!.readContract({
        address: CONTRACTS.RENTAL_ESCROW,
        abi: rentalEscrowAbi,
        functionName: "getRental",
        args: [rentalIdBytes32],
      });

      const [borrower, , axieId, , , , , , released, refunded] = rental;

      if (borrower === "0x0000000000000000000000000000000000000000") {
        toast.error("Rental not found in escrow contract. Was the deposit made to a different contract address?");
        return;
      }
      if (released) {
        toast.error("Funds already released for this rental.");
        return;
      }
      if (refunded) {
        toast.error("This rental was already refunded.");
        return;
      }

      // Pre-check 2: is the axie currently delegated to the borrower?
      // isDelegated() is not on the live contract — use getDelegationInfo instead.
      const [delegatee, , expiryTs] = await publicClient!.readContract({
        address: CONTRACTS.AXIE_DELEGATION,
        abi: axieDelegationAbi,
        functionName: "getDelegationInfo",
        args: [axieId],
      });

      const nowSec = BigInt(Math.floor(Date.now() / 1000));
      const delegatedToBorrower =
        delegatee.toLowerCase() === borrower.toLowerCase() && expiryTs > nowSec;

      if (!delegatedToBorrower) {
        if (delegatee === "0x0000000000000000000000000000000000000000") {
          toast.error("Axie is not delegated yet. Complete the delegation step first.");
        } else if (expiryTs <= nowSec) {
          toast.error("Delegation has expired. The owner needs to delegate again.");
        } else {
          toast.error(`Axie is delegated to a different address (${delegatee.slice(0, 8)}...), not the borrower.`);
        }
        return;
      }

      // All checks passed — submit the transaction
      const txHash = await writeContractAsync({
        address: CONTRACTS.RENTAL_ESCROW,
        abi: rentalEscrowAbi,
        functionName: "confirmDelegation",
        args: [rentalIdBytes32],
      });

      toast.info("Transaction submitted, waiting for confirmation...");

      const receipt = await publicClient!.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status !== "success") {
        throw new Error("Transaction was reverted on-chain");
      }

      await fetch(`/api/rentals/${rentalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DELEGATION_CONFIRMED", delegationTxHash: txHash }),
      });

      toast.success("Delegation confirmed! Rental is now active.");
      qc.invalidateQueries({ queryKey: ["pending-rentals"] });
    } catch (err: unknown) {
      const msg = err instanceof BaseError ? err.shortMessage : err instanceof Error ? err.message : String(err);
      console.error("[confirmAndRelease] failed:", err);
      toast.error(`Release failed: ${msg}`);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Button size="sm" onClick={handleConfirm} disabled={isPending}>
      {isPending ? "Confirming..." : "Confirm & Release"}
    </Button>
  );
}
