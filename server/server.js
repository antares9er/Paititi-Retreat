// Paititi Retreats: static website + small admin backend.
//   npm start            -> http://localhost:3000        (website)
//                        -> http://localhost:3000/admin  (admin panel)

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import multer from 'multer';
import * as content from './content.js';
import * as auth from './auth.js';

try { process.loadEnvFile(path.join(content.ROOT, '.env')); } catch { /* no .env yet */ }

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
const PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '';
const ADMIN_DIR = path.join(content.ROOT, 'admin');

// Folders of the website that may be served publicly. Everything else
// (server/, data/, .env, node_modules/ ...) is never exposed.
const PUBLIC_DIRS = [
    'css',
    'js',
    'brand_assets',
    'uploads',
    'Luxury ensuite room',
    'Maleika Restaurant',
    'Naya Veda Vastu Outdoor',
    'Open-bamboo-rooms',
    'photos_videos_Paititi Retreat_Antares',
];

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const IMAGE_SIGNATURES = [
    { ext: 'jpg',  mime: 'image/jpeg', test: b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
    { ext: 'png',  mime: 'image/png',  test: b => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
    { ext: 'gif',  mime: 'image/gif',  test: b => b.subarray(0, 4).toString('latin1') === 'GIF8' },
    { ext: 'webp', mime: 'image/webp', test: b => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' },
];

if (!PASSWORD_HASH) {
    console.warn('WARNUNG: ADMIN_PASSWORD_HASH fehlt in .env. Der Admin-Login ist deaktiviert. Passwort setzen mit: npm run set-password');
}

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);

// ---------------------------------------------------------------- common headers

app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    next();
});

// ---------------------------------------------------------------- public website

function sendPage(res, page) {
    res.setHeader('Cache-Control', 'no-cache');
    res.type('html').send(content.renderPage(page));
}

app.get('/', (req, res) => sendPage(res, 'index.html'));
for (const page of content.PAGES) {
    app.get('/' + page, (req, res) => sendPage(res, page));
}

for (const dir of PUBLIC_DIRS) {
    app.use('/' + encodeURI(dir), express.static(path.join(content.ROOT, dir), {
        index: false,
        dotfiles: 'ignore',
        maxAge: dir === 'uploads' ? '1h' : '7d',
    }));
}

// ---------------------------------------------------------------- admin

const admin = express.Router();
app.use('/admin', admin);

admin.use((req, res, next) => {
    res.setHeader('Content-Security-Policy',
        "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'; form-action 'self'");
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Cache-Control', 'no-store');
    next();
});

// Reject cross-site state-changing requests (defence in depth next to SameSite=Strict).
admin.use((req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD') return next();
    const site = req.headers['sec-fetch-site'];
    if (site && site !== 'same-origin' && site !== 'none') return res.status(403).send('Forbidden');
    const origin = req.headers.origin;
    if (origin) {
        const expected = `${req.protocol}://${req.headers.host}`;
        if (origin !== expected) return res.status(403).send('Forbidden');
    }
    next();
});

admin.use('/assets', express.static(path.join(ADMIN_DIR, 'assets'), { index: false }));

function isLoggedIn(req) {
    return auth.isValidSession(auth.getCookie(req, auth.COOKIE_NAME));
}

function requireLogin(req, res, next) {
    if (isLoggedIn(req)) return next();
    if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Nicht angemeldet.' });
    res.redirect('/admin/login');
}

// --- login / logout (plain HTML form, works without JavaScript)

admin.get('/login', (req, res) => {
    if (isLoggedIn(req)) return res.redirect('/admin');
    const messages = {
        '1': 'Passwort falsch.',
        'locked': 'Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen.',
        'nopw': 'Kein Admin-Passwort konfiguriert. Bitte "npm run set-password" ausführen.',
        'out': 'Du wurdest abgemeldet.',
    };
    const html = fs.readFileSync(path.join(ADMIN_DIR, 'login.html'), 'utf8')
        .replace('{{message}}', messages[req.query.msg] ?? '');
    res.type('html').send(html);
});

admin.post('/login', express.urlencoded({ extended: false, limit: '4kb' }), (req, res) => {
    if (!PASSWORD_HASH) return res.redirect('/admin/login?msg=nopw');
    const ip = req.ip;
    if (auth.isLockedOut(ip)) return res.redirect('/admin/login?msg=locked');
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!password || !auth.verifyPassword(password, PASSWORD_HASH)) {
        auth.recordFailedLogin(ip);
        return res.redirect('/admin/login?msg=1');
    }
    auth.clearFailedLogins(ip);
    res.setHeader('Set-Cookie', auth.sessionCookie(auth.createSession(), { secure: IS_PROD }));
    res.redirect('/admin');
});

admin.post('/logout', (req, res) => {
    auth.destroySession(auth.getCookie(req, auth.COOKIE_NAME));
    res.setHeader('Set-Cookie', auth.sessionCookie('', { secure: IS_PROD, expire: true }));
    res.redirect('/admin/login?msg=out');
});

// --- everything below requires a session

admin.use(requireLogin);

admin.get('/', (req, res) => res.sendFile(path.join(ADMIN_DIR, 'index.html')));

admin.get('/api/content', (req, res) => {
    res.json(content.getContentForAdmin());
});

admin.put('/api/texts', express.json({ limit: '1mb' }), (req, res) => {
    const errors = content.saveTexts(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });
    res.json({ ok: true });
});

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
});

function handleUpload(req, res, next) {
    upload.single('image')(req, res, err => {
        if (!err) return next();
        const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Die Datei ist zu groß (max. 8 MB).' : 'Upload fehlgeschlagen.';
        res.status(400).json({ error: msg });
    });
}

admin.post('/api/images/:key', handleUpload, (req, res) => {
    const key = req.params.key;
    if (!content.isKnownImageKey(key)) return res.status(400).json({ error: 'Unbekanntes Bild.' });
    if (!req.file || !req.file.buffer.length) return res.status(400).json({ error: 'Keine Datei erhalten.' });

    const type = IMAGE_SIGNATURES.find(sig => sig.test(req.file.buffer));
    if (!type) return res.status(400).json({ error: 'Nur JPG, PNG, WEBP oder GIF sind erlaubt.' });

    fs.mkdirSync(content.UPLOAD_DIR, { recursive: true });
    const filename = `${key.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}-${crypto.randomBytes(4).toString('hex')}.${type.ext}`;
    fs.writeFileSync(path.join(content.UPLOAD_DIR, filename), req.file.buffer);

    const relativePath = 'uploads/' + filename;
    content.setImage(key, relativePath);
    res.json({ ok: true, value: relativePath });
});

admin.delete('/api/images/:key', (req, res) => {
    const key = req.params.key;
    if (!content.isKnownImageKey(key)) return res.status(400).json({ error: 'Unbekanntes Bild.' });
    content.resetImage(key);
    res.json({ ok: true });
});

// ---------------------------------------------------------------- fallbacks

app.use((req, res) => {
    if (req.path.startsWith('/admin/api/')) return res.status(404).json({ error: 'Nicht gefunden.' });
    res.status(404).type('text').send('Not found');
});

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    console.error(err);
    if (res.headersSent) return;
    const status = err.status || 500;
    const message = status === 400 && err.type === 'entity.parse.failed' ? 'Ungültige Anfrage.' : 'Serverfehler.';
    if (req.path.startsWith('/admin/api/')) return res.status(status).json({ error: message });
    res.status(status).type('text').send(message);
});

app.listen(PORT, () => {
    console.log(`Website:     http://localhost:${PORT}`);
    console.log(`Admin-Panel: http://localhost:${PORT}/admin`);
});
