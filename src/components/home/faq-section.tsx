"use client";

import { useState } from "react";

const FAQS = [
  {
    q: "How does the escrow work?",
    a: "When a borrower rents an Axie, USDC is deposited directly into a smart contract on the Ronin network — not to the owner. The funds stay locked until the owner confirms delegation on-chain. Once confirmed, the rental is live and funds are held until the end date, then automatically released to the owner.",
  },
  {
    q: "What if the owner doesn't delegate in time?",
    a: "Every rental has a delegation deadline (typically 24 hours after payment). If the owner fails to delegate within that window, the borrower can claim a full refund directly from the smart contract. No manual intervention needed.",
  },
  {
    q: "What currency is used for payments?",
    a: "All payments are made in USDC on the Ronin network. Prices are set per day in USDC, and the total is calculated based on the rental duration you choose.",
  },
  {
    q: "What is the platform fee?",
    a: "AxieRent charges a 2.5% platform fee, deducted automatically from the owner's payout when funds are released. Borrowers pay exactly the listed price — no hidden fees.",
  },
  {
    q: "Which wallet do I need to use?",
    a: "You need the Ronin Wallet browser extension. All transactions happen on the Ronin network, so MetaMask and other EVM wallets are not supported. You can download Ronin Wallet from the official Ronin website.",
  },
  {
    q: "Can I list multiple Axies at once?",
    a: "Yes. You can list as many Axies as you own, each with its own price, duration, and availability settings. Manage all your listings from the dashboard under My Listings.",
  },
  {
    q: "Can I cancel a rental before it starts?",
    a: "A listing can be paused or cancelled at any time before a borrower pays. Once payment is deposited into escrow, the rental is committed. If you need to cancel after payment, contact support — cases are handled individually.",
  },
  {
    q: "How long can I rent an Axie for?",
    a: "Each listing has a minimum and maximum duration set by the owner, typically ranging from 1 to 30 days. You choose the exact number of days within that range when renting.",
  },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="bg-white py-20 px-4 border-t border-[#E7E5E4]">
      <div className="container mx-auto max-w-6xl">
        <div className="flex flex-col lg:flex-row gap-16 lg:gap-20">
          {/* Left: heading */}
          <div className="lg:w-72 shrink-0">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-5 h-0.5 bg-[#F97316]" />
              <span className="text-xs font-semibold text-[#F97316] uppercase tracking-widest">FAQ</span>
            </div>
            <h2 className="text-4xl font-extrabold text-[#0D0C0B] tracking-[-0.03em] leading-tight mb-4">
              Questions &amp; Answers
            </h2>
            <p className="text-sm text-[#78716C] leading-relaxed">
              Everything you need to know about renting and listing Axies on AxieRent.
            </p>
          </div>

          {/* Right: accordion */}
          <div className="flex-1 divide-y divide-[#E7E5E4]">
            {FAQS.map((item, i) => {
              const isOpen = openIndex === i;
              return (
                <div key={i} className="py-5">
                  <button
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                    className="flex items-center justify-between w-full text-left gap-4 cursor-pointer"
                  >
                    <span className="font-semibold text-[15px] text-[#0D0C0B] tracking-[-0.01em]">
                      {item.q}
                    </span>
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                        isOpen
                          ? "bg-[#0D0C0B]"
                          : "border border-[#E7E5E4]"
                      }`}
                    >
                      {isOpen ? (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2 4l4 4 4-4" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M6 2v8M2 6h8" stroke="#A8A29E" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      )}
                    </div>
                  </button>
                  {isOpen && (
                    <p className="mt-3 text-sm text-[#78716C] leading-relaxed max-w-2xl">
                      {item.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
