import { Memory } from "@mastra/memory";
import { PostgresStore } from "@mastra/pg";

/**
 * Mastra creates and migrates its own tables, so it wants the direct endpoint
 * rather than a pooled one: through PgBouncer the memory store fails to init.
 */
const MASTRA_SCHEMA = "mastra";

// Memoised the way `db.ts` memoises PrismaClient: this store opens its own
// unpooled Postgres connections, and a dev hot-reload would otherwise strand a
// pool per edit against the endpoint least able to spare the connections.
const globalForAdvisorMemory = globalThis as unknown as {
  advisorMemory: Memory | undefined;
};

let hasWarned = false;

export function getAdvisorMemory(): Memory | undefined {
  if (globalForAdvisorMemory.advisorMemory) {
    return globalForAdvisorMemory.advisorMemory;
  }

  const connectionString = advisorMemoryConnectionString();
  if (!connectionString) {
    warnOnce(
      "Advisor memory disabled: set MASTRA_DB_URL or DIRECT_URL to keep conversation threads"
    );
    return undefined;
  }

  try {
    globalForAdvisorMemory.advisorMemory = new Memory({
      storage: new PostgresStore({
        id: "advisor-memory",
        connectionString,
        schemaName: MASTRA_SCHEMA,
      }),
    });
    return globalForAdvisorMemory.advisorMemory;
  } catch (error) {
    // Losing the conversation history beats losing the answer.
    warnOnce(
      `Advisor memory disabled: storage failed to initialise (${error})`
    );
    return undefined;
  }
}

/**
 * Derived from the store, not from the env var: a configured but unusable
 * endpoint leaves the agent with no memory, and a caller that trimmed the
 * history on the env var's word would send a follow-up with no context at all.
 */
export function isMemoryEnabled(): boolean {
  return getAdvisorMemory() !== undefined;
}

export function getThreadId(userId: string): string {
  return `investment-advisor:${userId}`;
}

function advisorMemoryConnectionString(): string {
  return process.env.MASTRA_DB_URL || process.env.DIRECT_URL || "";
}

function warnOnce(message: string): void {
  if (hasWarned) {
    return;
  }
  hasWarned = true;
  console.warn(message);
}
