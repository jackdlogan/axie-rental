"use client";

import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useWriteContract, usePublicClient, useAccount, useReadContract } from "wagmi";
import { encodeAbiParameters, hexToBigInt, ContractFunctionRevertedError, BaseError } from "viem";
import { axieDelegationAbi, erc721Abi, rentalEscrowAbi, CONTRACTS } from "@/lib/contracts";
import { keccak256, toBytes } from "viem";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

// contextHash from AxieDelegation contract (getContextHash())
const DELEGATION_CONTEXT_HASH =
  "0xfa4914198408a3840a0a751c221614143f885428607953c71fa37ad0dd52f940" as `0x${string}`;

interface DelegateButtonProps {
  axieId: string;
  borrowerAddress: string;
  rentalDays: number;
  rentalId: string;
  rejectedRentalIds?: string[]; // other offers on same axie to refund immediately
}

export function DelegateButton({
  axieId,
  borrowerAddress,
  rentalDays,
  rentalId,
  rejectedRentalIds = [],
}: DelegateButtonProps) {
  const [isPending, setIsPending] = useState(false);
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const { address } = useAccount();
  const qc = useQueryClient();

  const { data: isApproved } = useReadContract({
    address: CONTRACTS.AXIE_NFT,
    abi: erc721Abi,
    functionName: "isApprovedForAll",
    args: [address as `0x${string}`, CONTRACTS.AXIE_DELEGATION],
    query: { enabled: !!address },
  });

  /**
   * Check if axie context is already attached to the delegation contract.
   * Simulates attachContext — succeeds (0x) if NOT attached, reverts if already attached.
   */
  const checkContextAttached = async (): Promise<boolean> => {
    try {
      const encoded = encodeAbiParameters(
        [{ type: "bytes32" }, { type: "uint256" }, { type: "bytes" }],
        [DELEGATION_CONTEXT_HASH, BigInt(axieId), "0x"]
      );
      await publicClient!.call({
        to: CONTRACTS.AXIE_NFT,
        data: `0x624fedb2${encoded.slice(2)}` as `0x${string}`,
        account: address,
      });
      return false; // simulation succeeded → NOT yet attached
    } catch {
      return true; // simulation reverted → already attached
    }
  };

  const handleDelegate = async () => {
    setIsPending(true);
    try {
      // Step 1: approve NFT contract for delegation (ERC721 setApprovalForAll)
      if (!isApproved) {
        toast.info("Approving delegation contract for your Axies...");
        const approveHash = await writeContractAsync({
          address: CONTRACTS.AXIE_NFT,
          abi: erc721Abi,
          functionName: "setApprovalForAll",
          args: [CONTRACTS.AXIE_DELEGATION, true],
        });
        const approveReceipt = await publicClient!.waitForTransactionReceipt({ hash: approveHash });
        if (approveReceipt.status !== "success") throw new Error("Approval transaction reverted");
        toast.success("Approval confirmed!");
      }

      // Step 2: attachContext (REP15 — one-time per axie, registers it with the delegation contract)
      const alreadyAttached = await checkContextAttached();
      if (!alreadyAttached) {
        toast.info("Registering axie with delegation contract (one-time)...");
        const attachHash = await writeContractAsync({
          address: CONTRACTS.AXIE_NFT,
          abi: erc721Abi,
          functionName: "attachContext",
          args: [DELEGATION_CONTEXT_HASH, BigInt(axieId), "0x"],
        });
        const attachReceipt = await publicClient!.waitForTransactionReceipt({ hash: attachHash });
        if (attachReceipt.status !== "success") throw new Error("attachContext transaction reverted");
        toast.success("Axie registered!");
      }

      // Step 3: revoke only if the axie is currently delegated via the delegation contract
      const delegationInfo = await publicClient!.readContract({
        address: CONTRACTS.AXIE_DELEGATION,
        abi: axieDelegationAbi,
        functionName: "getDelegationInfo",
        args: [BigInt(axieId)],
      });
      const currentDelegatee = delegationInfo[0]; // address

      if (currentDelegatee !== "0x0000000000000000000000000000000000000000") {
        toast.info("Revoking previous delegation (24h minimum must have passed)...");
        const revokeHash = await writeContractAsync({
          address: CONTRACTS.AXIE_DELEGATION,
          abi: axieDelegationAbi,
          functionName: "revokeDelegation",
          args: [BigInt(axieId)],
        });
        const revokeReceipt = await publicClient!.waitForTransactionReceipt({ hash: revokeHash });
        if (revokeReceipt.status !== "success") throw new Error("Revoke transaction reverted");
        toast.success("Previous delegation revoked!");
      }

      // Step 4: delegate to borrower
      // selector 0xae6a2ef4 = delegate(uint256,address,uint64,uint64)
      // gameType=0 for Axie Origin (verified against on-chain successful tx)
      const expiryTs = BigInt(Math.floor(Date.now() / 1000) + rentalDays * 86400);
      const GAME_TYPE = 0n;

      // Pre-flight simulation to get the actual revert reason instead of "Internal JSON-RPC error"
      try {
        await publicClient!.simulateContract({
          address: CONTRACTS.AXIE_DELEGATION,
          abi: axieDelegationAbi,
          functionName: "delegate",
          args: [BigInt(axieId), borrowerAddress as `0x${string}`, expiryTs, GAME_TYPE],
          account: address,
        });
      } catch (simErr) {
        if (simErr instanceof BaseError) {
          const revert = simErr.walk((e) => e instanceof ContractFunctionRevertedError);
          if (revert instanceof ContractFunctionRevertedError) {
            const reason = revert.data?.errorName ?? revert.shortMessage;
            throw new Error(`delegate() would revert: ${reason}`);
          }
        }
        throw simErr;
      }

      const hash = await writeContractAsync({
        address: CONTRACTS.AXIE_DELEGATION,
        abi: axieDelegationAbi,
        functionName: "delegate",
        args: [BigInt(axieId), borrowerAddress as `0x${string}`, expiryTs, GAME_TYPE],
      });

      toast.info("Delegation submitted! Waiting for confirmation...");
      const receipt = await publicClient!.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Delegation transaction was reverted on-chain");

      // Step 5: notify escrow that delegation covers the full rental period
      // This locks in the rental start time — owner can claim funds after the period ends
      toast.info("Confirming delegation in escrow...");
      const rentalIdBytes32 = keccak256(toBytes(rentalId));
      const confirmHash = await writeContractAsync({
        address: CONTRACTS.RENTAL_ESCROW,
        abi: rentalEscrowAbi,
        functionName: "confirmDelegation",
        args: [rentalIdBytes32],
      });
      await publicClient!.waitForTransactionReceipt({ hash: confirmHash });

      // Update DB only after both on-chain steps are confirmed
      await fetch(`/api/rentals/${rentalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DELEGATION_CONFIRMED", delegationTxHash: hash }),
      });

      // Immediately refund all other offers on this axie
      if (rejectedRentalIds.length > 0) {
        toast.info(`Refunding ${rejectedRentalIds.length} rejected offer(s)...`);
        for (const rejectedId of rejectedRentalIds) {
          try {
            const rejectedIdBytes32 = keccak256(toBytes(rejectedId));
            const refundTx = await writeContractAsync({
              address: CONTRACTS.RENTAL_ESCROW,
              abi: rentalEscrowAbi,
              functionName: "refundRejected",
              args: [rejectedIdBytes32],
            });
            await publicClient!.waitForTransactionReceipt({ hash: refundTx });
            await fetch(`/api/rentals/${rejectedId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "REFUNDED", refundTxHash: refundTx }),
            });
          } catch {
            // Non-fatal — borrower can still claimRefund() after 24h
            toast.warning(`Could not immediately refund one offer — borrower can claim after 24h.`);
          }
        }
      }

      qc.invalidateQueries({ queryKey: ["pending-rentals"] });
      toast.success("Axie delegated! Funds will be released to you.");
    } catch (error) {
      console.error("Delegation failed:", error);
      toast.error("Delegation failed. Please try again.");
    } finally {
      setIsPending(false);
    }
  };

  const label = isPending ? "Processing..." : "Delegate Axie";

  return (
    <Button onClick={handleDelegate} disabled={isPending}>
      {label}
    </Button>
  );
}
