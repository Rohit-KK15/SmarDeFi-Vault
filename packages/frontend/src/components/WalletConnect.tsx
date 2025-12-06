"use client"

import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { Wallet, LogOut, Loader2, AlertCircle, ChevronDown } from 'lucide-react'
import { formatAddress } from '@/lib/utils'

/**
 * WalletConnect component - handles wallet connection, disconnection, and network switching
 */
export function WalletConnect() {
  const { address, isConnected, connector } = useAccount()
  const { connect, connectors, isPending, error } = useConnect()
  const { disconnect } = useDisconnect()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()

  const [isMounted, setIsMounted] = useState(false)
  const [showConnectors, setShowConnectors] = useState(false)

  // Prevent hydration mismatch by only rendering after mount
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Auto-switch to Sepolia if connected to wrong network
  useEffect(() => {
    if (isConnected && chainId !== sepolia.id) {
      const timer = setTimeout(() => {
        switchChain?.({ chainId: sepolia.id })
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [isConnected, chainId, switchChain])

  // Handle wallet connection with specific connector
  const handleConnect = (connectorToUse: typeof connectors[0]) => {
    try {
      connect({ connector: connectorToUse })
      setShowConnectors(false)
    } catch (err) {
      console.error('Connection error:', err)
    }
  }

  // Handle disconnection
  const handleDisconnect = () => {
    disconnect()
    setShowConnectors(false)
  }

  // Prevent SSR hydration issues
  if (!isMounted) {
    return (
      <div className="h-10 w-40 bg-white/5 rounded-xl animate-pulse" />
    )
  }

  // Connected state - show address and disconnect button
  if (isConnected && address) {
    const isWrongNetwork = chainId !== sepolia.id

    return (
      <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-1 pr-4 backdrop-blur-sm">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${isWrongNetwork
          ? 'bg-yellow-500/10 border-yellow-500/20'
          : 'bg-blue-500/10 border-blue-500/20'
          }`}>
          {isWrongNetwork ? (
            <AlertCircle size={12} className="text-yellow-500" />
          ) : (
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          )}
          <span className="font-mono text-sm text-blue-100 font-medium">
            {formatAddress(address)}
          </span>
        </div>

        {connector && (
          <span className="text-xs text-gray-400 capitalize">
            {connector.name}
          </span>
        )}

        <button
          onClick={handleDisconnect}
          className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all duration-200"
          title="Disconnect wallet"
          aria-label="Disconnect wallet"
        >
          <LogOut size={16} />
        </button>
      </div>
    )
  }

  // Available connectors for connection
  const availableConnectors = connectors.filter(c => c.ready !== false)

  // Disconnected state - show connect options
  return (
    <div className="relative">
      {/* MAIN CONNECT BUTTON */}
      {!showConnectors ? (
        <button
          onClick={() => {
            if (availableConnectors.length === 1) {
              handleConnect(availableConnectors[0])
            } else {
              setShowConnectors(true)
            }
          }}
          disabled={isPending}
          className="
          group flex items-center gap-2 px-5 py-2.5 rounded-full
          bg-gradient-to-br from-[#5F5CFF] via-[#7A5CFF] to-[#B15CFF]
          hover:from-[#6C66FF] hover:via-[#8C66FF] hover:to-[#C66CFF]
          text-white font-semibold
          shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50
          transition-all duration-300 ease-out
          hover:scale-[1.03] active:scale-[0.98]
          disabled:opacity-60
        "
        >
          {isPending ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Wallet size={18} className="group-hover:rotate-12 transition-transform duration-300" />
          )}
          <span>{isPending ? "Connecting..." : "Connect Wallet"}</span>
          {availableConnectors.length > 1 && <ChevronDown size={16} />}
        </button>
      ) : null}

      {/* --- MODAL IN PORTAL --- */}
      {showConnectors &&
        createPortal(
          <>
            {/* Overlay */}
            <div
              onClick={() => setShowConnectors(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100000] animate-fadeIn"
            />

            {/* Modal */}
            <div
              className="
              fixed top-1/2 left-1/2 z-[100001]
              w-[90%] max-w-[380px]
              -translate-x-1/2 -translate-y-1/2
              rounded-2xl p-6
              bg-gradient-to-br from-[#111827] via-[#1f2937] to-[#111827]
              border border-white/10 backdrop-blur-xl
              shadow-2xl shadow-purple-500/20
              animate-slideUp
            "
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">
                  Connect Wallet
                </h2>
                <button
                  onClick={() => setShowConnectors(false)}
                  className="text-gray-400 hover:text-white transition"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                {availableConnectors.map((connector) => (
                  <button
                    key={connector.id}
                    onClick={() => handleConnect(connector)}
                    disabled={isPending}
                    className="
                    flex items-center gap-3 w-full px-4 py-3 rounded-xl
                    bg-white/5 hover:bg-white/10
                    border border-white/10 hover:border-purple-500/40
                    transition-all duration-200
                    text-left disabled:opacity-50
                  "
                  >
                    <div
                      className="
                      w-9 h-9 rounded-xl flex items-center justify-center
                      bg-gradient-to-br from-purple-500/40 to-purple-700/40
                      shadow-inner shadow-purple-900/20
                    "
                    >
                      <Wallet size={18} className="text-purple-300" />
                    </div>

                    <div>
                      <div className="text-white font-medium capitalize">
                        {connector.name}
                      </div>
                      <div className="text-xs text-gray-400">
                        {connector.ready ? "Available" : "Not installed"}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {error && (
                <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex gap-2">
                  <AlertCircle size={16} /> {error.message}
                </div>
              )}
            </div>
          </>,
          document.body
        )}
    </div>
  )

}
