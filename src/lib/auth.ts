import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "./db";
import { AuthSession } from "@/types";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret";
const SESSION_TTL_MINUTES = parseInt(process.env.SESSION_TTL_MINUTES || "60");

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
  const expiresIn = SESSION_TTL_MINUTES * 60; // Convert to seconds
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export function verifyJWT(token: string): AuthSession | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (
      typeof decoded === "object" &&
      decoded !== null &&
      "userId" in decoded
    ) {
      const payload = decoded as JWTPayload;
      return {
        userId: payload.userId,
        email: payload.email,
        expiresAt: new Date(payload.exp * 1000),
      };
    }
    return null;
  } catch (error) {
    console.error("JWT verification error:", error);
    return null;
  }
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
      investments: true,
    },
  });
}

export async function findUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: {
      settings: true,
      investments: true,
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
