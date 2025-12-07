"use client";

import { useEffect, useState } from "react";
import { formatAddress, formatNumber } from "@/lib/utils";
import { CONTRACTS, VAULT_ABI, ERC20_ABI } from "@/lib/contracts";
import { usePublicClient } from "wagmi";
import { Users } from "lucide-react";

interface Holder {
    address: string;
    percent: string;
    balance: bigint;
}

export function DepositorsList() {
    const publicClient = usePublicClient();
    const [holders, setHolders] = useState<Holder[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!publicClient) return;

        const fetchHolders = async () => {
            try {
                // 1. Get all Transfer events to find all potential holders
                // Inherited Filter: event Transfer(address indexed from, address indexed to, uint256 value);
                const logs = await publicClient.getContractEvents({
                    address: CONTRACTS.VAULT,
                    abi: ERC20_ABI,
                    eventName: 'Transfer',
                    fromBlock: 'earliest',
                });

                console.log("HoldersList: Found transfer logs", logs.length);

                const potentialHolders = new Set<string>();
                logs.forEach(log => {
                    if (log.args && typeof log.args === 'object' && 'to' in log.args) {
                        const to = log.args.to as string;
                        // Exclude zero address (burns)
                        if (to !== "0x0000000000000000000000000000000000000000") {
                            potentialHolders.add(to);
                        }
                    }
                });

                const uniqueAddresses = Array.from(potentialHolders);
                console.log("HoldersList: Unique addresses", uniqueAddresses);

                // 2. Fetch Total Supply
                const totalSupply = await publicClient.readContract({
                    address: CONTRACTS.VAULT,
                    abi: VAULT_ABI,
                    functionName: 'totalSupply',
                });

                // 3. Fetch current balance for each user
                const activeHolders: Holder[] = [];

                if (totalSupply > 0n) {
                    await Promise.all(
                        uniqueAddresses.map(async (userAddr) => {
                            try {
                                const shares = await publicClient.readContract({
                                    address: CONTRACTS.VAULT,
                                    abi: VAULT_ABI,
                                    functionName: 'balanceOf',
                                    args: [userAddr as `0x${string}`],
                                });

                                if (shares > 0n) {
                                    const percent = (Number(shares) * 100) / Number(totalSupply);
                                    activeHolders.push({
                                        address: userAddr,
                                        balance: shares,
                                        percent: percent.toFixed(2),
                                    });
                                }
                            } catch (err) {
                                console.error(`Error fetching balance for ${userAddr}`, err);
                            }
                        })
                    );
                }

                // Sort by balance (descending)
                activeHolders.sort((a, b) => Number(b.balance - a.balance)); // simple bigint sort for display order

                setHolders(activeHolders);
            } catch (error) {
                console.error("Failed to fetch holders:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchHolders();

        // Refresh every 30s
        const interval = setInterval(fetchHolders, 30000);
        return () => clearInterval(interval);
    }, [publicClient]);

    return (
        <div className="glass-card p-6 rounded-2xl h-full flex flex-col">
            <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                Holders
            </h3>

            <div className="flex-1 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
                {isLoading ? (
                    <div className="space-y-4">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="animate-pulse flex justify-between items-center">
                                <div className="h-4 w-24 bg-white/5 rounded"></div>
                                <div className="h-4 w-16 bg-white/5 rounded"></div>
                            </div>
                        ))}
                    </div>
                ) : holders.length > 0 ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 text-xs text-gray-500 pb-2 border-b border-white/5 uppercase tracking-wider">
                            <span>User</span>
                            <span className="text-right">Share %</span>
                        </div>
                        {holders.map((holder) => (
                            <div key={holder.address} className="grid grid-cols-2 items-center group">
                                <div className="font-mono text-sm text-gray-500 group-hover:text-blue-400 transition-colors truncate pr-4" title={holder.address}>
                                    {formatAddress(holder.address)}
                                </div>
                                <div className="text-right font-medium text-white">
                                    {holder.percent}%
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-10 text-gray-500">
                        No holders found
                    </div>
                )}
            </div>
        </div>
    );
}
