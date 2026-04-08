"use client";

import { useState } from "react";
import { useWriteContract, usePublicClient, useAccount, useReadContract } from "wagmi";
import { encodeAbiParameters, hexToBigInt, ContractFunctionRevertedError, BaseError, keccak256, toBytes } from "viem";
import { axieDelegationAbi, erc721Abi, teamRentalEscrowAbi, CONTRACTS } from "@/lib/contracts";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const DELEGATION_CONTEXT_HASH =
  "0xfa4914198408a3840a0a751c221614143f885428607953c71fa37ad0dd52f940" as `0x${string}`;

interface TeamDelegateButtonProps {
  axieIds: string[];
  borrowerAddress: string;
  rentalDays: number;
  rentalId: string;
  rejectedRentalIds?: string[];
}

export function TeamDelegateButton({
  axieIds,
  borrowerAddress,
  rentalDays,
  rentalId,
  rejectedRentalIds = [],
}: TeamDelegateButtonProps) {
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

  const checkContextAttached = async (axieId: string): Promise<boolean> => {
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
      return false;
    } catch {
      return true;
    }
  };

  const handleDelegate = async () => {
    setIsPending(true);
    try {
      // Step 1: approve NFT contract for delegation
      if (!isApproved) {
        toast.info("Approving delegation contract for your Axies...");
        const approveHash = await writeContractAsync({
          address: CONTRACTS.AXIE_NFT,
          abi: erc721Abi,
          functionName: "setApprovalForAll",
          args: [CONTRACTS.AXIE_DELEGATION, true],
        });
        const receipt = await publicClient!.waitForTransactionReceipt({ hash: approveHash });
        if (receipt.status !== "success") throw new Error("Approval transaction reverted");
        toast.success("Approval confirmed!");
      }

      // Step 2: attachContext for any axie not yet registered
      for (const axieId of axieIds) {
        const alreadyAttached = await checkContextAttached(axieId);
        if (!alreadyAttached) {
          toast.info(`Registering Axie #${axieId} with delegation contract...`);
          const attachHash = await writeContractAsync({
            address: CONTRACTS.AXIE_NFT,
            abi: erc721Abi,
            functionName: "attachContext",
            args: [DELEGATION_CONTEXT_HASH, BigInt(axieId), "0x"],
          });
          const receipt = await publicClient!.waitForTransactionReceipt({ hash: attachHash });
          if (receipt.status !== "success") throw new Error(`attachContext reverted for Axie #${axieId}`);
        }
      }

      // Step 3: revoke any existing delegations
      for (const axieId of axieIds) {
        const delegationInfo = await publicClient!.readContract({
          address: CONTRACTS.AXIE_DELEGATION,
          abi: axieDelegationAbi,
          functionName: "getDelegationInfo",
          args: [BigInt(axieId)],
        });
        if (delegationInfo[0] !== "0x0000000000000000000000000000000000000000") {
          toast.info(`Revoking previous delegation for Axie #${axieId}...`);
          const revokeHash = await writeContractAsync({
            address: CONTRACTS.AXIE_DELEGATION,
            abi: axieDelegationAbi,
            functionName: "revokeDelegation",
            args: [BigInt(axieId)],
          });
          const receipt = await publicClient!.waitForTransactionReceipt({ hash: revokeHash });
          if (receipt.status !== "success") throw new Error(`Revoke reverted for Axie #${axieId}`);
        }
      }

      // Step 4: bulkDelegate all axies to borrower
      const expiryTs = BigInt(Math.floor(Date.now() / 1000) + rentalDays * 86400);
      const GAME_TYPE = 0n;

      try {
        await publicClient!.simulateContract({
          address: CONTRACTS.AXIE_DELEGATION,
          abi: axieDelegationAbi,
          functionName: "bulkDelegate",
          args: [
            axieIds.map((id) => BigInt(id)),
            axieIds.map(() => borrowerAddress as `0x${string}`),
            axieIds.map(() => expiryTs),
            axieIds.map(() => GAME_TYPE),
          ],
          account: address,
        });
      } catch (simErr) {
        if (simErr instanceof BaseError) {
          const revert = simErr.walk((e) => e instanceof ContractFunctionRevertedError);
          if (revert instanceof ContractFunctionRevertedError) {
            throw new Error(`bulkDelegate() would revert: ${revert.data?.errorName ?? revert.shortMessage}`);
          }
        }
        throw simErr;
      }

      toast.info("Delegating all Axies...");
      const delegateHash = await writeContractAsync({
        address: CONTRACTS.AXIE_DELEGATION,
        abi: axieDelegationAbi,
        functionName: "bulkDelegate",
        args: [
          axieIds.map((id) => BigInt(id)),
          axieIds.map(() => borrowerAddress as `0x${string}`),
          axieIds.map(() => expiryTs),
          axieIds.map(() => GAME_TYPE),
        ],
      });

      toast.info("Delegation submitted! Waiting for confirmation...");
      const delegateReceipt = await publicClient!.waitForTransactionReceipt({ hash: delegateHash });
      if (delegateReceipt.status !== "success") throw new Error("Delegation reverted on-chain");

      // Step 5: confirmDelegation in escrow
      toast.info("Confirming delegation in escrow...");
      const rentalIdBytes32 = keccak256(toBytes(rentalId));
      const confirmHash = await writeContractAsync({
        address: CONTRACTS.TEAM_RENTAL_ESCROW,
        abi: teamRentalEscrowAbi,
        functionName: "confirmDelegation",
        args: [rentalIdBytes32],
      });
      await publicClient!.waitForTransactionReceipt({ hash: confirmHash });

      await fetch(`/api/team-rentals/${rentalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DELEGATION_CONFIRMED", delegationTxHash: delegateHash }),
      });

      // Step 6: refundRejected for all other offers
      if (rejectedRentalIds.length > 0) {
        toast.info(`Refunding ${rejectedRentalIds.length} rejected offer(s)...`);
        for (const rejectedId of rejectedRentalIds) {
          try {
            const rejectedIdBytes32 = keccak256(toBytes(rejectedId));
            const refundTx = await writeContractAsync({
              address: CONTRACTS.TEAM_RENTAL_ESCROW,
              abi: teamRentalEscrowAbi,
              functionName: "refundRejected",
              args: [rejectedIdBytes32],
            });
            await publicClient!.waitForTransactionReceipt({ hash: refundTx });
            await fetch(`/api/team-rentals/${rejectedId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "REFUNDED", refundTxHash: refundTx }),
            });
          } catch {
            toast.warning("Could not immediately refund one offer — borrower can claim after 24h.");
          }
        }
      }

      qc.invalidateQueries({ queryKey: ["pending-team-rentals"] });
      toast.success("Team delegated! Funds will be released after the rental period.");
    } catch (error) {
      console.error("Team delegation failed:", error);
      toast.error(error instanceof Error ? error.message.slice(0, 120) : "Delegation failed.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Button onClick={handleDelegate} disabled={isPending} size="sm">
      {isPending ? "Processing..." : "Delegate Team"}
    </Button>
  );
}
