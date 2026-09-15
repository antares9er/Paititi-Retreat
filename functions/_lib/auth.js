// Single-admin authentication for Cloudflare Pages Functions.
// - Password: PBKDF2-SHA256 hash stored in the ADMIN_PASSWORD_HASH secret
// - Session: signed cookie (HMAC-SHA256 with SESSION_SECRET), no server state
// - Brute force: failed-login counter per IP in KV

export const COOKIE_NAME = 'paititi_admin';
export const SESSION_TTL_SECONDS = 12 * 60 * 60;   // 12 hours
export const PBKDF2_ITERATIONS = 100000;             // Cloudflare's maximum
const MAX_FAILED_LOGINS = 8;                         // per IP ...
const LOCKOUT_SECONDS = 15 * 60;                     // ... within 15 minutes

const enc = new TextEncoder();

// ---------------------------------------------------------------- passwords

export async function hashPassword(password, iterations = PBKDF2_ITERATIONS) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await pbkdf2(password, salt, iterations);
    return `pbkdf2$${iterations}$${toHex(salt)}$${toHex(hash)}`;
}

// A hash pasted into a dashboard field easily picks up a stray space or a
// newline. Everything below trims first, and isValidHashFormat lets the caller
// tell "the stored hash is broken" apart from "the password is wrong".
const HASH_RE = /^pbkdf2\$\d+\$[0-9a-f]+\$[0-9a-f]+$/i;

export function isValidHashFormat(stored) {
    return typeof stored === 'string' && HASH_RE.test(stored.trim());
}

export async function verifyPassword(password, stored) {
    if (typeof stored !== 'string') return false;
    const [algo, iter, saltHex, hashHex] = stored.trim().split('$');
    const iterations = Number(iter);
    if (algo !== 'pbkdf2' || !Number.isInteger(iterations) || !saltHex || !hashHex) return false;
    const expected = fromHex(hashHex);
    const actual = await pbkdf2(password, fromHex(saltHex), iterations, expected.length);
    return timingSafeEqual(expected, actual);
}

async function pbkdf2(password, salt, iterations, length = 32) {
    const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, length * 8);
    return new Uint8Array(bits);
}

// ---------------------------------------------------------------- sessions

export async function createSessionToken(secret) {
    const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
    const nonce = toHex(crypto.getRandomValues(new Uint8Array(16)));
    const payload = `${exp}.${nonce}`;
    return `${payload}.${await sign(secret, payload)}`;
}

export async function isValidSessionToken(token, secret) {
    if (!token || !secret) return false;
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const [exp, nonce, sig] = parts;
    if (!/^\d+$/.test(exp) || Number(exp) < Math.floor(Date.now() / 1000)) return false;
    const expected = await sign(secret, `${exp}.${nonce}`);
    return timingSafeEqual(enc.encode(expected), enc.encode(sig));
}

async function sign(secret, data) {
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return toBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data))));
}

export function getCookie(request, name) {
    const header = request.headers.get('cookie');
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
        `Max-Age=${expire ? 0 : SESSION_TTL_SECONDS}`,
    ];
    if (secure) parts.push('Secure');
    return parts.join('; ');
}

// ---------------------------------------------------------------- brute-force guard (KV)

function failKey(ip) { return `loginfail:${ip}`; }

export async function isLockedOut(kv, ip) {
    const count = Number(await kv.get(failKey(ip))) || 0;
    return count >= MAX_FAILED_LOGINS;
}

export async function recordFailedLogin(kv, ip) {
    const count = Number(await kv.get(failKey(ip))) || 0;
    await kv.put(failKey(ip), String(count + 1), { expirationTtl: LOCKOUT_SECONDS });
}

export async function clearFailedLogins(kv, ip) {
    await kv.delete(failKey(ip));
}

// ---------------------------------------------------------------- helpers

function timingSafeEqual(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
}

function toHex(bytes) {
    return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex) {
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
    return out;
}

function toBase64Url(bytes) {
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
