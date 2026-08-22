import { createHmac, timingSafeEqual } from "node:crypto";
import type { Context, Next } from "hono";

export function signToken(secret: string, subject: string): string {
  const body = Buffer.from(JSON.stringify({ sub: subject, iat: Date.now() })).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyToken(secret: string, token: string): boolean {
  const [body, sig] = token.split(".");
  if (!body || !sig) return false;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function authMiddleware(secret: string) {
  return async (c: Context, next: Next) => {
    if (c.req.path === "/health" || c.req.path === "/login") return next();
    const header = c.req.header("authorization");
    const token = header?.startsWith("Bearer ") ? header.slice(7) : c.req.header("x-nousarium-token");
    if (!token || !verifyToken(secret, token)) {
      return c.json({ error: "unauthorized" }, 401);
    }
    return next();
  };
}
