// Creates the admin password hash and a session secret.
// Usage:  npm run set-password            (prompts for the password)
//         npm run set-password -- "pw"    (password as argument)
//
// Writes both values to .dev.vars (used by "npm run dev") and prints them,
// so they can be added as secrets in the Cloudflare Pages dashboard.

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { hashPassword } from '../functions/_lib/auth.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEV_VARS = path.join(ROOT, '.dev.vars');
const MIN_LENGTH = 10;

async function readPasswordFromPrompt() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = function (str) { if (str.includes('Admin-Passwort')) process.stdout.write(str); };
    const answer = await new Promise(resolve => rl.question('Neues Admin-Passwort: ', resolve));
    rl.close();
    process.stdout.write('\n');
    return answer;
}

const password = process.argv[2] ?? await readPasswordFromPrompt();
if (!password || password.length < MIN_LENGTH) {
    console.error(`Das Passwort muss mindestens ${MIN_LENGTH} Zeichen lang sein.`);
    process.exit(1);
}

let vars = '';
try { vars = fs.readFileSync(DEV_VARS, 'utf8'); } catch { /* not yet created */ }

const hash = await hashPassword(password);
vars = setVar(vars, 'ADMIN_PASSWORD_HASH', hash);

let secret = /^SESSION_SECRET=(.+)$/m.exec(vars)?.[1]?.trim();
if (!secret) {
    secret = [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, '0')).join('');
    vars = setVar(vars, 'SESSION_SECRET', secret);
}
fs.writeFileSync(DEV_VARS, vars, 'utf8');

console.log(`\nGespeichert in ${DEV_VARS} (für "npm run dev").\n`);
console.log('Für die Live-Seite im Cloudflare-Dashboard unter');
console.log('  Workers & Pages → dein Projekt → Settings → Variables and Secrets');
console.log('diese beiden Secrets anlegen bzw. aktualisieren (Typ: Secret):\n');
console.log(`ADMIN_PASSWORD_HASH=${hash}`);
console.log(`SESSION_SECRET=${secret}\n`);
console.log('Danach ein neues Deployment auslösen (Retry deployment oder ein Git-Push).');

function setVar(text, name, value) {
    const re = new RegExp(`^${name}=.*$`, 'm');
    if (re.test(text)) return text.replace(re, `${name}=${value}`);
    if (text && !text.endsWith('\n')) text += '\n';
    return text + `${name}=${value}\n`;
}
