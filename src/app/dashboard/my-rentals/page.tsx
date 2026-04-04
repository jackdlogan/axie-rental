"use client";

import { useAuth } from "@/components/providers";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AxieImage } from "@/components/axie/axie-image";
import { ClaimRefundButton } from "@/components/rental/claim-refund-button";
import { TxLink } from "@/components/ui/tx-link";
import { toast } from "sonner";

interface Rental {
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
  listing: {
    axieId: string;
    axieName: string | null;
    pricePerDay: string;
  };
  owner: { walletAddress: string };
}

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  PENDING_PAYMENT: "outline",
  PAYMENT_DEPOSITED: "secondary",
  DELEGATION_CONFIRMED: "secondary",
  ACTIVE: "default",
  COMPLETED: "default",
  REFUNDED: "destructive",
  CANCELLED: "destructive",
};

export default function MyRentalsPage() {
  const { isLoggedIn } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["my-rentals"],
    queryFn: async () => {
      const res = await fetch("/api/rentals?role=borrower");
      return res.json() as Promise<{ rentals: Rental[] }>;
    },
    enabled: isLoggedIn,
    refetchInterval: 15000,
  });

  const cancelMutation = useMutation({
    mutationFn: async (rentalId: string) => {
      const res = await fetch(`/api/rentals/${rentalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      if (!res.ok) throw new Error("Failed to cancel");
    },
    onSuccess: () => {
      toast.success("Rental cancelled — listing is now available again.");
      qc.invalidateQueries({ queryKey: ["my-rentals"] });
    },
    onError: () => toast.error("Failed to cancel rental"),
  });

  if (!isLoggedIn) {
    return (
      <p className="text-muted-foreground text-center py-12">
        Connect your wallet to view your rentals.
      </p>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">My Rentals</h1>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : !data?.rentals?.length ? (
        <div className="text-center py-16 space-y-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto w-12 h-12 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <p className="text-muted-foreground font-medium">No rentals yet.</p>
          <a href="/marketplace" className="text-sm text-primary hover:underline">Browse the marketplace to rent an Axie</a>
        </div>
      ) : (
        <div className="space-y-4">
          {data.rentals.map((rental) => (
            <Card key={rental.id}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-16 h-16 bg-muted rounded flex items-center justify-center shrink-0 overflow-hidden">
                  <AxieImage axieId={rental.listing.axieId} width={64} height={64} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">
                      {rental.listing.axieName ||
                        `Axie #${rental.listing.axieId}`}
                    </h3>
                    <Badge variant={STATUS_VARIANT[rental.status]}>
                      {rental.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {rental.totalPrice} USDC &middot; {rental.rentalDays} days
                  </p>
                  {rental.startDate && rental.endDate && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(rental.startDate).toLocaleDateString()} &mdash;{" "}
                      {new Date(rental.endDate).toLocaleDateString()}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-3 mt-1">
                    {rental.escrowTxHash && (
                      <span className="text-xs text-muted-foreground">Deposit: <TxLink hash={rental.escrowTxHash} /></span>
                    )}
                    {rental.delegationTxHash && (
                      <span className="text-xs text-muted-foreground">Delegation: <TxLink hash={rental.delegationTxHash} /></span>
                    )}
                    {rental.releaseTxHash && (
                      <span className="text-xs text-muted-foreground">Release: <TxLink hash={rental.releaseTxHash} /></span>
                    )}
                    {rental.refundTxHash && (
                      <span className="text-xs text-muted-foreground">Refund: <TxLink hash={rental.refundTxHash} /></span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  {rental.status === "PENDING_PAYMENT" && (
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
                    <ClaimRefundButton
                      rentalId={rental.id}
                      delegationDeadline={rental.delegationDeadline}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
