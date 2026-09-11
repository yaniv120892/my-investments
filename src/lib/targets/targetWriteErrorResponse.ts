import { NextResponse } from "next/server";
import { FieldValidationError } from "@/lib/validation/fieldErrors";
import { isRecordNotFoundError } from "@/lib/validation/prismaErrors";
import { describeError } from "@/utils/describeError";

export function toTargetWriteErrorResponse(error: unknown): NextResponse {
  if (error instanceof FieldValidationError) {
    return NextResponse.json(
      { error: error.message, fieldErrors: error.fieldErrors },
      { status: 400 }
    );
  }

  // A holding validated a moment ago can be deleted before the transaction
  // runs; that is a 404, not an internal error leaking Prisma's message.
  if (isRecordNotFoundError(error)) {
    return NextResponse.json(
      { error: "That holding no longer exists" },
      { status: 404 }
    );
  }

  console.error("Unexpected error while writing allocation targets:", error);
  return NextResponse.json(
    { error: `Internal server error (${describeError(error)})` },
    { status: 500 }
  );
}
