import { z } from 'zod';
import type { CheckoutConfig } from './config.js';
export class PaymentError extends Error {
  constructor(public readonly status: number, public readonly code: string) { super(code); }
}
export interface CreateOrder {
  requestId: string; actorId: string; amount: string; returnUrl: string; cancelUrl: string;
}
export interface PayPalProvider {
  createOrder(input: CreateOrder): Promise<unknown>;
  getOrder(orderId: string): Promise<unknown>;
  captureOrder(orderId: string, requestId: string): Promise<unknown>;
  verifyWebhook(raw: string, headers: Record<string, string>): Promise<boolean>;
}
const BASE = 'https://api-m.sandbox.paypal.com';
export class SandboxPayPalProvider implements PayPalProvider {
  private token: { value: string; expires: number } | undefined;
  constructor(private readonly config: CheckoutConfig, private readonly transport: typeof fetch = fetch) {}
  private async send(path: string, init: RequestInit): Promise<unknown> {
    try {
      const response = await this.transport(BASE + path, { ...init, redirect: 'error', signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new PaymentError(response.status === 422 ? 422 : 502,
        response.status === 422 ? 'paypal_declined_or_unprocessable' : 'paypal_request_failed');
      return await response.json();
    } catch (error) {
      if (error instanceof PaymentError) throw error;
      throw new PaymentError(502, 'paypal_unavailable_retry_safely');
    }
  }
  private async accessToken(): Promise<string> {
    if (this.token && this.token.expires > Date.now()) return this.token.value;
    const body = await this.send('/v1/oauth2/token', {
      method: 'POST', headers: {
        Authorization: `Basic ${Buffer.from(`${this.config.PAYPAL_CLIENT_ID}:${this.config.PAYPAL_CLIENT_SECRET}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      }, body: 'grant_type=client_credentials',
    });
    const token = z.object({ access_token: z.string().min(1), expires_in: z.number().positive() }).safeParse(body);
    if (!token.success) throw new PaymentError(502, 'paypal_invalid_token_response');
    this.token = { value: token.data.access_token, expires: Date.now() + Math.max(0, token.data.expires_in - 60) * 1000 };
    return this.token.value;
  }
  private async request(path: string, method: string, body?: string, requestId?: string): Promise<unknown> {
    const token = await this.accessToken();
    return this.send(path, { method, headers: {
      Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation',
      ...(requestId ? { 'PayPal-Request-Id': requestId } : {}),
    }, ...(body !== undefined ? { body } : {}) });
  }
  createOrder(input: CreateOrder): Promise<unknown> {
    return this.request('/v2/checkout/orders', 'POST', JSON.stringify({
      intent: 'CAPTURE', purchase_units: [{ custom_id: input.actorId, description: 'Generic sandbox test purchase',
        amount: { currency_code: 'USD', value: input.amount } }],
      payment_source: { paypal: { experience_context: {
        shipping_preference: 'NO_SHIPPING', user_action: 'CONTINUE',
        return_url: input.returnUrl, cancel_url: input.cancelUrl,
      } } },
    }), input.requestId);
  }
  getOrder(orderId: string): Promise<unknown> { return this.request(`/v2/checkout/orders/${encodeURIComponent(orderId)}`, 'GET'); }
  captureOrder(orderId: string, requestId: string): Promise<unknown> {
    return this.request(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, 'POST', '{}', requestId);
  }
  async verifyWebhook(raw: string, headers: Record<string, string>): Promise<boolean> {
    // Preserve the original event JSON bytes when embedding it in PayPal's postback body.
    const prefix = JSON.stringify({ transmission_id: headers['paypal-transmission-id'],
      transmission_time: headers['paypal-transmission-time'], cert_url: headers['paypal-cert-url'],
      auth_algo: headers['paypal-auth-algo'], transmission_sig: headers['paypal-transmission-sig'],
      webhook_id: this.config.PAYPAL_WEBHOOK_ID }).slice(0, -1);
    const result = await this.request('/v1/notifications/verify-webhook-signature', 'POST', `${prefix},"webhook_event":${raw}}`);
    return z.object({ verification_status: z.literal('SUCCESS') }).safeParse(result).success;
  }
}
