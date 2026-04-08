"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ConnectButton } from "@/components/wallet/connect-button";

export function Header() {
  const { isLoggedIn, walletAddress, logout } = useAuth();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const truncatedAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : "";

  const mobileNavLinks = [
    { href: "/marketplace", label: "Rent an Axie" },
    { href: "/marketplace/teams", label: "Rent a Team" },
    ...(isLoggedIn
      ? [
          { href: "/dashboard", label: "Dashboard" },
          { href: "/dashboard/my-axies", label: "My Axies" },
          { href: "/dashboard/my-listings", label: "My Listings" },
          { href: "/dashboard/pending-rentals", label: "Pending Delegations" },
          { href: "/dashboard/my-rentals", label: "My Rentals" },
          { href: "/dashboard/earnings", label: "Earnings" },
        ]
      : []),
  ];

  return (
    <header className="bg-[#0D0C0B] border-b border-[#1C1B19] sticky top-0 z-50">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-6 h-6 bg-[#F97316] rounded-md flex items-center justify-center">
              <div className="w-2.5 h-2.5 bg-[#0D0C0B] rounded-full" />
            </div>
            <span className="font-bold text-white text-lg tracking-tight">AxieRent</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/marketplace" className="text-sm text-[#A8A29E] hover:text-white transition-colors duration-150">
              Rent an Axie
            </Link>
            <Link href="/marketplace/teams" className="text-sm text-[#A8A29E] hover:text-white transition-colors duration-150">
              Rent a Team
            </Link>
            {isLoggedIn && (
              <Link
                href="/dashboard"
                className="text-sm text-[#A8A29E] hover:text-white transition-colors duration-150"
              >
                Dashboard
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {/* Desktop wallet */}
          <div className="hidden md:flex items-center gap-3">
            {isLoggedIn ? (
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex items-center justify-center gap-2 rounded-md bg-[#1C1B19] border border-[#2C2B29] px-3 h-8 text-xs font-mono text-white cursor-pointer hover:bg-[#2C2B29] transition-colors">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                  {truncatedAddress}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-[#1C1B19] border-[#2C2B29] text-white">
                  <DropdownMenuItem className="cursor-pointer text-[#A8A29E] hover:text-white focus:text-white focus:bg-[#2C2B29]" onClick={() => router.push("/dashboard")}>
                    Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer text-[#A8A29E] hover:text-white focus:text-white focus:bg-[#2C2B29]" onClick={() => router.push("/dashboard/my-axies")}>
                    My Axies
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer text-[#A8A29E] hover:text-white focus:text-white focus:bg-[#2C2B29]" onClick={() => router.push("/dashboard/my-listings")}>
                    My Listings
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer text-[#A8A29E] hover:text-white focus:text-white focus:bg-[#2C2B29]" onClick={() => router.push("/dashboard/my-rentals")}>
                    My Rentals
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-[#2C2B29]" />
                  <DropdownMenuItem variant="destructive" className="cursor-pointer focus:bg-[#2C2B29]" onClick={logout}>
                    Disconnect
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <ConnectButton />
            )}
          </div>

          {/* Mobile hamburger */}
          <div className="md:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger className="inline-flex items-center justify-center w-9 h-9 rounded-md text-[#A8A29E] hover:text-white hover:bg-[#1C1B19] transition-colors cursor-pointer" aria-label="Open menu">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              </SheetTrigger>
              <SheetContent side="right">
                <SheetHeader>
                  <SheetTitle className="font-bold tracking-tight text-left">AxieRent</SheetTitle>
                </SheetHeader>
                <nav className="mt-6 flex flex-col gap-1">
                  {mobileNavLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className="px-3 py-2.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      {link.label}
                    </Link>
                  ))}
                </nav>
                <div className="mt-6 px-3">
                  {isLoggedIn ? (
                    <div className="space-y-3">
                      <p className="text-xs font-mono text-muted-foreground truncate">{truncatedAddress}</p>
                      <button
                        onClick={() => { logout(); setMobileOpen(false); }}
                        className="w-full text-left px-3 py-2.5 rounded-md text-sm text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <ConnectButton />
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
