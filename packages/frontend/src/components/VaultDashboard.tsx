"use client";

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { CONTRACTS, VAULT_ABI, ROUTER_ABI, ERC20_ABI, isValidAddress } from "@/lib/contracts";
import { formatTokenAmount, formatNumber, parseTokenAmount } from "@/lib/utils";
import { useState } from "react";
import { DepositModal } from "./DepositModal";
import { WithdrawModal } from "./WithdrawModal";
import { StrategyCard } from "./StrategyCard";
import { ActivityCard } from "./ActivityCard";
import { TrendingUp, DollarSign, PieChart } from "lucide-react";

export function VaultDashboard() {
  const { address, isConnected } = useAccount();
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const hasValidContracts = isValidAddress(CONTRACTS.VAULT) && isValidAddress(CONTRACTS.ROUTER);

  // Read vault state
  const { data: totalAssets } = useReadContract({
    address: CONTRACTS.VAULT,
    abi: VAULT_ABI,
    functionName: "totalAssets",
    query: { enabled: isConnected && hasValidContracts },
  });

  const { data: totalManaged } = useReadContract({
    address: CONTRACTS.VAULT,
    abi: VAULT_ABI,
    functionName: "totalManagedAssets",
    query: { enabled: isConnected && hasValidContracts },
  });

  const { data: totalSupply } = useReadContract({
    address: CONTRACTS.VAULT,
    abi: VAULT_ABI,
    functionName: "totalSupply",
    query: { enabled: isConnected && hasValidContracts },
  });

  const { data: userShares } = useReadContract({
    address: CONTRACTS.VAULT,
    abi: VAULT_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: isConnected && !!address && hasValidContracts },
  });

  const { data: userAssets } = useReadContract({
    address: CONTRACTS.VAULT,
    abi: VAULT_ABI,
    functionName: "convertToAssets",
    args: userShares ? [userShares] : undefined,
    query: { enabled: isConnected && !!userShares && hasValidContracts },
  });

  // Read portfolio state
  const { data: portfolioState } = useReadContract({
    address: CONTRACTS.ROUTER,
    abi: ROUTER_ABI,
    functionName: "getPortfolioState",
    query: { enabled: isConnected && hasValidContracts },
  });

  // Write contracts
  const { writeContract: writeRouter, isPending: isRouterPending } = useWriteContract();

  const handleRebalance = () => {
    writeRouter({
      address: CONTRACTS.ROUTER,
      abi: ROUTER_ABI,
      functionName: "rebalance",
    });
  };

  const handleHarvest = () => {
    writeRouter({
      address: CONTRACTS.ROUTER,
      abi: ROUTER_ABI,
      functionName: "harvestAll",
    });
  };

  if (!isConnected) {
    return (
      <div className="text-center py-12 text-gray-400">
        Please connect your wallet to view the vault dashboard
      </div>
    );
  }

  if (!hasValidContracts) {
    return (
      <div className="text-center py-12">
        <p className="text-yellow-400 mb-2">⚠️ Contract addresses not configured</p>
        <p className="text-gray-400 text-sm">
          Please set contract addresses in your .env.local file
        </p>
      </div>
    );
  }

  const totalAssetsFormatted = totalAssets ? formatTokenAmount(totalAssets) : "0";
  const totalManagedFormatted = totalManaged ? formatTokenAmount(totalManaged) : "0";
  const userSharesFormatted = userShares ? formatTokenAmount(userShares, 18) : "0";
  const userAssetsFormatted = userAssets ? formatTokenAmount(userAssets) : "0";

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-400">Total Assets</p>
            <DollarSign className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-2xl font-bold">{formatNumber(totalAssetsFormatted)} LINK</p>
        </div>

        <div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-400">Total Managed</p>
            <TrendingUp className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-2xl font-bold">{formatNumber(totalManagedFormatted)} LINK</p>
        </div>

        <div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-400">Your Shares</p>
            <PieChart className="w-5 h-5 text-purple-500" />
          </div>
          <p className="text-2xl font-bold">{formatNumber(userSharesFormatted)}</p>
        </div>

        <div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-400">Your Assets</p>
            <DollarSign className="w-5 h-5 text-yellow-500" />
          </div>
          <p className="text-2xl font-bold">{formatNumber(userAssetsFormatted)} LINK</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={() => setShowDeposit(true)}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
        >
          Deposit
        </button>
        <button
          onClick={() => setShowWithdraw(true)}
          className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
        >
          Withdraw
        </button>
        <button
          onClick={handleRebalance}
          disabled={isRouterPending}
          className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg font-medium transition-colors"
        >
          {isRouterPending ? "Rebalancing..." : "Rebalance"}
        </button>
        <button
          onClick={handleHarvest}
          disabled={isRouterPending}
          className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg font-medium transition-colors"
        >
          {isRouterPending ? "Harvesting..." : "Harvest All"}
        </button>
      </div>

      {/* Strategies */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
        <h2 className="text-xl font-bold mb-4">Strategies</h2>
        <div className="space-y-4">
          {portfolioState && portfolioState[0]?.length > 0 ? (
            portfolioState[0].map((strategy, index) => (
              <StrategyCard
                key={strategy}
                strategy={strategy}
                balance={portfolioState[1][index]}
                target={portfolioState[2][index]}
                totalManaged={totalManaged || BigInt(0)}
              />
            ))
          ) : (
            <p className="text-gray-400">No strategies configured</p>
          )}
        </div>
      </div>

      {/* Activity */}
      <ActivityCard />

      {/* Modals */}
      {showDeposit && <DepositModal onClose={() => setShowDeposit(false)} />}
      {showWithdraw && <WithdrawModal onClose={() => setShowWithdraw(false)} />}
    </div>
  );
}

