import type { z } from "zod";
import type { FieldErrorMap } from "@/lib/validation/zodFieldErrors.types";

export type { FieldErrorMap } from "@/lib/validation/zodFieldErrors.types";

export function toFieldErrors(error: z.ZodError, body: unknown): FieldErrorMap {
  const fieldErrors: FieldErrorMap = {};

  for (const issue of error.issues) {
    if (issue.code === "unrecognized_keys") {
      for (const key of issue.keys) {
        fieldErrors[key] = `This field cannot be set (field: ${key})`;
      }
      continue;
    }

    const field = issue.path.length > 0 ? issue.path.join(".") : "body";
    if (fieldErrors[field] === undefined) {
      fieldErrors[field] = describeIssue(issue.message, body, issue.path);
    }
  }

  return fieldErrors;
}

function describeIssue(
  message: string,
  body: unknown,
  path: PropertyKey[]
): string {
  const receivedValue = readValueAtPath(body, path);
  if (receivedValue === undefined) {
    return message;
  }
  return `${message} (received: ${JSON.stringify(receivedValue)})`;
}

function readValueAtPath(body: unknown, path: PropertyKey[]): unknown {
  let currentValue: unknown = body;

  for (const key of path) {
    if (typeof currentValue !== "object" || currentValue === null) {
      return undefined;
    }
    currentValue = Reflect.get(currentValue, key);
  }

  return currentValue;
}

export function describeFieldErrors(fieldErrors: FieldErrorMap): string {
  return Object.entries(fieldErrors)
    .map(([field, message]) => `${field}: ${message}`)
    .join("; ");
}
