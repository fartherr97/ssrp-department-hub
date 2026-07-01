/*
 * Shared HTTP security helpers.
 *
 * isSameOrigin: the primitive behind our CSRF defense. For a cookie-authed,
 * same-origin API the cheapest correct check is "did this mutating request come
 * from our own origin?" — a cross-site form or script cannot forge Origin/Referer
 * (browsers set them), and combined with SameSite=Lax cookies that covers CSRF
 * without the front-end managing a token. Used by both the /api sameOriginGuard
 * (index.js) and the /auth/dev-login handler (auth.js), which sits outside /api
 * but still mints a session.
 */
import crypto from "node:crypto";

export function isSameOrigin(req) {
  const origin = req.get("origin") || req.get("referer") || "";
  const host = req.get("host") || "";
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/*
 * Constant-time comparison for shared secrets (bot sync tokens). A plain `===`
 * on secrets is theoretically vulnerable to timing attacks; timingSafeEqual runs
 * in time independent of where the first differing byte is. Returns false (never
 * throws) on length mismatch or missing values.
 */
export function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
