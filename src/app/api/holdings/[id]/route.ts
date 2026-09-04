import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { parseUpdateHoldingBody } from "@/lib/holdings/holdingRequestSchemas";
import { holdingWriteService } from "@/lib/holdings/holdingWriteService";
import { toWriteErrorResponse } from "@/lib/holdings/holdingWriteErrorResponse";
import { readJsonBody } from "@/lib/validation/requestBody";
import { USER_ID_HEADER } from "@/lib/authTokens";

interface HoldingRouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(
  request: NextRequest,
  context: HoldingRouteContext
) {
  const userId = request.headers.get(USER_ID_HEADER);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const input = parseUpdateHoldingBody(await readJsonBody(request));
    const holding = await holdingWriteService.updateHolding(userId, id, input);
    return NextResponse.json({ holding });
  } catch (error) {
    return toWriteErrorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: HoldingRouteContext
) {
  const userId = request.headers.get(USER_ID_HEADER);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    await holdingWriteService.deleteHolding(userId, id);
    return NextResponse.json({ id });
  } catch (error) {
    return toWriteErrorResponse(error);
  }
}
