import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { CheckoutService } from './service.js';
import { checkoutConfig } from './config.js';
import { MockProvider, example, fixture, headers, settings } from './test-support.js';

let server: Server | undefined;
afterEach(async () => { if (server) await new Promise<void>((resolve, reject) => { server?.close(error => error ? reject(error) : resolve()); }); server = undefined; });
async function start(service: CheckoutService) {
  server = createServer(createApp(service));
  await new Promise<void>(resolve => { server?.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing test address');
  const base = `http://127.0.0.1:${address.port}/sandbox`;
  const call = (path: string, body?: unknown, cookie = '', origin = settings.CHECKOUT_ORIGIN) => fetch(base + path, {
    headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: cookie },
    ...(body !== undefined ? { method: 'POST', body: JSON.stringify(body) } : {}),
  });
  return { base, call };
}
describe('sandbox HTTP authorization and lifecycle', () => {
  it('returns setup-required with no credentials and never contacts PayPal', async () => {
    const provider = new MockProvider();
    const { call } = await start(new CheckoutService(checkoutConfig({}), provider));
    const response = await call('/config');
    expect(await response.json()).toMatchObject({ setupRequired: true, source: 'paypal_sandbox' });
    expect((await call('/session', { accessKey: 'unused' })).status).toBe(503);
    expect(provider.createOrder).not.toHaveBeenCalled();
  });
  it('enforces origin, authorization, immutable amount, and explicit capture confirmation', async () => {
    const { service, provider } = fixture();
    const { call } = await start(service);
    expect((await call('/orders', {})).status).toBe(401);
    expect((await call('/session', { accessKey: settings.CHECKOUT_ACCESS_KEY }, '', 'https://untrusted.example')).status).toBe(403);
    expect((await call('/session', { accessKey: 'bad' })).status).toBe(401);
    const login = await call('/session', { accessKey: settings.CHECKOUT_ACCESS_KEY });
    expect(login.headers.get('set-cookie')).toContain('HttpOnly');
    expect(login.headers.get('set-cookie')).toContain('SameSite=Strict');
    const cookie = login.headers.get('set-cookie')?.split(';')[0] ?? '';
    expect((await call('/orders', { amountMinor: 1 }, cookie)).status).toBe(400);
    expect((await call('/orders', {}, cookie)).status).toBe(200);
    expect((await call('/capture', {}, cookie)).status).toBe(400);
    expect((await call('/capture', { confirm: true, amountMinor: 5 }, cookie)).status).toBe(400);
    expect(provider.captureOrder).not.toHaveBeenCalled();
    const captured = await call('/capture', { confirm: true }, cookie);
    expect(captured.status).toBe(200);
    expect(await captured.json()).toMatchObject({ state: 'verified', event: { source: 'paypal_sandbox', eventType: 'capture' } });
    expect((await call('/capture', { confirm: true }, cookie)).status).toBe(200);
    expect(provider.captureOrder).toHaveBeenCalledTimes(1);
    const statusText = await (await call('/session', undefined, cookie)).text();
    expect(statusText).not.toMatch(/mock-secret|access-code|email|payer|mock-client/);
    expect((await call('/session')).status).toBe(401);
  });
  it('rejects invalid webhook signatures over HTTP and deduplicates verified delivery', async () => {
    const { service, provider, id } = fixture();
    await service.create(id); await service.capture(id);
    const { base } = await start(service);
    const deliver = () => fetch(base + '/webhook', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(example) });
    provider.verifyWebhook.mockResolvedValueOnce(false);
    expect((await deliver()).status).toBe(401);
    expect(await (await deliver()).json()).toEqual({ duplicate: false });
    expect(await (await deliver()).json()).toEqual({ duplicate: true });
    expect(service.status(id).verifiedWebhookCount).toBe(1);
  });
  it('bounds request bodies and rejects malformed JSON without echoing it', async () => {
    const { service } = fixture();
    const { base, call } = await start(service);
    expect((await call('/session', { accessKey: 'x'.repeat(2000) })).status).toBe(413);
    const malformed = await fetch(base + '/session', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: settings.CHECKOUT_ORIGIN }, body: '{private-secret' });
    expect(malformed.status).toBe(400);
    expect(await malformed.text()).not.toContain('private-secret');
  });
});
