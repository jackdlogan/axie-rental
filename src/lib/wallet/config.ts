import { http, createConfig } from "wagmi";
import { defineChain } from "viem";
import { injected } from "wagmi/connectors";

// Ronin Wallet injects itself as window.ronin.provider
const roninWallet = injected({
  target: {
    id: "roninWallet",
    name: "Ronin Wallet",
    provider: () =>
      typeof window !== "undefined"
        ? (window as unknown as { ronin?: { provider?: unknown } }).ronin?.provider as never
        : undefined,
  },
});

export const ronin = defineChain({
  id: 2020,
  name: "Ronin",
  nativeCurrency: { name: "RON", symbol: "RON", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://api.roninchain.com/rpc"] },
  },
  blockExplorers: {
    default: { name: "Ronin Explorer", url: "https://app.roninchain.com" },
  },
});

export const saigon = defineChain({
  id: 2021,
  name: "Saigon Testnet",
  nativeCurrency: { name: "RON", symbol: "RON", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://saigon-testnet.roninchain.com/rpc"] },
  },
  blockExplorers: {
    default: {
      name: "Saigon Explorer",
      url: "https://saigon-app.roninchain.com",
    },
  },
  testnet: true,
});

const isMainnet = process.env.NEXT_PUBLIC_CHAIN === "mainnet";
export const activeChain = isMainnet ? ronin : saigon;

export const config = createConfig({
  chains: [ronin, saigon],
  connectors: [roninWallet],
  transports: {
    [ronin.id]: http(),
    [saigon.id]: http(),
  },
  ssr: true,
});
