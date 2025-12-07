import { AgentBuilder, type SamplingHandler } from "@iqai/adk";
import { env, model } from "../../env";
import { getStrategySentinelAgent } from "../sub-agents/strategy-sentinel-agent/agent";
import { getTelegramTools } from "./tools";

export const createTelegramAgent = async (samplingHandler: SamplingHandler) => {
	const tools = await getTelegramTools(samplingHandler);
	const strategySentinelAgent = await getStrategySentinelAgent();

	return AgentBuilder.create("telegram_agent")
		.withInstruction("Summarize the recieved text or data into brief important notes not exeeding the max characters for a telegram message.")
		.withModel(model)
		.withSubAgents([strategySentinelAgent])
		.withTools(...tools)
		.build();
};