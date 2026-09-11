import type { NextRequest } from "next/server";
import { FieldValidationError } from "@/lib/validation/fieldErrors";
import { describeError } from "@/utils/describeError";
import type { FieldErrorMap } from "@/lib/validation/fieldErrors.types";

export class InvalidJsonBodyError extends FieldValidationError {
  public constructor(fieldErrors: FieldErrorMap) {
    super("Request is invalid", fieldErrors);
    this.name = "InvalidJsonBodyError";
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
