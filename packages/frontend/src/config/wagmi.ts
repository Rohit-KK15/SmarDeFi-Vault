import { http, createConfig, createStorage, cookieStorage } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'

// Get environment variables - use proper Next.js env format
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || ''
const sepoliaRpcUrl = process.env.RPC_URL || `https://sepolia.infura.io/v3/bb0f90b39a0c429986192a19e16acdc4`

/**
 * Wagmi configuration with multiple chains and connectors
 * Supports: Injected wallets, WalletConnect, and Coinbase Wallet
 */
export const config = createConfig({
  // Define supported chains
  chains: [sepolia],

  // Configure wallet connectors
  connectors: [
    // Injected connector for browser extension wallets (MetaMask, Rabby, etc.)
    injected({
      shimDisconnect: true,
      target() {
        return {
          id: 'injected',
          name: 'Browser Wallet',
          provider: typeof window !== 'undefined' ? window.ethereum : undefined,
        }
      },
    }),

    // WalletConnect v2 for mobile wallets and QR code scanning (client-side only)
    ...(typeof window !== 'undefined' ? [
      walletConnect({
        projectId: walletConnectProjectId,
        metadata: {
          name: 'MetaVault AI',
          description: 'Intelligent DeFi Portfolio Management',
          url: window.location.origin,
          icons: [`${window.location.origin}/logo.png`],
        },
        showQrModal: true,
        qrModalOptions: {
          themeMode: 'dark',
          themeVariables: {
            '--wcm-z-index': '9999',
          },
        },
      })
    ] : []),

  ],

  // Configure RPC transports for each chain
  transports: {
    [sepolia.id]: http(sepoliaRpcUrl)
  },

  // Use noop storage for SSR compatibility (no IndexedDB required)
  storage: createStorage({
    storage: cookieStorage,
  }),

  // Enable Server-Side Rendering support
  ssr: true,

  // Batch multiple calls into a single RPC request
  batch: {
    multicall: true,
  },
})

// Export config for use in providers and components
export default config
