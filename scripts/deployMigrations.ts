import { spawnSync } from "node:child_process";
import { decideMigration } from "./migrationGate";
import { describeError } from "@/utils/describeError";

function main(): void {
  const decision = decideMigration(process.env);

  if (!decision.apply) {
    console.log(`Skipping migrations: ${decision.reason}`);
    return;
  }

  console.log("Applying pending migrations before building");
  const result = spawnSync("npm", ["run", "db:deploy"], { stdio: "inherit" });

  if (result.error) {
    throw result.error;
  }

  // A build that ships a client the database cannot serve is the failure this
  // script exists to prevent, so an unapplied migration stops the deploy
  // rather than surfacing as a runtime error on the next cron.
  if (result.status !== 0) {
    throw new Error(
      `prisma migrate deploy exited with ${result.status ?? "no status"}; the deploy is stopped so the build cannot ship a schema the database does not have`
    );
  }
}

function run(): void {
  try {
    main();
  } catch (error) {
    console.error(describeError(error));
    process.exitCode = 1;
  }
}

run();
