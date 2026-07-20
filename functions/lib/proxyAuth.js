"use strict";
/**
 * proxyAuth.ts — Caller authentication for the LLM proxy.
 *
 * Before this, llmProxy answered anyone on the internet — CORS only restricts
 * browsers, so any curl/script could spend the Anthropic key freely. This gate
 * accepts exactly two kinds of caller:
 *
 *   1. Browser users — a valid Firebase ID token in `Authorization: Bearer`.
 *      Callers enforce a verified Lemon Workspace identity before spending.
 *
 *   2. The VPS daemon — a shared service key in `X-Lemon-Service-Key`. The
 *      daemon is server-side Python and has no user session, so it can't hold
 *      an ID token. The key lives in functions/.env (PROXY_SERVICE_KEY) and in
 *      the daemon's environment; it never ships to any browser bundle.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateProxyRequest = authenticateProxyRequest;
const auth_1 = require("firebase-admin/auth");
const app_1 = require("firebase-admin/app");
if (!(0, app_1.getApps)().length)
    (0, app_1.initializeApp)();
/** Constant-time string comparison to avoid leaking the key via timing. */
function timingSafeEqual(a, b) {
    if (a.length !== b.length)
        return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++)
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}
/**
 * Authenticate an inbound proxy request. Returns a discriminated result; the
 * caller decides the HTTP response. `serviceKey` is the configured secret
 * (may be empty in local dev, in which case service-key auth is disabled).
 */
async function authenticateProxyRequest(req, serviceKey) {
    // ── Path 2: service key (daemon) ──
    const presentedKey = req.get("X-Lemon-Service-Key");
    if (presentedKey) {
        if (serviceKey && timingSafeEqual(presentedKey, serviceKey)) {
            return { ok: true, kind: "service" };
        }
        return { ok: false, status: 403, message: "Invalid service key." };
    }
    // ── Path 1: Firebase ID token (browser) ──
    const authHeader = req.get("Authorization") ?? "";
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) {
        return {
            ok: false,
            status: 401,
            message: "Missing credentials. Send a Firebase ID token or service key.",
        };
    }
    try {
        const decoded = await (0, auth_1.getAuth)().verifyIdToken(match[1]);
        return {
            ok: true,
            kind: "user",
            uid: decoded.uid,
            email: decoded.email ?? "",
            emailVerified: decoded.email_verified === true,
        };
    }
    catch {
        return { ok: false, status: 401, message: "Invalid or expired ID token." };
    }
}
//# sourceMappingURL=proxyAuth.js.map