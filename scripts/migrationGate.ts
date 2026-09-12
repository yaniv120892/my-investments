/**
 * Vercel builds every pushed branch, not just main, and the project's database
 * variables are not scoped per environment — so an unguarded `migrate deploy`
 * in the build command would let a preview build of any feature branch apply
 * that branch's unmerged migrations to the live database. Production is
 * therefore the only environment allowed to migrate; everywhere else builds
 * against whatever schema is already there.
 */
export type MigrationDecision =
  { apply: true } | { apply: false; reason: string };

export function decideMigration(
  environment: Record<string, string | undefined>
): MigrationDecision {
  const vercelEnvironment = environment.VERCEL_ENV;

  if (!vercelEnvironment) {
    return {
      apply: false,
      reason:
        "VERCEL_ENV is unset, so this is not a Vercel build; run `npm run db:deploy` yourself if you meant to migrate",
    };
  }

  if (vercelEnvironment !== "production") {
    return {
      apply: false,
      reason: `VERCEL_ENV is "${vercelEnvironment}", and only a production build may write to the database`,
    };
  }

  // `migrate deploy` takes an advisory lock the transaction pooler does not
  // hold, so the datasource routes it through DIRECT_URL. Prisma's own error
  // for the missing value names the variable but not why the build wanted it.
  if (!environment.DIRECT_URL) {
    throw new Error(
      "DIRECT_URL is required to apply migrations: it is the unpooled endpoint (the DATABASE_URL host without `-pooler`), and `prisma migrate deploy` cannot take its advisory lock through the pooler"
    );
  }

  return { apply: true };
}
