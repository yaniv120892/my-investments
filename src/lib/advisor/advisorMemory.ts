import { Memory } from "@mastra/memory";
import { PostgresStore } from "@mastra/pg";

/**
 * Mastra creates and migrates its own tables, so it wants the direct endpoint
 * rather than a pooled one: through PgBouncer the memory store fails to init.
 */
const MASTRA_SCHEMA = "mastra";

let memory: Memory | undefined;
let hasWarned = false;

export function getAdvisorMemory(): Memory | undefined {
  const connectionString = advisorMemoryConnectionString();
  if (!connectionString) {
    warnOnce(
      "Advisor memory disabled: set MASTRA_DB_URL or DIRECT_URL to keep conversation threads"
    );
    return undefined;
  }

  try {
    memory ??= new Memory({
      storage: new PostgresStore({
        id: "advisor-memory",
        connectionString,
        schemaName: MASTRA_SCHEMA,
      }),
    });
    return memory;
  } catch (error) {
    warnOnce(
      `Advisor memory disabled: storage failed to initialise (${error})`
    );
    return undefined;
  }
}

export function isMemoryEnabled(): boolean {
  return Boolean(advisorMemoryConnectionString());
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
