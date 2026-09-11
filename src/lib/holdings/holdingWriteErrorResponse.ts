import { NextResponse } from "next/server";
import {
  HoldingNotFoundError,
  PlatformNameConflictError,
  PlatformNotFoundError,
} from "@/lib/holdings/holdingWriteErrors";
import { FieldValidationError } from "@/lib/validation/fieldErrors";
import { isRecordNotFoundError } from "@/lib/validation/prismaErrors";
import { describeError } from "@/utils/describeError";

export function toWriteErrorResponse(error: unknown): NextResponse {
  if (error instanceof FieldValidationError) {
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
