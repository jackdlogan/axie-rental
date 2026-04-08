"use client";

import { useAuth } from "@/components/providers";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { AxieImage } from "@/components/axie/axie-image";
import { AxieClassIcon } from "@/components/axie/axie-class-icon";
import { toast } from "sonner";

interface TeamListingAxie {
  id: string;
  axieId: string;
  axieClass: string | null;
  axieName: string | null;
}

interface TeamListing {
  id: string;
  name: string | null;
  pricePerDay: string;
  minDays: number;
  maxDays: number;
  status: string;
  pendingOfferCount: number;
  axies: TeamListingAxie[];
}

export default function MyTeamsPage() {
  const { isLoggedIn } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["my-teams"],
    queryFn: async () => {
      const res = await fetch("/api/team-listings?mine=true");
      return res.json() as Promise<{ listings: TeamListing[] }>;
    },
    enabled: isLoggedIn,
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/team-listings/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to cancel");
    },
    onSuccess: () => {
      toast.success("Team listing cancelled.");
      qc.invalidateQueries({ queryKey: ["my-teams"] });
    },
    onError: () => toast.error("Failed to cancel listing"),
  });

  if (!isLoggedIn) {
    return <p className="text-muted-foreground text-center py-12">Connect your wallet to manage your teams.</p>;
  }

  const activeListings = data?.listings?.filter((l) => l.status === "ACTIVE" || l.status === "RENTED") ?? [];
  const pastListings = data?.listings?.filter((l) => l.status === "CANCELLED") ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1">My Teams</h1>
          <p className="text-muted-foreground text-sm">List a team of Axies for rent as a bundle.</p>
        </div>
        <Link href="/dashboard/my-axies">
          <Button>Create Team Listing</Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : !activeListings.length ? (
        <div className="text-center py-16 space-y-3">
          <p className="text-muted-foreground font-medium">No active team listings.</p>
          <p className="text-sm text-muted-foreground">Go to My Axies to create a team listing.</p>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeListings.map((listing) => (
              <Card key={listing.id} className="overflow-hidden">
                <CardHeader className="p-4 pb-3 border-b bg-muted/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{listing.name || `Team (${listing.axies.length} Axies)`}</p>
                      <p className="text-sm text-muted-foreground">{listing.pricePerDay} USDC/day</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant={listing.status === "RENTED" ? "default" : "secondary"}>
                        {listing.status}
                      </Badge>
                      {listing.pendingOfferCount > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {listing.pendingOfferCount} offer{listing.pendingOfferCount !== 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="flex flex-wrap gap-2">
                    {listing.axies.map((axie) => (
                      <div key={axie.id} className="flex flex-col items-center gap-1">
                        <div className="w-14 h-14 bg-muted rounded-lg overflow-hidden flex items-center justify-center">
                          <AxieImage axieId={axie.axieId} width={56} height={56} />
                        </div>
                        {axie.axieClass && (
                          <AxieClassIcon axieClass={axie.axieClass} size={12} />
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    {listing.minDays}–{listing.maxDays} days · {listing.axies.length} Axies
                  </p>
                </CardContent>
                <CardFooter className="p-4 pt-0 flex gap-2">
                  {listing.pendingOfferCount > 0 && (
                    <Link href="/dashboard/pending-team-rentals" className="flex-1">
                      <Button variant="outline" className="w-full">View Offers</Button>
                    </Link>
                  )}
                  {listing.status === "ACTIVE" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive cursor-pointer"
                      onClick={() => cancelMutation.mutate(listing.id)}
                      disabled={cancelMutation.isPending}
                    >
                      Cancel
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>

          {pastListings.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-3">Past Listings</p>
              <div className="space-y-2">
                {pastListings.map((listing) => (
                  <div key={listing.id} className="flex items-center justify-between p-3 border rounded-lg opacity-60">
                    <span className="text-sm">{listing.name || `Team (${listing.axies.length} Axies)`}</span>
                    <Badge variant="outline">{listing.status}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
