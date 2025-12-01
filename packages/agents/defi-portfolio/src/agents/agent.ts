import { AgentBuilder } from "@iqai/adk";
import { model } from "../env";

export const defiAgent = async () => {
    return await AgentBuilder
        .create("DeFi_Portfolio_Agent")
        .withDescription("Portfolio Analyser and Market Advisor")
        .withInstruction("Analyses User's Potfolio and suggest actions")
        .withModel(model)
        .build();
}