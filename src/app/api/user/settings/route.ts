import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { SUPPORTED_CURRENCIES } from "@/lib/pricing/supportedCurrencies";
import { USER_ID_HEADER } from "@/lib/authTokens";
import { describeError } from "@/utils/describeError";

const updateSettingsSchema = z.object({
  darkMode: z.boolean().optional(),
  baseCurrency: z.enum(SUPPORTED_CURRENCIES).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get(USER_ID_HEADER);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { settings: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      email: user.email,
      darkMode: user.settings?.darkMode ?? false,
      baseCurrency: user.settings?.baseCurrency ?? "NIS",
    });
  } catch (error) {
    console.error("Error fetching user settings:", describeError(error));
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = request.headers.get(USER_ID_HEADER);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = updateSettingsSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: `Invalid settings (baseCurrency must be one of ${SUPPORTED_CURRENCIES.join(", ")})`,
        },
        { status: 400 }
      );
    }
    const { darkMode, baseCurrency } = parsed.data;

    const settings = await prisma.settings.upsert({
      where: { userId },
      update: {
        ...(darkMode !== undefined && { darkMode }),
        ...(baseCurrency !== undefined && { baseCurrency }),
      },
      create: {
        userId,
        darkMode: darkMode ?? false,
        baseCurrency: baseCurrency ?? "NIS",
      },
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error updating user settings:", describeError(error));
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
