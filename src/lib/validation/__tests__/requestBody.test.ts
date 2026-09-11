import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  InvalidJsonBodyError,
  readJsonBody,
} from "@/lib/validation/requestBody";
import { FieldValidationError } from "@/lib/validation/fieldErrors";
import { toWriteErrorResponse } from "@/lib/holdings/holdingWriteErrorResponse";
import {
  HoldingNotFoundError,
  PlatformNameConflictError,
} from "@/lib/holdings/holdingWriteErrors";

function postBody(body: string): NextRequest {
  return new NextRequest(new URL("http://localhost/api/holdings"), {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json" },
  });
}

describe("readJsonBody", () => {
  it("returns the parsed body when it is valid JSON", async () => {
    await expect(readJsonBody(postBody('{"a":1}'))).resolves.toEqual({ a: 1 });
  });

  it("throws a field error naming the body when it is not", async () => {
    const failure = await readJsonBody(postBody("{not json")).catch(
      (error: unknown) => error
    );

    expect(failure).toBeInstanceOf(InvalidJsonBodyError);
    expect(failure).toBeInstanceOf(FieldValidationError);
    expect((failure as InvalidJsonBodyError).fieldErrors.body).toContain(
      "JSON"
    );
  });
});

describe("toWriteErrorResponse", () => {
  it("answers any field error with 400 and its fieldErrors, whichever module threw", async () => {
    const response = toWriteErrorResponse(
      new InvalidJsonBodyError({ body: "Request body must be valid JSON" })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      fieldErrors: { body: expect.stringContaining("JSON") },
    });
  });

  it("keeps a conflict at 409 rather than folding it into the field-error branch", async () => {
    const response = toWriteErrorResponse(
      new PlatformNameConflictError("Blink")
    );

    expect(response.status).toBe(409);
  });

  it("keeps a not-found at 404", async () => {
    expect(toWriteErrorResponse(new HoldingNotFoundError("h1")).status).toBe(
      404
    );
  });
});
