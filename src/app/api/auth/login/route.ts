import { NextRequest, NextResponse } from "next/server";
import {
  findUserByEmail,
  verifyPassword,
  generateVerificationCode,
  generateJWT,
} from "@/lib/auth";
import { sendVerificationCode } from "@/lib/emailService";
import { setCachedData } from "@/lib/redis";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // If the user is already verified, issue JWT and return
    if (user.isVerified) {
      const token = generateJWT({ userId: user.id, email: user.email });
      const response = NextResponse.json(
        { message: "Login successful", verificationRequired: false },
        { status: 200 }
      );
      response.cookies.set("auth-token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
      });
      return response;
    }

    // Otherwise, send verification code for first-time verification
    const verificationCode = generateVerificationCode();
    const verificationKey = `verification:${email}`;
    await setCachedData(verificationKey, {
      code: verificationCode,
      userId: user.id,
      createdAt: new Date(),
    });

    const emailSent = await sendVerificationCode(email, verificationCode);
    if (!emailSent) {
      return NextResponse.json(
        { error: "Failed to send verification email" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: "Verification code sent to email",
        verificationRequired: true,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
