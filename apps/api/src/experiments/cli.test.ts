import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { createApp } from '../app.js';
import type { ExperimentStore } from './store.js';

it('CLI imports a saved seeded file and repeats identical scoring without reading labels', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'payment-risk-baseline-'));
  const events = [{ eventId: 'e1', actorId: 'fictional-cli', occurredAt: '2026-01-01T00:00:00Z', source: 'synthetic',
    eventType: 'deposit', status: 'completed', amountMinor: 100, currency: 'USD',
    provenance: { source: 'synthetic', datasetId: 'saved-dataset', seed: 42, generatorVersion: 'synthetic-v1' } }];
  const actions: string[] = [];
  const store: ExperimentStore = { owner: async () => '22222222-2222-4222-8222-222222222222',
    command: async (_owner, _id, action, data) => { actions.push(action); return action === 'snapshot' ? { events } : data; } };
  const server = createServer(createApp(undefined, store));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('address required');
    const path = join(directory, 'events.jsonl');
    await writeFile(path, events.map(event => JSON.stringify(event)).join('\n') + '\n');
    // No labels file exists: the CLI must not read one.
    const cli = fileURLToPath(new URL('../../dist/experiments/cli.js', import.meta.url));
    const run = () => promisify(execFile)(process.execPath, [cli, '--experiment', '11111111-1111-4111-8111-111111111111', '--events', path], {
      env: { ...process.env, EXPERIMENT_ACCESS_TOKEN: 'test-user-token', EXPERIMENT_API_URL: `http://127.0.0.1:${address.port}` },
    });
    const first = await run();
    expect(first.stderr).toBe('');
    expect((await run()).stdout).toBe(first.stdout);
    expect(JSON.parse(first.stdout)).toMatchObject({ version: 'rules-v1', decisions: [{ eventId: 'e1', decision: 'pass' }] });
    expect(actions).toEqual(['create', 'ingest', 'snapshot', 'save', 'create', 'ingest', 'snapshot', 'save']);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  }
});
