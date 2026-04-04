"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";
import { useState } from "react";
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

  const { data, isLoading } = useQuery({
    queryKey: ["listings", classFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (classFilter !== "All") params.set("class", classFilter);
      if (search) params.set("search", search);
      const res = await fetch(`/api/listings?${params}`);
      return res.json() as Promise<{ listings: Listing[] }>;
    },
  });

  return (
    <div className="container mx-auto px-4 py-10">
      {/* Page header */}
      <div className="flex items-baseline gap-4 mb-8 border-b border-border pb-4">
        <h1 className="font-heading text-3xl font-700 tracking-tight">Marketplace</h1>
        <span className="text-xs uppercase tracking-widest text-muted-foreground">
          Available Axies
        </span>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-8 flex-wrap">
        <Input
          placeholder="Search by Axie ID or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs bg-card border-border"
        />
        <Select value={classFilter} onValueChange={(v) => setClassFilter(v ?? "All")}>
          <SelectTrigger className="w-36 bg-card border-border cursor-pointer">
            <SelectValue placeholder="Class" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            {AXIE_CLASSES.map((c) => (
              <SelectItem key={c} value={c} className="cursor-pointer">
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="overflow-hidden border-border bg-card">
              <CardHeader className="p-0">
                <Skeleton className="h-44 w-full rounded-none" />
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
            <p className="col-span-full text-center text-muted-foreground py-16 font-heading text-lg">
              No listings found. Be the first to list an Axie!
            </p>
          )}
          {data?.listings?.map((listing) => (
            <Card
              key={listing.id}
              className="overflow-hidden border-border bg-card hover:paper-shadow transition-shadow duration-200 cursor-pointer group"
            >
              <CardHeader className="p-0">
                <div className="h-44 bg-muted flex items-center justify-center overflow-hidden">
                  <AxieImage
                    axieId={listing.axieId}
                    name={listing.axieName ?? undefined}
                    width={180}
                    height={176}
                    className="group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2 gap-2">
                  <h3 className="font-heading font-600 text-base leading-tight truncate">
                    {listing.axieName || `Axie #${listing.axieId}`}
                  </h3>
                  {listing.axieClass && (
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {listing.axieClass}
                    </Badge>
                  )}
                </div>
                <p className="font-heading text-xl font-700 text-foreground">
                  {listing.pricePerDay}{" "}
                  <span className="text-sm font-body font-400 text-muted-foreground">USDC/day</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {listing.minDays}–{listing.maxDays} days
                </p>
              </CardContent>
              <CardFooter className="p-4 pt-0">
                <Link
                  href={`/axie/${listing.axieId}`}
                  className={cn(buttonVariants({ variant: "outline" }), "w-full justify-center cursor-pointer text-sm")}
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
