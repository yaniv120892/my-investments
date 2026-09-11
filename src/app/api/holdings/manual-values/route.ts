import { NextResponse } from "next/server";
import { parseRecordManualValuesBody } from "@/lib/holdings/holdingRequestSchemas";
import { holdingWriteService } from "@/lib/holdings/holdingWriteService";
import { toWriteErrorResponse } from "@/lib/holdings/holdingWriteErrorResponse";
import { readJsonBody } from "@/lib/validation/requestBody";
import { withUser } from "@/lib/requestUser";

export const PATCH = withUser(async (userId, request) => {
  try {
    const entries = parseRecordManualValuesBody(await readJsonBody(request));
    const confirmedAt = await holdingWriteService.recordManualValues(
      userId,
      entries
    );
    return NextResponse.json({ confirmedAt, confirmedCount: entries.length });
  } catch (error) {
    return toWriteErrorResponse(error);
  }
});
