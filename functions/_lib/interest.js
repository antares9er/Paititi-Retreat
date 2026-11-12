// "Register your interest" form: public POST /api/interest + admin list/delete.
//
// Each entry is one KV key  interest:<ISO time>-<random>  holding JSON
//   { id, name, email, journey, message, createdAt }
// Spam protection: hidden honeypot field "website", same-origin check,
// max RATE_LIMIT submissions per IP per hour.

const PREFIX = 'interest:';
const RATE_PREFIX = 'interest-rl:';
const RATE_LIMIT = 5;
const JOURNEYS = { bali: 'Bali 2027', peru: 'Peru 2027', both: 'Bali & Peru 2027' };
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/;

/** Public endpoint. Returns a JSON response. */
export async function submitInterest(request, env) {
    const url = new URL(request.url);
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    const site = request.headers.get('sec-fetch-site');
    if (site && site !== 'same-origin') return json({ error: 'Forbidden' }, 403);
    const origin = request.headers.get('origin');
    if (origin && origin !== url.origin) return json({ error: 'Forbidden' }, 403);
    if (!env.CONTENT) return json({ error: 'Storage is not configured.' }, 500);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return json({ error: 'Invalid request.' }, 400);

    // Bots fill every field; humans never see this one. Pretend success.
    if (str(body.website)) return json({ ok: true });

    const name = str(body.name).slice(0, 120);
    const email = str(body.email).slice(0, 200);
    const journey = JOURNEYS[str(body.journey)] ? str(body.journey) : 'bali';
    const message = str(body.message).slice(0, 1500);

    if (!name) return json({ error: 'Please enter your name.' }, 400);
    if (!EMAIL_RE.test(email)) return json({ error: 'Please enter a valid email address.' }, 400);

    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const rateKey = RATE_PREFIX + ip;
    const count = Number(await env.CONTENT.get(rateKey)) || 0;
    if (count >= RATE_LIMIT) return json({ error: 'Too many requests. Please try again later or email us directly.' }, 429);
    await env.CONTENT.put(rateKey, String(count + 1), { expirationTtl: 3600 });

    const createdAt = new Date().toISOString();
    const id = createdAt + '-' + randomHex(4);
    await env.CONTENT.put(PREFIX + id, JSON.stringify({ id, name, email, journey, message, createdAt }));
    return json({ ok: true });
}

/** All entries, newest first (for the admin panel). */
export async function listInterest(env) {
    const keys = [];
    let cursor;
    do {
        const page = await env.CONTENT.list({ prefix: PREFIX, cursor });
        keys.push(...page.keys.map(k => k.name));
        cursor = page.list_complete ? null : page.cursor;
    } while (cursor);

    const entries = await Promise.all(keys.map(k => env.CONTENT.get(k, 'json')));
    return entries.filter(Boolean)
        .map(e => ({ ...e, journeyLabel: JOURNEYS[e.journey] || e.journey }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteInterest(env, id) {
    if (!/^[0-9TZ:.\-a-f]+$/.test(id)) return false;
    await env.CONTENT.delete(PREFIX + id);
    return true;
}

function str(v) { return typeof v === 'string' ? v.trim() : ''; }

function json(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
    });
}

function randomHex(n) {
    return [...crypto.getRandomValues(new Uint8Array(n))].map(b => b.toString(16).padStart(2, '0')).join('');
}
