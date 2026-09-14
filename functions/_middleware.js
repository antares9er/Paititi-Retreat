// Runs for the routes listed in _routes.json:
// - blocks files that should never be public
// - injects the admin overrides into every HTML page
// - adds a few security headers

import { applyOverrides, hasOverrides } from './_lib/cms.js';
import { loadStore } from './_lib/store.js';

const PRIVATE_PATHS = [
    /^\/(server|data|functions|scripts|node_modules)\//i,
    /^\/Retreat structure\//i,
    /^\/\.(env|dev\.vars|git|claude|wrangler)/i,
    /^\/(package(-lock)?\.json|ADMIN\.md|CLAUDE\.md|_routes\.json|wrangler\.(toml|jsonc?))$/i,
];

export async function onRequest(context) {
    const { request, env, next } = context;
    const path = safeDecode(new URL(request.url).pathname);

    if (PRIVATE_PATHS.some(re => re.test(path))) {
        return new Response('Not found', { status: 404 });
    }

    const response = await next();

    const isHtml = (response.headers.get('content-type') || '').includes('text/html');
    if (response.status === 200 && isHtml && !path.startsWith('/admin')) {
        const store = await loadStore(env);
        const headers = new Headers(response.headers);
        headers.set('Cache-Control', 'no-cache');
        addSecurityHeaders(headers);
        if (!hasOverrides(store)) return new Response(response.body, { status: 200, headers });
        return new Response(applyOverrides(await response.text(), store), { status: 200, headers });
    }

    return response;
}

function addSecurityHeaders(headers) {
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    headers.set('X-Frame-Options', 'SAMEORIGIN');
}

function safeDecode(s) {
    try { return decodeURIComponent(s); } catch { return s; }
}
