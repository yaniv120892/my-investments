import type { NextRequest } from "next/server";
import { describeError } from "@/utils/describeError";
import { describeFieldErrors } from "@/lib/validation/zodFieldErrors";
import type { FieldErrorMap } from "@/lib/validation/zodFieldErrors.types";

/**
 * Shared by every write route, so an unreadable body is a 400 naming the body
 * wherever it happens — not a 500 in whichever module did not recognise some
 * other module's validation error.
 */
export class InvalidJsonBodyError extends Error {
  public readonly fieldErrors: FieldErrorMap;

  public constructor(fieldErrors: FieldErrorMap) {
    super(`Request is invalid (${describeFieldErrors(fieldErrors)})`);
    this.name = "InvalidJsonBodyError";
    this.fieldErrors = fieldErrors;
  }
}

export async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch (error) {
    throw new InvalidJsonBodyError({
      body: `Request body must be valid JSON (${describeError(error)})`,
    });
  }
}
