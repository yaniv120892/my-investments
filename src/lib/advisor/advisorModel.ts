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

  switch (process.env.AI_PROVIDER?.toLowerCase()) {
    case "gemini":
      return {
        id: modelId(DEFAULT_GEMINI_MODEL),
        apiKey: process.env.GEMINI_API_KEY,
        ...baseUrl,
      };
    case "chatgpt":
    default:
      return {
        id: modelId(DEFAULT_OPENAI_MODEL),
        apiKey: process.env.OPENAI_API_KEY,
        ...baseUrl,
      };
  }
}

export function isAdvisorModelConfigured(): boolean {
  const provider = process.env.AI_PROVIDER?.toLowerCase();
  const apiKey =
    provider === "gemini"
      ? process.env.GEMINI_API_KEY
      : process.env.OPENAI_API_KEY;
  return Boolean(apiKey) || Boolean(process.env.ASSISTANT_MODEL_URL);
}

function modelId(fallback: ModelRouterId): ModelRouterId {
  const override = process.env.ASSISTANT_MODEL_ID;
  if (!override) {
    return fallback;
  }
  return isModelRouterId(override) ? override : fallback;
}

function isModelRouterId(value: string): value is ModelRouterId {
  return value.includes("/");
}
