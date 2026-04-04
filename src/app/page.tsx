import Link from "next/link";
import Image from "next/image";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";
import { prisma } from "@/lib/db";

export default async function HomePage() {
  const [activeListings, completedRentals] = await Promise.all([
    prisma.listing.count({ where: { status: "ACTIVE" } }),
    prisma.rental.count({ where: { status: "COMPLETED" } }),
  ]);
  return (
    <div className="flex flex-col">
      {/* Hero — two-column: text left, image right */}
      <section className="py-16 md:py-20 px-4 border-b border-border overflow-hidden">
        <div className="container mx-auto max-w-5xl">
          <div className="flex flex-col md:flex-row items-center gap-10 md:gap-8">
            {/* Left: copy */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-body uppercase tracking-[0.2em] text-muted-foreground mb-4">
                Ronin Mainnet · Trustless · Non-custodial
              </p>
              <h1 className="font-heading text-5xl md:text-6xl lg:text-7xl font-800 leading-[1.05] tracking-tight text-foreground mb-6">
                Rent Axies.<br />
                <span className="text-primary">Earn while</span><br />
                you sleep.
              </h1>
              <div className="flex gap-4 flex-wrap">
                <Link href="/marketplace" className={cn(buttonVariants({ size: "lg" }), "cursor-pointer")}>
                  Browse Axies
                </Link>
                <Link href="/dashboard/my-axies" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "cursor-pointer")}>
                  List Your Axies
                </Link>
              </div>
            </div>

            {/* Right: hero image */}
            <div className="w-full md:w-[480px] lg:w-[560px] shrink-0">
              <Image
                src="/hero-axies.png"
                alt="Axie Infinity characters including Xmas, Origin, Japan, Summer, and Mystic Axies in glowing orbs"
                width={1456}
                height={816}
                priority
                className="w-full h-auto rounded-xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Rule + pull quote */}
      <section className="py-12 px-4 border-b border-border bg-muted/40">
        <div className="container mx-auto max-w-4xl">
          <blockquote className="border-l-4 border-primary pl-6 text-lg text-muted-foreground italic font-heading">
            "The first escrow-based Axie rental marketplace on Ronin. Owners list, borrowers pay,
            and smart contracts handle the rest — no trust required."
          </blockquote>
        </div>
      </section>

      {/* How it works — 3-column editorial grid */}
      <section className="py-16 px-4 border-b border-border">
        <div className="container mx-auto max-w-4xl">
          <div className="flex items-baseline gap-4 mb-10">
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">How it works</span>
            <div className="flex-1 border-t border-border" />
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                num: "I",
                title: "List Your Axie",
                body: "Set your daily price in USDC, choose min/max rental duration, and publish your listing.",
              },
              {
                num: "II",
                title: "Borrower Pays",
                body: "USDC is deposited into a smart contract escrow — safe and trustless for both parties.",
              },
              {
                num: "III",
                title: "Delegate & Earn",
                body: "Delegate the Axie on-chain. Escrow verifies delegation and releases payment to you.",
              },
            ].map((item) => (
              <div key={item.num} className="space-y-3">
                <div className="font-heading text-3xl font-700 text-primary/60">{item.num}</div>
                <h3 className="font-heading text-lg font-600 text-foreground">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats — thin ruled row */}
      <section className="py-10 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="grid grid-cols-3 divide-x divide-border text-center">
            <div className="px-4 py-2">
              <p className="font-heading text-3xl font-700 text-foreground">{activeListings}</p>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">Active Listings</p>
            </div>
            <div className="px-4 py-2">
              <p className="font-heading text-3xl font-700 text-foreground">{completedRentals}</p>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">Completed Rentals</p>
            </div>
            <div className="px-4 py-2">
              <p className="font-heading text-3xl font-700 text-foreground">2.5%</p>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">Platform Fee</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
