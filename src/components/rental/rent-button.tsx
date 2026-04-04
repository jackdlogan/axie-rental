"use client";

import { useState } from "react";
import { useWriteContract, useAccount, usePublicClient } from "wagmi";
import { parseUnits, formatUnits, keccak256, toBytes } from "viem";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { erc20Abi, rentalEscrowAbi, CONTRACTS } from "@/lib/contracts";

interface RentButtonProps {
  listingId: string;
  axieId: string;
  ownerAddress: string;
  rentalDays: number;
  totalPrice: string; // decimal string, e.g. "12.50"
  onSuccess?: () => void;
}

type Step = "idle" | "creating" | "approving" | "awaiting-approve" | "depositing" | "done";

export function RentButton({
  listingId,
  axieId,
  ownerAddress,
  rentalDays,
  totalPrice,
  onSuccess,
}: RentButtonProps) {
  const [step, setStep] = useState<Step>("idle");
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const isLoading = step !== "idle" && step !== "done";

  const handleRent = async () => {
    if (!address) {
      toast.error("Connect your wallet first");
      return;
    }
    if (!publicClient) {
      toast.error("Wallet not connected");
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
          description: `You have ${parseFloat(have).toFixed(2)} USDC but need ${totalPrice} USDC. Bridge USDC to Ronin or swap on Katana DEX.`,
          action: {
            label: "Get USDC",
            onClick: () => window.open("https://app.roninchain.com/bridge", "_blank"),
          },
          duration: 10000,
        });
        return;
      }
    } catch {
      // If balance check fails, continue — the deposit tx itself will revert with a clear error
    }

    // Step 1: Create rental in DB
    setStep("creating");
    let rentalId: string;
    try {
      const res = await fetch("/api/rentals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, rentalDays }),
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
        args: [CONTRACTS.RENTAL_ESCROW, amountWei],
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Approval failed: " + msg.slice(0, 100));
      setStep("idle");
      return;
    }

    // Step 3: Wait for approval to be mined before depositing
    setStep("awaiting-approve");
    try {
      await publicClient.waitForTransactionReceipt({ hash: approveTxHash });
    } catch {
      toast.error("Approval did not confirm — please try again");
      setStep("idle");
      return;
    }

    // Step 4: Deposit to escrow
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

      await fetch(`/api/rentals/${rentalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "PAYMENT_DEPOSITED",
          escrowTxHash: depositTx,
        }),
      });

      setStep("done");
      toast.success("Payment deposited! The owner will now delegate your Axie.");
      onSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Deposit failed: " + msg.slice(0, 100));
      setStep("idle");
    }
  };

  const label: Record<Step, string> = {
    idle: `Rent for ${totalPrice} USDC`,
    creating: "Creating rental...",
    approving: "Approve USDC in wallet...",
    "awaiting-approve": "Waiting for approval...",
    depositing: "Confirm deposit in wallet...",
    done: "Rental confirmed!",
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
