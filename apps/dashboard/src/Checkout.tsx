import { useEffect, useState } from 'react';
import { SandboxConfigurationSchema, SandboxSessionSchema } from '@payment-risk/core';
import type { SandboxSession } from '@payment-risk/core';

async function request(path: string, body?: unknown) {
  const response = await fetch(`/sandbox/${path}`, { credentials: 'same-origin', cache: 'no-store',
    ...(body !== undefined ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  const data: unknown = await response.json();
  if (!response.ok) {
    const code = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : 'request_failed';
    throw new Error(code);
  }
  return data;
}
export function Checkout() {
  const [configuration, setConfiguration] = useState<ReturnType<typeof SandboxConfigurationSchema.parse>>();
  const [session, setSession] = useState<SandboxSession>();
  const [accessKey, setAccessKey] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [returned] = useState(() => new URLSearchParams(window.location.search).get('checkout'));
  useEffect(() => {
    let stopped = false;
    // Provider return parameters are not payment evidence and need not remain in browser history.
    if (window.location.search) window.history.replaceState(null, '', window.location.pathname);
    void (async () => {
      try {
        const config = SandboxConfigurationSchema.parse(await request('config'));
        if (!stopped) setConfiguration(config);
        if (!config.setupRequired) {
          try {
            const state = SandboxSessionSchema.parse(await request('session'));
            if (!stopped) setSession(state);
          } catch (error) {
            if (!stopped && error instanceof Error && error.message !== 'checkout_session_required') setError(error.message);
          }
        }
      } catch { if (!stopped) setError('Sandbox API unavailable. Start the API and check the local proxy.'); }
    })();
    return () => { stopped = true; };
  }, []);
  async function act(path: string, body?: unknown) {
    setBusy(true); setError('');
    try { setSession(SandboxSessionSchema.parse(await request(path, body))); }
    catch (error) { setError(error instanceof Error ? error.message : 'request_failed'); }
    finally { setAccessKey(''); setBusy(false); }
  }
  return <section aria-labelledby="checkout-title">
    <h2 id="checkout-title">PayPal sandbox checkout (test only)</h2>
    <p>A generic test purchase using sandbox accounts. No real money, wagers, or synthetic deposits.</p>
    {error && <p role="alert" className="error">{error}. No new capture has been verified. For an uncertain result, refresh status or retry the same checkout.</p>}
    {!configuration && !error && <p role="status">Checking sandbox setup...</p>}
    {configuration?.setupRequired && <><p role="status">Setup required. Configure the server, then restart and reload.</p><p>Missing: {configuration.missing.join(', ')}</p></>}
    {configuration && !configuration.setupRequired && <>
      <p>Server-authorized test amount: {(configuration.amountMinor / 100).toFixed(2)} USD</p>
      {!session && <form onSubmit={event => { event.preventDefault(); void act('session', { accessKey }); }}>
        <label htmlFor="checkout-access">Local checkout access code</label>
        <input id="checkout-access" type="password" autoComplete="off" value={accessKey} onChange={event => setAccessKey(event.target.value)} required maxLength={256} />
        <button disabled={busy}>Authorize test session</button>
      </form>}
      {session && <>
        <p role="status">Checkout state: {session.state}</p>
        {returned === 'approved' && !session.event && <p>Returned from PayPal. This callback does not prove payment. Confirm capture below to check approval server-side.</p>}
        {returned === 'cancelled' && !session.event && <p>Returned through the cancel link. You may cancel the local checkout below; no payment success is assumed.</p>}
        {session.state === 'ready' && <button disabled={busy} onClick={() => { void act('orders', {}); }}>Create sandbox order</button>}
        {session.state === 'approval_required' && <>
          {session.approvalUrl && <p><a href={session.approvalUrl} rel="noreferrer">Approve test purchase on PayPal sandbox</a></p>}
          <button disabled={busy} onClick={() => { void act('capture', { confirm: true }); }}>Confirm and capture test purchase</button>
          <button disabled={busy} onClick={() => { void act('cancel', {}); }}>Cancel local checkout</button>
        </>}
        <button disabled={busy} onClick={() => { void act('session'); }}>Refresh verified status</button>
        {session.state === 'cancelled' && <p>Local checkout cancelled. No capture will be initiated for this session. A new session is available after expiry or clearing the local session cookie.</p>}
        {session.event && session.event.source === 'paypal_sandbox' && <>
          <h3>Verified PayPal sandbox event</h3>
          <dl><dt>Source</dt><dd>{session.event.source}</dd><dt>Capture ID</dt><dd>{session.event.provenance.providerCaptureId}</dd><dt>Order ID</dt><dd>{session.event.provenance.providerOrderId}</dd><dt>Logical payments</dt><dd>1</dd><dt>Verified webhook IDs</dt><dd>{session.verifiedWebhookCount}</dd></dl>
          <details><summary>Inspect verified sandbox evidence</summary><pre>{JSON.stringify(session.event, null, 2)}</pre></details>
        </>}
      </>}
    </>}
  </section>;
}
