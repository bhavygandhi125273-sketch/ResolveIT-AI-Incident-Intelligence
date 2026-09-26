import "server-only";

import {
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { getDatabasePool } from "@/server/database/pool";
import { requireAuthSecret } from "@/server/config/env";

const scrypt = promisify(scryptCallback);

const SESSION_COOKIE = "resolveit_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export type UserRole = "EMPLOYEE" | "IT_ADMIN";

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
  displayName: string;
};

type SessionPayload = {
  userId: string;
  expiresAt: number;
};

type UserRow = {
  id: string;
  email: string;
  role: UserRole;
  display_name: string;
};

function encodePayload(payload: SessionPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodePayload(value: string): SessionPayload | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as SessionPayload;

    if (
      typeof parsed.userId !== "string" ||
      typeof parsed.expiresAt !== "number"
    ) {
      return null;
    }

    if (parsed.expiresAt <= Date.now()) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function sign(value: string): string {
  return createHmac("sha256", requireAuthSecret())
    .update(value)
    .digest("base64url");
}

function createSessionToken(payload: SessionPayload): string {
  const encoded = encodePayload(payload);
  return `${encoded}.${sign(encoded)}`;
}

function verifySessionToken(token: string): SessionPayload | null {
  const separator = token.lastIndexOf(".");

  if (separator <= 0) {
    return null;
  }

  const encoded = token.slice(0, separator);
  const providedSignature = token.slice(separator + 1);
  const expectedSignature = sign(encoded);

  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);

  if (provided.length !== expected.length) {
    return null;
  }

  if (!timingSafeEqual(provided, expected)) {
    return null;
  }

  return decodePayload(encoded);
}

async function findUserById(userId: string): Promise<AuthUser | null> {
  const result = await getDatabasePool().query<UserRow>(
    `SELECT id, email, role, display_name
     FROM users
     WHERE id = $1`,
    [userId],
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    role: row.role,
    displayName: row.display_name,
  };
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const payload = verifySessionToken(token);

  if (!payload) {
    return null;
  }

  return findUserById(payload.userId);
}

export async function requireSession(): Promise<AuthUser> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("AUTHENTICATION_REQUIRED");
  }

  return user;
}

export async function requireRole(
  role: UserRole,
): Promise<AuthUser> {
  const user = await requireSession();

  if (user.role !== role) {
    throw new Error("FORBIDDEN");
  }

  return user;
}

/** Maps requireSession/requireRole failures to 401/403 responses; returns null for other errors. */
export function authErrorResponse(
  error: unknown,
  unauthenticatedMessage: string,
  forbiddenMessage = "You do not have permission to perform this action.",
): Response | null {
  if (!(error instanceof Error)) return null;
  if (error.message === "AUTHENTICATION_REQUIRED") {
    return Response.json(
      { success: false, error: { code: "UNAUTHORIZED", message: unauthenticatedMessage } },
      { status: 401 },
    );
  }
  if (error.message === "FORBIDDEN") {
    return Response.json(
      { success: false, error: { code: "FORBIDDEN", message: forbiddenMessage } },
      { status: 403 },
    );
  }
  return null;
}

export async function createSession(userId: string): Promise<void> {
  const token = createSessionToken({
    userId,
    expiresAt: Date.now() + SESSION_MAX_AGE * 1000,
  });

  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const [salt, key] = storedHash.split(":");

  if (!salt || !key) {
    return false;
  }

  const derivedKey = (await scrypt(
    password,
    salt,
    64,
  )) as Buffer;

  const storedKey = Buffer.from(key, "hex");

  if (derivedKey.length !== storedKey.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, storedKey);
}

export async function hashPassword(
  password: string,
): Promise<string> {
  const salt = randomBytes(16).toString("hex");

  const derivedKey = (await scrypt(
    password,
    salt,
    64,
  )) as Buffer;

  return `${salt}:${derivedKey.toString("hex")}`;
}