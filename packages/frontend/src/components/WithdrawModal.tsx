"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { CONTRACTS, VAULT_ABI } from "@/lib/contracts";
import { parseTokenAmount, formatTokenAmount, formatNumber } from "@/lib/utils";
import { X } from "lucide-react";

interface WithdrawModalProps {
  onClose: () => void;
}

export function WithdrawModal({ onClose }: WithdrawModalProps) {
  const { address } = useAccount();
  const [amount, setAmount] = useState("");

  // Get user shares
  const { data: userShares } = useReadContract({
    address: CONTRACTS.VAULT,
    abi: VAULT_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });

  // Hardcode 1% withdrawal fee (100 basis points)
  const WITHDRAW_FEE_BPS = BigInt(100);

  // Convert shares to assets to show withdrawal amount
  const { data: assetsOut } = useReadContract({
    address: CONTRACTS.VAULT,
    abi: VAULT_ABI,
    functionName: "convertToAssets",
    args: amount ? [parseTokenAmount(amount, 18)] : undefined,
  });

  const { writeContract: withdraw, data: withdrawHash } = useWriteContract();

  const { isLoading: isWithdrawing, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: withdrawHash,
  });

  useEffect(() => {
    if (isConfirmed) {
      setAmount("");
      onClose();
    }
  }, [isConfirmed, onClose]);

  const handleWithdraw = () => {
    if (!amount) return;
    const sharesBigInt = parseTokenAmount(amount, 18);
    withdraw({
      address: CONTRACTS.VAULT,
      abi: VAULT_ABI,
      functionName: "withdraw",
      args: [sharesBigInt],
    });
  };

  const sharesBigInt = amount ? parseTokenAmount(amount, 18) : BigInt(0);
  const hasShares = userShares ? sharesBigInt <= userShares : false;

  // Calculate fee and amount to receive
  const withdrawFee = assetsOut
    ? (assetsOut * WITHDRAW_FEE_BPS) / BigInt(10000)
    : BigInt(0);
  const amountToReceive = assetsOut && withdrawFee
    ? assetsOut - withdrawFee
    : BigInt(0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Withdraw Shares</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Amount (Shares)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
            />
            {userShares && (
              <p className="text-xs text-gray-500 mt-1">
                Your shares: {formatNumber(formatTokenAmount(userShares, 18))}
              </p>
            )}
          </div>

          {/* Fee Breakdown */}
          {amount && assetsOut && (
            <div className="space-y-2 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Withdrawal Amount:</span>
                <span className="text-white">{formatNumber(formatTokenAmount(assetsOut))} LINK</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Withdraw Fee (1%):</span>
                <span className="text-red-400">-{formatNumber(formatTokenAmount(withdrawFee))} LINK</span>
              </div>
              <div className="h-px bg-gray-700 my-2" />
              <div className="flex justify-between text-sm font-semibold">
                <span className="text-gray-300">You Will Receive:</span>
                <span className="text-green-400">{formatNumber(formatTokenAmount(amountToReceive))} LINK</span>
              </div>
            </div>
          )}

          {!hasShares && amount && (
            <p className="text-sm text-red-400">Insufficient shares</p>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleWithdraw}
              disabled={isWithdrawing || !amount || !hasShares}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors"
            >
              {isWithdrawing ? "Withdrawing..." : "Withdraw"}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}



