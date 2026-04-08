"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { useState } from "react";
import { AxieImage } from "@/components/axie/axie-image";

interface TeamListingAxie {
  axieId: string;
  axieClass: string | null;
  axieName: string | null;
  fortuneSlips: number | null;
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
  owner: { walletAddress: string };
}

export default function TeamMarketplacePage() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["team-listings", search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`/api/team-listings?${params}`);
      return res.json() as Promise<{ listings: TeamListing[] }>;
    },
  });

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Team Marketplace</h1>
        <p className="text-muted-foreground">Rent a full Axie team — multiple Axies in one deal.</p>
      </div>

      {/* Search */}
      <div className="mb-8 max-w-sm">
        <Input
          placeholder="Search by team name or Axie..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-64" />)}
        </div>
      ) : !data?.listings?.length ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground font-medium">No team listings available.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.listings.map((listing) => (
            <Link key={listing.id} href={`/marketplace/teams/${listing.id}`}>
              <Card className="overflow-hidden bg-white border border-[#E7E5E4] rounded-2xl hover:shadow-md transition-shadow duration-200 cursor-pointer group h-full flex flex-col">
                <CardHeader className="p-0">
                  <div className="bg-[#F5F5F4] h-44 relative overflow-hidden">
                    {/* Overlapping axie thumbnails */}
                    <div className="flex items-end justify-center h-full pb-1">
                      {listing.axies.slice(0, listing.axies.length > 4 ? 3 : 4).map((axie, idx, arr) => (
                        <div
                          key={axie.axieId}
                          className="relative"
                          style={{
                            marginLeft: idx === 0 ? 0 : -28,
                            zIndex: arr.length - idx,
                          }}
                        >
                          <AxieImage
                            axieId={axie.axieId}
                            width={110}
                            height={110}
                            className="group-hover:scale-105 transition-transform duration-300 drop-shadow-md"
                          />
                        </div>
                      ))}
                      {listing.axies.length > 4 && (
                        <div
                          className="relative w-[72px] h-[72px] rounded-full bg-[#0D0C0B]/80 flex items-center justify-center text-sm font-bold text-white shrink-0"
                          style={{ marginLeft: -20, zIndex: 0 }}
                        >
                          +{listing.axies.length - 3}
                        </div>
                      )}
                    </div>
                    {listing.pendingOfferCount > 0 && (
                      <span className="absolute top-2 left-2 bg-white/90 text-[10px] font-semibold px-1.5 py-0.5 rounded-md border border-[#E7E5E4]">
                        {listing.pendingOfferCount} offer{listing.pendingOfferCount !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-4 flex-1">
                  <h3 className="font-semibold text-base text-[#0D0C0B] leading-tight truncate mb-1">
                    {listing.name || `Team of ${listing.axies.length}`}
                  </h3>
                  <p className="text-xs text-muted-foreground mb-2">
                    {listing.axies.length} Axies · {listing.minDays}–{listing.maxDays} days
                  </p>
                  <p className="font-extrabold text-xl text-[#0D0C0B] tracking-tight">
                    {listing.pricePerDay}{" "}
                    <span className="text-sm font-normal text-[#78716C]">USDC/day</span>
                  </p>
                </CardContent>
                <CardFooter className="p-4 pt-0">
                  <Badge variant="outline" className="text-xs">
                    {listing.owner.walletAddress.slice(0, 6)}…{listing.owner.walletAddress.slice(-4)}
                  </Badge>
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
