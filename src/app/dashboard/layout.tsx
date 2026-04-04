"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/my-axies", label: "My Axies" },
  { href: "/dashboard/my-listings", label: "My Listings" },
  { href: "/dashboard/pending-rentals", label: "Pending Delegations" },
  { href: "/dashboard/my-rentals", label: "My Rentals" },
  { href: "/dashboard/earnings", label: "Earnings" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="container mx-auto px-4 py-6 md:py-8">
      {/* Mobile: horizontal scrollable tab bar */}
      <nav className="md:hidden flex gap-1 overflow-x-auto pb-4 mb-6 border-b border-border scrollbar-hide -mx-4 px-4">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "shrink-0 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors duration-150",
              pathname === item.href
                ? "bg-primary text-primary-foreground font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="flex gap-8">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex flex-col w-52 shrink-0">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4 px-3">
            Navigation
          </p>
          <nav className="space-y-0.5">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center px-3 py-2 text-sm transition-colors duration-150 cursor-pointer rounded-sm",
                  pathname === item.href
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
