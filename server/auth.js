// Single-admin authentication: scrypt password hash from .env,
// random session tokens kept in memory, HttpOnly cookie.

import crypto from 'node:crypto';

export const COOKIE_NAME = 'paititi_admin';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;   // 12 hours
const MAX_FAILED_LOGINS = 8;                  // per IP ...
const LOCKOUT_MS = 15 * 60 * 1000;            // ... within 15 minutes

const sessions = new Map();     // token -> expiry timestamp
const failedLogins = new Map(); // ip -> { count, until }

// ---------------------------------------------------------------- passwords

export function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
    if (typeof stored !== 'string') return false;
    const [algo, salt, hash] = stored.split('$');
    if (algo !== 'scrypt' || !salt || !hash) return false;
    const expected = Buffer.from(hash, 'hex');
    const actual = crypto.scryptSync(password, salt, expected.length);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

// ---------------------------------------------------------------- sessions

export function createSession() {
    const token = crypto.randomBytes(32).toString('base64url');
    sessions.set(token, Date.now() + SESSION_TTL_MS);
    return token;
}

export function destroySession(token) {
    if (token) sessions.delete(token);
}

export function isValidSession(token) {
    if (!token) return false;
    const expires = sessions.get(token);
    if (!expires) return false;
    if (expires < Date.now()) { sessions.delete(token); return false; }
    return true;
}

export function getCookie(req, name) {
    const header = req.headers.cookie;
    if (!header) return null;
    for (const part of header.split(';')) {
        const idx = part.indexOf('=');
        if (idx === -1) continue;
        if (part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim());
    }
    return null;
}

export function sessionCookie(token, { secure, expire = false }) {
    const parts = [
        `${COOKIE_NAME}=${expire ? '' : token}`,
        'Path=/admin',
        'HttpOnly',
        'SameSite=Strict',
        `Max-Age=${expire ? 0 : Math.floor(SESSION_TTL_MS / 1000)}`,
    ];
    if (secure) parts.push('Secure');
    return parts.join('; ');
}

// ---------------------------------------------------------------- brute-force guard

export function isLockedOut(ip) {
    const entry = failedLogins.get(ip);
    if (!entry) return false;
    if (entry.until < Date.now()) { failedLogins.delete(ip); return false; }
    return entry.count >= MAX_FAILED_LOGINS;
}

export function recordFailedLogin(ip) {
    const now = Date.now();
    const entry = failedLogins.get(ip);
    if (!entry || entry.until < now) failedLogins.set(ip, { count: 1, until: now + LOCKOUT_MS });
    else entry.count += 1;
}

export function clearFailedLogins(ip) {
    failedLogins.delete(ip);
}

// Periodically drop expired entries so the maps never grow unbounded.
setInterval(() => {
    const now = Date.now();
    for (const [token, exp] of sessions) if (exp < now) sessions.delete(token);
    for (const [ip, entry] of failedLogins) if (entry.until < now) failedLogins.delete(ip);
}, 10 * 60 * 1000).unref();
