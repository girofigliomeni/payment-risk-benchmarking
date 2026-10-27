import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
try { process.loadEnvFile(join(root, '.env')); }
catch (error) {
  if (error.code !== 'ENOENT') {
    console.error('Unable to load repository .env');
    process.exit(1);
  }
}
const local = join(root, '.tools/ngrok', process.platform === 'win32' ? 'ngrok.exe' : 'ngrok');
const binary = existsSync(local) ? local : 'ngrok';
const config = join(root, 'ngrok.yml');
const check = process.argv.includes('--check');
const port = process.env.PORT ?? '3001';
if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
  console.error('PORT must be an integer from 1 to 65535.');
  process.exit(1);
}
if (!check && !process.env.NGROK_AUTHTOKEN?.trim()) {
  console.error('Setup required: set NGROK_AUTHTOKEN in the root .env using https://dashboard.ngrok.com/get-started/your-authtoken, then rerun npm run tunnel. Never paste the token into chat.');
  process.exit(1);
}
// Pass only ngrok's token, not payment/database/model credentials, to the child.
const environment = { ...process.env };
for (const key of Object.keys(environment)) {
  if (/^(PAYPAL_|SUPABASE_|OPENAI_|CHECKOUT_)/.test(key)) delete environment[key];
}
const args = check ? ['config', 'check', '--config', config] :
  ['http', `http://127.0.0.1:${port}`, '--inspect=false', '--config', config];
if (!check) console.log(`Forwarding the API on port ${port}. Register the HTTPS forwarding URL shown by ngrok plus /sandbox/webhook in PayPal. Keep this terminal open.`);
const result = spawnSync(binary, args, { cwd: root, env: environment, stdio: 'inherit' });
if (result.error) {
  console.error('Could not launch ngrok. On Windows run npm run tunnel:install; on other systems install the official ngrok CLI on PATH.');
  process.exit(1);
}
process.exit(result.status ?? 1);
