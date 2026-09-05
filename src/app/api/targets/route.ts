import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { targetRepository } from "@/lib/targets/targetRepository";
import { targetWriteService } from "@/lib/targets/targetWriteService";
import { parseReplaceTargetsBody } from "@/lib/targets/targetRequestSchemas";
import { toTargetWriteErrorResponse } from "@/lib/targets/targetWriteErrorResponse";
import { readJsonBody } from "@/lib/validation/requestBody";
import { USER_ID_HEADER } from "@/lib/authTokens";

export async function GET(request: NextRequest) {
  const userId = request.headers.get(USER_ID_HEADER);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await targetRepository.findTargets(userId));
  } catch (error) {
    return toTargetWriteErrorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  const userId = request.headers.get(USER_ID_HEADER);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const input = parseReplaceTargetsBody(await readJsonBody(request));
    return NextResponse.json(
      await targetWriteService.replaceTargets(userId, input)
    );
  } catch (error) {
    return toTargetWriteErrorResponse(error);
  }
}
