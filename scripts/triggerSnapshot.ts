import { describeError } from "@/utils/describeError";

const SNAPSHOT_PATH = "/api/snapshot";

async function main(): Promise<void> {
  const baseUrl = process.env.SNAPSHOT_BASE_URL;
  if (!baseUrl) {
    throw new Error(
      "SNAPSHOT_BASE_URL is required so the script knows which deployment to snapshot (e.g. https://my-investments.vercel.app)"
    );
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    throw new Error(
      `CRON_SECRET is required to authorize ${SNAPSHOT_PATH}; set the same value that is configured on the deployment at ${baseUrl}`
    );
  }

  const endpoint = new URL(SNAPSHOT_PATH, baseUrl).toString();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${cronSecret}`,
      "content-type": "application/json",
    },
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(
      `Snapshot request failed (endpoint: ${endpoint}, status: ${response.status} ${response.statusText}, body: ${body})`
    );
  }

  console.log(`Snapshot triggered at ${endpoint}: ${body}`);
}

async function run(): Promise<void> {
  try {
    await main();
  } catch (error) {
    console.error(describeError(error));
    process.exitCode = 1;
  }
}

void run();
