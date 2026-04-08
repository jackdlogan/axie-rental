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
import { AxieImage } from "@/components/axie/axie-image";
import { AxieClassIcon } from "@/components/axie/axie-class-icon";
import Link from "next/link";
import { RentButton } from "@/components/rental/rent-button";

interface AxieDetail {
  id: string;
  name: string;
  class: string;
  newGenes: string;
  parts: { id: string; name: string; class: string; type: string }[];
  stats: { hp: number; speed: number; skill: number; morale: number };
  fortuneSlips?: { total: number; potentialAmount: number };
}

interface ListingDetail {
  id: string;
  axieId: string;
  pricePerDay: string;
  minDays: number;
  maxDays: number;
  status: string;
  pendingOfferCount: number;
  owner: { walletAddress: string };
}

export default function AxieDetailPage() {
  const params = useParams();
  const axieId = params.axieId as string;
  const { isLoggedIn, walletAddress } = useAuth();
  const [rentalDays, setRentalDays] = useState(1);

  const { data: axie, isLoading: axieLoading } = useQuery({
    queryKey: ["axie", axieId],
    queryFn: async () => {
      const res = await fetch(`/api/axies/${axieId}`);
      if (!res.ok) return null;
      return res.json() as Promise<AxieDetail>;
    },
  });

  const { data: listingData, isLoading: listingLoading } = useQuery({
    queryKey: ["listing-by-axie", axieId],
    queryFn: async () => {
      const res = await fetch(`/api/listings?axieId=${axieId}`);
      const data = await res.json();
      return (data.listings?.[0] as ListingDetail) ?? null;
    },
  });

  const listing = listingData;
  const totalPrice = listing
    ? (parseFloat(listing.pricePerDay) * rentalDays).toFixed(2)
    : "0";
  const isOwner =
    walletAddress &&
    listing?.owner?.walletAddress === walletAddress;

  if (axieLoading || listingLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-8">
          <Skeleton className="h-96" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid md:grid-cols-2 gap-8">
        {/* Image */}
        <Card>
          <CardContent className="p-8 flex items-center justify-center min-h-96">
            <AxieImage axieId={axieId} name={axie?.name} width={320} height={320} />
          </CardContent>
        </Card>

        {/* Details */}
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              {axie?.name || `Axie #${axieId}`}
            </h1>
            <div className="flex items-center gap-2 flex-wrap">
              {axie?.class && (
                <Badge className="flex items-center gap-1">
                  <AxieClassIcon axieClass={axie.class} size={14} />
                  {axie.class}
                </Badge>
              )}
              <Link
                href={`https://app.axieinfinity.com/marketplace/axies/${axieId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#78716C] hover:text-[#F97316] transition-colors duration-150 flex items-center gap-1"
              >
                View on Marketplace
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              </Link>
            </div>
          </div>

          {axie?.stats && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4 text-center">
                  {Object.entries(axie.stats).map(([key, value]) => (
                    <div key={key}>
                      <p className="text-lg font-bold">{value}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {key}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {axie?.fortuneSlips != null && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[#E7E5E4] bg-[#F5F5F4]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://cdn.axieinfinity.com/marketplace-website/asset-icon/fortune-slip.png"
                alt="Fortune Slip"
                width={32}
                height={32}
                className="shrink-0"
              />
              <div>
                <p className="text-sm font-semibold text-[#0D0C0B]">
                  {axie.fortuneSlips.total} Fortune Slip{axie.fortuneSlips.total !== 1 ? "s" : ""}
                </p>
                <p className="text-xs text-[#78716C]">
                  ~{axie.fortuneSlips.potentialAmount} potential
                </p>
              </div>
            </div>
          )}

          {axie?.parts && axie.parts.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Parts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {axie.parts.map((part) => (
                    <div key={part.id} className="flex justify-between text-sm">
                      <span className="text-muted-foreground capitalize">
                        {part.type}
                      </span>
                      <span>{part.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Separator />

          {listing && listing.status === "ACTIVE" ? (
            <Card>
              <CardHeader>
                <CardTitle>Rent This Axie</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Price per day</span>
                  <span className="font-bold">{listing.pricePerDay} USDC</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Duration</span>
                  <span>
                    {listing.minDays}–{listing.maxDays} days
                  </span>
                </div>
                {listing.pendingOfferCount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Pending offers</span>
                    <span className="font-semibold text-[#F97316]">
                      {listing.pendingOfferCount} offer{listing.pendingOfferCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                )}
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="days">Rental Days</Label>
                  <Input
                    id="days"
                    type="number"
                    min={listing.minDays}
                    max={listing.maxDays}
                    value={rentalDays}
                    onChange={(e) => setRentalDays(Number(e.target.value))}
                  />
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{totalPrice} USDC</span>
                </div>
                {isOwner ? (
                  <p className="text-sm text-muted-foreground text-center">
                    You own this listing
                  </p>
                ) : isLoggedIn ? (
                  <RentButton
                    listingId={listing.id}
                    axieId={axieId}
                    ownerAddress={listing.owner.walletAddress}
                    rentalDays={rentalDays}
                    totalPrice={totalPrice}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground text-center">
                    Connect your wallet to rent
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No active listing for this Axie
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
