"use client";

import { useAuth } from "@/components/providers";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface PendingRental {
  id: string;
  status: string;
  delegationDeadline: string | null;
  endDate: string | null;
  listing: { axieId: string; axieName: string | null };
}

function msUntil(iso: string) {
  return new Date(iso).getTime() - Date.now();
}

function deadlineLabel(deadline: string) {
  const ms = msUntil(deadline);
  if (ms <= 0) return { text: "Deadline passed", urgent: true };
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return {
    text: h >= 1 ? `${h}h ${m}m left to delegate` : `${m}m left to delegate`,
    urgent: h < 2,
  };
}

function expiryLabel(endDate: string) {
  const ms = msUntil(endDate);
  if (ms <= 0) return { text: "Delegation expired — release now", urgent: true };
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  return {
    text: d >= 1 ? `Delegation expires in ${d}d ${h}h` : `Delegation expires in ${h}h`,
    urgent: d < 1,
  };
}

export default function DashboardPage() {
  const { isLoggedIn, walletAddress } = useAuth();

  const { data: listingsData } = useQuery({
    queryKey: ["my-listings-stats", walletAddress],
    queryFn: async () => {
      const res = await fetch("/api/listings?mine=true");
      return res.json() as Promise<{ listings: { status: string }[] }>;
    },
    enabled: isLoggedIn,
    refetchInterval: 15000,
  });

  const { data: rentalsData } = useQuery({
    queryKey: ["dashboard-rentals", walletAddress],
    queryFn: async () => {
      const [ownerRes, borrowerRes] = await Promise.all([
        fetch("/api/rentals?role=owner&status=PAYMENT_DEPOSITED,DELEGATION_CONFIRMED"),
        fetch("/api/rentals?role=borrower"),
      ]);
      const owner = await ownerRes.json();
      const borrower = await borrowerRes.json();
      return {
        pendingRentals: owner.rentals as PendingRental[],
        borrowerRentals: borrower.rentals as { status: string }[],
      };
    },
    enabled: isLoggedIn,
    refetchInterval: 15000,
  });

  const activeListings =
    listingsData?.listings?.filter((l) => l.status === "ACTIVE").length ?? 0;
  const totalListings = listingsData?.listings?.length ?? 0;

  const needDelegation =
    rentalsData?.pendingRentals?.filter((r) => r.status === "PAYMENT_DEPOSITED") ?? [];
  const needRelease =
    rentalsData?.pendingRentals?.filter((r) => r.status === "DELEGATION_CONFIRMED") ?? [];

  const activeRentals =
    rentalsData?.borrowerRentals?.filter((r) => r.status === "ACTIVE").length ?? 0;

  const hasActions = needDelegation.length > 0 || needRelease.length > 0;

  if (!isLoggedIn) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          Connect your wallet to access the dashboard.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      {/* Action needed */}
      {hasActions && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-4">
            Action Needed
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {needDelegation.map((r) => {
              const { text, urgent } = r.delegationDeadline
                ? deadlineLabel(r.delegationDeadline)
                : { text: "Deadline unknown", urgent: false };
              return (
                <Link key={r.id} href="/dashboard/pending-rentals">
                  <div
                    className={cn(
                      "group flex flex-col gap-4 rounded-xl border p-5 transition-all hover:shadow-md cursor-pointer",
                      urgent
                        ? "border-destructive/40 bg-destructive/5 hover:bg-destructive/8"
                        : "border-amber-300/70 bg-amber-50/70 hover:bg-amber-50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "w-2.5 h-2.5 rounded-full mt-0.5 shrink-0",
                            urgent ? "bg-destructive" : "bg-amber-500"
                          )}
                        />
                        <span className={cn(
                          "text-xs font-semibold uppercase tracking-wide",
                          urgent ? "text-destructive" : "text-amber-700"
                        )}>
                          Delegate Axie
                        </span>
                      </div>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0 mt-0.5">
                        <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">
                        {r.listing.axieName || `Axie #${r.listing.axieId}`}
                      </p>
                      <p className={cn(
                        "text-sm mt-1",
                        urgent ? "text-destructive" : "text-amber-700"
                      )}>
                        {text}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}

            {needRelease.map((r) => {
              const { text, urgent } = r.endDate
                ? expiryLabel(r.endDate)
                : { text: "Check status", urgent: false };
              return (
                <Link key={r.id} href="/dashboard/pending-rentals">
                  <div
                    className={cn(
                      "group flex flex-col gap-4 rounded-xl border p-5 transition-all hover:shadow-md cursor-pointer",
                      urgent
                        ? "border-destructive/40 bg-destructive/5 hover:bg-destructive/8"
                        : "border-border bg-muted/40 hover:bg-muted/60"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "w-2.5 h-2.5 rounded-full mt-0.5 shrink-0",
                            urgent ? "bg-destructive" : "bg-muted-foreground"
                          )}
                        />
                        <span className={cn(
                          "text-xs font-semibold uppercase tracking-wide",
                          urgent ? "text-destructive" : "text-muted-foreground"
                        )}>
                          Release Funds
                        </span>
                      </div>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0 mt-0.5">
                        <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">
                        {r.listing.axieName || `Axie #${r.listing.axieId}`}
                      </p>
                      <p className={cn(
                        "text-sm mt-1",
                        urgent ? "text-destructive" : "text-muted-foreground"
                      )}>
                        {text}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Stats */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Overview
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { title: "Active Listings", value: activeListings, href: "/dashboard/my-listings" },
            { title: "Active Rentals (as borrower)", value: activeRentals, href: "/dashboard/my-rentals" },
            { title: "Pending Delegations", value: needDelegation.length, href: "/dashboard/pending-rentals" },
            { title: "Total Listings", value: totalListings, href: "/dashboard/my-listings" },
          ].map((card) => (
            <Link key={card.title} href={card.href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {card.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{card.value}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick links when nothing pending */}
      {!hasActions && (
        <div className="rounded-lg border border-border bg-muted/30 px-6 py-5">
          <p className="text-sm font-medium text-foreground mb-1">All clear</p>
          <p className="text-sm text-muted-foreground">
            No rentals waiting for your action.{" "}
            <Link href="/dashboard/my-axies" className="text-primary hover:underline">
              List an Axie
            </Link>{" "}
            or{" "}
            <Link href="/marketplace" className="text-primary hover:underline">
              browse the marketplace
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}
