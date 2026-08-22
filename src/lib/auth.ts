import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "./db";
import type { AuthSession } from "@/types";

const SESSION_TTL_MINUTES = Number.parseInt(
  process.env.SESSION_TTL_MINUTES ?? "60",
  10
);

function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "JWT_SECRET is not set; refusing to sign or verify sessions with a default secret"
    );
  }
  return secret;
}

interface JWTPayload {
  userId: string;
  email: string;
  exp: number;
}

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateJWT(payload: {
  userId: string;
  email: string;
}): string {
  const expiresInSeconds = SESSION_TTL_MINUTES * 60;
  return jwt.sign(payload, requireJwtSecret(), { expiresIn: expiresInSeconds });
}

export function verifyJWT(token: string): AuthSession | null {
  try {
    const decoded = jwt.verify(token, requireJwtSecret());
    if (!isJwtPayload(decoded)) {
      return null;
    }
    return {
      userId: decoded.userId,
      email: decoded.email,
      expiresAt: new Date(decoded.exp * 1000),
    };
  } catch (error) {
    console.error("JWT verification error:", error);
    return null;
  }
}

function isJwtPayload(value: unknown): value is JWTPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const hasEveryClaim = "userId" in value && "email" in value && "exp" in value;
  if (!hasEveryClaim) {
    return false;
  }
  return (
    typeof value.userId === "string" &&
    typeof value.email === "string" &&
    typeof value.exp === "number" &&
    Number.isFinite(value.exp)
  );
}

export async function createUser(email: string, password: string) {
  const passwordHash = await hashPassword(password);

  return prisma.user.create({
    data: {
      email,
      passwordHash,
      settings: {
        create: {
          baseCurrency: "NIS",
          darkMode: false,
        },
      },
    },
    include: {
      settings: true,
    },
  });
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    include: {
      settings: true,
      holdings: true,
    },
  });
}

export async function findUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: {
      settings: true,
      holdings: true,
    },
  });
}

export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function markUserAsVerified(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { isVerified: true },
  });
}
