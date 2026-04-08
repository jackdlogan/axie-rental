"use client";

import { useAuth } from "@/components/providers";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";
import { AxieImage } from "@/components/axie/axie-image";
import { AxieClassIcon } from "@/components/axie/axie-class-icon";
import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface Axie {
  id: string;
  name: string;
  class: string;
  newGenes: string;
}

export default function MyAxiesPage() {
  const { isLoggedIn, walletAddress } = useAuth();
  const router = useRouter();

  // Team creation mode
  const [teamMode, setTeamMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [teamName, setTeamName] = useState("");
  const [pricePerDay, setPricePerDay] = useState("");
  const [minDays, setMinDays] = useState(1);
  const [maxDays, setMaxDays] = useState(30);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["my-axies", walletAddress],
    queryFn: async () => {
      const res = await fetch(`/api/axies?owner=${walletAddress}`);
      return res.json() as Promise<{ axies: Axie[]; total: number }>;
    },
    enabled: !!walletAddress,
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateTeam = async () => {
    if (selectedIds.size === 0) {
      toast.error("Select at least one Axie");
      return;
    }
    if (!pricePerDay || isNaN(parseFloat(pricePerDay))) {
      toast.error("Enter a valid price per day");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/team-listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          axieIds: Array.from(selectedIds),
          name: teamName || undefined,
          pricePerDay: parseFloat(pricePerDay),
          minDays,
          maxDays,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to create team listing");
        return;
      }
      toast.success("Team listing created!");
      router.push("/dashboard/my-teams");
    } catch {
      toast.error("Failed to create team listing");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <p className="text-muted-foreground text-center py-12">
        Connect your wallet to view your Axies.
      </p>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">My Axies</h1>
          <p className="text-muted-foreground text-sm mt-1">{data?.total ?? 0} Axies</p>
        </div>
        <Button
          variant={teamMode ? "default" : "outline"}
          onClick={() => {
            setTeamMode((v) => !v);
            setSelectedIds(new Set());
          }}
        >
          {teamMode ? "Cancel Team" : "Create Team Listing"}
        </Button>
      </div>

      {/* Team creation panel */}
      {teamMode && (
        <Card className="mb-6 border-primary/30 bg-primary/5">
          <CardContent className="p-4 space-y-4">
            <p className="text-sm font-medium">
              Select Axies below, then fill in the details.{" "}
              <span className="text-muted-foreground">({selectedIds.size} selected)</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Team Name (optional)</Label>
                <Input
                  placeholder="e.g. Beast Attack Team"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Price per Day (USDC)</Label>
                <Input
                  type="number"
                  min={0.1}
                  step={0.1}
                  placeholder="e.g. 5.00"
                  value={pricePerDay}
                  onChange={(e) => setPricePerDay(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Min Days</Label>
                <Input
                  type="number"
                  min={1}
                  value={minDays}
                  onChange={(e) => setMinDays(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label>Max Days</Label>
                <Input
                  type="number"
                  min={minDays}
                  max={90}
                  value={maxDays}
                  onChange={(e) => setMaxDays(Number(e.target.value))}
                />
              </div>
            </div>
            <Button
              onClick={handleCreateTeam}
              disabled={isSubmitting || selectedIds.size === 0}
              className="w-full"
            >
              {isSubmitting ? "Creating..." : `Create Team Listing (${selectedIds.size} Axies)`}
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <Skeleton className="h-48" />
              <CardContent className="p-4"><Skeleton className="h-4 w-24" /></CardContent>
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
          {data?.axies?.map((axie) => {
            const isSelected = selectedIds.has(axie.id);
            return (
              <Card
                key={axie.id}
                className={cn(
                  "overflow-hidden transition-all",
                  teamMode && "cursor-pointer",
                  teamMode && isSelected && "ring-2 ring-primary"
                )}
                onClick={teamMode ? () => toggleSelect(axie.id) : undefined}
              >
                <CardHeader className="p-0 relative">
                  <div className="h-48 bg-muted flex items-center justify-center">
                    <AxieImage axieId={axie.id} name={axie.name} width={180} height={180} />
                  </div>
                  {teamMode && isSelected && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold truncate">{axie.name || `Axie #${axie.id}`}</h3>
                    {axie.class && (
                      <Badge variant="secondary" className="ml-2 shrink-0 flex items-center gap-1">
                        <AxieClassIcon axieClass={axie.class} size={13} />
                        {axie.class}
                      </Badge>
                    )}
                  </div>
                </CardContent>
                {!teamMode && (
                  <CardFooter className="p-4 pt-0">
                    <Link
                      href={`/dashboard/my-axies/${axie.id}/list`}
                      className={cn(buttonVariants({ variant: "outline" }), "w-full justify-center")}
                    >
                      List for Rent
                    </Link>
                  </CardFooter>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
