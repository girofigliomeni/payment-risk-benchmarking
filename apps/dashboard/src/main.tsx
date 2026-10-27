import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DashboardEnvironmentSchema, HealthSchema, PaymentEventSchema } from '@payment-risk/core';
import fixture from '../../../packages/core/fixtures/sample-synthetic.json';
import './style.css';
const env = DashboardEnvironmentSchema.parse(import.meta.env);
const sample = PaymentEventSchema.parse(fixture);
function App() {
  const [connection, setConnection] = useState<'checking' | 'connected' | 'error'>('checking');
  useEffect(() => {
    let stopped = false;
    let controller: AbortController | undefined;
    async function check() {
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 3000);
      try {
        const response = await fetch(`${env.VITE_API_BASE_URL.replace(/\/$/, '')}/health`, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error('Health request failed');
        HealthSchema.parse(await response.json());
        if (!stopped) setConnection('connected');
      } catch {
        if (!stopped) setConnection('error');
      } finally {
        window.clearTimeout(timeout);
        if (!stopped) timer = window.setTimeout(() => { void check(); }, 5000);
      }
    }
    let timer: number | undefined;
    void check();
    return () => { stopped = true; window.clearTimeout(timer); controller?.abort(); };
  }, []);
  return <main>
    <header><h1>Payment Risk Lab</h1><p>Reproducible payment-risk research</p></header>
    <section aria-labelledby="connection-title"><h2 id="connection-title">API connection</h2>
      <p role="status" className={connection}>{connection === 'checking' ? 'Checking API?' : connection === 'connected' ? 'Connected ? API health is OK' : 'Connection error ? API health could not be verified. Start the API and check its configured address.'}</p>
      <p>Health is checked every five seconds.</p>
    </section>
    <section aria-labelledby="experiments-title"><h2 id="experiments-title">Experiments</h2><p className="empty">No experiments yet.</p><p>This foundation has no experiment runner. No payment activity is connected.</p></section>
    <section aria-labelledby="sample-title"><h2 id="sample-title">Synthetic sample data</h2><p>A checked-in, hand-authored example. This is not PayPal activity or a processed payment.</p>
      <dl><dt>Source</dt><dd>{sample.source}</dd><dt>Event</dt><dd>{sample.eventId}</dd><dt>Status</dt><dd>{sample.status}</dd><dt>Amount (minor units)</dt><dd>{sample.amountMinor} {sample.currency}</dd></dl>
      <details><summary>Inspect sample event and provenance</summary><pre>{JSON.stringify(sample, null, 2)}</pre></details>
    </section>
  </main>;
}
const root = document.getElementById('root');
if (!root) throw new Error('Root element is missing');
createRoot(root).render(<StrictMode><App /></StrictMode>);

