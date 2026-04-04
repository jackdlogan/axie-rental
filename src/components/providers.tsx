"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { config } from "@/lib/wallet/config";
import { useState, createContext, useContext, useCallback, useEffect } from "react";

interface AuthContextType {
  walletAddress: string | null;
  isLoggedIn: boolean;
  login: (address: string) => void;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  walletAddress: null,
  isLoggedIn: false,
  login: () => {},
  logout: async () => {},
  refreshSession: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60 * 1000 },
        },
      })
  );

  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session");
      const data = await res.json();
      setWalletAddress(data.walletAddress);
      setIsLoggedIn(data.isLoggedIn);
    } catch {
      setWalletAddress(null);
      setIsLoggedIn(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const login = useCallback((address: string) => {
    setWalletAddress(address.toLowerCase());
    setIsLoggedIn(true);
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setWalletAddress(null);
    setIsLoggedIn(false);
  }, []);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider
          value={{ walletAddress, isLoggedIn, login, logout, refreshSession }}
        >
          {children}
        </AuthContext.Provider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
