import { createHash } from 'node:crypto';
import { z } from 'zod';
import { PaymentError } from '../paypal/provider.js';

export type ConsumerPrincipal = { owner: string; session: string };
export type IntegrationPrincipal = { integration: string; credentialHash: string };
export type Principal = ConsumerPrincipal | IntegrationPrincipal;
export interface ProtectionStore {
  consumer(token: string): Promise<ConsumerPrincipal>;
  command(principal: Principal, source: string | null, action: string, key: string | null, data: unknown): Promise<unknown>;
}
export const credentialHash = (value: string) => createHash('sha256').update(value).digest('hex');
export function integrationPrincipal(token: string): IntegrationPrincipal {
  const [integration, secret, extra] = token.split('.');
  if (!z.uuid().safeParse(integration).success || !secret || !/^[A-Za-z0-9_-]{43}$/.test(secret) || extra !== undefined) {
    throw new PaymentError(401, 'integration_auth_required');
  }
  return { integration: integration!, credentialHash: credentialHash(token) };
}
const Envelope = z.object({ status: z.number().int(), error: z.string().optional(),
  requestId: z.uuid().optional(), serverTime: z.number().int().optional(), data: z.unknown().optional(),
}).strict();

export class SupabaseProtectionStore implements ProtectionStore {
  constructor(private readonly url: string, private readonly key: string, private readonly request: typeof fetch = fetch) {}
  private async call(path: string, init: RequestInit): Promise<Response> {
    try { return await this.request(`${this.url}${path}`, { ...init, signal: AbortSignal.timeout(15000) }); }
    catch { throw new PaymentError(503, 'protection_unavailable'); }
  }
  async consumer(token: string): Promise<ConsumerPrincipal> {
    // Verification must precede decoding. /user verifies this exact token with Supabase Auth.
    const response = await this.call('/auth/v1/user', { headers: { apikey: this.key, Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new PaymentError(response.status >= 500 || response.status === 429 ? 503 : 401, 'protection_auth_required');
    try {
      const user = z.object({ id: z.uuid(), email: z.string().min(1), is_anonymous: z.literal(false).optional() }).parse(await response.json());
      const parts = token.split('.');
      if (parts.length !== 3) throw new Error('JWT required');
      const claims = z.object({ sub: z.uuid(), session_id: z.uuid(),
        amr: z.array(z.object({ method: z.string(), timestamp: z.number().int().nonnegative() })),
      }).parse(JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8')));
      if (claims.sub !== user.id || !claims.amr.some(c => c.method === 'password')) throw new Error('Password sign-in required');
      // Neither iat, AMR timestamps nor user.last_sign_in_at supplies the age clock.
      // The database checks this session's original created_at and continued existence on every command.
      return { owner: user.id, session: claims.session_id };
    } catch { throw new PaymentError(401, 'fresh_authentication_required'); }
  }
  async rpc(name: 'protection_command' | 'protection_operator', args: unknown): Promise<unknown> {
    const response = await this.call(`/rest/v1/rpc/${name}`, { method: 'POST', headers: {
      apikey: this.key, Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json',
    }, body: JSON.stringify(args) });
    if (!response.ok) {
      const parsed = z.object({ code: z.string() }).safeParse(await response.json().catch(() => null));
      const status = parsed.success ? ({ PT401: 401, '23505': 409, '23514': 400, '22023': 400, '22003': 409, P0002: 404 }[parsed.data.code] ?? 503) : 503;
      throw new PaymentError(status, status === 503 ? 'protection_unavailable' : status === 401 ? 'fresh_authentication_required' : 'protection_request_rejected');
    }
    try { return await response.json(); } catch { throw new PaymentError(503, 'protection_unavailable'); }
  }
  async command(principal: Principal, source: string | null, action: string, key: string | null, data: unknown): Promise<unknown> {
    const result = Envelope.safeParse(await this.rpc('protection_command', {
      p_owner: 'owner' in principal ? principal.owner : null, p_session: 'session' in principal ? principal.session : null,
      p_integration: 'integration' in principal ? principal.integration : null,
      p_credential_hash: 'credentialHash' in principal ? principal.credentialHash : null,
      p_source: source, p_action: action, p_key: key, p_data: data,
    }));
    if (!result.success) throw new PaymentError(503, 'protection_unavailable');
    if (result.data.status !== 200) {
      const status = [400,401,404,409,429,503].includes(result.data.status) ? result.data.status : 503;
      throw new PaymentError(status, result.data.error ?? 'protection_unavailable');
    }
    if (!result.data.requestId || result.data.serverTime === undefined || !('data' in result.data)) throw new PaymentError(503, 'protection_unavailable');
    return result.data;
  }
}
export function protectionStore(env: NodeJS.ProcessEnv): SupabaseProtectionStore | undefined {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return undefined;
  const url = z.url().parse(env.SUPABASE_URL).replace(/\/$/, '');
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['127.0.0.1','localhost'].includes(parsed.hostname))) throw new Error('SUPABASE_URL requires HTTPS or local HTTP');
  return new SupabaseProtectionStore(url, env.SUPABASE_SERVICE_ROLE_KEY);
}
