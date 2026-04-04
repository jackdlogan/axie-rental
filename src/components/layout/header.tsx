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
    { href: "/marketplace", label: "Marketplace" },
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
    <header className="sticky top-0 z-50 border-b border-border bg-[#FDFBF7]/95 backdrop-blur supports-[backdrop-filter]:bg-[#FDFBF7]/80">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="font-heading text-xl font-700 tracking-tight text-foreground">
            Axie Rental
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/marketplace"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150"
            >
              Marketplace
            </Link>
            {isLoggedIn && (
              <Link
                href="/dashboard"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150"
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
                <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 h-8 text-xs font-mono cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors">
                  {truncatedAddress}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-card border-border">
                  <DropdownMenuItem className="cursor-pointer" onClick={() => router.push("/dashboard")}>
                    Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer" onClick={() => router.push("/dashboard/my-axies")}>
                    My Axies
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer" onClick={() => router.push("/dashboard/my-listings")}>
                    My Listings
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer" onClick={() => router.push("/dashboard/my-rentals")}>
                    My Rentals
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" className="cursor-pointer" onClick={logout}>
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
              <SheetTrigger className="inline-flex items-center justify-center w-9 h-9 rounded-md hover:bg-accent transition-colors cursor-pointer" aria-label="Open menu">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              </SheetTrigger>
              <SheetContent side="right">
                <SheetHeader>
                  <SheetTitle className="font-heading tracking-tight text-left">Axie Rental</SheetTitle>
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
