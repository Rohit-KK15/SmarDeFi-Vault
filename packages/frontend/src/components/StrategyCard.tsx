"use client";

import { formatTokenAmount, formatNumber, formatAddress } from "@/lib/utils";
import { formatUnits } from "viem";
import { Copy, Check } from "lucide-react";
import { useState } from "react";

interface StrategyCardProps {
  strategy: string;
  name?: string;
  balance: bigint;
  target: bigint;
  totalManaged: bigint;
}

export function StrategyCard({ strategy, name, balance, target, totalManaged }: StrategyCardProps) {
  const [copied, setCopied] = useState(false);
  const balanceFormatted = formatTokenAmount(balance);
  const targetBps = Number(target);
  const targetPercent = targetBps / 100;
  const actualPercent = totalManaged > 0n
    ? (Number(balance) * 10000) / Number(totalManaged) / 100
    : 0;
  const deviation = actualPercent - targetPercent;

  const handleCopy = () => {
    navigator.clipboard.writeText(strategy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold text-white">{name || "Strategy"}</p>
            <button
              onClick={handleCopy}
              className="text-gray-400 hover:text-white transition-colors p-1"
              title="Copy strategy address"
            >
              {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            </button>
          </div>
          <p className="font-mono text-xs text-gray-500">{formatAddress(strategy)}</p>
          <p className="text-lg font-semibold mt-1">{formatNumber(balanceFormatted)} LINK</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-400">Target</p>
          <p className="text-lg font-semibold">{targetPercent.toFixed(1)}%</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Actual Allocation</span>
          <span className={deviation > 5 ? "text-yellow-400" : "text-green-400"}>
            {actualPercent.toFixed(2)}%
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all"
            style={{ width: `${Math.min(actualPercent, 100)}%` }}
          />
        </div>
        {Math.abs(deviation) > 5 && (
          <p className="text-xs text-yellow-400">
            {deviation > 0 ? "+" : ""}{deviation.toFixed(2)}% deviation from target
          </p>
        )}
      </div>
    </div>
  );
}



