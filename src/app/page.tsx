import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db";
import { FaqSection } from "@/components/home/faq-section";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [activeListings, completedRentals] = await Promise.all([
    prisma.listing.count({ where: { status: "ACTIVE" } }),
    prisma.rental.count({ where: { status: "COMPLETED" } }),
  ]);

  return (
    <div className="flex flex-col">
      {/* Hero — dark full-width section */}
      <section className="bg-[#0D0C0B] py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row items-center gap-12">
            {/* Left: copy */}
            <div className="flex-1 min-w-0">
              {/* Pill badge */}
              <div className="inline-flex items-center gap-2 mb-8">
                <div className="w-1.5 h-1.5 rounded-full bg-[#F97316]" />
                <span className="text-xs font-medium text-[#78716C] uppercase tracking-widest">
                  Ronin Network · Trustless Escrow
                </span>
              </div>
              <h1 className="text-7xl md:text-8xl font-black text-white leading-[0.95] tracking-[-0.04em] mb-6">
                Rent Axies.<br />
                <span className="text-[#F97316]">Earn Daily.</span>
              </h1>
              <p className="text-[#78716C] text-lg leading-relaxed max-w-md mb-10">
                The escrow-backed marketplace for Axie NFT rentals on Ronin. Owners earn, borrowers play — smart contracts handle the rest.
              </p>
              <div className="flex gap-3 flex-wrap">
                <Link
                  href="/marketplace"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-[#F97316] text-white font-semibold text-sm hover:bg-[#EA6C0A] transition-colors"
                >
                  Browse Axies
                </Link>
                <Link
                  href="/dashboard/my-axies"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-lg border border-[#2C2B29] text-[#A8A29E] font-semibold text-sm hover:text-white hover:border-[#3C3B39] transition-colors"
                >
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

      {/* Stats bar */}
      <section className="bg-[#F5F5F4] border-y border-[#E7E5E4]">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-[#E7E5E4] text-center">
            <div className="px-6 py-6">
              <p className="text-3xl font-extrabold text-[#0D0C0B] tracking-tight">{activeListings}</p>
              <p className="text-xs font-medium uppercase tracking-widest text-[#78716C] mt-1">Active Listings</p>
            </div>
            <div className="px-6 py-6">
              <p className="text-3xl font-extrabold text-[#0D0C0B] tracking-tight">{completedRentals}</p>
              <p className="text-xs font-medium uppercase tracking-widest text-[#78716C] mt-1">Completed Rentals</p>
            </div>
            <div className="px-6 py-6">
              <p className="text-3xl font-extrabold text-[#0D0C0B] tracking-tight">2.5%</p>
              <p className="text-xs font-medium uppercase tracking-widest text-[#78716C] mt-1">Platform Fee</p>
            </div>
            <div className="px-6 py-6">
              <p className="text-3xl font-extrabold text-[#0D0C0B] tracking-tight">100%</p>
              <p className="text-xs font-medium uppercase tracking-widest text-[#78716C] mt-1">Non-custodial</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="bg-white py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-12">
            <p className="text-xs font-medium uppercase tracking-widest text-[#78716C] mb-3">How it works</p>
            <h2 className="text-4xl md:text-5xl font-extrabold text-[#0D0C0B] tracking-[-0.03em]">
              Simple. Trustless. Profitable.
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                num: "01",
                title: "List Your Axie",
                body: "Set your daily price in USDC, choose min/max rental duration, and publish your listing.",
                dark: false,
              },
              {
                num: "02",
                title: "Borrower Pays",
                body: "USDC is deposited into a smart contract escrow — safe and trustless for both parties.",
                dark: false,
              },
              {
                num: "03",
                title: "Delegate On-chain",
                body: "Delegate the Axie on-chain. Escrow verifies delegation and locks the rental period.",
                dark: false,
              },
              {
                num: "04",
                title: "Earn & Release",
                body: "When the rental ends, escrow releases payment to you automatically. No trust required.",
                dark: true,
              },
            ].map((step) => (
              <div
                key={step.num}
                className={`border rounded-xl p-6 flex flex-col gap-4 ${
                  step.dark
                    ? "bg-[#0D0C0B] border-[#1C1B19]"
                    : "bg-white border-[#E7E5E4]"
                }`}
              >
                <div
                  className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold ${
                    step.dark
                      ? "bg-[#F97316] text-white"
                      : "bg-[#F5F5F4] text-[#0D0C0B]"
                  }`}
                >
                  {step.num}
                </div>
                <div>
                  <h3
                    className={`font-bold text-base mb-2 ${
                      step.dark ? "text-white" : "text-[#0D0C0B]"
                    }`}
                  >
                    {step.title}
                  </h3>
                  <p
                    className={`text-sm leading-relaxed ${
                      step.dark ? "text-[#78716C]" : "text-[#78716C]"
                    }`}
                  >
                    {step.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <FaqSection />
    </div>
  );
}
