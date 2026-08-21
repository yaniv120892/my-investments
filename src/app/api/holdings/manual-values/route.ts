import { NextRequest, NextResponse } from "next/server";
import { parseRecordManualValuesBody } from "@/lib/holdings/holdingRequestSchemas";
import { holdingWriteService } from "@/lib/holdings/holdingWriteService";
import { toWriteErrorResponse } from "@/lib/holdings/holdingWriteErrorResponse";
import { readJsonBody } from "@/lib/holdings/requestBody";

/** The monthly pass over the balances that no free provider can fetch. */
export async function PATCH(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
}
