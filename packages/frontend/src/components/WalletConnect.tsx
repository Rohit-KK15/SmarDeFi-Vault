"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { formatAddress } from "@/lib/utils";

export function WalletConnect() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-4 p-4 bg-gray-900 rounded-lg border border-gray-800">
        <div className="flex-1">
          <p className="text-sm text-gray-400">Connected</p>
          <p className="font-mono text-sm">{formatAddress(address)}</p>
        </div>
        <button
          onClick={() => disconnect()}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
      <p className="text-sm text-gray-400 mb-3">Connect your wallet to continue</p>
      <div className="flex gap-2 flex-wrap">
        {connectors.map((connector) => (
          <button
            key={connector.id}
            onClick={() => connect({ connector })}
            disabled={isPending}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors"
          >
            {connector.name}
          </button>
        ))}
      </div>
    </div>
  );
}

