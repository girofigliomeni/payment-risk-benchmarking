import { z } from 'zod';
import { PaymentEventSchema, RulesDecisionSchema } from '@payment-risk/core';
import { PaymentError } from '../paypal/provider.js';

export const NewExperimentSchema = z.object({ experimentId: z.uuid(), name: z.string().min(1).max(120),
  datasetId: z.string().min(1).max(128), seed: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
}).strict();
export const SnapshotSchema = z.object({ events: z.array(PaymentEventSchema).max(10000) }).strict();
export interface ExperimentStore {
  owner(token: string): Promise<string>;
  command(owner: string, experiment: string, action: 'create' | 'ingest' | 'read' | 'snapshot' | 'save', data: unknown): Promise<unknown>;
}
export class SupabaseExperimentStore implements ExperimentStore {
  constructor(private readonly url: string, private readonly key: string, private readonly request: typeof fetch = fetch) {}
  private async call(path: string, init: RequestInit): Promise<Response> {
    try { return await this.request(`${this.url}${path}`, { ...init, signal: AbortSignal.timeout(15000) }); }
    catch { throw new PaymentError(503, 'storage_unavailable'); }
  }
  async owner(token: string): Promise<string> {
    const response = await this.call('/auth/v1/user', { headers: { apikey: this.key, Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new PaymentError(response.status >= 500 ? 503 : 401, 'experiment_auth_required');
    return z.object({ id: z.uuid() }).parse(await response.json()).id;
  }
  async command(owner: string, experiment: string, action: 'create' | 'ingest' | 'read' | 'snapshot' | 'save', data: unknown): Promise<unknown> {
    const response = await this.call('/rest/v1/rpc/lab_command', { method: 'POST', headers: {
      apikey: this.key, Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json',
    }, body: JSON.stringify({ p_owner: owner, p_experiment: experiment, p_action: action, p_data: data }) });
    if (!response.ok) {
      const error: unknown = await response.json().catch(() => null);
      const code = z.object({ code: z.string() }).safeParse(error);
      const status = code.success ? ({ P0002: 404, '23505': 409, '23514': 409, '22023': 400 }[code.data.code] ?? 503) : 503;
      throw new PaymentError(status, status === 503 ? 'storage_unavailable' : 'experiment_request_rejected');
    }
    return response.json();
  }
}
export function experimentStore(env: NodeJS.ProcessEnv): ExperimentStore | undefined {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return undefined;
  const url = z.url().parse(env.SUPABASE_URL).replace(/\/$/, '');
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(parsed.hostname))) {
    throw new Error('SUPABASE_URL requires HTTPS or local HTTP');
  }
  return new SupabaseExperimentStore(url, env.SUPABASE_SERVICE_ROLE_KEY);
}
export const SavedRunSchema = z.object({ version: z.string(), decisions: z.array(RulesDecisionSchema) }).strict();
