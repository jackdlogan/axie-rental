"use client";

import { useAuth } from "@/components/providers";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TeamDelegateButton } from "@/components/rental/team-delegate-button";
import { TeamClaimFundsButton } from "@/components/rental/team-claim-funds-button";
import { AxieImage } from "@/components/axie/axie-image";
import { AxieClassIcon } from "@/components/axie/axie-class-icon";
import { TxLink } from "@/components/ui/tx-link";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface TeamListingAxie {
  axieId: string;
  axieClass: string | null;
  axieName: string | null;
}

interface TeamRental {
  id: string;
  totalPrice: string;
  rentalDays: number;
  status: string;
  delegationDeadline: string | null;
  startDate: string | null;
  endDate: string | null;
  delegationTxHash: string | null;
  releaseTxHash: string | null;
  borrower: { walletAddress: string };
  teamListing: {
    id: string;
    name: string | null;
    axies: TeamListingAxie[];
  };
}

interface TeamGroup {
  teamListingId: string;
  teamName: string | null;
  axies: TeamListingAxie[];
  rentals: TeamRental[];
}

function DeadlineBadge({ deadline }: { deadline: string }) {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return <Badge variant="destructive" className="text-xs">Deadline passed</Badge>;
  const hours = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  return (
    <Badge variant={hours < 2 ? "destructive" : "secondary"} className="text-xs whitespace-nowrap">
      {hours >= 1 ? `${hours}h ${mins}m left` : `${mins}m left`}
    </Badge>
  );
}

function RentalExpiryBadge({ endDate }: { endDate: string }) {
  const ms = new Date(endDate).getTime() - Date.now();
  if (ms <= 0) return <Badge variant="default" className="text-xs">Ended — claim funds</Badge>;
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  return (
    <Badge variant="secondary" className="text-xs whitespace-nowrap">
      {days >= 1 ? `${days}d ${hours}h left` : `${hours}h left`}
    </Badge>
  );
}

function shortenAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function TeamGroupCard({ group }: { group: TeamGroup }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="p-4 border-b bg-muted/30">
        <div className="flex items-center gap-4">
          <div className="flex -space-x-2">
            {group.axies.slice(0, 5).map((axie) => (
              <div key={axie.axieId} className="w-10 h-10 bg-muted rounded-full border-2 border-background overflow-hidden flex items-center justify-center">
                <AxieImage axieId={axie.axieId} width={40} height={40} />
              </div>
            ))}
            {group.axies.length > 5 && (
              <div className="w-10 h-10 bg-muted rounded-full border-2 border-background flex items-center justify-center text-xs font-medium">
                +{group.axies.length - 5}
              </div>
            )}
          </div>
          <div>
            <h2 className="font-semibold">{group.teamName || `Team (${group.axies.length} Axies)`}</h2>
            <div className="flex flex-wrap gap-1 mt-0.5">
              {group.axies.map((axie) => axie.axieClass && (
                <span key={axie.axieId} className="flex items-center gap-0.5 text-xs text-muted-foreground">
                  <AxieClassIcon axieClass={axie.axieClass} size={11} />
                  {axie.axieClass}
                </span>
              ))}
            </div>
          </div>
          <div className="ml-auto">
            <Badge variant="outline" className="text-xs">
              {group.rentals.length} offer{group.rentals.length !== 1 ? "s" : ""}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="text-xs">
              <TableHead>Borrower</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tx</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {group.rentals.map((rental) => (
              <TableRow key={rental.id}>
                <TableCell className="font-mono text-xs">{shortenAddress(rental.borrower.walletAddress)}</TableCell>
                <TableCell className="text-sm font-medium">
                  {rental.totalPrice} <span className="text-muted-foreground text-xs">USDC</span>
                </TableCell>
                <TableCell className="text-sm">{rental.rentalDays}d</TableCell>
                <TableCell>
                  {rental.status === "PAYMENT_DEPOSITED" && rental.delegationDeadline && (
                    <DeadlineBadge deadline={rental.delegationDeadline} />
                  )}
                  {rental.status === "DELEGATION_CONFIRMED" && rental.endDate && (
                    <RentalExpiryBadge endDate={rental.endDate} />
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground space-y-1">
                  {rental.delegationTxHash && <div>Delegate: <TxLink hash={rental.delegationTxHash} /></div>}
                  {rental.releaseTxHash && <div>Release: <TxLink hash={rental.releaseTxHash} /></div>}
                </TableCell>
                <TableCell className="text-right">
                  {rental.status === "PAYMENT_DEPOSITED" &&
                    rental.delegationDeadline &&
                    new Date(rental.delegationDeadline).getTime() > Date.now() && (
                      <TeamDelegateButton
                        axieIds={group.axies.map((a) => a.axieId)}
                        borrowerAddress={rental.borrower.walletAddress}
                        rentalDays={rental.rentalDays}
                        rentalId={rental.id}
                        rejectedRentalIds={group.rentals
                          .filter((r) => r.id !== rental.id && r.status === "PAYMENT_DEPOSITED")
                          .map((r) => r.id)}
                      />
                    )}
                  {rental.status === "DELEGATION_CONFIRMED" && rental.startDate && (
                    <TeamClaimFundsButton
                      rentalId={rental.id}
                      rentalStart={rental.startDate}
                      rentalDays={rental.rentalDays}
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function PendingTeamRentalsPage() {
  const { isLoggedIn } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["pending-team-rentals"],
    queryFn: async () => {
      const res = await fetch("/api/team-rentals?role=owner&status=PAYMENT_DEPOSITED,DELEGATION_CONFIRMED");
      return res.json() as Promise<{ rentals: TeamRental[] }>;
    },
    enabled: isLoggedIn,
    refetchInterval: 15000,
  });

  const groups: TeamGroup[] = [];
  if (data?.rentals) {
    for (const rental of data.rentals) {
      const existing = groups.find((g) => g.teamListingId === rental.teamListing.id);
      if (existing) {
        existing.rentals.push(rental);
      } else {
        groups.push({
          teamListingId: rental.teamListing.id,
          teamName: rental.teamListing.name,
          axies: rental.teamListing.axies,
          rentals: [rental],
        });
      }
    }
  }

  if (!isLoggedIn) {
    return <p className="text-muted-foreground text-center py-12">Connect your wallet to view pending team rentals.</p>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Pending Team Offers</h1>
      <p className="text-muted-foreground mb-8 text-sm">
        Delegate your team to the borrower you choose — others will be automatically refunded.
      </p>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : !groups.length ? (
        <div className="text-center py-16 space-y-3">
          <p className="text-muted-foreground font-medium">No pending team offers.</p>
          <p className="text-sm text-muted-foreground">When borrowers deposit funds for your teams, they will appear here.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => <TeamGroupCard key={group.teamListingId} group={group} />)}
        </div>
      )}
    </div>
  );
}
