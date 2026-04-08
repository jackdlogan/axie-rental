import { createPublicClient, http } from "viem";
import { activeChain } from "@/lib/wallet/config";

// Shared server-side read-only Ronin client.
// Used by API routes and cron jobs — never imported in client components.
export const publicClient = createPublicClient({
  chain: activeChain,
  transport: http(),
});
