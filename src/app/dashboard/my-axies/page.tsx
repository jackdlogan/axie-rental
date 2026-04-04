"use client";

import { useAuth } from "@/components/providers";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";
import { AxieImage } from "@/components/axie/axie-image";

interface Axie {
  id: string;
  name: string;
  class: string;
  newGenes: string;
}

export default function MyAxiesPage() {
  const { isLoggedIn, walletAddress } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["my-axies", walletAddress],
    queryFn: async () => {
      const res = await fetch(`/api/axies?owner=${walletAddress}`);
      return res.json() as Promise<{ axies: Axie[]; total: number }>;
    },
    enabled: !!walletAddress,
  });

  if (!isLoggedIn) {
    return (
      <p className="text-muted-foreground text-center py-12">
        Connect your wallet to view your Axies.
      </p>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">My Axies</h1>
        <p className="text-muted-foreground text-sm">
          {data?.total ?? 0} Axies
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <Skeleton className="h-48" />
              <CardContent className="p-4">
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {(!data?.axies || data.axies.length === 0) && (
            <p className="col-span-full text-center text-muted-foreground py-12">
              No Axies found for this wallet.
            </p>
          )}
          {data?.axies?.map((axie) => (
            <Card key={axie.id} className="overflow-hidden">
              <CardHeader className="p-0">
                <div className="h-48 bg-muted flex items-center justify-center">
                  <AxieImage axieId={axie.id} name={axie.name} width={180} height={180} />
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold truncate">
                    {axie.name || `Axie #${axie.id}`}
                  </h3>
                  {axie.class && (
                    <Badge variant="secondary" className="ml-2 shrink-0">
                      {axie.class}
                    </Badge>
                  )}
                </div>
              </CardContent>
              <CardFooter className="p-4 pt-0">
                <Link href={`/dashboard/my-axies/${axie.id}/list`} className={cn(buttonVariants({ variant: "outline" }), "w-full justify-center")}>
                  List for Rent
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
