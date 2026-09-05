import type { MastraModelConfig } from "@mastra/core/llm";

type ModelRouterId = `${string}/${string}`;

const DEFAULT_OPENAI_MODEL: ModelRouterId = "openai/gpt-4o";
const DEFAULT_GEMINI_MODEL: ModelRouterId = "google/gemini-2.5-flash";

/**
 * Every read is optional rather than required: an unset key must fail the one
 * advisor request that needs it, never the import that every page pulls in.
 */
export function getAdvisorModel(): MastraModelConfig {
  const baseUrl = process.env.ASSISTANT_MODEL_URL
    ? { url: process.env.ASSISTANT_MODEL_URL }
    : {};

  return {
    id: modelId(),
    apiKey: providerApiKey(),
    ...baseUrl,
  };
}

export function isAdvisorModelConfigured(): boolean {
  return Boolean(providerApiKey() || process.env.ASSISTANT_MODEL_URL);
}

function isGemini(): boolean {
  return process.env.AI_PROVIDER?.toLowerCase() === "gemini";
}

function providerApiKey(): string | undefined {
  return isGemini() ? process.env.GEMINI_API_KEY : process.env.OPENAI_API_KEY;
}

function modelId(): ModelRouterId {
  const fallback = isGemini() ? DEFAULT_GEMINI_MODEL : DEFAULT_OPENAI_MODEL;
  const override = process.env.ASSISTANT_MODEL_ID;
  if (!override) {
    return fallback;
  }
  return isModelRouterId(override) ? override : fallback;
}

function isModelRouterId(value: string): value is ModelRouterId {
  return value.includes("/");
}
