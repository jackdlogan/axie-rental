"use client";

import { useState } from "react";
import { useWriteContract, useAccount, usePublicClient } from "wagmi";
import { parseUnits, formatUnits, keccak256, toBytes } from "viem";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { erc20Abi, teamRentalEscrowAbi, CONTRACTS } from "@/lib/contracts";

interface TeamRentButtonProps {
  teamListingId: string;
  ownerAddress: string;
  axieIds: string[];
  rentalDays: number;
  totalPrice: string;
  onSuccess?: () => void;
}

type Step = "idle" | "creating" | "approving" | "awaiting-approve" | "depositing" | "done";

export function TeamRentButton({
  teamListingId,
  ownerAddress,
  axieIds,
  rentalDays,
  totalPrice,
  onSuccess,
}: TeamRentButtonProps) {
  const [step, setStep] = useState<Step>("idle");
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const isLoading = step !== "idle" && step !== "done";

  const handleRent = async () => {
    if (!address || !publicClient) {
      toast.error("Connect your wallet first");
      return;
    }

    const amountWei = parseUnits(totalPrice, 6);

    try {
      const balance = await publicClient.readContract({
        address: CONTRACTS.USDC,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address],
      }) as bigint;

      if (balance < amountWei) {
        const have = formatUnits(balance, 6);
        toast.error("Insufficient USDC balance", {
          description: `You have ${parseFloat(have).toFixed(2)} USDC but need ${totalPrice} USDC.`,
          action: {
            label: "Get USDC",
            onClick: () => window.open("https://app.roninchain.com/bridge", "_blank"),
          },
          duration: 10000,
        });
        return;
      }
    } catch {
      // continue
    }

    // Step 1: Create team rental in DB
    setStep("creating");
    let rentalId: string;
    try {
      const res = await fetch("/api/team-rentals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamListingId, rentalDays }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to create rental");
        setStep("idle");
        return;
      }
      rentalId = data.rental.id;
    } catch {
      toast.error("Failed to create rental");
      setStep("idle");
      return;
    }

    const rentalIdBytes32 = keccak256(toBytes(rentalId));

    // Step 2: Approve USDC
    setStep("approving");
    let approveTxHash: `0x${string}`;
    try {
      approveTxHash = await writeContractAsync({
        address: CONTRACTS.USDC,
        abi: erc20Abi,
        functionName: "approve",
        args: [CONTRACTS.TEAM_RENTAL_ESCROW, amountWei],
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Approval failed: " + msg.slice(0, 100));
      setStep("idle");
      return;
    }

    // Step 3: Wait for approval
    setStep("awaiting-approve");
    try {
      await publicClient.waitForTransactionReceipt({ hash: approveTxHash });
    } catch {
      toast.error("Approval did not confirm — please try again");
      setStep("idle");
      return;
    }

    // Step 4: Deposit to team escrow
    setStep("depositing");
    try {
      const depositTx = await writeContractAsync({
        address: CONTRACTS.TEAM_RENTAL_ESCROW,
        abi: teamRentalEscrowAbi,
        functionName: "deposit",
        args: [
          rentalIdBytes32,
          ownerAddress as `0x${string}`,
          axieIds.map((id) => BigInt(id)),
          amountWei,
          BigInt(rentalDays),
        ],
      });

      const patchRes = await fetch(`/api/team-rentals/${rentalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PAYMENT_DEPOSITED", escrowTxHash: depositTx }),
      });

      if (!patchRes.ok) {
        toast.warning("Deposited on-chain but status update failed. Your funds are safe — status will sync automatically.");
      } else {
        toast.success("Offer submitted! The owner will review and delegate the team.");
      }

      setStep("done");
      onSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Deposit failed: " + msg.slice(0, 100));
      setStep("idle");
    }
  };

  const label: Record<Step, string> = {
    idle: `Place Offer — ${totalPrice} USDC`,
    creating: "Creating offer...",
    approving: "Approve USDC in wallet...",
    "awaiting-approve": "Waiting for approval...",
    depositing: "Confirm deposit in wallet...",
    done: "Offer submitted!",
  };

  return (
    <Button
      className="w-full cursor-pointer"
      size="lg"
      onClick={handleRent}
      disabled={isLoading || step === "done"}
    >
      {label[step]}
    </Button>
  );
}
