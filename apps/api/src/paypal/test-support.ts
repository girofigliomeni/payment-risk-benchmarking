import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { vi } from 'vitest';
import { checkoutConfig } from './config.js';
import type { CreateOrder, PayPalProvider } from './provider.js';
import { PaymentError } from './provider.js';
import { CheckoutService } from './service.js';

export const example = z.object({ id: z.string(), event_type: z.string(), resource: z.object({
  id: z.string(), status: z.string(), amount: z.object({ value: z.string(), currency_code: z.string() }),
  create_time: z.string(), final_capture: z.boolean(), supplementary_data: z.object({ related_ids: z.object({ order_id: z.string() }) }),
}) }).parse(JSON.parse(readFileSync(new URL('./fixtures/documentation-example.json', import.meta.url), 'utf8')) as unknown);
export const settings = checkoutConfig({ PAYPAL_CLIENT_ID: 'mock-client', PAYPAL_CLIENT_SECRET: 'mock-secret',
  PAYPAL_WEBHOOK_ID: 'mock-webhook-id', CHECKOUT_ACCESS_KEY: 'test-access-code-not-for-real-use-123456' });
export const fixedTime = Date.parse('2024-05-16T05:19:23Z');
export const headers = {
  'paypal-transmission-id': 'mock-transmission', 'paypal-transmission-time': '2024-05-16T05:19:23Z',
  'paypal-transmission-sig': 'mock-signature-not-evidence', 'paypal-cert-url': 'https://api.sandbox.paypal.com/v1/notifications/certs/MOCK',
  'paypal-auth-algo': 'SHA256withRSA',
};
export class MockProvider implements PayPalProvider {
  actorId = '';
  status = 'APPROVED';
  orderAmount = '1.00';
  captureAmount = '1.00';
  currency = 'USD';
  captureStatus = 'COMPLETED';
  createOrder = vi.fn(async (input: CreateOrder): Promise<unknown> => {
    this.actorId = input.actorId;
    return { id: example.resource.supplementary_data.related_ids.order_id, links: [{ rel: 'payer-action', href: `https://www.sandbox.paypal.com/checkoutnow?token=${example.resource.supplementary_data.related_ids.order_id}` }] };
  });
  getOrder = vi.fn(async (): Promise<unknown> => ({
    id: example.resource.supplementary_data.related_ids.order_id, status: this.status, intent: 'CAPTURE',
    purchase_units: [{ custom_id: this.actorId, amount: { value: this.orderAmount, currency_code: this.currency },
      ...(this.status === 'COMPLETED' ? { payments: { captures: [{ ...example.resource,
        status: this.captureStatus, amount: { value: this.captureAmount, currency_code: this.currency } }] } } : {}) }],
  }));
  captureOrder = vi.fn(async (_orderId: string, _requestId: string): Promise<unknown> => {
    void _orderId; void _requestId;
    this.status = 'COMPLETED'; return this.getOrder();
  });
  verifyWebhook = vi.fn(async (_raw: string, _headers: Record<string, string>) => { void _raw; void _headers; return true; });
}
export function fixture() {
  const provider = new MockProvider();
  const service = new CheckoutService(settings, provider, () => fixedTime);
  const id = service.authorize(settings.CHECKOUT_ACCESS_KEY ?? '');
  return { provider, service, id };
}
export function declined(): PaymentError { return new PaymentError(422, 'paypal_declined_or_unprocessable'); }
