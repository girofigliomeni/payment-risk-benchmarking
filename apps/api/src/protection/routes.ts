import express from 'express';
import { z } from 'zod';
import { ApproveLinkSchema, CancelChangeSchema, ConsentChangeSchema, CoolingOffSchema, HistoryQuerySchema,
  InvitationSchema, PolicyChangeSchema, ProtectionSourceSchema, SourceBodySchema } from '@payment-risk/core';
import { PaymentError } from '../paypal/provider.js';
import { integrationPrincipal } from './store.js';
import type { Principal, ProtectionStore } from './store.js';

const SourceQuery = z.object({ source: ProtectionSourceSchema }).strict();
const CursorQuery = SourceQuery.extend({ after: z.uuid().optional() }).strict();
const HistoryQuery = HistoryQuerySchema;
const IntegratorQuery = z.object({ after: z.uuid().optional() }).strict();
const ExportQuery = HistoryQuery.extend({ section: z.enum(['policies','consents','links','audit']).default('audit'), afterLink: z.uuid().optional() }).strict();
const Key = z.string().regex(/^[A-Za-z0-9._:-]{1,128}$/);
export function protectionRouter(store: ProtectionStore | undefined, origin: string) {
  const router = express.Router();
  router.use((request, response, next) => {
    response.set('Cache-Control', 'no-store');
    if (request.get('origin') && request.get('origin') !== origin) throw new PaymentError(403, 'origin_rejected');
    if (!store) throw new PaymentError(503, 'protection_setup_required');
    next();
  });
  router.use(express.json({ limit: '16kb', strict: true }));
  const route = (method: 'get' | 'post', path: string, action: string, schema: z.ZodType, integrator = false) => {
    router[method](path, async (request, response) => {
      const auth = request.get('authorization') ?? '';
      if (!/^Bearer [^\s]{1,8192}$/.test(auth)) throw new PaymentError(401, 'protection_auth_required');
      const parsed = schema.safeParse(method === 'get' ? request.query : request.body);
      if (!parsed.success) throw new PaymentError(400, 'invalid_protection_request');
      const data = parsed.data as Record<string, unknown>; // All route schemas are strict objects.
      const id = request.params.id;
      if (id !== undefined && !z.uuid().safeParse(id).success) throw new PaymentError(400, 'invalid_resource_id');
      const key = method === 'post' ? Key.safeParse(request.get('idempotency-key')) : null;
      if (key && !key.success) throw new PaymentError(400, 'idempotency_key_required');
      const principal: Principal = integrator ? integrationPrincipal(auth.slice(7)) : await store!.consumer(auth.slice(7));
      response.json(await store!.command(principal, typeof data.source === 'string' ? data.source : null,
        action, key?.success ? key.data : null, { ...data, ...(id !== undefined ? { id } : {}) }));
    });
  };
  route('get','/me/protection','read',SourceQuery);
  route('get','/me/protection/history','history',HistoryQuery);
  route('post','/me/consents','consent',ConsentChangeSchema);
  route('post','/me/policy-changes','caps',PolicyChangeSchema);
  route('post','/me/policy-changes/:id/cancel','cancel',CancelChangeSchema);
  route('post','/me/cooling-off','cooling_off',CoolingOffSchema);
  route('get','/me/integration-links','links',CursorQuery);
  route('post','/me/integration-links','approve_link',ApproveLinkSchema);
  route('post','/me/integration-links/:id/revoke','revoke_link',SourceBodySchema);
  route('post','/me/export-requests','export',SourceBodySchema);
  route('get','/me/export-requests/:id','export_read',ExportQuery);
  route('post','/me/deletion-requests','deletion',SourceBodySchema);
  route('get','/me/deletion-requests/:id','lifecycle_read',SourceQuery);
  route('post','/integrations/link-invitations','invite',InvitationSchema,true);
  route('get','/integrations/links','integration_links',IntegratorQuery,true);
  return router;
}
