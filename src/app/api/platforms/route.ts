import { NextResponse } from "next/server";
import { parseCreatePlatformBody } from "@/lib/holdings/holdingRequestSchemas";
import { platformWriteService } from "@/lib/holdings/platformWriteService";
import { toWriteErrorResponse } from "@/lib/holdings/holdingWriteErrorResponse";
import { readJsonBody } from "@/lib/validation/requestBody";
import { withUser } from "@/lib/requestUser";

export const GET = withUser(async (userId) => {
  try {
    const platforms = await platformWriteService.listPlatforms(userId);
    return NextResponse.json({ platforms });
  } catch (error) {
    return toWriteErrorResponse(error);
  }
});

export const POST = withUser(async (userId, request) => {
  try {
    const input = parseCreatePlatformBody(await readJsonBody(request));
    const platform = await platformWriteService.createPlatform(userId, input);
    return NextResponse.json({ platform }, { status: 201 });
  } catch (error) {
    return toWriteErrorResponse(error);
  }
});
