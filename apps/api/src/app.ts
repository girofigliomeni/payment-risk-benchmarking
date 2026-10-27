import express from 'express';
import type { ErrorRequestHandler } from 'express';
import { HealthSchema } from '@payment-risk/core';
import { checkoutConfig } from './paypal/config.js';
import { SandboxPayPalProvider, PaymentError } from './paypal/provider.js';
import { CheckoutService } from './paypal/service.js';
import { checkoutRouter } from './paypal/routes.js';
import { experimentRouter } from './experiments/routes.js';
import type { ExperimentStore } from './experiments/store.js';

export function createApp(checkout: CheckoutService = new CheckoutService(checkoutConfig({}), new SandboxPayPalProvider(checkoutConfig({}))), store?: ExperimentStore) {
  const app = express();
  app.disable('x-powered-by');
  app.use((request, response, next) => {
    response.vary('Origin');
    const origin = request.get('origin');
    if (origin === checkout.config.CHECKOUT_ORIGIN) {
      response.set('Access-Control-Allow-Origin', origin);
      response.set('Access-Control-Allow-Credentials', 'true');
    }
    if (request.method !== 'OPTIONS' || !origin) { next(); return; }
    response.vary('Access-Control-Request-Method');
    response.vary('Access-Control-Request-Headers');
    const method = request.get('access-control-request-method');
    const headers = (request.get('access-control-request-headers') ?? '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
    if (origin !== checkout.config.CHECKOUT_ORIGIN || !method || !['GET', 'POST', 'OPTIONS'].includes(method) ||
      headers.some(header => !['authorization', 'content-type'].includes(header))) {
      response.status(403).json({ error: 'cors_preflight_rejected' }); return;
    }
    // Browser preflights carry no bearer token or session cookie; actual routes still authenticate.
    response.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    response.status(204).end();
  });
  app.get('/health', (_request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.json(HealthSchema.parse({ status: 'ok', service: 'payment-risk-api' }));
  });
  app.use('/experiments', experimentRouter(store, checkout));
  app.use('/sandbox/experiments', experimentRouter(store, checkout));
  app.use('/sandbox', checkoutRouter(checkout));
  const handleError: ErrorRequestHandler = (error: unknown, _request, response, next) => {
    void next; // Express identifies error middleware by its four-argument signature.
    // Never return/log raw provider errors, payloads, credentials, or bearer tokens.
    const status = error instanceof PaymentError ? error.status : error instanceof SyntaxError ? 400 :
      typeof error === 'object' && error !== null && 'type' in error && error.type === 'entity.too.large' ? 413 : 500;
    response.status(status).json({ error: error instanceof PaymentError ? error.code : 'request_failed' });
  };
  app.use(handleError);
  return app;
}
export const app = createApp();
