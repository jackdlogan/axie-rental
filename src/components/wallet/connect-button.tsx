"use client";

import { useConnect, useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { SiweMessage } from "siwe";

export function ConnectButton() {
  const { connectors, connect } = useConnect();
  const { address, isConnected } = useAccount();
  const { login } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleSignIn = useCallback(async () => {
    if (!address) return;
    setIsSigningIn(true);
    try {
      const nonceRes = await fetch("/api/auth/nonce");
      const { nonce } = await nonceRes.json();

      // Build a fully compliant EIP-4361 message
      const siweMessage = new SiweMessage({
        domain: window.location.host,
        address,
        statement: "Sign in to Axie Rental Marketplace",
        uri: window.location.origin,
        version: "1",
        chainId: 2020,
        nonce,
      });
      const messageStr = siweMessage.prepareMessage();

      const provider = (
        window as unknown as {
          ronin?: {
            provider?: {
              request: (args: {
                method: string;
                params: unknown[];
              }) => Promise<string>;
            };
          };
        }
      ).ronin?.provider;

      if (!provider) {
        toast.error("Ronin Wallet not found. Please install it.");
        return;
      }

      const signature = await provider.request({
        method: "personal_sign",
        params: [messageStr, address],
      });

      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageStr, signature }),
      });

      if (verifyRes.ok) {
        login(address);
      } else {
        toast.error("Sign in failed. Please try again.");
      }
    } catch (error) {
      console.error("Sign in failed:", error);
      toast.error("Sign in cancelled.");
    } finally {
      setIsSigningIn(false);
    }
  }, [address, login]);

  if (isConnected && address) {
    return (
      <Button onClick={handleSignIn} disabled={isSigningIn} size="sm">
        {isSigningIn ? "Signing in..." : "Sign In"}
      </Button>
    );
  }

  const connector = connectors[0];

  return (
    <Button
      size="sm"
      onClick={() => connector && connect({ connector })}
      disabled={!connector}
    >
      Connect Ronin Wallet
    </Button>
  );
}
