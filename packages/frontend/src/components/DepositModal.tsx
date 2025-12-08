"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { CONTRACTS, VAULT_ABI, ERC20_ABI, isValidAddress } from "@/lib/contracts";
import { parseTokenAmount, formatTokenAmount, formatNumber } from "@/lib/utils";
import { X } from "lucide-react";

interface DepositModalProps {
  onClose: () => void;
}

export function DepositModal({ onClose }: DepositModalProps) {
  const { address } = useAccount();
  const [amount, setAmount] = useState("");
  const [shouldDepositAfterApproval, setShouldDepositAfterApproval] = useState(false);
  const hasValidContracts = isValidAddress(CONTRACTS.VAULT) && isValidAddress(CONTRACTS.LINK);


  const amountBigInt = amount ? parseTokenAmount(amount) : BigInt(0);

  // Check LINK balance
  const { data: linkBalance } = useReadContract({
    address: CONTRACTS.LINK,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && hasValidContracts },
  });

  // Check allowance
  const { data: allowance } = useReadContract({
    address: CONTRACTS.LINK,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && CONTRACTS.VAULT ? [address, CONTRACTS.VAULT] : undefined,
  });

  const needsApproval = allowance ? amountBigInt > allowance : true;
  const hasBalance = linkBalance ? amountBigInt <= linkBalance : false;


  const { writeContract: approveToken, data: approveHash, isPending: isApprovePending, isError: isApproveWriteError } = useWriteContract();
  const { writeContract: deposit, data: depositHash, isPending: isDepositPending } = useWriteContract();

  const { isLoading: isApproving, isSuccess: isApprovalSuccess, isError: isApproveReceiptError } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  const { isLoading: isDepositing, isSuccess: isDepositSuccess } = useWaitForTransactionReceipt({
    hash: depositHash,
  });

  useEffect(() => {
    if (isDepositSuccess) {
      setAmount("");
      setShouldDepositAfterApproval(false);
      onClose();
    }
  }, [isDepositSuccess, onClose]);

  // Reset state if approval fails (rejected or reverted)
  useEffect(() => {
    if (isApproveWriteError || isApproveReceiptError) {
      setShouldDepositAfterApproval(false);
    }
  }, [isApproveWriteError, isApproveReceiptError]);

  useEffect(() => {
    if (isApprovalSuccess && shouldDepositAfterApproval) {
      const amountBigInt = parseTokenAmount(amount);
      deposit({
        address: CONTRACTS.VAULT,
        abi: VAULT_ABI,
        functionName: "deposit",
        args: [amountBigInt],
      });
      setShouldDepositAfterApproval(false);
    }
  }, [isApprovalSuccess, shouldDepositAfterApproval, amount, deposit]);

  const handleUnifiedDeposit = () => {
    if (!amount) return;

    if (needsApproval) {
      setShouldDepositAfterApproval(true);
      approveToken({
        address: CONTRACTS.LINK,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [CONTRACTS.VAULT, amountBigInt],
      });
    } else {
      deposit({
        address: CONTRACTS.VAULT,
        abi: VAULT_ABI,
        functionName: "deposit",
        args: [amountBigInt],
      });
    }
  };



  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Deposit LINK</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Amount (LINK)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
            />
            {linkBalance && (
              <p className="text-xs text-gray-500 mt-1">
                Balance: {formatNumber(formatTokenAmount(linkBalance))} LINK
              </p>
            )}
          </div>

          {!hasBalance && amount && (
            <p className="text-sm text-red-400">Insufficient balance</p>
          )}


          <div className="flex gap-2">
            <button
              onClick={handleUnifiedDeposit}
              disabled={
                !amount ||
                !hasBalance ||
                isApprovePending ||
                isApproving ||
                isDepositPending ||
                isDepositing ||
                shouldDepositAfterApproval
              }
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors"
            >
              {isApprovePending || isApproving || shouldDepositAfterApproval
                ? "Approving..."
                : isDepositPending || isDepositing
                  ? "Depositing..."
                  : needsApproval
                    ? "Approve & Deposit"
                    : "Deposit"}
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

