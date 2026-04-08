"use client";

import { useAuth } from "@/components/providers";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AxieImage } from "@/components/axie/axie-image";
import { TeamClaimRefundButton } from "@/components/rental/team-claim-refund-button";
import { TxLink } from "@/components/ui/tx-link";
import { toast } from "sonner";

interface TeamListingAxie {
  axieId: string;
  axieClass: string | null;
  axieName: string | null;
}

interface TeamRental {
  id: string;
  totalPrice: string;
  rentalDays: number;
  startDate: string | null;
  endDate: string | null;
  delegationDeadline: string | null;
  escrowTxHash: string | null;
  delegationTxHash: string | null;
  releaseTxHash: string | null;
  refundTxHash: string | null;
  status: string;
  teamListing: {
    name: string | null;
    axies: TeamListingAxie[];
  };
  owner: { walletAddress: string };
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  PENDING_PAYMENT: "outline",
  PAYMENT_DEPOSITED: "secondary",
  DELEGATION_CONFIRMED: "secondary",
  ACTIVE: "default",
  COMPLETED: "default",
  REFUNDED: "destructive",
  CANCELLED: "destructive",
};

function RejectedRefundAction({
  rentalId,
  delegationDeadline,
}: {
  rentalId: string;
  delegationDeadline: string | null;
}) {
  const isPastDeadline = delegationDeadline && new Date(delegationDeadline) < new Date();

  if (isPastDeadline) {
    return <TeamClaimRefundButton rentalId={rentalId} delegationDeadline={delegationDeadline} forceShow />;
  }

  const msLeft = delegationDeadline ? new Date(delegationDeadline).getTime() - Date.now() : null;
  const hoursLeft = msLeft ? Math.floor(msLeft / 3600000) : null;
  const minsLeft = msLeft ? Math.floor((msLeft % 3600000) / 60000) : null;
  const countdownLabel = hoursLeft !== null && minsLeft !== null
    ? hoursLeft >= 1 ? `${hoursLeft}h ${minsLeft}m` : `${minsLeft}m`
    : "soon";

  return (
    <div className="flex flex-col items-end gap-1">
      <span className="text-xs text-muted-foreground text-right">Refund pending from owner</span>
      <span className="text-xs text-muted-foreground text-right">Fallback in {countdownLabel}</span>
    </div>
  );
}

export default function MyTeamRentalsPage() {
  const { isLoggedIn } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["my-team-rentals"],
    queryFn: async () => {
      const res = await fetch("/api/team-rentals?role=borrower");
      return res.json() as Promise<{ rentals: TeamRental[] }>;
    },
    enabled: isLoggedIn,
    refetchInterval: 15000,
  });

  const cancelMutation = useMutation({
    mutationFn: async (rentalId: string) => {
      const res = await fetch(`/api/team-rentals/${rentalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      if (!res.ok) throw new Error("Failed to cancel");
    },
    onSuccess: () => {
      toast.success("Offer cancelled.");
      qc.invalidateQueries({ queryKey: ["my-team-rentals"] });
    },
    onError: () => toast.error("Failed to cancel"),
  });

  if (!isLoggedIn) {
    return <p className="text-muted-foreground text-center py-12">Connect your wallet to view your team rentals.</p>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">My Team Rentals</h1>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : !data?.rentals?.length ? (
        <div className="text-center py-16 space-y-3">
          <p className="text-muted-foreground font-medium">No team rentals yet.</p>
          <a href="/marketplace/teams" className="text-sm text-primary hover:underline">
            Browse team listings
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          {data.rentals.map((rental) => (
            <Card key={rental.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Axie stack */}
                  <div className="flex -space-x-2 shrink-0">
                    {rental.teamListing.axies.slice(0, 4).map((axie) => (
                      <div key={axie.axieId} className="w-10 h-10 bg-muted rounded-full border-2 border-background overflow-hidden flex items-center justify-center">
                        <AxieImage axieId={axie.axieId} width={40} height={40} />
                      </div>
                    ))}
                    {rental.teamListing.axies.length > 4 && (
                      <div className="w-10 h-10 bg-muted rounded-full border-2 border-background flex items-center justify-center text-xs font-medium">
                        +{rental.teamListing.axies.length - 4}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold">
                        {rental.teamListing.name || `Team (${rental.teamListing.axies.length} Axies)`}
                      </h3>
                      <Badge variant={STATUS_VARIANT[rental.status]}>
                        {rental.status === "REFUNDED" && !rental.refundTxHash
                          ? "Offer Rejected"
                          : rental.status === "PAYMENT_DEPOSITED"
                          ? "Offer Pending"
                          : rental.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {rental.totalPrice} USDC · {rental.rentalDays} days
                    </p>
                    {rental.startDate && rental.endDate && (
                      <p className="text-xs text-muted-foreground">
                        {new Date(rental.startDate).toLocaleDateString()} — {new Date(rental.endDate).toLocaleDateString()}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-3 mt-1">
                      {rental.escrowTxHash && <span className="text-xs text-muted-foreground">Deposit: <TxLink hash={rental.escrowTxHash} /></span>}
                      {rental.delegationTxHash && <span className="text-xs text-muted-foreground">Delegation: <TxLink hash={rental.delegationTxHash} /></span>}
                      {rental.releaseTxHash && <span className="text-xs text-muted-foreground">Release: <TxLink hash={rental.releaseTxHash} /></span>}
                      {rental.refundTxHash && <span className="text-xs text-muted-foreground">Refund: <TxLink hash={rental.refundTxHash} /></span>}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    {rental.status === "PENDING_PAYMENT" && !rental.escrowTxHash && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="cursor-pointer"
                        onClick={() => cancelMutation.mutate(rental.id)}
                        disabled={cancelMutation.isPending}
                      >
                        Cancel
                      </Button>
                    )}
                    {rental.status === "PAYMENT_DEPOSITED" && (
                      <>
                        <Badge variant="secondary" className="text-xs text-center">Awaiting owner decision</Badge>
                        <TeamClaimRefundButton
                          rentalId={rental.id}
                          delegationDeadline={rental.delegationDeadline}
                        />
                      </>
                    )}
                    {rental.status === "REFUNDED" && !rental.refundTxHash && (
                      <RejectedRefundAction
                        rentalId={rental.id}
                        delegationDeadline={rental.delegationDeadline}
                      />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
