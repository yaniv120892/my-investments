import { z } from "zod";
import { AssetClass, Liquidity, PriceSource } from "@prisma/client";
import { HoldingValidationError } from "@/lib/holdings/holdingWriteErrors";
import type {
  CreateHoldingInput,
  CreatePlatformInput,
  FieldErrorMap,
  ManualValueEntry,
  UpdateHoldingInput,
} from "@/lib/holdings/holdingWrite.types";

const createHoldingSchema = z.strictObject({
  platformId: z.string().min(1, "A platform must be selected"),
  assetName: z.string({ error: "An asset name is required" }).trim(),
  assetClass: z.enum(AssetClass),
  liquidity: z.enum(Liquidity),
  quantity: z.number({ error: "A quantity is required and must be a number" }),
  priceSource: z.enum(PriceSource),
  sourceSymbol: z.string({ error: "A symbol must be text" }).trim().nullish(),
  currency: z.string({ error: "A currency is required" }).trim(),
  targetPercent: z
    .number({ error: "Target percent must be a number" })
    .nullish(),
  manualValueNis: z
    .number({ error: "A manual value must be a number in NIS" })
    .nullish(),
});

const updateHoldingSchema = createHoldingSchema.partial();

/**
 * Keyed by holding rather than an array of pairs: the key is the only stable
 * name a field error can carry back to the form, and a map cannot confirm the
 * same holding twice.
 */
const recordManualValuesSchema = z.strictObject({
  values: z
    .record(
      z.string().min(1, "A holding must be identified"),
      z.number({ error: "A manual value must be a number in NIS" })
    )
    .refine(
      (values) => Object.keys(values).length > 0,
      "At least one manual value must be confirmed"
    ),
});

const createPlatformSchema = z.strictObject({
  name: z.string().trim(),
  baseCurrency: z.string().trim(),
});

export function parseCreateHoldingBody(body: unknown): CreateHoldingInput {
  return parseWithSchema(createHoldingSchema, body);
}

export function parseUpdateHoldingBody(body: unknown): UpdateHoldingInput {
  return parseWithSchema(updateHoldingSchema, body);
}

export function parseRecordManualValuesBody(body: unknown): ManualValueEntry[] {
  const { values } = parseWithSchema(recordManualValuesSchema, body);
  return Object.entries(values).map(([holdingId, manualValueNis]) => ({
    holdingId,
    manualValueNis,
  }));
}

export function parseCreatePlatformBody(body: unknown): CreatePlatformInput {
  return parseWithSchema(createPlatformSchema, body);
}

function parseWithSchema<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new HoldingValidationError(toFieldErrors(result.error, body));
  }
  return result.data;
}

function toFieldErrors(error: z.ZodError, body: unknown): FieldErrorMap {
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
