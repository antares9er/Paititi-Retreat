// Sets the admin password: writes ADMIN_PASSWORD_HASH into .env
// Usage:  npm run set-password            (prompts for the password)
//         npm run set-password -- "pw"    (password as argument)

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { hashPassword } from './auth.js';
import { ROOT } from './content.js';

const ENV_FILE = path.join(ROOT, '.env');
const MIN_LENGTH = 10;

async function readPasswordFromPrompt() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    // Hide typed characters
    rl._writeToOutput = function (str) {
        if (str.includes('Admin-Passwort')) process.stdout.write(str);
    };
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

const hash = hashPassword(password);
let env = '';
try { env = fs.readFileSync(ENV_FILE, 'utf8'); } catch { /* .env does not exist yet */ }

if (/^ADMIN_PASSWORD_HASH=.*$/m.test(env)) {
    env = env.replace(/^ADMIN_PASSWORD_HASH=.*$/m, `ADMIN_PASSWORD_HASH=${hash}`);
} else {
    if (env && !env.endsWith('\n')) env += '\n';
    env += `ADMIN_PASSWORD_HASH=${hash}\n`;
}
fs.writeFileSync(ENV_FILE, env, 'utf8');
console.log(`Passwort gespeichert in ${ENV_FILE}. Server neu starten, damit es wirksam wird.`);
