// src/services/monitoring-service.ts

import cron, { type ScheduledTask } from "node-cron";
import dedent from "dedent";
import { getRootAgent } from "../agents/agent";
import type { EnhancedRunner } from "@iqai/adk";
import { env } from "../env";

/**
 * Automated monitoring & management service for MetaVault.
 *
 * Uses node-cron (not setInterval).
 */
export class MonitoringService {
  private isRunning = false;
  private monitoringJob: ScheduledTask | null = null;
  private yieldGenerateJob: ScheduledTask | null = null;

  constructor(
    private readonly monitoringCronExpr = "0 */1 * * *", // every 1 hour
    private readonly yieldGenerateCronExpr = "*/2 * * * *", // every 2 min
    private readonly telegramRunner: EnhancedRunner,
  ) { }

  /**
   * Start cron-based monitoring
   */
  start(): void {
    if (this.isRunning) {
      console.log("⚠️ MonitoringService already running");
      return;
    }
    this.isRunning = true;

    console.log("🤖 Starting MonitoringService...");
    console.log(`📅 Comprehensive cycle: ${this.monitoringCronExpr}`);
    console.log(`💹 Yield generation: ${this.yieldGenerateCronExpr}`);

    // Full monitoring every 1 Hour
    this.monitoringJob = cron.schedule(this.monitoringCronExpr, async () => {
      try {
        await this.runMonitoringCycle();
      } catch (err) {
        console.error("❌ runMonitoringCycle error:", (err as Error).message);
      }
    });

    // Yield generation every 2 minute
    this.yieldGenerateJob = cron.schedule(this.yieldGenerateCronExpr, async () => {
      try {
        await this.yieldGeneration();
      } catch (err) {
        console.error("❌ yieldGeneration error:", (err as Error).message);
      }
    });

    // run one cycle immediately
    void this.runMonitoringCycle();

    console.log("✅ MonitoringService started");
  }

  /**
   * Stop cron jobs
   */
  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.yieldGenerateJob) this.yieldGenerateJob.stop();
    if (this.monitoringJob) this.monitoringJob.stop();

    console.log("🛑 MonitoringService stopped");
  }

  /**
   * Send report to Telegram via ADK runner
   */
  private async sendTelegramSummary(summary: string): Promise<void> {
    try {
      // const root = await getRootAgent();
      // const { runner } = root;

      await this.telegramRunner.ask(
        dedent`
        Send the following monitoring summary to Telegram channel ${env.TELEGRAM_CHANNEL_ID}:
        
        ${summary}
      `,
      );
      console.log("📨 Telegram summary sent");
    } catch (err: any) {
      console.error("❌ Error sending Telegram summary:", err.message);
    }
  }

  /**
   * Full monitoring cycle with 5 steps
   */
  public async runMonitoringCycle(): Promise<void> {
    const timestamp = new Date().toISOString();
    console.log("\n" + "=".repeat(80));
    console.log(`🔄 Running monitoring cycle @ ${timestamp}`);
    console.log("=".repeat(80));

    try {
      const root = await getRootAgent();
      const runner = root.runner as EnhancedRunner;

      // 1. Market prices
      console.log("📊 Step 1: Market prices...");
      const priceCheck = await runner.ask(
        "Check real LINK and WETH prices using get_token_prices and evaluate volatility (>10%).",
      );

      // 2. Leverage strategy
      console.log("⚖️ Step 2: Leverage strategy...");
      const leverageCheck = await runner.ask(
        "Use get_leverage_strategy_state to evaluate LTV, borrow amounts, and pause status.",
      );

      // 3. Risk assessment
      console.log("🚨 Step 3: Liquidation risk...");
      const riskCheck = await runner.ask(
        "Check liquidation risk using check_liquidation_risk and identify if deleveraging is required.",
      );

      // 4. Vault & strategies
      console.log("💼 Step 4: Vault state...");
      const vaultCheck = await runner.ask(
        "Fetch get_vault_state and get_strategy_states to determine if rebalancing is required. Include the current Weights and the target weights of the strategies are 80% for leverage and 20% for the aave pool.",
      );

      // 5. Actions to take
      console.log("🎯 Step 5: Decision making...");
      const actions = await runner.ask(
        dedent`
        Based on price, strategy, and risk:
        - initiate pausing or resuming leverage
        - initiate updating leverage parameters
        - initiate rebalancing if allocations diverge
        - initiate harvesting yields
        Provide reasoning and simulate transactions before recommending.
        `,
      );

      const summary = dedent`
        🤖 *MetaVault Monitoring Report*
        🕒 ${timestamp}

        📊 *Price Analysis:*  
        ${priceCheck}

        ⚖️ *Leverage State:*  
        ${leverageCheck}

        🚨 *Risk Assessment:*  
        ${riskCheck}

        💼 *Vault State:*  
        ${vaultCheck}

        🎯 *Actions:*  
        ${actions}
      `;

      await this.sendTelegramSummary(summary);

      console.log("✅ Monitoring cycle finished\n");
    } catch (err: any) {
      console.error("❌ Monitoring cycle error:", err.message);

      const errorReport = dedent`
        ❌ *Monitoring Error*
        🕒 ${new Date().toISOString()}
        Error: ${err.message}
      `;
      await this.sendTelegramSummary(errorReport);
    }
  }

  /**
   * Yield generation
   */
  public async yieldGeneration(): Promise<void> {
    try {
      const root = await getRootAgent();
      const runner = root.runner as EnhancedRunner;

      const result = await runner.ask(
        "accrue yield to the vault.",
      );

      console.log(`[${new Date().toISOString()}] Yield Generation →`, result);
    } catch (err: any) {
      console.error("yieldGeneration error:", err.message);
      await this.sendTelegramSummary(
        `❌ Yield generation failed: ${err.message}`,
      );
    }
  }
}

export default MonitoringService;
