"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { mainnet, sepolia, localhost } from "wagmi/chains";
import { injected, metaMask, walletConnect } from "wagmi/connectors";
import { useState, useEffect } from "react";

function createWagmiConfig() {
  return createConfig({
    chains: [localhost, sepolia, mainnet],
    connectors: [
      injected(),
      metaMask({
        dappMetadata: {
          name: "DeFi Portfolio Vault",
          url: typeof window !== "undefined" ? window.location.origin : "http://localhost:3000",
        },
      }),
      ...(process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
        ? [
            walletConnect({
              projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
            }),
          ]
        : []),
    ],
    transports: {
      [localhost.id]: http(),
      [sepolia.id]: http(),
      [mainnet.id]: http(),
    },
  });
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [config] = useState(() => createWagmiConfig());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}

