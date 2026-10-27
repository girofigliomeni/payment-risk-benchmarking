import express from 'express';
import type { Request } from 'express';
import { z } from 'zod';
import { PaymentError } from './provider.js';
import type { CheckoutService } from './service.js';

const COOKIE = 'sandbox_session';
export function sessionId(request: Request): string {
  const value = request.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!value || !/^[a-f0-9-]{36}$/.test(value)) throw new PaymentError(401, 'checkout_session_required');
  return value;
}
export function checkoutRouter(service: CheckoutService) {
  const router = express.Router();
  let windowStart = Date.now();
  let requests = 0;
  router.use((_request, response, next) => {
    response.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' });
    if (Date.now() - windowStart >= 60000) { windowStart = Date.now(); requests = 0; }
    if (++requests > 120) { response.status(429).json({ error: 'checkout_rate_limited' }); return; }
    next();
  });
  router.get('/config', (_request, response) => { response.json(service.configuration()); });
  router.post('/webhook', express.raw({ type: 'application/json', limit: '64kb' }), async (request, response) => {
    if (!Buffer.isBuffer(request.body)) throw new PaymentError(415, 'webhook_json_required');
    const headers: Record<string, string> = {};
    for (const name of ['paypal-transmission-id', 'paypal-transmission-time', 'paypal-transmission-sig', 'paypal-cert-url', 'paypal-auth-algo']) {
      headers[name] = request.get(name) ?? '';
    }
    response.json(await service.webhook(request.body.toString('utf8'), headers));
  });
  router.use((request, _response, next) => {
    if (request.method !== 'GET' && request.get('origin') !== service.config.CHECKOUT_ORIGIN) {
      throw new PaymentError(403, 'checkout_origin_rejected');
    }
    next();
  });
  router.use(express.json({ limit: '1kb' }));
  router.post('/session', (request, response) => {
    const body = z.object({ accessKey: z.string().min(1).max(256) }).strict().safeParse(request.body);
    if (!body.success) throw new PaymentError(400, 'invalid_session_request');
    let existing: string | undefined;
    try { existing = sessionId(request); } catch { /* A new authorized session has no cookie yet. */ }
    const id = service.authorize(body.data.accessKey, existing);
    response.cookie(COOKIE, id, { httpOnly: true, secure: service.config.CHECKOUT_ORIGIN.startsWith('https:'), sameSite: 'strict',
      maxAge: 3600000, path: '/sandbox' });
    response.json(service.status(id));
  });
  router.get('/session', (request, response) => { response.json(service.status(sessionId(request))); });
  const emptyBody = (body: unknown) => {
    if (!z.object({}).strict().safeParse(body).success) throw new PaymentError(400, 'request_body_must_be_empty');
  };
  router.post('/orders', async (request, response) => {
    emptyBody(request.body);
    response.json(await service.create(sessionId(request)));
  });
  router.post('/capture', async (request, response) => {
    if (!z.object({ confirm: z.literal(true) }).strict().safeParse(request.body).success) throw new PaymentError(400, 'explicit_capture_confirmation_required');
    response.json(await service.capture(sessionId(request)));
  });
  router.post('/cancel', async (request, response) => {
    emptyBody(request.body);
    response.json(await service.cancel(sessionId(request)));
  });
  return router;
}
