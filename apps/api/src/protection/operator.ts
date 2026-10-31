import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { z } from 'zod';
import { ProtectionSourceSchema } from '@payment-risk/core';
import { credentialHash, protectionStore } from './store.js';

// Local operator tool only. Credential output is intentional; never call from HTTP/logging.
export async function operate(args: string[], env: NodeJS.ProcessEnv): Promise<unknown> {
  const [action, value, source] = args;
  if (!['provision','rotate','disable','retire_responses'].includes(action ?? '') || args.length > (action === 'provision' ? 3 : action === 'retire_responses' ? 1 : 2)) throw new Error('Use provision <name> <source>, rotate <UUID>, disable <UUID>, or retire_responses');
  const store = protectionStore(env);
  if (!store) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required locally');
  const id = action === 'provision' || action === 'retire_responses' ? randomUUID() : z.uuid().parse(value);
  const credential = `${id}.${randomBytes(32).toString('base64url')}`;
  const data = action === 'provision' ? { name: z.string().min(1).max(100).parse(value), source: ProtectionSourceSchema.parse(source), credentialHash: credentialHash(credential) }
    : action === 'rotate' ? { credentialHash: credentialHash(credential) } : {};
  const result = await store.rpc('protection_operator', { p_id: id, p_action: action, p_data: data });
  return { result, ...(['provision','rotate'].includes(action ?? '') ? { credential } : {}) };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  config({ path: fileURLToPath(new URL('../../../../.env', import.meta.url)), quiet: true });
  operate(process.argv.slice(2), process.env).then(result => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch(() => { process.stderr.write('Operator command failed; verify arguments and local server configuration.\n'); process.exitCode=1; });
}
