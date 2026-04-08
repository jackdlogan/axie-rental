"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useAuth } from "@/components/providers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import Link from "next/link";
import { AxieImage } from "@/components/axie/axie-image";
import { AxieClassIcon } from "@/components/axie/axie-class-icon";
import { TeamRentButton } from "@/components/rental/team-rent-button";

interface TeamListingAxie {
  id: string;
  axieId: string;
  axieClass: string | null;
  axieName: string | null;
  fortuneSlips: number | null;
}

interface TeamListingDetail {
  id: string;
  name: string | null;
  pricePerDay: string;
  minDays: number;
  maxDays: number;
  status: string;
  axies: TeamListingAxie[];
  owner: { walletAddress: string };
}

export default function TeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isLoggedIn, walletAddress: address } = useAuth();
  const [rentalDays, setRentalDays] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["team-listing", id],
    queryFn: async () => {
      const res = await fetch(`/api/team-listings/${id}`);
      return res.json() as Promise<{ listing: TeamListingDetail }>;
    },
  });

  const listing = data?.listing;
  const isOwner = address?.toLowerCase() === listing?.owner.walletAddress.toLowerCase();
  const totalPrice = listing ? (parseFloat(listing.pricePerDay) * rentalDays).toFixed(6) : "0";

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-10 max-w-4xl">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="container mx-auto px-4 py-10 text-center">
        <p className="text-muted-foreground">Team listing not found.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-4xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Axies grid */}
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {listing.axies.map((axie) => (
              <Card key={axie.id} className="overflow-hidden">
                <CardContent className="p-2 flex flex-col items-center">
                  <div className="bg-muted rounded-lg w-full flex items-center justify-center h-20 mb-2 overflow-hidden">
                    <AxieImage axieId={axie.axieId} width={72} height={72} />
                  </div>
                  <div className="flex items-center gap-1 w-full justify-center">
                    <p className="text-xs font-medium text-center truncate">
                      {axie.axieName || `#${axie.axieId}`}
                    </p>
                    <Link
                      href={`https://app.axieinfinity.com/marketplace/axies/${axie.axieId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-[#A8A29E] hover:text-[#F97316] transition-colors"
                      title="View on Axie Marketplace"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    </Link>
                  </div>
                  {axie.axieClass && (
                    <span className="flex items-center gap-0.5 text-xs text-muted-foreground mt-0.5">
                      <AxieClassIcon axieClass={axie.axieClass} size={11} />
                      {axie.axieClass}
                    </span>
                  )}
                  {axie.fortuneSlips != null && (
                    <Badge variant="secondary" className="text-xs mt-1">{axie.fortuneSlips} slips</Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-sm text-muted-foreground text-center">
            {listing.axies.length} Axies in this team
          </p>
        </div>

        {/* Rental form */}
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold mb-1">
              {listing.name || `Team of ${listing.axies.length}`}
            </h1>
            <p className="text-sm text-muted-foreground">
              Owner: <span className="font-mono">{listing.owner.walletAddress.slice(0, 6)}…{listing.owner.walletAddress.slice(-4)}</span>
            </p>
          </div>

          <Separator />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Pricing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Price per day</span>
                <span className="font-semibold">{listing.pricePerDay} USDC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Min / Max days</span>
                <span>{listing.minDays} – {listing.maxDays} days</span>
              </div>
            </CardContent>
          </Card>

          {listing.status !== "ACTIVE" ? (
            <Badge variant="secondary" className="w-full justify-center py-2 text-sm">
              {listing.status === "RENTED" ? "Currently Rented" : listing.status}
            </Badge>
          ) : isOwner ? (
            <Badge variant="outline" className="w-full justify-center py-2 text-sm">
              This is your listing
            </Badge>
          ) : !isLoggedIn ? (
            <p className="text-sm text-muted-foreground text-center">Connect your wallet to place an offer.</p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Rental Duration</Label>
                <Input
                  type="number"
                  min={listing.minDays}
                  max={listing.maxDays}
                  value={rentalDays}
                  onChange={(e) => setRentalDays(Math.max(listing.minDays, Math.min(listing.maxDays, Number(e.target.value))))}
                />
                <p className="text-xs text-muted-foreground">
                  {listing.minDays}–{listing.maxDays} days allowed
                </p>
              </div>
              <div className="flex justify-between text-sm font-semibold">
                <span>Total</span>
                <span>{parseFloat(totalPrice).toFixed(2)} USDC</span>
              </div>
              <TeamRentButton
                teamListingId={listing.id}
                ownerAddress={listing.owner.walletAddress}
                axieIds={listing.axies.map((a) => a.axieId)}
                rentalDays={rentalDays}
                totalPrice={totalPrice}
                onSuccess={() => window.location.href = "/dashboard/my-team-rentals"}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
