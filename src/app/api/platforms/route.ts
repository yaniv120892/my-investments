import { NextRequest, NextResponse } from "next/server";
import { parseCreatePlatformBody } from "@/lib/holdings/holdingRequestSchemas";
import { platformWriteService } from "@/lib/holdings/platformWriteService";
import { toWriteErrorResponse } from "@/lib/holdings/holdingWriteErrorResponse";
import { readJsonBody } from "@/lib/holdings/requestBody";

export async function GET(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const platforms = await platformWriteService.listPlatforms(userId);
    return NextResponse.json({ platforms });
  } catch (error) {
    return toWriteErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const input = parseCreatePlatformBody(await readJsonBody(request));
    const platform = await platformWriteService.createPlatform(userId, input);
    return NextResponse.json({ platform }, { status: 201 });
  } catch (error) {
    return toWriteErrorResponse(error);
  }
}
