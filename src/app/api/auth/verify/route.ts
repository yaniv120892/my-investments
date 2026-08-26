import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCachedData, deleteCachedData } from "@/lib/redis";
import { generateJWT, findUserById, markUserAsVerified } from "@/lib/auth";
import { sendWelcomeEmail } from "@/lib/emailService";
import { describeError } from "@/utils/describeError";
import { AUTH_COOKIE_NAME } from "@/lib/authTokens";

export const runtime = "nodejs";

const NEW_USER_WINDOW_MS = 60_000;

export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json();

    if (!email || !code) {
      return NextResponse.json(
        { error: "Email and verification code are required" },
        { status: 400 }
      );
    }

    const verificationKey = `verification:${email}`;
    const verificationData = await getCachedData<{
      code: string;
      userId: string;
      createdAt: Date;
    }>(verificationKey);

    if (!verificationData) {
      return NextResponse.json(
        { error: "Verification code expired or not found" },
        { status: 400 }
      );
    }

    if (verificationData.code !== code) {
      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 400 }
      );
    }

    const now = new Date();
    const codeAge =
      now.getTime() - new Date(verificationData.createdAt).getTime();
    const tenMinutes = 10 * 60 * 1000;

    if (codeAge > tenMinutes) {
      await deleteCachedData(verificationKey);
      return NextResponse.json(
        { error: "Verification code expired" },
        { status: 400 }
      );
    }

    const user = await findUserById(verificationData.userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const token = generateJWT({
      userId: user.id,
      email: user.email,
    });

    await deleteCachedData(verificationKey);

    await markUserAsVerified(user.id);

    const isNewUser =
      user.createdAt.getTime() > now.getTime() - NEW_USER_WINDOW_MS;
    if (isNewUser) {
      void sendWelcomeEmailQuietly(user.email);
    }

    const response = NextResponse.json(
      { message: "Verification successful" },
      { status: 200 }
    );

    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    console.error("Verification error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// A welcome email is a courtesy; a failed one must not cost the user the
// session they just verified.
async function sendWelcomeEmailQuietly(email: string): Promise<void> {
  try {
    await sendWelcomeEmail(email);
  } catch (error) {
    console.warn(`Welcome email failed for ${email}:`, describeError(error));
  }
}
