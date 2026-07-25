import { NextResponse } from "next/server";
import {
  HoldingNotFoundError,
  HoldingValidationError,
  PlatformNameConflictError,
  PlatformNotFoundError,
} from "@/lib/holdings/holdingWriteErrors";
import { describeError } from "@/utils/describeError";

const PRISMA_RECORD_NOT_FOUND = "P2025";

export function toWriteErrorResponse(error: unknown): NextResponse {
  if (error instanceof HoldingValidationError) {
    return NextResponse.json(
      { error: error.message, fieldErrors: error.fieldErrors },
      { status: 400 }
    );
  }

  if (error instanceof PlatformNotFoundError) {
    return NextResponse.json(
      { error: error.message, fieldErrors: error.fieldErrors },
      { status: 404 }
    );
  }

  if (error instanceof HoldingNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  if (error instanceof PlatformNameConflictError) {
    return NextResponse.json(
      { error: error.message, fieldErrors: error.fieldErrors },
      { status: 409 }
    );
  }

  if (isRecordNotFoundError(error)) {
    return NextResponse.json(
      { error: "That record no longer exists" },
      { status: 404 }
    );
  }

  console.error("Unexpected error while writing to the portfolio:", error);
  return NextResponse.json(
    { error: `Internal server error (${describeError(error)})` },
    { status: 500 }
  );
}

function isRecordNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === PRISMA_RECORD_NOT_FOUND
  );
}
