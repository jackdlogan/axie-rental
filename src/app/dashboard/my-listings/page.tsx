"use client";

import { useAuth } from "@/components/providers";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/lib/button-variants";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AxieImage } from "@/components/axie/axie-image";

interface Listing {
  id: string;
  axieId: string;
  axieClass: string | null;
  axieName: string | null;
  axieGenes: string | null;
  pricePerDay: string;
  minDays: number;
  maxDays: number;
  status: "ACTIVE" | "RENTED" | "PAUSED" | "CANCELLED";
}

const STATUS_VARIANT: Record<
  Listing["status"],
  "default" | "secondary" | "outline" | "destructive"
> = {
  ACTIVE: "default",
  RENTED: "secondary",
  PAUSED: "outline",
  CANCELLED: "destructive",
};

export default function MyListingsPage() {
  const { isLoggedIn } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["my-listings"],
    queryFn: async () => {
      const res = await fetch("/api/listings?mine=true");
      return res.json() as Promise<{ listings: Listing[] }>;
    },
    enabled: isLoggedIn,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/listings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-listings"] });
      toast.success("Listing updated");
    },
    onError: () => toast.error("Failed to update listing"),
  });

  if (!isLoggedIn) {
    return (
      <p className="text-muted-foreground text-center py-12">
        Connect your wallet to view your listings.
      </p>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8 gap-4">
        <h1 className="text-3xl font-bold">My Listings</h1>
        <Link href="/dashboard/my-axies" className={cn(buttonVariants({ variant: "outline" }), "shrink-0")}>
          + New Listing
        </Link>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : !data?.listings?.length ? (
        <p className="text-muted-foreground text-center py-12">
          No listings yet.{" "}
          <Link href="/dashboard/my-axies" className="underline">
            List an Axie
          </Link>
        </p>
      ) : (
        <div className="space-y-4">
          {data.listings.map((listing) => (
            <Card key={listing.id}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-16 h-16 bg-muted rounded flex items-center justify-center shrink-0 overflow-hidden">
                  <AxieImage axieId={listing.axieId} name={listing.axieName ?? undefined} width={64} height={64} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">
                      {listing.axieName || `Axie #${listing.axieId}`}
                    </h3>
                    <Badge variant={STATUS_VARIANT[listing.status]}>
                      {listing.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {listing.pricePerDay} USDC/day &middot; {listing.minDays}–
                    {listing.maxDays} days
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                  {listing.status === "ACTIVE" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        updateMutation.mutate({
                          id: listing.id,
                          status: "PAUSED",
                        })
                      }
                      disabled={updateMutation.isPending}
                    >
                      Pause
                    </Button>
                  )}
                  {listing.status === "PAUSED" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        updateMutation.mutate({
                          id: listing.id,
                          status: "ACTIVE",
                        })
                      }
                      disabled={updateMutation.isPending}
                    >
                      Resume
                    </Button>
                  )}
                  {(listing.status === "ACTIVE" ||
                    listing.status === "PAUSED") && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() =>
                        updateMutation.mutate({
                          id: listing.id,
                          status: "CANCELLED",
                        })
                      }
                      disabled={updateMutation.isPending}
                    >
                      Cancel
                    </Button>
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
