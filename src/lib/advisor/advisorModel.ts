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

/** Named by the model layer, so the 503 cannot name a key for the wrong provider. */
export function requiredApiKeyName(): string {
  return isGemini() ? "GEMINI_API_KEY" : "OPENAI_API_KEY";
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
  if (isModelRouterId(override)) {
    return override;
  }
  // Falling back silently would serve a different model than was configured.
  console.warn(
    `Ignoring ASSISTANT_MODEL_ID: expected "provider/model" (received: ${override})`
  );
  return fallback;
}

function isModelRouterId(value: string): value is ModelRouterId {
  return /^[a-z0-9-]+\/.+$/.test(value);
}
