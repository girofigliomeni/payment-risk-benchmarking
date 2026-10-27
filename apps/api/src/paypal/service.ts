import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { PaymentEventSchema, SandboxSessionSchema } from '@payment-risk/core';
import type { PaymentEvent, SandboxSession } from '@payment-risk/core';
import { missingSetup } from './config.js';
import type { CheckoutConfig } from './config.js';
import { PaymentError } from './provider.js';
import type { PayPalProvider } from './provider.js';

const Id = z.string().regex(/^[A-Z0-9-]{1,100}$/);
const Amount = z.object({ value: z.string().regex(/^\d+\.\d{2}$/), currency_code: z.literal('USD') });
const Capture = z.object({ id: Id, status: z.string(), amount: Amount, create_time: z.iso.datetime(), final_capture: z.boolean() });
const Order = z.object({ id: Id, intent: z.literal('CAPTURE'), status: z.string(),
  purchase_units: z.array(z.object({ custom_id: z.string(), amount: Amount,
    payments: z.object({ captures: z.array(Capture) }).optional(),
  })).length(1), links: z.array(z.object({ rel: z.string(), href: z.url() })).optional(),
});
function parsed<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new PaymentError(502, 'paypal_invalid_response');
  return result.data;
}
export function decimal(amountMinor: number): string {
  return `${Math.floor(amountMinor / 100)}.${String(amountMinor % 100).padStart(2, '0')}`;
}
interface Session {
  id: string; expires: number; createKey: string; captureKey: string; amount: string;
  orderId?: string; approvalUrl?: string; cancelled: boolean; captureStarted: boolean;
  event?: PaymentEvent; webhookIds: Map<string, string>;
}
export class CheckoutService {
  private readonly sessions = new Map<string, Session>();
  private readonly locks = new Map<string, Promise<unknown>>();
  constructor(readonly config: CheckoutConfig, private readonly provider: PayPalProvider,
    private readonly now: () => number = Date.now) {}
  configuration() { return { setupRequired: missingSetup(this.config).length > 0, missing: missingSetup(this.config),
    source: 'paypal_sandbox' as const, amountMinor: this.config.CHECKOUT_AMOUNT_MINOR, currency: 'USD' as const }; }
  private ready() { if (missingSetup(this.config).length) throw new PaymentError(503, 'setup_required'); }
  private session(id: string, allowExpired = false): Session {
    const session = this.sessions.get(id);
    if (!session || (!allowExpired && session.expires < this.now())) throw new PaymentError(401, 'checkout_session_required');
    return session;
  }
  authorize(key: string, existingId?: string): string {
    this.ready();
    const digest = (value: string) => createHash('sha256').update(value).digest();
    if (!timingSafeEqual(digest(key), digest(this.config.CHECKOUT_ACCESS_KEY ?? ''))) throw new PaymentError(401, 'invalid_access_key');
    if (existingId && this.sessions.has(existingId) && this.session(existingId, true).expires >= this.now()) return existingId;
    // Retain correlations for the lifetime of this single-process demo. Never evict active payment state.
    if (this.sessions.size >= 1000) throw new PaymentError(503, 'checkout_capacity_reached');
    const id = randomUUID();
    this.sessions.set(id, { id, expires: this.now() + 3600000, createKey: randomUUID(), captureKey: randomUUID(),
      amount: decimal(this.config.CHECKOUT_AMOUNT_MINOR), cancelled: false, captureStarted: false, webhookIds: new Map() });
    return id;
  }
  status(id: string): SandboxSession {
    const session = this.session(id);
    return SandboxSessionSchema.parse({ state: session.event ? 'verified' : session.cancelled ? 'cancelled' : session.orderId ? 'approval_required' : 'ready',
      ...(session.orderId ? { orderId: session.orderId } : {}), ...(session.approvalUrl ? { approvalUrl: session.approvalUrl } : {}),
      ...(session.event ? { event: session.event } : {}), verifiedWebhookCount: session.webhookIds.size });
  }
  private async exclusive<T>(id: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(id) ?? Promise.resolve();
    const task = previous.catch(() => undefined).then(operation);
    this.locks.set(id, task);
    try { return await task; } finally { if (this.locks.get(id) === task) this.locks.delete(id); }
  }
  private validateOrder(session: Session, value: unknown) {
    const order = parsed(Order, value);
    const unit = order.purchase_units[0];
    if (order.id !== session.orderId || !unit || unit.custom_id !== session.id || unit.amount.value !== session.amount) {
      throw new PaymentError(409, 'order_or_amount_mismatch');
    }
    return order;
  }
  async create(id: string): Promise<SandboxSession> {
    this.ready();
    return this.exclusive(id, async () => {
      const session = this.session(id);
      if (session.cancelled) throw new PaymentError(409, 'checkout_cancelled');
      if (session.orderId) return this.status(id);
      const created = parsed(z.object({ id: Id, links: z.array(z.object({ rel: z.string(), href: z.url() })) }), await this.provider.createOrder({
        requestId: session.createKey, actorId: session.id, amount: session.amount,
        returnUrl: `${this.config.CHECKOUT_ORIGIN}/?checkout=approved`, cancelUrl: `${this.config.CHECKOUT_ORIGIN}/?checkout=cancelled`,
      }));
      const link = created.links.find(link => link.rel === 'payer-action' || link.rel === 'approve');
      if (!link) throw new PaymentError(502, 'paypal_missing_approval_link');
      const url = new URL(link.href);
      if (url.protocol !== 'https:' || url.hostname !== 'www.sandbox.paypal.com' || url.username || url.password || url.port) {
        throw new PaymentError(502, 'paypal_invalid_approval_link');
      }
      session.orderId = created.id;
      session.approvalUrl = link.href;
      return this.status(id);
    });
  }
  private normalize(session: Session, orderValue: unknown, expectedCaptureId?: string): PaymentEvent {
    const order = this.validateOrder(session, orderValue);
    const captures = order.purchase_units[0]?.payments?.captures;
    const capture = captures?.[0];
    if (order.status !== 'COMPLETED' || captures?.length !== 1 || !capture || capture.status !== 'COMPLETED' || !capture.final_capture) {
      throw new PaymentError(409, 'capture_not_verified');
    }
    if (capture.amount.value !== session.amount || expectedCaptureId && capture.id !== expectedCaptureId) {
      throw new PaymentError(409, 'capture_or_amount_mismatch');
    }
    if (session.event) {
      if (session.event.provenance.source !== 'paypal_sandbox' || session.event.provenance.providerCaptureId !== capture.id) {
        throw new PaymentError(409, 'capture_conflict');
      }
      return session.event;
    }
    session.event = PaymentEventSchema.parse({ eventId: `paypal_sandbox:capture:${capture.id}`, source: 'paypal_sandbox',
      eventType: 'capture', occurredAt: capture.create_time, actorId: `fictional-${session.id}`,
      amountMinor: this.config.CHECKOUT_AMOUNT_MINOR, currency: 'USD', status: 'completed',
      provenance: { source: 'paypal_sandbox', providerOrderId: order.id, providerCaptureId: capture.id,
        providerEventId: capture.id, verificationStatus: 'verified', verifiedAt: new Date(this.now()).toISOString() } });
    return session.event;
  }
  async capture(id: string): Promise<SandboxSession> {
    this.ready();
    return this.exclusive(id, async () => {
      const session = this.session(id);
      if (session.cancelled || !session.orderId) throw new PaymentError(409, 'checkout_not_capturable');
      if (session.event) return this.status(id);
      const before = this.validateOrder(session, await this.provider.getOrder(session.orderId));
      if (before.status === 'COMPLETED' && session.captureStarted) {
        this.normalize(session, before); return this.status(id);
      }
      if (before.status !== 'APPROVED') throw new PaymentError(409, 'paypal_approval_required');
      session.captureStarted = true;
      let failure: unknown;
      try { await this.provider.captureOrder(session.orderId, session.captureKey); } catch (error) { failure = error; }
      // Even a successful POST or browser callback is not enough: verify by GET from PayPal.
      const after = this.validateOrder(session, await this.provider.getOrder(session.orderId));
      if (after.status !== 'COMPLETED' && failure) throw failure;
      this.normalize(session, after);
      return this.status(id);
    });
  }
  async cancel(id: string): Promise<SandboxSession> {
    return this.exclusive(id, async () => {
      const session = this.session(id);
      if (session.captureStarted || session.event) throw new PaymentError(409, 'capture_already_started');
      session.cancelled = true;
      return this.status(id);
    });
  }
  async webhook(raw: string, headers: Record<string, string>) {
    this.ready();
    const headerNames = ['paypal-transmission-id', 'paypal-transmission-time', 'paypal-transmission-sig', 'paypal-cert-url', 'paypal-auth-algo'];
    if (headerNames.some(name => !headers[name] || headers[name].length > 4096)) throw new PaymentError(400, 'webhook_headers_required');
    const timestamp = Date.parse(headers['paypal-transmission-time'] ?? '');
    if (!Number.isFinite(timestamp) || timestamp > this.now() + 300000 || timestamp < this.now() - 3 * 86400000) {
      throw new PaymentError(400, 'webhook_transmission_expired');
    }
    let certificate: URL;
    try { certificate = new URL(headers['paypal-cert-url'] ?? ''); } catch { throw new PaymentError(400, 'webhook_invalid_certificate_url'); }
    if (certificate.protocol !== 'https:' || !['api.paypal.com', 'api.sandbox.paypal.com', 'api-m.sandbox.paypal.com'].includes(certificate.hostname)
      || !certificate.pathname.startsWith('/v1/notifications/certs/') || certificate.username || certificate.password || certificate.port) {
      throw new PaymentError(400, 'webhook_invalid_certificate_url');
    }
    let payload: unknown;
    try { payload = JSON.parse(raw); } catch { throw new PaymentError(400, 'webhook_invalid_json'); }
    if (!await this.provider.verifyWebhook(raw, headers)) throw new PaymentError(401, 'webhook_signature_invalid');
    const envelope = parsed(z.object({ id: Id, event_type: z.string(), resource: z.unknown() }), payload);
    if (envelope.event_type !== 'PAYMENT.CAPTURE.COMPLETED') return { ignored: true };
    const resource = parsed(Capture.extend({ supplementary_data: z.object({ related_ids: z.object({ order_id: Id }) }) }), envelope.resource);
    const session = [...this.sessions.values()].find(session => session.orderId === resource.supplementary_data.related_ids.order_id);
    if (!session || !session.captureStarted) return { ignored: true };
    return this.exclusive(session.id, async () => {
      const fingerprint = createHash('sha256').update(raw).digest('hex');
      const seen = session.webhookIds.get(envelope.id);
      if (seen && seen !== fingerprint) throw new PaymentError(409, 'webhook_replay_conflict');
      if (seen) return { duplicate: true };
      if (session.webhookIds.size >= 100) throw new PaymentError(429, 'webhook_capacity_reached');
      if (resource.status !== 'COMPLETED' || resource.amount.value !== session.amount || !resource.final_capture) {
        throw new PaymentError(409, 'webhook_capture_mismatch');
      }
      this.normalize(session, await this.provider.getOrder(session.orderId ?? ''), resource.id);
      session.webhookIds.set(envelope.id, fingerprint);
      return { duplicate: false };
    });
  }
}
