import { NextResponse } from "next/server";
import { targetRepository } from "@/lib/targets/targetRepository";
import { targetWriteService } from "@/lib/targets/targetWriteService";
import { parseReplaceTargetsBody } from "@/lib/targets/targetRequestSchemas";
import { toTargetWriteErrorResponse } from "@/lib/targets/targetWriteErrorResponse";
import { readJsonBody } from "@/lib/validation/requestBody";
import { withUser } from "@/lib/requestUser";

export const GET = withUser(async (userId) => {
  try {
    return NextResponse.json(await targetRepository.findTargets(userId));
  } catch (error) {
    return toTargetWriteErrorResponse(error);
  }
});

export const PUT = withUser(async (userId, request) => {
  try {
    const input = parseReplaceTargetsBody(await readJsonBody(request));
    return NextResponse.json(
      await targetWriteService.replaceTargets(userId, input)
    );
  } catch (error) {
    return toTargetWriteErrorResponse(error);
  }
});
