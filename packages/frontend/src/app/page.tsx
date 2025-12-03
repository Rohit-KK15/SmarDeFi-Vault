"use client";

import { VaultDashboard } from "@/components/VaultDashboard";
import { AgentChat } from "@/components/AgentChat";
import { WalletConnect } from "@/components/WalletConnect";
import { useState } from "react";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"vault" | "agent">("vault");

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">DeFi Portfolio Vault</h1>
          <p className="text-gray-400">AI-Powered Strategy Management</p>
        </div>

        {/* Wallet Connection */}
        <div className="mb-6">
          <WalletConnect />
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-800">
          <button
            onClick={() => setActiveTab("vault")}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === "vault"
                ? "border-b-2 border-blue-500 text-blue-500"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Vault Dashboard
          </button>
          <button
            onClick={() => setActiveTab("agent")}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === "agent"
                ? "border-b-2 border-blue-500 text-blue-500"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            AI Agent
          </button>
        </div>

        {/* Content */}
        {activeTab === "vault" && <VaultDashboard />}
        {activeTab === "agent" && <AgentChat />}
      </div>
    </main>
  );
}

