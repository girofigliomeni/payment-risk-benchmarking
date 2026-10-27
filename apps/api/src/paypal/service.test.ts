import { describe, expect, it } from 'vitest';
import { PaymentEventSchema } from '@payment-risk/core';
import { checkoutConfig } from './config.js';
import { CheckoutService, decimal } from './service.js';
import { MockProvider, declined, example, fixture, fixedTime, headers, settings } from './test-support.js';

const raw = JSON.stringify(example);
describe('sandbox lifecycle using documentation-derived mocks', () => {
  it('creates once concurrently, captures once, verifies via GET and exports one sandbox event', async () => {
    const { service, provider, id } = fixture();
    const created = await Promise.all([service.create(id), service.create(id)]);
    expect(created[0]).toEqual(created[1]);
    expect(provider.createOrder).toHaveBeenCalledTimes(1);
    expect(provider.createOrder.mock.calls[0]?.[0].amount).toBe('1.00');
    const captured = await Promise.all([service.capture(id), service.capture(id)]);
    expect(provider.captureOrder).toHaveBeenCalledTimes(1);
    expect(captured[0]?.state).toBe('verified');
    expect(PaymentEventSchema.parse(captured[0]?.event).source).toBe('paypal_sandbox');
    expect(captured[1]?.event).toEqual(captured[0]?.event);
    expect(JSON.stringify(captured)).not.toMatch(/mock-secret|mock-client|access-code|scenario|seed/);
    expect(provider.getOrder.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
  it('does not capture based on a client callback or unapproved order', async () => {
    const { service, provider, id } = fixture();
    await service.create(id); provider.status = 'CREATED';
    await expect(service.capture(id)).rejects.toThrow('paypal_approval_required');
    expect(provider.captureOrder).not.toHaveBeenCalled();
    expect(service.status(id).event).toBeUndefined();
  });
  it('keeps decline truthful and safely reuses the capture idempotency key on retry', async () => {
    const { service, provider, id } = fixture();
    await service.create(id);
    provider.captureOrder.mockRejectedValueOnce(declined());
    await expect(service.capture(id)).rejects.toThrow('paypal_declined_or_unprocessable');
    expect(service.status(id).event).toBeUndefined();
    await service.capture(id);
    expect(provider.captureOrder.mock.calls[0]?.[1]).toBe(provider.captureOrder.mock.calls[1]?.[1]);
  });
  it('reconciles a timed-out POST that actually captured without sending a second capture', async () => {
    const { service, provider, id } = fixture();
    await service.create(id);
    provider.captureOrder.mockImplementationOnce(async () => { provider.status = 'COMPLETED'; throw new Error('mock timeout'); });
    expect((await service.capture(id)).state).toBe('verified');
    await service.capture(id);
    expect(provider.captureOrder).toHaveBeenCalledTimes(1);
  });
  it('reuses the create key after an uncertain create request', async () => {
    const { service, provider, id } = fixture();
    provider.createOrder.mockRejectedValueOnce(new Error('mock timeout'));
    await expect(service.create(id)).rejects.toThrow();
    await service.create(id);
    expect(provider.createOrder.mock.calls[0]?.[0].requestId).toBe(provider.createOrder.mock.calls[1]?.[0].requestId);
  });
  it('cancels locally before capture and rejects capture after cancellation', async () => {
    const { service, provider, id } = fixture();
    await service.create(id);
    expect((await service.cancel(id)).state).toBe('cancelled');
    await expect(service.capture(id)).rejects.toThrow('checkout_not_capturable');
    expect(provider.captureOrder).not.toHaveBeenCalled();
  });
  it('does not allow cancellation to hide an already-started capture', async () => {
    const { service, provider, id } = fixture();
    await service.create(id); provider.captureOrder.mockRejectedValueOnce(declined());
    await expect(service.capture(id)).rejects.toThrow();
    await expect(service.cancel(id)).rejects.toThrow('capture_already_started');
  });
  it.each(['order', 'capture', 'currency', 'actor', 'pending'] as const)('rejects %s mismatch without a trusted event', async mismatch => {
    const { service, provider, id } = fixture();
    await service.create(id);
    if (mismatch === 'order') provider.orderAmount = '2.00';
    if (mismatch === 'capture') provider.captureAmount = '2.00';
    if (mismatch === 'currency') provider.currency = 'EUR';
    if (mismatch === 'actor') provider.actorId = 'other-session';
    if (mismatch === 'pending') provider.captureStatus = 'PENDING';
    await expect(service.capture(id)).rejects.toThrow();
    expect(service.status(id).event).toBeUndefined();
  });
  it('rejects a forged signature before trusting any payload and accepts valid duplicates once', async () => {
    const { service, provider, id } = fixture();
    await service.create(id); await service.capture(id);
    const event = service.status(id).event;
    provider.verifyWebhook.mockResolvedValueOnce(false);
    await expect(service.webhook(raw, headers)).rejects.toThrow('webhook_signature_invalid');
    expect(service.status(id).verifiedWebhookCount).toBe(0);
    expect(await service.webhook(raw, headers)).toEqual({ duplicate: false });
    expect(await service.webhook(raw, headers)).toEqual({ duplicate: true });
    expect(service.status(id).verifiedWebhookCount).toBe(1);
    expect(service.status(id).event).toEqual(event);
    await expect(service.webhook(JSON.stringify({ ...example, resource: { ...example.resource, amount: { value: '2.00', currency_code: 'USD' } } }), headers)).rejects.toThrow('webhook_replay_conflict');
  });
  it('correlates a webhook arriving before the capture response is reconciled', async () => {
    const { service, provider, id } = fixture();
    await service.create(id);
    provider.captureOrder.mockRejectedValueOnce(new Error('mock timeout'));
    await expect(service.capture(id)).rejects.toThrow();
    provider.status = 'COMPLETED';
    await service.webhook(raw, headers);
    expect(service.status(id).event?.eventId).toBe(`paypal_sandbox:capture:${example.resource.id}`);
    await service.capture(id);
    expect(provider.captureOrder).toHaveBeenCalledTimes(1);
  });
  it('rejects webhook capture/amount mismatch and ignores unrelated verified events', async () => {
    const { service, id } = fixture();
    await service.create(id); await service.capture(id);
    await expect(service.webhook(JSON.stringify({ ...example, resource: { ...example.resource, id: 'OTHER-CAPTURE' } }), headers)).rejects.toThrow('capture_or_amount_mismatch');
    await expect(service.webhook(JSON.stringify({ ...example, resource: { ...example.resource, amount: { value: '2.00', currency_code: 'USD' } } }), headers)).rejects.toThrow('webhook_capture_mismatch');
    expect(await service.webhook(JSON.stringify({ ...example, event_type: 'CHECKOUT.ORDER.APPROVED' }), headers)).toEqual({ ignored: true });
    expect(service.status(id).verifiedWebhookCount).toBe(0);
  });
  it('rejects stale headers, untrusted certificates and missing headers', async () => {
    const { service, provider } = fixture();
    await expect(service.webhook(raw, { ...headers, 'paypal-transmission-time': '2000-01-01T00:00:00Z' })).rejects.toThrow('webhook_transmission_expired');
    await expect(service.webhook(raw, { ...headers, 'paypal-cert-url': 'http://localhost/secret' })).rejects.toThrow('webhook_invalid_certificate_url');
    await expect(service.webhook(raw, {})).rejects.toThrow('webhook_headers_required');
    expect(provider.verifyWebhook).not.toHaveBeenCalled();
  });
  it('fails closed for missing configuration and rejects bad authorization and expired sessions', async () => {
    const provider = new MockProvider();
    const unavailable = new CheckoutService(checkoutConfig({}), provider);
    expect(unavailable.configuration().setupRequired).toBe(true);
    expect(() => unavailable.authorize('not-a-key')).toThrow('setup_required');
    let clock = fixedTime;
    const service = new CheckoutService(settings, provider, () => clock);
    expect(() => service.authorize('bad')).toThrow('invalid_access_key');
    const id = service.authorize(settings.CHECKOUT_ACCESS_KEY ?? '');
    clock += 7200000;
    expect(() => service.status(id)).toThrow('checkout_session_required');
    expect(provider.createOrder).not.toHaveBeenCalled();
  });
  it('uses exact minor-unit decimal conversion and safe local defaults', () => {
    expect(decimal(1)).toBe('0.01'); expect(decimal(10000)).toBe('100.00');
    expect(() => checkoutConfig({ CHECKOUT_ACCESS_KEY: 'short' })).toThrow('CHECKOUT_ACCESS_KEY');
    expect(() => checkoutConfig({ CHECKOUT_ORIGIN: 'http://external.example' })).toThrow('CHECKOUT_ORIGIN');
  });
});
