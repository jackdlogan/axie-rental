"use client";

import { useAuth } from "@/components/providers";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DelegateButton } from "@/components/rental/delegate-button";
import { ConfirmReleaseButton } from "@/components/rental/confirm-release-button";
import { AxieImage } from "@/components/axie/axie-image";
import { TxLink } from "@/components/ui/tx-link";

interface Rental {
  id: string;
  totalPrice: string;
  rentalDays: number;
  status: string;
  delegationDeadline: string | null;
  endDate: string | null;
  delegationTxHash: string | null;
  releaseTxHash: string | null;
  borrower: { walletAddress: string };
  listing: { axieId: string; axieName: string | null };
}

function DeadlineStatus({ deadline }: { deadline: string }) {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) {
    return (
      <Badge variant="destructive" className="text-xs">
        Deadline passed — borrower may claim refund
      </Badge>
    );
  }
  const hours = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  const label = hours >= 1 ? `${hours}h ${mins}m to delegate` : `${mins}m to delegate`;
  return (
    <Badge variant={hours < 2 ? "destructive" : "secondary"} className="text-xs">
      {label}
    </Badge>
  );
}

function DelegationExpiry({ endDate }: { endDate: string }) {
  const ms = new Date(endDate).getTime() - Date.now();
  if (ms <= 0) {
    return (
      <Badge variant="destructive" className="text-xs">
        Delegation expired — confirm &amp; release ASAP
      </Badge>
    );
  }
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const label = days >= 1 ? `Delegation expires in ${days}d ${hours}h` : `Delegation expires in ${hours}h`;
  return (
    <Badge variant={days < 1 ? "destructive" : "secondary"} className="text-xs">
      {label}
    </Badge>
  );
}

export default function PendingRentalsPage() {
  const { isLoggedIn } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["pending-rentals"],
    queryFn: async () => {
      const res = await fetch("/api/rentals?role=owner&status=PAYMENT_DEPOSITED,DELEGATION_CONFIRMED");
      return res.json() as Promise<{ rentals: Rental[] }>;
    },
    enabled: isLoggedIn,
    refetchInterval: 15000,
  });

  if (!isLoggedIn) {
    return (
      <p className="text-muted-foreground text-center py-12">
        Connect your wallet to view pending rentals.
      </p>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Pending Delegations</h1>
      <p className="text-muted-foreground mb-8 text-sm">
        These rentals are paid. Delegate your Axie within 24h to release funds.
      </p>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : !data?.rentals?.length ? (
        <div className="text-center py-16 space-y-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto w-12 h-12 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-muted-foreground font-medium">All clear — no pending delegations.</p>
          <p className="text-sm text-muted-foreground">Paid rentals waiting for your delegation will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.rentals.map((rental) => (
            <Card key={rental.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-muted rounded flex items-center justify-center shrink-0 overflow-hidden">
                      <AxieImage axieId={rental.listing.axieId} width={64} height={64} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-semibold">
                        {rental.listing.axieName || `Axie #${rental.listing.axieId}`}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {rental.totalPrice} USDC &middot; {rental.rentalDays} days
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Borrower:{" "}
                        <span className="font-mono text-xs">
                          {rental.borrower.walletAddress.slice(0, 6)}...{rental.borrower.walletAddress.slice(-4)}
                        </span>
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {rental.status === "PAYMENT_DEPOSITED" && rental.delegationDeadline && (
                          <DeadlineStatus deadline={rental.delegationDeadline} />
                        )}
                        {rental.status === "DELEGATION_CONFIRMED" && rental.endDate && (
                          <DelegationExpiry endDate={rental.endDate} />
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 pt-1">
                        {rental.delegationTxHash && (
                          <span className="text-xs text-muted-foreground">
                            Delegation: <TxLink hash={rental.delegationTxHash} />
                          </span>
                        )}
                        {rental.releaseTxHash && (
                          <span className="text-xs text-muted-foreground">
                            Release: <TxLink hash={rental.releaseTxHash} />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    {rental.status === "PAYMENT_DEPOSITED" && (
                      <DelegateButton
                        axieId={rental.listing.axieId}
                        borrowerAddress={rental.borrower.walletAddress}
                        rentalDays={rental.rentalDays}
                        rentalId={rental.id}
                      />
                    )}
                    {rental.status === "DELEGATION_CONFIRMED" && (
                      <ConfirmReleaseButton rentalId={rental.id} />
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
