"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { AxieImage } from "@/components/axie/axie-image";
import { AxieClassIcon } from "@/components/axie/axie-class-icon";

interface Listing {
  id: string;
  axieId: string;
  axieClass: string | null;
  axieName: string | null;
  axieGenes: string | null;
  fortuneSlips: number | null;
  pricePerDay: string;
  minDays: number;
  maxDays: number;
  status: string;
  owner: { walletAddress: string };
}

const AXIE_CLASSES = [
  "All", "Beast", "Aquatic", "Plant", "Bird",
  "Bug", "Reptile", "Mech", "Dawn", "Dusk",
];

export default function MarketplacePage() {
  const [classFilter, setClassFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [minSlips, setMinSlips] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["listings", classFilter, search, minSlips],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (classFilter !== "All") params.set("class", classFilter);
      if (search) params.set("search", search);
      if (minSlips !== null) params.set("minFortuneSlips", String(minSlips));
      const res = await fetch(`/api/listings?${params}`);
      return res.json() as Promise<{ listings: Listing[] }>;
    },
  });

  return (
    <div className="container mx-auto px-4 py-10">
      {/* Page header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-[#0D0C0B] tracking-[-0.03em] mb-1">Marketplace</h1>
          <p className="text-sm text-[#78716C]">Browse available Axies for rent on Ronin</p>
        </div>
        <Link href="/marketplace/teams" className="text-sm font-medium text-primary hover:underline">
          Browse Team Listings →
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 mb-8">
        <Input
          placeholder="Search by Axie ID or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs bg-[#F5F5F4] border-[#E7E5E4] focus:border-[#F97316] focus:ring-[#F97316]"
        />
        {/* Pill filter buttons */}
        <div className="flex gap-2 flex-wrap">
          {AXIE_CLASSES.map((c) => (
            <button
              key={c}
              onClick={() => setClassFilter(c)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer",
                classFilter === c
                  ? "bg-[#0D0C0B] text-white"
                  : "border border-[#E7E5E4] text-[#78716C] hover:border-[#0D0C0B] hover:text-[#0D0C0B]"
              )}
            >
              {c}
            </button>
          ))}
        </div>
        {/* Fortune slips filter */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://cdn.axieinfinity.com/marketplace-website/asset-icon/fortune-slip.png"
            alt="Fortune Slip"
            width={18}
            height={18}
          />
          <span className="text-sm text-[#78716C]">Min Fortune Slips:</span>
          {[null, 1, 5, 20, 80].map((val) => (
            <button
              key={val ?? "any"}
              onClick={() => setMinSlips(val)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer",
                minSlips === val
                  ? "bg-[#F97316] text-white"
                  : "border border-[#E7E5E4] text-[#78716C] hover:border-[#F97316] hover:text-[#F97316]"
              )}
            >
              {val === null ? "Any" : `${val}+`}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="overflow-hidden border-[#E7E5E4] bg-white rounded-2xl">
              <CardHeader className="p-0">
                <Skeleton className="h-40 w-full rounded-none" />
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {data?.listings?.length === 0 && (
            <p className="col-span-full text-center text-[#78716C] py-16 text-lg">
              No listings found. Be the first to list an Axie!
            </p>
          )}
          {data?.listings?.map((listing) => (
            <Card
              key={listing.id}
              className="overflow-hidden bg-white border border-[#E7E5E4] rounded-2xl hover:shadow-md transition-shadow duration-200 cursor-pointer group"
            >
              <CardHeader className="p-0">
                <div className="bg-[#F5F5F4] h-40 flex items-center justify-center overflow-hidden relative">
                  <AxieImage
                    axieId={listing.axieId}
                    name={listing.axieName ?? undefined}
                    width={180}
                    height={160}
                    className="group-hover:scale-105 transition-transform duration-300"
                  />
                  {listing.axieClass && (
                    <span className="absolute top-2 right-2 flex items-center gap-1 bg-[#0D0C0B] text-white text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-md">
                      <AxieClassIcon axieClass={listing.axieClass} size={14} />
                      {listing.axieClass}
                    </span>
                  )}
                  {listing.fortuneSlips != null && (
                    <span className="absolute bottom-2 left-2 flex items-center gap-1 bg-white/90 backdrop-blur-sm border border-[#E7E5E4] text-[#0D0C0B] text-[10px] font-semibold px-1.5 py-0.5 rounded-md">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="https://cdn.axieinfinity.com/marketplace-website/asset-icon/fortune-slip.png"
                        alt=""
                        width={12}
                        height={12}
                      />
                      {listing.fortuneSlips}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <h3 className="font-semibold text-base text-[#0D0C0B] leading-tight truncate mb-2">
                  {listing.axieName || `Axie #${listing.axieId}`}
                </h3>
                <p className="font-extrabold text-xl text-[#0D0C0B] tracking-tight">
                  {listing.pricePerDay}{" "}
                  <span className="text-sm font-normal text-[#78716C]">USDC/day</span>
                </p>
                <p className="text-xs text-[#78716C] mt-1">
                  {listing.minDays}–{listing.maxDays} days
                </p>
              </CardContent>
              <CardFooter className="p-4 pt-0">
                <Link
                  href={`/axie/${listing.axieId}`}
                  className="w-full inline-flex items-center justify-center px-4 py-2 rounded-lg bg-[#F97316] text-white font-semibold text-sm hover:bg-[#EA6C0A] transition-colors"
                >
                  View Details
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
