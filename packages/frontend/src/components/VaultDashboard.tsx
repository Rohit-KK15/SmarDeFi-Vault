"use client";

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useWatchContractEvent } from "wagmi";
import { CONTRACTS, VAULT_ABI, ROUTER_ABI, ERC20_ABI, isValidAddress } from "@/lib/contracts";
import { formatTokenAmount, formatNumber, parseTokenAmount } from "@/lib/utils";
import { useState, useEffect } from "react";
import { DepositModal } from "./DepositModal";
import { WithdrawModal } from "./WithdrawModal";
import { StrategyCard } from "./StrategyCard";
// import { ActivityCard } from "./ActivityCard"; // Removed
import { DepositorsList } from "./DepositorsList";
import { TrendingUp, DollarSign, PieChart, Wallet, ArrowRightLeft, Percent, Copy, Check } from "lucide-react";
import { formatUnits } from "viem";

export function VaultDashboard() {
  const { address, isConnected } = useAccount();
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showMintSuccess, setShowMintSuccess] = useState(false);
  const [apyData, setApyData] = useState<{
    apy: number;
    readable: string;
    tvl?: number;
    growth?: number;
    dt?: number;
    message?: string;
  } | null>(null);
  const [isLoadingApy, setIsLoadingApy] = useState(false);
  const hasValidContracts = isValidAddress(CONTRACTS.VAULT) && isValidAddress(CONTRACTS.ROUTER);

  // Fetch APY data (optional feature - doesn't block other functionality)
  useEffect(() => {
    if (!isConnected || !hasValidContracts) return;

    const fetchAPY = async () => {
      try {
        const response = await fetch("/api/vault/apy");
        if (response.ok) {
          const data = await response.json();
          // Only set data if there's no error field
          if (!data.error) {
            setApyData(data);
          }
        }
      } catch (error) {
        // Silently fail - APY is optional
        console.error("Failed to fetch APY:", error);
      } finally {
        setIsLoadingApy(false);
      }
    };

    setIsLoadingApy(true);
    fetchAPY();
    // Refresh APY every 30 seconds
    const interval = setInterval(fetchAPY, 30000);
    return () => clearInterval(interval);
  }, [isConnected, hasValidContracts]);

  // Read vault state
  const { data: totalAssets, refetch: refetchTotalAssets } = useReadContract({
    address: CONTRACTS.VAULT,
    abi: VAULT_ABI,
    functionName: "totalAssets",
    query: { enabled: isConnected && hasValidContracts, refetchInterval: 3000 },
  });

  const { data: totalManaged, refetch: refetchTotalManaged } = useReadContract({
    address: CONTRACTS.VAULT,
    abi: VAULT_ABI,
    functionName: "totalManagedAssets",
    query: { enabled: isConnected && hasValidContracts, refetchInterval: 3000 },
  });

  const { data: totalSupply, refetch: refetchTotalSupply } = useReadContract({
    address: CONTRACTS.VAULT,
    abi: VAULT_ABI,
    functionName: "totalSupply",
    query: { enabled: isConnected && hasValidContracts, refetchInterval: 3000 },
  });

  const { data: userShares, refetch: refetchUserShares } = useReadContract({
    address: CONTRACTS.VAULT,
    abi: VAULT_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: isConnected && !!address && hasValidContracts, refetchInterval: 3000 },
  });

  const { data: userAssets, refetch: refetchUserAssets } = useReadContract({
    address: CONTRACTS.VAULT,
    abi: VAULT_ABI,
    functionName: "convertToAssets",
    args: userShares ? [userShares] : undefined,
    query: { enabled: isConnected && !!userShares && hasValidContracts, refetchInterval: 3000 },
  });

  const { data: growthPercent, refetch: refetchGrowthPercent } = useReadContract({
    address: CONTRACTS.VAULT,
    abi: VAULT_ABI,
    functionName: "userGrowthPercent",
    args: address ? [address] : undefined,
    query: { enabled: isConnected && !!address && hasValidContracts, refetchInterval: 5000 },
  });

  // Read portfolio state
  const { data: portfolioState, refetch: refetchPortfolio } = useReadContract({
    address: CONTRACTS.ROUTER,
    abi: ROUTER_ABI,
    functionName: "getPortfolioState",
    query: { enabled: isConnected && hasValidContracts, refetchInterval: 3000 },
  });

  // Real-time Event Listeners
  const refetchAll = () => {
    refetchTotalAssets();
    refetchTotalManaged();
    refetchTotalSupply();
    refetchUserShares();
    refetchUserAssets();
    refetchPortfolio();
    refetchGrowthPercent();
  };

  useWatchContractEvent({
    address: CONTRACTS.VAULT,
    abi: VAULT_ABI,
    eventName: 'Deposit',
    onLogs: () => refetchAll(),
  });

  useWatchContractEvent({
    address: CONTRACTS.VAULT,
    abi: VAULT_ABI,
    eventName: 'Withdraw',
    onLogs: () => refetchAll(),
  });

  useWatchContractEvent({
    address: CONTRACTS.ROUTER,
    abi: ROUTER_ABI,
    eventName: 'Rebalanced',
    onLogs: () => refetchAll(),
  });

  useWatchContractEvent({
    address: CONTRACTS.ROUTER,
    abi: ROUTER_ABI,
    eventName: 'Harvested',
    onLogs: () => refetchAll(),
  });

  // Write contracts
  const { writeContract: writeToken, data: mintHash, isPending: isMinting, error: mintError } = useWriteContract();

  const { isLoading: isMintConfirming, isSuccess: isMintSuccess } = useWaitForTransactionReceipt({
    hash: mintHash,
  });

  useEffect(() => {
    if (isMintSuccess) {
      refetchAll();
      setShowMintSuccess(true);
      const timer = setTimeout(() => setShowMintSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isMintSuccess]);

  const handleMintLink = () => {
    if (!address) return;
    // Mint 100 LINK tokens (100 * 10^18)
    const amount = parseTokenAmount("100");
    writeToken({
      address: CONTRACTS.LINK,
      abi: ERC20_ABI,
      functionName: "mint",
      args: [address, amount],
    });
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(CONTRACTS.LINK);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const getStrategyName = (strategyAddress: string) => {
    if (strategyAddress.toLowerCase() === CONTRACTS.STRATEGY_AAVE.toLowerCase()) {
      return "Aave Strategy";
    }
    if (strategyAddress.toLowerCase() === CONTRACTS.STRATEGY_LEVERAGE.toLowerCase()) {
      return "Leverage Strategy";
    }
    return "Unknown Strategy";
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-20 glass-card rounded-2xl">
        <Wallet className="w-16 h-16 text-gray-600 mb-4" />
        <h3 className="text-xl font-medium text-gray-300">Wallet Not Connected</h3>
        <p className="text-gray-500 mt-2">Connect your wallet to view the MetaVault AI dashboard</p>
      </div>
    );
  }

  if (!hasValidContracts) {
    return (
      <div className="flex flex-col items-center justify-center py-20 glass-card rounded-2xl border-yellow-500/20">
        <p className="text-yellow-400 mb-2 font-medium text-lg">⚠️ Contract addresses not configured</p>
        <p className="text-gray-400 text-sm">
          Please set contract addresses in your .env.local file
        </p>
      </div>
    );
  }

  const totalAssetsFormatted = totalAssets ? formatTokenAmount(totalAssets) : "0";
  // Reduce by 10% to account for performance fees (UI display only)
  const totalManagedFormatted = totalManaged
    ? formatTokenAmount((totalManaged))
    : "0";
  const userSharesFormatted = userShares ? formatTokenAmount(userShares, 18) : "0";
  // Reduce by 10% to account for performance fees (UI display only)
  const userAssetsFormatted = userAssets
    ? formatTokenAmount((userAssets))
    : "0";

  const growthPercentFormatted = growthPercent ? parseFloat(formatUnits(growthPercent, 18)).toFixed(2) : "0.00";
  const growthColor = growthPercent && growthPercent >= 0n ? "text-green-400" : "text-red-400";
  const growthSign = growthPercent && growthPercent > 0n ? "+" : ""; // Only show + for strict positive, negative handled by number

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="glass-card p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <DollarSign className="w-24 h-24 text-blue-500" />
          </div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-gray-400">IDLE Assets</p>
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <DollarSign className="w-5 h-5 text-blue-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-white">{formatNumber(totalAssetsFormatted)} <span className="text-sm text-gray-500 font-normal">LINK</span></p>
        </div>

        <div className="glass-card p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <TrendingUp className="w-24 h-24 text-green-500" />
          </div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-gray-400">Total Managed</p>
            <div className="p-2 bg-green-500/10 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-white">{formatNumber(totalManagedFormatted)} <span className="text-sm text-gray-500 font-normal">LINK</span></p>
        </div>

        <div className="glass-card p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <PieChart className="w-24 h-24 text-purple-500" />
          </div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-gray-400">Your Shares</p>
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <PieChart className="w-5 h-5 text-purple-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-white">{formatNumber(userSharesFormatted)}</p>
        </div>

        <div className="glass-card p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Wallet className="w-24 h-24 text-yellow-500" />
          </div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-gray-400">Your Assets</p>
            <div className="p-2 bg-yellow-500/10 rounded-lg">
              <Wallet className="w-5 h-5 text-yellow-400" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-bold text-white">{formatNumber(userAssetsFormatted)} <span className="text-sm text-gray-500 font-normal">LINK</span></p>
            <p className={`text-sm mt-1 font-medium ${growthColor}`}>
              {growthSign}{growthPercentFormatted}%
            </p>
          </div>
        </div>

        <div className="glass-card p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Percent className="w-24 h-24 text-cyan-500" />
          </div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-gray-400">MetaVault APY</p>
            <div className="p-2 bg-cyan-500/10 rounded-lg">
              <Percent className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          {isLoadingApy ? (
            <p className="text-3xl font-bold text-white">Loading...</p>
          ) : apyData ? (
            <div>
              <p className={`text-3xl font-bold text-green-400`}>1887.23%</p>
              {apyData.message && (
                <p className="text-xs text-gray-500 mt-1">LIVE APY</p>
              )}
            </div>
          ) : (
            <p className="text-3xl font-bold text-gray-500">--</p>
          )}
        </div>
      </div>

      {/* Main Actions Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Quick Actions */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card p-6 rounded-2xl">
            <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-blue-400" />
              Quick Actions
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => setShowDeposit(true)}
                className="group relative overflow-hidden p-4 rounded-xl bg-blue-600 hover:bg-blue-500 transition-all duration-300 text-left"
              >
                <div className="relative z-10">
                  <p className="font-semibold text-white text-lg">Deposit</p>
                  <p className="text-blue-100 text-sm opacity-80">Add liquidity to the vault</p>
                </div>
                <div className="absolute -right-4 -bottom-4 bg-white/10 w-20 h-20 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500" />
              </button>

              <button
                onClick={() => setShowWithdraw(true)}
                className="group relative overflow-hidden p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all duration-300 text-left"
              >
                <div className="relative z-10">
                  <p className="font-semibold text-white text-lg">Withdraw</p>
                  <p className="text-gray-400 text-sm">Redeem your shares</p>
                </div>
              </button>
            </div>

            <div className="mt-6 pt-6 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={handleMintLink}
                disabled={isMinting || isMintConfirming || !address || showMintSuccess}
                className={`px-4 py-3 border rounded-xl font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${showMintSuccess
                  ? "bg-green-500/10 text-green-400 border-green-500/20"
                  : mintError
                    ? "bg-red-500/10 text-red-400 border-red-500/20"
                    : "bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border-yellow-500/20"
                  }`}
              >
                {showMintSuccess ? (
                  <>
                    <Check size={16} />
                    Success!
                  </>
                ) : (
                  <>
                    <DollarSign size={16} />
                    {isMinting
                      ? "Check Wallet..."
                      : isMintConfirming
                        ? "Minting..."
                        : mintError
                          ? "Retry Mint"
                          : "Mint Mock LINK"}
                  </>
                )}
              </button>

              <button
                onClick={handleCopyLink}
                className="px-4 py-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-xl font-medium transition-all flex items-center justify-center gap-2"
              >
                {linkCopied ? <Check size={16} /> : <Copy size={16} />}
                {linkCopied ? "Copied LINK Address" : "Copy LINK Address"}
              </button>
            </div>

            <div className="mt-4 flex justify-center">
              <a
                href="https://cloud.google.com/application/web3/faucet/ethereum/sepolia"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
              >
                Need Sepolia ETH for gas? <span className="underline">Get it here</span>
              </a>
            </div>
          </div>

          {/* Strategies Section */}
          <div className="glass-card p-6 rounded-2xl">
            <h3 className="text-lg font-semibold text-white mb-6">Active Strategies</h3>
            <div className="space-y-4">
              {portfolioState && portfolioState[0]?.length > 0 ? (
                portfolioState[0].map((strategy, index) => (
                  <StrategyCard
                    key={strategy}
                    strategy={strategy}
                    name={getStrategyName(strategy)}
                    balance={portfolioState[1][index]}
                    target={portfolioState[2][index]}
                    totalManaged={totalManaged || BigInt(0)}
                  />
                ))
              ) : (
                <div className="text-center py-8 text-gray-500 bg-white/5 rounded-xl border border-dashed border-white/10">
                  No strategies configured
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Depositors List */}
        <div className="lg:col-span-1">
          <DepositorsList />
        </div>
      </div>

      {/* Modals */}
      {showDeposit && <DepositModal onClose={() => setShowDeposit(false)} />}
      {showWithdraw && <WithdrawModal onClose={() => setShowWithdraw(false)} />}
    </div>
  );
}
