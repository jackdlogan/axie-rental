"use client";

import { useAuth } from "@/components/providers";
import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";

interface Axie {
  id: string;
  name: string;
  class: string;
  image: string;
}

export default function CreateListingPage() {
  const { isLoggedIn } = useAuth();
  const params = useParams();
  const router = useRouter();
  const axieId = params.axieId as string;

  const [pricePerDay, setPricePerDay] = useState("");
  const [minDays, setMinDays] = useState(1);
  const [maxDays, setMaxDays] = useState(30);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: axie } = useQuery({
    queryKey: ["axie", axieId],
    queryFn: async () => {
      const res = await fetch(`/api/axies/${axieId}`);
      if (!res.ok) return null;
      return res.json() as Promise<Axie>;
    },
  });

  if (!isLoggedIn) {
    return (
      <p className="text-muted-foreground text-center py-12">
        Connect your wallet to list Axies.
      </p>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(pricePerDay);
    if (!price || price <= 0) {
      toast.error("Please enter a valid price");
      return;
    }
    if (minDays > maxDays) {
      toast.error("Min days cannot exceed max days");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ axieId, pricePerDay: price, minDays, maxDays }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Listing created!");
        router.push("/dashboard/my-listings");
      } else {
        toast.error(data.error || "Failed to create listing");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold mb-8">List Axie for Rent</h1>

      <div className="space-y-6">
        {/* Axie preview */}
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-24 h-24 bg-muted rounded-lg flex items-center justify-center shrink-0">
              {axie?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={axie.image}
                  alt={`Axie #${axieId}`}
                  className="w-full h-full object-contain p-2"
                />
              ) : (
                <span className="text-sm text-muted-foreground">
                  #{axieId}
                </span>
              )}
            </div>
            <div>
              <h2 className="font-semibold text-lg">
                {axie?.name || `Axie #${axieId}`}
              </h2>
              {axie?.class && (
                <p className="text-muted-foreground">{axie.class}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Rental Terms</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="price">Price per Day (USDC)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="e.g. 1.50"
                  value={pricePerDay}
                  onChange={(e) => setPricePerDay(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="minDays">Min Days</Label>
                  <Input
                    id="minDays"
                    type="number"
                    min={1}
                    value={minDays}
                    onChange={(e) => setMinDays(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxDays">Max Days</Label>
                  <Input
                    id="maxDays"
                    type="number"
                    min={1}
                    value={maxDays}
                    onChange={(e) => setMaxDays(Number(e.target.value))}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Listing"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
