"use client"

import { type ReactNode, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, type State } from 'wagmi'
import { config } from '@/config/wagmi'

/**
 * Root providers component that wraps the entire application
 * Sets up Wagmi and React Query for Web3 functionality
 */
export function Providers({
  children,
  initialState
}: {
  children: ReactNode
  initialState?: State
}) {
  // Create a new QueryClient instance for each render to avoid state sharing
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Disable automatic background refetching to reduce RPC calls
        refetchOnWindowFocus: false,
        // Enable refetch on reconnect so data loads when wallet reconnects
        refetchOnReconnect: true,
        // Cache data for 5 minutes
        staleTime: 5 * 60 * 1000,
        // Keep unused data in cache for 10 minutes
        gcTime: 10 * 60 * 1000,
        // Retry failed requests up to 2 times
        retry: 2,
        // Exponential backoff for retries
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      },
      mutations: {
        // Retry failed mutations once
        retry: 1,
      },
    },
  }))

  return (
    <WagmiProvider config={config} initialState={initialState} reconnectOnMount={true}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
}
