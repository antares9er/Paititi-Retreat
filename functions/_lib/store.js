// Reads/writes the content overrides in KV and the registry from the static pages.

import { PAGES, buildRegistry, normalizeStore } from './cms.js';

const KV_KEY = 'content';

export async function loadStore(env) {
    if (!env.CONTENT) return normalizeStore(null);
    return normalizeStore(await env.CONTENT.get(KV_KEY, 'json'));
}

export async function saveStore(env, store) {
    await env.CONTENT.put(KV_KEY, JSON.stringify(store));
}

/** Fetches a static asset by its pretty path (e.g. "/", "/booking", "/admin/"). */
export async function fetchAsset(env, request, path) {
    const url = new URL(path, request.url);
    let res = await env.ASSETS.fetch(new Request(url, { method: 'GET' }));
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        res = await env.ASSETS.fetch(new Request(new URL(res.headers.get('location'), url), { method: 'GET' }));
    }
    return res;
}

/** Registry of editable texts/images, read from the original HTML files. */
export async function loadRegistry(env, request) {
    const pages = await Promise.all(PAGES.map(async ({ page, path }) => {
        const res = await fetchAsset(env, request, path);
        return { page, html: res.ok ? await res.text() : '' };
    }));
    return buildRegistry(pages);
}
