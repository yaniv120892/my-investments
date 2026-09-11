/** Prisma's "record required but not found" code, raised by update and delete. */
const PRISMA_RECORD_NOT_FOUND = "P2025";

export function isRecordNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === PRISMA_RECORD_NOT_FOUND
  );
}
