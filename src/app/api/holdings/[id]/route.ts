import { NextResponse } from "next/server";
import { parseUpdateHoldingBody } from "@/lib/holdings/holdingRequestSchemas";
import { holdingWriteService } from "@/lib/holdings/holdingWriteService";
import { toWriteErrorResponse } from "@/lib/holdings/holdingWriteErrorResponse";
import { readJsonBody } from "@/lib/validation/requestBody";
import { withUser } from "@/lib/requestUser";

interface HoldingRouteContext {
  params: Promise<{ id: string }>;
}

export const PATCH = withUser(
  async (userId, request, context: HoldingRouteContext) => {
    try {
      const { id } = await context.params;
      const input = parseUpdateHoldingBody(await readJsonBody(request));
      const holding = await holdingWriteService.updateHolding(
        userId,
        id,
        input
      );
      return NextResponse.json({ holding });
    } catch (error) {
      return toWriteErrorResponse(error);
    }
  }
);

export const DELETE = withUser(
  async (userId, _request, context: HoldingRouteContext) => {
    try {
      const { id } = await context.params;
      await holdingWriteService.deleteHolding(userId, id);
      return NextResponse.json({ id });
    } catch (error) {
      return toWriteErrorResponse(error);
    }
  }
);
