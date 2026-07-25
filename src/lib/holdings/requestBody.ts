import type { NextRequest } from "next/server";
import { HoldingValidationError } from "@/lib/holdings/holdingWriteErrors";
import { describeError } from "@/utils/describeError";

export async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch (error) {
    throw new HoldingValidationError({
      body: `Request body must be valid JSON (${describeError(error)})`,
    });
  }
}
