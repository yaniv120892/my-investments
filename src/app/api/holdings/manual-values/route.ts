import { NextRequest, NextResponse } from "next/server";
import { parseRecordManualValuesBody } from "@/lib/holdings/holdingRequestSchemas";
import { holdingWriteService } from "@/lib/holdings/holdingWriteService";
import { toWriteErrorResponse } from "@/lib/holdings/holdingWriteErrorResponse";
import { readJsonBody } from "@/lib/holdings/requestBody";

/**
 * The monthly pass over the balances that no free provider can fetch — the
 * pension and study funds, and anything else priced by hand. Separate from
 * PATCH /api/holdings/[id] because confirming a balance means something the
 * general edit does not: it re-dates the reading even when the number is
 * unchanged.
 */
export async function PATCH(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { values } = parseRecordManualValuesBody(await readJsonBody(request));
    const holdings = await holdingWriteService.recordManualValues(
      userId,
      values
    );
    return NextResponse.json({ holdings });
  } catch (error) {
    return toWriteErrorResponse(error);
  }
}
