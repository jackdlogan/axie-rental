"use client";

import { useAuth } from "@/components/providers";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TxLink } from "@/components/ui/tx-link";

interface Rental {
  id: string;
  totalPrice: string;
  status: string;
  createdAt: string;
  releaseTxHash: string | null;
  listing: { axieId: string; axieName: string | null };
}

export default function EarningsPage() {
  const { isLoggedIn } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["earnings"],
    queryFn: async () => {
      const res = await fetch("/api/rentals?role=owner");
      return res.json() as Promise<{ rentals: Rental[] }>;
    },
    enabled: isLoggedIn,
  });

  if (!isLoggedIn) {
    return (
      <p className="text-muted-foreground text-center py-12">
        Connect your wallet to view earnings.
      </p>
    );
  }

  const completedRentals =
    data?.rentals?.filter(
      (r) => r.status === "ACTIVE" || r.status === "COMPLETED"
    ) ?? [];

  const totalEarnings = completedRentals.reduce(
    (sum, r) => sum + parseFloat(r.totalPrice) * 0.975,
    0
  );

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Earnings</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Earnings (after 2.5% fee)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {totalEarnings.toFixed(2)} USDC
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completed Rentals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{completedRentals.length}</p>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-xl font-semibold mb-4">History</h2>
      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : completedRentals.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto w-12 h-12 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-muted-foreground font-medium">No earnings yet.</p>
          <p className="text-sm text-muted-foreground">Complete a rental to see your earnings here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {completedRentals.map((rental) => (
            <Card key={rental.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">
                    {rental.listing.axieName || `Axie #${rental.listing.axieId}`}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {new Date(rental.createdAt).toLocaleDateString()}
                  </p>
                  {rental.releaseTxHash && (
                    <TxLink hash={rental.releaseTxHash} label="View tx" />
                  )}
                </div>
                <p className="font-bold text-green-600 dark:text-green-400">
                  +{(parseFloat(rental.totalPrice) * 0.975).toFixed(2)} USDC
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
