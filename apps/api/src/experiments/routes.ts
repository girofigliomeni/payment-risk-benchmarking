import express from 'express';
import { z } from 'zod';
import { PaymentEventSchema, RULES_VERSION, scoreRules, toObservablePaymentEvent } from '@payment-risk/core';
import { PaymentError } from '../paypal/provider.js';
import type { CheckoutService } from '../paypal/service.js';
import { sessionId } from '../paypal/routes.js';
import { NewExperimentSchema, SnapshotSchema } from './store.js';
import type { ExperimentStore } from './store.js';

const IngestionSchema = z.object({ events: z.array(PaymentEventSchema.options[0]).min(1).max(500) }).strict();
export function experimentRouter(store: ExperimentStore | undefined, checkout: CheckoutService) {
  const router = express.Router();
  let windowStart = Date.now();
  let requests = 0;
  router.use(async (request, response, next) => {
    response.set('Cache-Control', 'no-store');
    if (Date.now() - windowStart >= 60000) { windowStart = Date.now(); requests = 0; }
    if (++requests > 120) throw new PaymentError(429, 'experiment_rate_limited');
    if (!store) throw new PaymentError(503, 'experiment_setup_required');
    const authorization = request.get('authorization') ?? '';
    if (!/^Bearer [^\s]{1,8192}$/.test(authorization)) throw new PaymentError(401, 'experiment_auth_required');
    response.locals.owner = await store.owner(authorization.slice(7));
    next();
  });
  router.use(express.json({ limit: '1mb' }));
  router.post('/', async (request, response) => {
    const parsed = NewExperimentSchema.safeParse(request.body);
    if (!parsed.success) throw new PaymentError(400, 'invalid_experiment');
    response.json(await store!.command(String(response.locals.owner), parsed.data.experimentId, 'create', parsed.data));
  });
  router.use('/:id', (request, _response, next) => {
    if (!z.uuid().safeParse(request.params.id).success) throw new PaymentError(400, 'invalid_experiment_id');
    next();
  });
  router.get('/:id', async (request, response) => {
    response.json(await store!.command(String(response.locals.owner), String(request.params.id), 'read', {}));
  });
  router.post('/:id/events', async (request, response) => {
    const parsed = IngestionSchema.safeParse(request.body);
    if (!parsed.success) throw new PaymentError(400, 'invalid_synthetic_events');
    response.json(await store!.command(String(response.locals.owner), String(request.params.id), 'ingest', parsed.data));
  });
  // Mounted under /sandbox/experiments too, so the existing HttpOnly checkout cookie is available.
  // The request cannot supply a provider event or a verification claim.
  router.post('/:id/verified', async (request, response) => {
    if (!z.object({}).strict().safeParse(request.body).success) throw new PaymentError(400, 'empty_body_required');
    const event = checkout.status(sessionId(request)).event;
    if (!event) throw new PaymentError(409, 'verified_capture_required');
    response.json(await store!.command(String(response.locals.owner), String(request.params.id), 'ingest', { events: [event] }));
  });
  router.post('/:id/baseline', async (request, response) => {
    if (!z.object({}).strict().safeParse(request.body).success) throw new PaymentError(400, 'empty_body_required');
    const owner = String(response.locals.owner);
    const id = String(request.params.id);
    const snapshot = SnapshotSchema.parse(await store!.command(owner, id, 'snapshot', {}));
    const decisions = scoreRules(snapshot.events.map(toObservablePaymentEvent));
    response.json(await store!.command(owner, id, 'save', { version: RULES_VERSION, decisions }));
  });
  return router;
}
