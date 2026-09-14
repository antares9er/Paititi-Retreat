// Route: /uploads/<file>  -> serves images uploaded via the admin panel from R2

const NAME_RE = /^[a-z0-9-]+\.(jpg|png|gif|webp)$/;

export async function onRequestGet(context) {
    const { env, params } = context;
    const name = Array.isArray(params.path) ? params.path.join('/') : String(params.path || '');
    if (!NAME_RE.test(name) || !env.UPLOADS) return new Response('Not found', { status: 404 });

    const object = await env.UPLOADS.get(name);
    if (!object) return new Response('Not found', { status: 404 });

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('Cache-Control', 'public, max-age=3600');
    headers.set('X-Content-Type-Options', 'nosniff');
    return new Response(object.body, { headers });
}
