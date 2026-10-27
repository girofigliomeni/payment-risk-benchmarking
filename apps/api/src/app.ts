import express from 'express';
import type { ErrorRequestHandler } from 'express';
import { HealthSchema } from '@payment-risk/core';
import { checkoutConfig } from './paypal/config.js';
import { SandboxPayPalProvider, PaymentError } from './paypal/provider.js';
import { CheckoutService } from './paypal/service.js';
import { checkoutRouter } from './paypal/routes.js';

export function createApp(checkout: CheckoutService = new CheckoutService(checkoutConfig({}), new SandboxPayPalProvider(checkoutConfig({})))) {
  const app = express();
  app.disable('x-powered-by');
  app.get('/health', (_request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Cache-Control', 'no-store');
    response.json(HealthSchema.parse({ status: 'ok', service: 'payment-risk-api' }));
  });
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
