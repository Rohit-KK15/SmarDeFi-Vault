import { config } from "dotenv";
import { z } from "zod";
import { type LanguageModelV2, createOpenRouter } from "@openrouter/ai-sdk-provider";

config();

/**
 * Environment variable schema definition for the simple agent.
 *
 * Defines and validates required environment variables including:
 * - DEBUG: Optional debug mode flag (defaults to "false")
 * - GOOGLE_API_KEY: Required API key for Google/Gemini model access
 */
export const envSchema = z.object({
	ADK_DEBUG: z.coerce.boolean().default(false),
	OPEN_ROUTER_KEY: z.string(),
	LLM_MODEL: z.string().default("openai/gpt-4.1"),
	TELEGRAM_BOT_TOKEN: z.string().min(1),
	TELEGRAM_CHANNEL_ID: z.string().min(1),
	RPC_URL: z.string().min(1),
	PRIVATE_KEY: z.string().min(1),
	VAULT_ADDRESS: z.string().min(1),
	ROUTER_ADDRESS: z.string().min(1),
	STRATEGY_LEVERAGE_ADDRESS: z.string().min(1),
	STRATEGY_AAVE_ADDRESS: z.string().min(1),
	MOCK_AAVE_POOL_ADDRESS: z.string().min(1),
	LINK_ADDRESS: z.string().min(1),
});

/**
 * Validated environment variables parsed from process.env.
 * Throws an error if required environment variables are missing or invalid.
 */
export const env = envSchema.parse(process.env);
export let model: LanguageModelV2;
if (env.OPEN_ROUTER_KEY) {
	const openrouter = createOpenRouter({
		apiKey: env.OPEN_ROUTER_KEY
	});
	model = openrouter(env.LLM_MODEL);
}
