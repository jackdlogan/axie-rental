"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navGroups = [
  {
    label: "Account",
    items: [
      { href: "/dashboard", label: "Overview" },
      { href: "/dashboard/earnings", label: "Earnings" },
    ],
  },
  {
    label: "Inventory",
    items: [
      { href: "/dashboard/my-axies", label: "My Axies" },
    ],
  },
  {
    label: "My Listings",
    items: [
      { href: "/dashboard/my-listings", label: "Single Axie" },
      { href: "/dashboard/my-teams", label: "Teams" },
    ],
  },
  {
    label: "Owner Actions",
    items: [
      { href: "/dashboard/pending-rentals", label: "Pending Delegations" },
      { href: "/dashboard/pending-team-rentals", label: "Team Delegations" },
    ],
  },
  {
    label: "My Rentals",
    items: [
      { href: "/dashboard/my-rentals", label: "Single Axie" },
      { href: "/dashboard/my-team-rentals", label: "Teams" },
    ],
  },
];

const allNavItems = navGroups.flatMap((g) => g.items);

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="container mx-auto px-4 py-6 md:py-8">
      {/* Mobile: horizontal scrollable tab bar */}
      <nav className="md:hidden flex gap-1.5 overflow-x-auto pb-4 mb-6 border-b border-[#E7E5E4] scrollbar-hide -mx-4 px-4">
        {allNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "shrink-0 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors duration-150",
              pathname === item.href
                ? "bg-[#0D0C0B] text-white"
                : "border border-[#E7E5E4] text-[#78716C] hover:text-[#0D0C0B] hover:border-[#0D0C0B]"
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="flex gap-8">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex flex-col w-52 shrink-0">
          <nav className="flex flex-col gap-4">
            {navGroups.map((group, gi) => (
              <div key={group.label}>
                {gi > 0 && (
                  <div className="border-t border-[#E7E5E4] mb-4" />
                )}
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#A8A29E] mb-1.5 px-3">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center px-3 py-2 text-sm transition-colors duration-150 cursor-pointer rounded-lg",
                        pathname === item.href
                          ? "bg-[#F5F5F4] text-[#0D0C0B] font-semibold"
                          : "text-[#78716C] hover:text-[#0D0C0B] hover:bg-[#F5F5F4]"
                      )}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
