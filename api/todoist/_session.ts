import { createHash } from "crypto";
import { parse, serialize } from "cookie";
import { EncryptJWT, jwtDecrypt } from "jose";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const SESSION_COOKIE_NAME = "todoist_session";
const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export type SessionPayload = {
  accessToken: string;
};

export class SessionSecretMissingError extends Error {
  missing: string[];

  constructor() {
    super("TODOIST_SESSION_SECRET is not configured");
    this.name = "SessionSecretMissingError";
    this.missing = ["TODOIST_SESSION_SECRET"];
  }
}

function getSessionSecret(): Uint8Array {
  const secret = process.env.TODOIST_SESSION_SECRET;
  if (!secret) {
    throw new SessionSecretMissingError();
  }

  const hash = createHash("sha256").update(secret).digest();
  return new Uint8Array(hash.buffer, hash.byteOffset, hash.byteLength);
}

export async function createSessionCookie(
  res: VercelResponse,
  payload: SessionPayload,
  ttlSeconds: number = DEFAULT_SESSION_TTL_SECONDS
) {
  const secret = getSessionSecret();
  const jwe = await new EncryptJWT(payload)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .encrypt(secret);

  const cookie = serialize(SESSION_COOKIE_NAME, jwe, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: ttlSeconds,
  });

  res.setHeader("Set-Cookie", cookie);
}

export function clearSessionCookie(res: VercelResponse) {
  const cookie = serialize(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  res.setHeader("Set-Cookie", cookie);
}

export async function readSession(req: VercelRequest): Promise<SessionPayload | null> {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) {
    return null;
  }

  const cookies = parse(cookieHeader);
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) {
    return null;
  }

  try {
    const secret = getSessionSecret();
    const { payload } = await jwtDecrypt(token, secret, {
      clockTolerance: 2,
    });
    if (!payload || typeof payload.accessToken !== "string") {
      return null;
    }
    return { accessToken: payload.accessToken };
  } catch (error) {
    if (error instanceof SessionSecretMissingError) {
      throw error;
    }
    console.warn("[session] Failed to decrypt session cookie", error);
    return null;
  }
}

export async function requireSession(
  req: VercelRequest,
  res: VercelResponse
): Promise<SessionPayload | null> {
  try {
    const session = await readSession(req);
    if (!session) {
      res.status(401).json({ error: "Unauthorized" });
      return null;
    }
    return session;
  } catch (error) {
    if (error instanceof SessionSecretMissingError) {
      res.status(503).json({ error: error.message, missing: error.missing });
      return null;
    }
    throw error;
  }
}

