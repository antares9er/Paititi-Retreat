// Worker entry point for paititi-retreats.com
//
// Serves the static site and runs the small admin backend:
//   - blocks files that should never be public
//   - /admin*      -> login + admin panel + API   (functions/_lib/admin.js)
//   - /uploads/*   -> images from R2
//   - every other HTML page gets the admin overrides injected
//
// Bindings (wrangler.jsonc):
//   ASSETS    the static files of this repo
//   CONTENT   KV  - text/image overrides + failed-login counters
//   UPLOADS   R2  - images uploaded through the admin panel
// Secrets (dashboard -> Settings -> Variables and Secrets):
//   ADMIN_PASSWORD_HASH, SESSION_SECRET   -> npm run set-password

import { applyOverrides, hasOverrides } from '../functions/_lib/cms.js';
import { loadStore } from '../functions/_lib/store.js';
import { onRequest as handleAdmin } from '../functions/_lib/admin.js';

const PRIVATE_PATHS = [
    /^\/(server|data|functions|scripts|src|node_modules)\//i,
    /^\/Retreat structure\//i,
    /^\/\.(env|dev\.vars|git|claude|wrangler|assetsignore|node-version)/i,
    /^\/(package(-lock)?\.json|ADMIN\.md|CLAUDE\.md|_routes\.json|wrangler\.(toml|jsonc?))$/i,
];

const UPLOAD_NAME_RE = /^[a-z0-9-]+\.(jpg|png|gif|webp)$/;

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const path = safeDecode(url.pathname);

        if (PRIVATE_PATHS.some(re => re.test(path))) return notFound();

        if (path === '/admin' || path.startsWith('/admin/')) {
            return handleAdmin({ request, env });
        }

        if (path.startsWith('/uploads/')) {
            return serveUpload(env, request, path.slice('/uploads/'.length));
        }

        const response = await env.ASSETS.fetch(request);

        const isHtml = (response.headers.get('content-type') || '').includes('text/html');
        if (response.status !== 200 || !isHtml) return response;

        const store = await loadStore(env);
        const headers = new Headers(response.headers);
        headers.set('Cache-Control', 'no-cache');
        addSecurityHeaders(headers);

        if (!hasOverrides(store)) return new Response(response.body, { status: 200, headers });
        return new Response(applyOverrides(await response.text(), store), { status: 200, headers });
    },
};

// ---------------------------------------------------------------- uploads

async function serveUpload(env, request, name) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method not allowed', { status: 405 });
    }
    if (!UPLOAD_NAME_RE.test(name) || !env.UPLOADS) return notFound();

    const object = await env.UPLOADS.get(name);
    if (!object) return notFound();

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('Cache-Control', 'public, max-age=3600');
    headers.set('X-Content-Type-Options', 'nosniff');
    return new Response(request.method === 'HEAD' ? null : object.body, { headers });
}

// ---------------------------------------------------------------- helpers

function addSecurityHeaders(headers) {
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    headers.set('X-Frame-Options', 'SAMEORIGIN');
}

function notFound() {
    return new Response('Not found', {
        status: 404,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
}

function safeDecode(s) {
    try { return decodeURIComponent(s); } catch { return s; }
}
