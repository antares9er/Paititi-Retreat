// Admin panel + API under /admin (Cloudflare Pages Function).
//
// Bindings (Pages project → Settings → Bindings):
//   KV  CONTENT   text/image overrides + login counters
//   R2  UPLOADS   uploaded images
// Secrets (Settings → Variables and Secrets):
//   ADMIN_PASSWORD_HASH   from:  npm run set-password
//   SESSION_SECRET        from:  npm run set-password

import * as auth from './auth.js';
import { KEY_RE, applyTextUpdates, contentForAdmin } from './cms.js';
import { fetchAsset, loadRegistry, loadStore, saveStore } from './store.js';

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const IMAGE_SIGNATURES = [
    { ext: 'jpg',  mime: 'image/jpeg', test: b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
    { ext: 'png',  mime: 'image/png',  test: b => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
    { ext: 'gif',  mime: 'image/gif',  test: b => ascii(b, 0, 4) === 'GIF8' },
    { ext: 'webp', mime: 'image/webp', test: b => ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP' },
];

const LOGIN_MESSAGES = {
    '1': 'Passwort falsch.',
    'locked': 'Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen.',
    'nopw': 'Admin-Login nicht konfiguriert: ADMIN_PASSWORD_HASH und SESSION_SECRET als Secrets im Cloudflare-Dashboard setzen.',
    'badhash': 'Der gespeicherte ADMIN_PASSWORD_HASH hat nicht das erwartete Format. Vermutlich ist beim Einfuegen ins Dashboard ein Zeichen verloren gegangen oder etwas zu viel mitkopiert worden.',
    'out': 'Du wurdest abgemeldet.',
};

export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/admin';
    const method = request.method;

    // Static files of the panel (CSS/JS) need no login.
    if (path.startsWith('/admin/assets/') && (method === 'GET' || method === 'HEAD')) {
        return withAdminHeaders(await env.ASSETS.fetch(request));
    }

    // Reject cross-site state-changing requests (defence in depth next to SameSite=Strict).
    if (method !== 'GET' && method !== 'HEAD') {
        const site = request.headers.get('sec-fetch-site');
        if (site && site !== 'same-origin' && site !== 'none') return text('Forbidden', 403);
        const origin = request.headers.get('origin');
        if (origin && origin !== url.origin) return text('Forbidden', 403);
    }

    const loggedIn = await auth.isValidSessionToken(auth.getCookie(request, auth.COOKIE_NAME), env.SESSION_SECRET);
    const secure = url.protocol === 'https:';

    // --- login / logout
    if (path === '/admin/login' && method === 'GET') {
        if (loggedIn) return redirect('/admin');
        const res = await fetchAsset(env, request, '/admin/login');
        const html = (await res.text()).replace('{{message}}', LOGIN_MESSAGES[url.searchParams.get('msg')] ?? '');
        return withAdminHeaders(new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }));
    }

    if (path === '/admin/login' && method === 'POST') {
        if (!env.ADMIN_PASSWORD_HASH || !env.SESSION_SECRET) return redirect('/admin/login?msg=nopw');
        if (!auth.isValidHashFormat(env.ADMIN_PASSWORD_HASH)) return redirect('/admin/login?msg=badhash');
        const ip = request.headers.get('cf-connecting-ip') || 'unknown';
        if (await auth.isLockedOut(env.CONTENT, ip)) return redirect('/admin/login?msg=locked');
        const form = await request.formData().catch(() => null);
        const password = form && typeof form.get('password') === 'string' ? form.get('password') : '';
        if (!password || !(await auth.verifyPassword(password, env.ADMIN_PASSWORD_HASH))) {
            await auth.recordFailedLogin(env.CONTENT, ip);
            return redirect('/admin/login?msg=1');
        }
        await auth.clearFailedLogins(env.CONTENT, ip);
        const token = await auth.createSessionToken(env.SESSION_SECRET);
        return redirect('/admin', { 'set-cookie': auth.sessionCookie(token, { secure }) });
    }

    if (path === '/admin/logout' && method === 'POST') {
        return redirect('/admin/login?msg=out', { 'set-cookie': auth.sessionCookie('', { secure, expire: true }) });
    }

    // --- everything below requires a session
    if (!loggedIn) {
        if (path.startsWith('/admin/api/')) return json({ error: 'Nicht angemeldet.' }, 401);
        return redirect('/admin/login');
    }

    if (path === '/admin' && method === 'GET') {
        const res = await fetchAsset(env, request, '/admin/');
        return withAdminHeaders(new Response(await res.text(), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }));
    }

    if (path === '/admin/api/content' && method === 'GET') {
        const [registry, store] = await Promise.all([loadRegistry(env, request), loadStore(env)]);
        return json(contentForAdmin(registry, store));
    }

    if (path === '/admin/api/texts' && method === 'PUT') {
        const updates = await request.json().catch(() => null);
        if (!updates) return json({ error: 'Ungültige Anfrage.' }, 400);
        const [registry, store] = await Promise.all([loadRegistry(env, request), loadStore(env)]);
        const result = applyTextUpdates(store, registry, updates);
        if (result.errors.length) return json({ error: result.errors.join(' ') }, 400);
        await saveStore(env, result.store);
        return json({ ok: true });
    }

    const imageMatch = /^\/admin\/api\/images\/([^/]+)$/.exec(path);
    if (imageMatch && (method === 'POST' || method === 'DELETE')) {
        const key = safeDecode(imageMatch[1]);
        if (!KEY_RE.test(key)) return json({ error: 'Unbekanntes Bild.' }, 400);
        const [registry, store] = await Promise.all([loadRegistry(env, request), loadStore(env)]);
        if (!registry.images.some(i => i.key === key)) return json({ error: 'Unbekanntes Bild.' }, 400);
        return method === 'POST' ? uploadImage(env, request, store, key) : resetImage(env, store, key);
    }

    if (path.startsWith('/admin/api/')) return json({ error: 'Nicht gefunden.' }, 404);
    return redirect('/admin');
}

// ---------------------------------------------------------------- images

async function uploadImage(env, request, store, key) {
    const declared = Number(request.headers.get('content-length')) || 0;
    if (declared > MAX_UPLOAD_BYTES + 64 * 1024) return json({ error: 'Die Datei ist zu groß (max. 8 MB).' }, 400);

    const form = await request.formData().catch(() => null);
    const file = form ? form.get('image') : null;
    if (!file || typeof file === 'string' || !file.size) return json({ error: 'Keine Datei erhalten.' }, 400);
    if (file.size > MAX_UPLOAD_BYTES) return json({ error: 'Die Datei ist zu groß (max. 8 MB).' }, 400);

    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = IMAGE_SIGNATURES.find(sig => sig.test(bytes));
    if (!type) return json({ error: 'Nur JPG, PNG, WEBP oder GIF sind erlaubt.' }, 400);

    const name = `${key.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}-${randomHex(4)}.${type.ext}`;
    await env.UPLOADS.put(name, bytes, { httpMetadata: { contentType: type.mime } });

    await deleteUpload(env, store.images[key]);
    const next = { ...store, images: { ...store.images, [key]: 'uploads/' + name } };
    await saveStore(env, next);
    return json({ ok: true, value: next.images[key] });
}

async function resetImage(env, store, key) {
    if (key in store.images) {
        await deleteUpload(env, store.images[key]);
        const images = { ...store.images };
        delete images[key];
        await saveStore(env, { ...store, images });
    }
    return json({ ok: true });
}

async function deleteUpload(env, relativePath) {
    if (!relativePath || !relativePath.startsWith('uploads/')) return;
    await env.UPLOADS.delete(relativePath.slice('uploads/'.length));
}

// ---------------------------------------------------------------- helpers

function withAdminHeaders(response) {
    const res = new Response(response.body, response);
    res.headers.set('Content-Security-Policy',
        "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'; form-action 'self'");
    res.headers.set('X-Frame-Options', 'DENY');
    res.headers.set('X-Content-Type-Options', 'nosniff');
    res.headers.set('X-Robots-Tag', 'noindex, nofollow');
    res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (!res.headers.get('content-type')?.startsWith('text/css') && !res.headers.get('content-type')?.includes('javascript')) {
        res.headers.set('Cache-Control', 'no-store');
    }
    return res;
}

function json(body, status = 200) {
    return withAdminHeaders(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } }));
}

function text(body, status = 200) {
    return new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}

function redirect(location, extraHeaders = {}) {
    return new Response(null, { status: 302, headers: { location, 'cache-control': 'no-store', ...extraHeaders } });
}

function ascii(bytes, start, end) {
    return String.fromCharCode(...bytes.subarray(start, end));
}

function randomHex(n) {
    return [...crypto.getRandomValues(new Uint8Array(n))].map(b => b.toString(16).padStart(2, '0')).join('');
}

function safeDecode(s) {
    try { return decodeURIComponent(s); } catch { return s; }
}
