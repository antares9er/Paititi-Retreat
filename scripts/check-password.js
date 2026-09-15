// Checks a password against the ADMIN_PASSWORD_HASH in .dev.vars.
// Usage:  node scripts/check-password.js "meinPasswort"
//
// Prints only OK or FAIL - never the hash, never the password.
// Runs in a second, no wrangler and no dev server needed.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyPassword } from '../functions/_lib/auth.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEV_VARS = path.join(ROOT, '.dev.vars');

const password = process.argv[2];
if (!password) {
    console.error('Aufruf:  node scripts/check-password.js "meinPasswort"');
    process.exit(1);
}

let vars = '';
try {
    vars = fs.readFileSync(DEV_VARS, 'utf8');
} catch {
    console.error(`${DEV_VARS} nicht gefunden. Zuerst "npm run set-password" ausfuehren.`);
    process.exit(1);
}

const hash = /^ADMIN_PASSWORD_HASH=(.+)$/m.exec(vars)?.[1]?.trim();
if (!hash) {
    console.error('In .dev.vars steht kein ADMIN_PASSWORD_HASH.');
    process.exit(1);
}

console.log(`Passwortlaenge: ${password.length} Zeichen`);
const nonAscii = [...password].filter(c => c.charCodeAt(0) > 127);
if (nonAscii.length) {
    console.log(`Achtung: ${nonAscii.length} Zeichen ausserhalb von ASCII (z.B. Umlaute).`);
    console.log('Die koennen in der Windows-Konsole anders ankommen als im Browser.');
}

if (await verifyPassword(password, hash)) {
    console.log('\nOK - dieses Passwort passt zum Hash in .dev.vars.');
    console.log('Denselben Hash als Secret ADMIN_PASSWORD_HASH im Cloudflare-Dashboard eintragen.');
} else {
    console.log('\nFAIL - dieses Passwort passt NICHT zum Hash in .dev.vars.');
    console.log('Neu setzen mit:  node scripts/set-password.js "meinPasswort"');
    process.exitCode = 2;
}
