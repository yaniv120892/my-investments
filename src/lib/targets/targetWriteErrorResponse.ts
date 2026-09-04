import { NextResponse } from "next/server";
import { TargetValidationError } from "@/lib/targets/targetWriteErrors";
import { describeError } from "@/utils/describeError";

export function toTargetWriteErrorResponse(error: unknown): NextResponse {
  if (error instanceof TargetValidationError) {
    return NextResponse.json(
      { error: error.message, fieldErrors: error.fieldErrors },
      { status: 400 }
    );
  }

  console.error("Unexpected error while writing allocation targets:", error);
  return NextResponse.json(
    { error: `Internal server error (${describeError(error)})` },
    { status: 500 }
  );
}
