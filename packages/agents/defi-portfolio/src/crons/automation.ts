// rebalance-cron.ts (or .js if not using TypeScript)
import cron from "node-cron";
import { defiAgent } from "../agents/agent";

async function checkAndRebalance() {
  const { runner } = await defiAgent();
  // In ADK-TS, agents are usually wrapped in AgentBuilder, returning {runner}. LlmAgent itself may not have ask, so either expose via builder or directly use agent.ask if available.
  await runner.ask("Check if any vault/strategy requires rebalancing.");
  console.log("Rebalance check completed at", new Date().toISOString());
}

// Schedule to run every 10 minutes
cron.schedule("*/1 * * * *", checkAndRebalance);

// Optionally, run once at start
checkAndRebalance();