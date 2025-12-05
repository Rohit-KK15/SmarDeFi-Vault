import { createTool, ToolContext } from "@iqai/adk";
import { z } from "zod";
import { 
  StrategyLeverageABI, 
  StrategyAaveV3ABI, 
  VaultABI, 
  StrategyRouterABI,
  OracleABI
} from "../../shared/abi";
import { chain_read, chain_write, toStringBN } from "../../shared/utils/chain";
import { format18, parseUnits } from "../../shared/utils/bigint";
import { env } from "../../../env";

/* -----------------------------------------------------
   1️⃣ READ TOOLS
-----------------------------------------------------*/

export const get_vault_state = createTool({
  name: "get_vault_state",
  description: "Reads the vault's global state.",
  fn: async () => {
    const [
      totalAssets,
      totalSupply,
      totalManaged,
    ] = await Promise.all([
      chain_read(env.VAULT_ADDRESS, VaultABI.abi, "totalAssets", []),
      chain_read(env.VAULT_ADDRESS, VaultABI.abi, "totalSupply", []),
      chain_read(env.VAULT_ADDRESS, VaultABI.abi, "totalManagedAssets", []),
    ]);

    const raw = {
      totalAssets: totalAssets.toString(),
      totalSupply: totalSupply.toString(),
      totalManaged: totalManaged.toString(),
    };

    const human = {
      totalAssets: format18(raw.totalAssets),
      totalSupply: format18(totalSupply),
      totalManaged: format18(raw.totalManaged),
    };

    return toStringBN({ raw, human });
  }
});


export const get_strategy_states = createTool({
  name: "get_strategy_states",
  description: "Fetches detailed state for all strategies.",
  fn: async () => {
    const [
      poolBal,
      leverageDeposited,
      leverageBorrowed
    ] = await Promise.all([
      chain_read(env.STRATEGY_AAVE_ADDRESS, StrategyAaveV3ABI.abi, "strategyBalance", []),
      chain_read(env.STRATEGY_LEVERAGE_ADDRESS, StrategyLeverageABI.abi, "deposited", []),
      chain_read(env.STRATEGY_LEVERAGE_ADDRESS, StrategyLeverageABI.abi, "borrowedWETH", []),
    ]);

    const raw = {
      aaveBal: poolBal.toString(),
      levDeposited: leverageDeposited.toString(),
      levBorrowed: leverageBorrowed.toString()
    };

    const human = {
      aaveBal: format18(raw.aaveBal),
      levDeposited: format18(raw.levDeposited),
      levBorrowed: format18(raw.levBorrowed),
    };

    return toStringBN({ raw, human });
  }
});


export const get_user_balances = createTool({
  name: "get_user_balances",
  description: "Fetches vault share balance and withdrawable amount for a user.",
  schema: z.object({
    user: z.string()
  }),
  fn: async ({ user }) => {
    const [
      balance,
      assets
    ] = await Promise.all([
      chain_read(env.VAULT_ADDRESS, VaultABI.abi, "balanceOf", [user]),
      chain_read(env.VAULT_ADDRESS, VaultABI.abi, "convertToAssets", [
        await chain_read(env.VAULT_ADDRESS, VaultABI.abi, "balanceOf", [user])
      ])
    ]);

    const raw = {
      shares: balance.toString(),
      withdrawable: assets.toString(),
    };

    const human = {
      shares: format18(raw.shares),
      withdrawable: format18(raw.withdrawable),
    };

    return toStringBN({ raw, human });
  }
});


export const get_token_prices = createTool({
  name: "get_token_prices",
  description: "Fetches real-time LINK and WETH prices from CoinGecko API (real market prices). Returns LINK and WETH prices in USD, and calculates LINK price per WETH ratio.",
  fn: async () => {
    try {
      // Fetch real prices from CoinGecko API
      // Chainlink token ID: chainlink
      // WETH token ID: weth
      const response = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=chainlink,weth&vs_currencies=usd&include_24hr_change=true"
      );

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.statusText}`);
      }

      const data = await response.json() as {
        chainlink?: { usd: number; usd_24h_change?: number };
        weth?: { usd: number; usd_24h_change?: number };
      };
      
      // Extract prices in USD
      const linkPriceUSD = data.chainlink?.usd || 0;
      const wethPriceUSD = data.weth?.usd || 0;
      const link24hChange = data.chainlink?.usd_24h_change || 0;
      const weth24hChange = data.weth?.usd_24h_change || 0;

      if (linkPriceUSD === 0 || wethPriceUSD === 0) {
        throw new Error("Failed to fetch valid prices from CoinGecko");
      }

      // Calculate LINK price per WETH (how many LINK = 1 WETH)
      // If WETH = $3000 and LINK = $15, then 1 WETH = 200 LINK
      const linkPricePerWETH = wethPriceUSD / linkPriceUSD;

      // Convert to 18 decimal format (scaled by 1e18)
      const linkPricePerWETH_scaled = BigInt(Math.floor(linkPricePerWETH * 1e18));
      const wethPrice_scaled = BigInt(Math.floor(wethPriceUSD * 1e18));
      const linkPriceUSD_scaled = BigInt(Math.floor(linkPriceUSD * 1e18));

      const raw = {
        linkPriceUSD: linkPriceUSD_scaled.toString(),
        wethPriceUSD: wethPrice_scaled.toString(),
        linkPricePerWETH: linkPricePerWETH_scaled.toString(),
      };

      const human = {
        linkPriceUSD: linkPriceUSD.toFixed(2),
        wethPriceUSD: wethPriceUSD.toFixed(2),
        linkPricePerWETH: linkPricePerWETH.toFixed(6),
        link24hChange: link24hChange.toFixed(2) + "%",
        weth24hChange: weth24hChange.toFixed(2) + "%",
        // Price ratio interpretation
        interpretation: `1 WETH = ${linkPricePerWETH.toFixed(2)} LINK`,
      };

      return { raw, human, source: "CoinGecko API (real market prices)" };
    } catch (error: any) {
      // Fallback: try alternative API or return error
      try {
        // Alternative: CoinCap API (also free)
        const altResponse = await fetch(
          "https://api.coincap.io/v2/assets?ids=chainlink,ethereum"
        );
        
        if (altResponse.ok) {
          const altData = await altResponse.json() as {
            data?: Array<{ id: string; priceUsd: string }>;
          };
          const linkData = altData.data?.find((a) => a.id === "chainlink");
          const ethData = altData.data?.find((a) => a.id === "ethereum");
          
          if (linkData && ethData) {
            const linkPriceUSD = parseFloat(linkData.priceUsd);
            const wethPriceUSD = parseFloat(ethData.priceUsd); // Using ETH price as WETH proxy
            const linkPricePerWETH = wethPriceUSD / linkPriceUSD;

            const raw = {
              linkPriceUSD: BigInt(Math.floor(linkPriceUSD * 1e18)).toString(),
              wethPriceUSD: BigInt(Math.floor(wethPriceUSD * 1e18)).toString(),
              linkPricePerWETH: BigInt(Math.floor(linkPricePerWETH * 1e18)).toString(),
            };

            const human = {
              linkPriceUSD: linkPriceUSD.toFixed(2),
              wethPriceUSD: wethPriceUSD.toFixed(2),
              linkPricePerWETH: linkPricePerWETH.toFixed(6),
              interpretation: `1 WETH ≈ ${linkPricePerWETH.toFixed(2)} LINK`,
            };

            return { raw, human, source: "CoinCap API (real market prices)" };
          }
        }
      } catch (altError) {
        // Both APIs failed
      }

      throw new Error(`Failed to fetch real prices: ${error.message}`);
    }
  }
});


export const get_leverage_strategy_state = createTool({
  name: "get_leverage_strategy_state",
  description: "Gets comprehensive state of the leverage strategy including deposited amount, borrowed WETH, LTV, pause status, and leverage parameters.",
  fn: async () => {
    const [
      leverageState,
      ltv,
      paused,
      maxDepth,
      borrowFactor
    ] = await Promise.all([
      chain_read(env.STRATEGY_LEVERAGE_ADDRESS, StrategyLeverageABI.abi, "getLeverageState", []),
      chain_read(env.STRATEGY_LEVERAGE_ADDRESS, StrategyLeverageABI.abi, "getLTV", []),
      chain_read(env.STRATEGY_LEVERAGE_ADDRESS, StrategyLeverageABI.abi, "paused", []),
      chain_read(env.STRATEGY_LEVERAGE_ADDRESS, StrategyLeverageABI.abi, "maxDepth", []),
      chain_read(env.STRATEGY_LEVERAGE_ADDRESS, StrategyLeverageABI.abi, "borrowFactor", []),
    ]);

    // Handle tuple return: [deposited, borrowed, netExposure, loops, maxDepth]
    const deposited = Array.isArray(leverageState) ? leverageState[0] : leverageState.deposited_;
    const borrowed = Array.isArray(leverageState) ? leverageState[1] : leverageState.borrowed_;
    const netExposure = Array.isArray(leverageState) ? leverageState[2] : leverageState.netExposure;

    const raw = {
      deposited: deposited.toString(),
      borrowedWETH: borrowed.toString(),
      netExposure: netExposure.toString(),
      ltv: ltv.toString(),
      paused: paused,
      maxDepth: maxDepth.toString(),
      borrowFactor: borrowFactor.toString(),
    };

    const human = {
      deposited: format18(raw.deposited),
      borrowedWETH: format18(raw.borrowedWETH),
      netExposure: format18(raw.netExposure),
      ltv: Number(format18(raw.ltv)),
      paused: raw.paused,
      maxDepth: Number(raw.maxDepth),
      borrowFactor: Number(raw.borrowFactor) / 100, // Convert from basis points to percentage
    };

    return { raw, human };
  }
});

// Core APY calculation logic (extracted for reuse)
async function calculateVaultAPY(toolContext: ToolContext) {
  // Load previous state from context
  const stateKey = "session.vault_apy_state";
  const state = toolContext.state[stateKey] as {
    lastTVL?: number;
    lastTimestamp?: number;
  } | undefined;

  const lastTVL = state?.lastTVL ? Number(state.lastTVL) : 0;
  const lastTs = state?.lastTimestamp ? Number(state.lastTimestamp) : 0;
  const now = Math.floor(Date.now() / 1000);

  // Read current TVL
  const tvl = Number(
    await chain_read(env.VAULT_ADDRESS, VaultABI.abi, "totalManagedAssets", [])
  );

  // First run - store baseline state
  if (lastTVL === 0 || lastTs === 0) {
    // Store initial state in context
    toolContext.state[stateKey] = {
      lastTVL: tvl,
      lastTimestamp: now
    };

    return {
      apy: 0,
      readable: "0%",
      message: "APY baseline set (first run).",
      tvl
    };
  }

  let dt: number = now - lastTs;
  if (dt <= 0) dt = 1;

  const growth = (tvl - lastTVL) / lastTVL;
  const YEAR = 365 * 24 * 3600;

  const apy = (growth / dt) * YEAR;
  const readable = `${(apy * 100).toFixed(2)}%`;

  // Update state in context with new values
  toolContext.state[stateKey] = {
    lastTVL: tvl,
    lastTimestamp: now
  };

  return {
    apy,
    readable,
    tvl,
    growth,
    dt
  };
}

export const get_vault_apy = createTool({
  name: "get_vault_apy",
  description: "Calculates the vault APY based on TVL growth.",
  fn: async (_params: {}, toolContext: ToolContext) => {
    return calculateVaultAPY(toolContext);
  }
});

// Export the core function for use in helper
export { calculateVaultAPY };



/* -----------------------------------------------------
   2️⃣ WRITE TOOLS (TX SENDING)
-----------------------------------------------------*/

export const vault_deposit = createTool({
  name: "vault_deposit",
  description: "Deposit LINK into vault.",
  schema: z.object({
    amount: z.string()
  }),
  fn: async ({ amount }) => {
    const tx = await chain_write(
      env.VAULT_ADDRESS,
      VaultABI.abi,
      "deposit",
      [parseUnits(amount)] // value: LINK
    );
    return tx.hash;
  }
});


export const vault_withdraw = createTool({
  name: "vault_withdraw",
  description: "Withdraw shares from vault.",
  schema: z.object({
    shares: z.string()
  }),
  fn: async ({ shares }) => {
    const tx = await chain_write(env.VAULT_ADDRESS, VaultABI.abi, "withdraw", [shares]);
    return tx.hash;
  }
});


export const rebalance_vault = createTool({
  name: "rebalance_vault",
  description: "Triggers vault rebalance().",
  fn: async () => {
    const tx = await chain_write(env.ROUTER_ADDRESS, StrategyRouterABI.abi, "rebalance", []);
    return tx.hash;
  }
});


export const harvest_strategy = createTool({
  name: "harvest_strategy",
  description: "Calls harvestAll().",
  fn: async () => {
    const tx = await chain_write(env.ROUTER_ADDRESS, StrategyRouterABI.abi, "harvestAll", []);
    return tx.hash;
  }
});


/* -----------------------------------------------------
   3️⃣ RISK MANAGEMENT TOOLS
-----------------------------------------------------*/

export const check_liquidation_risk = createTool({
  name: "check_liquidation_risk",
  description: "Checks leverage strategy liquidation risk.",
  fn: async () => {
    const [
      deposited,
      borrowed
    ] = await Promise.all([
      chain_read(env.STRATEGY_LEVERAGE_ADDRESS, StrategyLeverageABI.abi, "deposited", []),
      chain_read(env.STRATEGY_LEVERAGE_ADDRESS, StrategyLeverageABI.abi, "borrowedWETH", []),
    ]);

    const dep = Number(format18(deposited.toString()));
    const bor = Number(format18(borrowed.toString()));

    const ltv = bor / dep;

    return {
      ltv,
      safe: ltv < 0.70,
      warning: ltv >= 0.70 && ltv < 0.80,
      critical: ltv >= 0.80,
    };
  }
});


export const auto_deleverage = createTool({
  name: "auto_deleverage",
  description: "Repay debt to reduce liquidation risk.",
  fn: async () => {
    const tx = await chain_write(
      env.ROUTER_ADDRESS,
      StrategyRouterABI.abi,
      "triggerDeleverage",
      [env.STRATEGY_LEVERAGE_ADDRESS, 10]
    );
    return tx.hash;
  }
});


export const update_strategy_target_weights = createTool({
  name: "update_strategy_target_weights",
  description: "Updates target allocation weights for strategies in basis points (10000 = 100%). Must sum to 10000. Example: [8000, 2000] means 80% to first strategy, 20% to second.",
  schema: z.object({
    leverageStrategyBps: z.number().min(0).max(10000).describe("Target weight for leverage strategy in basis points (0-10000)"),
    aaveStrategyBps: z.number().min(0).max(10000).describe("Target weight for Aave strategy in basis points (0-10000)")
  }),
  fn: async ({ leverageStrategyBps, aaveStrategyBps }) => {
    if (leverageStrategyBps + aaveStrategyBps !== 10000) {
      throw new Error("Target weights must sum to 10000 (100%)");
    }

    const strategies = [env.STRATEGY_LEVERAGE_ADDRESS, env.STRATEGY_AAVE_ADDRESS];
    const bps = [leverageStrategyBps, aaveStrategyBps];

    const tx = await chain_write(
      env.ROUTER_ADDRESS,
      StrategyRouterABI.abi,
      "setStrategies",
      [strategies, bps]
    );
    return { tx: tx.hash, newWeights: { leverage: leverageStrategyBps, aave: aaveStrategyBps } };
  }
});


export const toggle_leverage_strategy_pause = createTool({
  name: "toggle_leverage_strategy_pause",
  description: "Pauses or unpauses the leverage strategy. When paused, the strategy cannot invest or deleverage.",
  fn: async () => {
    const tx = await chain_write(
      env.STRATEGY_LEVERAGE_ADDRESS,
      StrategyLeverageABI.abi,
      "togglePause",
      []
    );
    
    // Read the new pause state
    const paused = await chain_read(env.STRATEGY_LEVERAGE_ADDRESS, StrategyLeverageABI.abi, "paused", []);
    
    return { 
      tx: tx.hash, 
      paused: paused,
      status: paused ? "paused" : "active"
    };
  }
});


export const update_leverage_params = createTool({
  name: "update_leverage_params",
  description: "Updates leverage strategy parameters: maxDepth (1-6, max loop iterations) and borrowFactor (0-8000, parts-per-10000, e.g., 6000 = 60% of collateral borrowed per loop).",
  schema: z.object({
    maxDepth: z.number().min(1).max(6).describe("Maximum leverage loop iterations (1-6)"),
    borrowFactor: z.number().min(0).max(8000).describe("Borrow factor in basis points (0-8000, e.g., 6000 = 60%)")
  }),
  fn: async ({ maxDepth, borrowFactor }) => {
    const tx = await chain_write(
      env.STRATEGY_LEVERAGE_ADDRESS,
      StrategyLeverageABI.abi,
      "setLeverageParams",
      [maxDepth, borrowFactor]
    );
    return { 
      tx: tx.hash, 
      newParams: { 
        maxDepth, 
        borrowFactor: borrowFactor / 100 + "%" 
      } 
    };
  }
});


/* -----------------------------------------------------
   4️⃣ SIMULATION TOOLS
-----------------------------------------------------*/

// export const simulate_yield = createTool({
//   name: "simulate_yield",
//   description: "Simulates yield for n days using compound interest.",
//   schema: z.object({
//     principal: z.string(),
//     apr: z.number(),
//     days: z.number()
//   }),
//   fn: async ({ principal, apr, days }) => {
//     const p = Number(format18(principal));
//     const daily = apr / 365;
//     const amount = p * Math.pow(1 + daily, days);

//     return {
//       initial: p,
//       final: amount,
//       profit: amount - p
//     };
//   }
// });



/* -----------------------------------------------------
   EXPORT ALL
-----------------------------------------------------*/
export default {
  get_vault_state,
  get_strategy_states,
  get_user_balances,
  vault_deposit,
  vault_withdraw,
  rebalance_vault,
  harvest_strategy,
  check_liquidation_risk,
  auto_deleverage,
  get_token_prices,
  get_leverage_strategy_state,
  get_vault_apy,
  update_strategy_target_weights,
  toggle_leverage_strategy_pause,
  update_leverage_params,
  // simulate_yield
};
