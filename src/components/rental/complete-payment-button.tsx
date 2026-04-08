"use client";

import { useState } from "react";
import { useWriteContract, useAccount, usePublicClient } from "wagmi";
import { parseUnits, formatUnits, keccak256, toBytes } from "viem";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { erc20Abi, rentalEscrowAbi, CONTRACTS } from "@/lib/contracts";

interface CompletePaymentButtonProps {
  rentalId: string;
  axieId: string;
  ownerAddress: string;
  rentalDays: number;
  totalPrice: string;
  onSuccess?: () => void;
}

type Step = "idle" | "approving" | "awaiting-approve" | "depositing" | "done";

export function CompletePaymentButton({
  rentalId,
  axieId,
  ownerAddress,
  rentalDays,
  totalPrice,
  onSuccess,
}: CompletePaymentButtonProps) {
  const [step, setStep] = useState<Step>("idle");
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const isLoading = step !== "idle" && step !== "done";

  const handlePay = async () => {
    if (!address || !publicClient) {
      toast.error("Connect your wallet first");
      return;
    }

    const amountWei = parseUnits(totalPrice, 6);

    // Pre-flight: check USDC balance
    try {
      const balance = await publicClient.readContract({
        address: CONTRACTS.USDC,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address],
      }) as bigint;

      if (balance < amountWei) {
        const have = formatUnits(balance, 6);
        toast.error(`Insufficient USDC balance`, {
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
      // Continue — deposit tx will revert with a clear error if balance is insufficient
    }

    const rentalIdBytes32 = keccak256(toBytes(rentalId));

    // Step 1: Approve USDC
    setStep("approving");
    let approveTxHash: `0x${string}`;
    try {
      approveTxHash = await writeContractAsync({
        address: CONTRACTS.USDC,
        abi: erc20Abi,
        functionName: "approve",
        args: [CONTRACTS.RENTAL_ESCROW, amountWei],
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Approval failed: " + msg.slice(0, 100));
      setStep("idle");
      return;
    }

    // Step 2: Wait for approval
    setStep("awaiting-approve");
    try {
      await publicClient.waitForTransactionReceipt({ hash: approveTxHash });
    } catch {
      toast.error("Approval did not confirm — please try again");
      setStep("idle");
      return;
    }

    // Step 3: Deposit to escrow
    setStep("depositing");
    try {
      const depositTx = await writeContractAsync({
        address: CONTRACTS.RENTAL_ESCROW,
        abi: rentalEscrowAbi,
        functionName: "deposit",
        args: [
          rentalIdBytes32,
          ownerAddress as `0x${string}`,
          BigInt(axieId),
          amountWei,
          BigInt(rentalDays),
        ],
      });

      const patchRes = await fetch(`/api/rentals/${rentalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "PAYMENT_DEPOSITED",
          escrowTxHash: depositTx,
        }),
      });

      if (!patchRes.ok) {
        toast.warning("Deposited on-chain but status update failed. Your funds are safe — status will sync automatically.");
      } else {
        toast.success("Offer submitted! Awaiting owner decision.");
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
    idle: "Complete Payment",
    approving: "Approve USDC in wallet...",
    "awaiting-approve": "Waiting for approval...",
    depositing: "Confirm deposit in wallet...",
    done: "Paid!",
  };

  return (
    <Button
      size="sm"
      onClick={handlePay}
      disabled={isLoading || step === "done"}
      className="cursor-pointer"
    >
      {label[step]}
    </Button>
  );
}
