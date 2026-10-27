import { parseArgs } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { simulate, serializeSimulation } from './index.js';

async function main() {
  const { values } = parseArgs({ options: {
    seed: { type: 'string' }, population: { type: 'string' }, 'duration-seconds': { type: 'string' },
    config: { type: 'string' }, out: { type: 'string' }, help: { type: 'boolean' },
  }, strict: true });
  if (values.help) {
    console.log('Synthetic development datasets only.\nUsage: npm run simulate -- --seed 42 --population 1000 --duration-seconds 604800 --out artifacts/seed-42\nOptional: --config path/to/config.json (scenario mix, amount ranges, currency; CLI flags override config).\nOutput: events.jsonl (full synthetic provenance), inference.jsonl (observable fields), labels.jsonl (evaluation only), manifest.json.\nOutput directory must be new, to avoid overwriting existing work.');
    return;
  }
  let config: Record<string, unknown> = {};
  if (values.config) {
    const parsed: unknown = JSON.parse(await readFile(resolve(values.config), 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Config must be a JSON object');
    config = { ...parsed };
  }
  const numeric = (value: string): number => {
    if (!/^\d+$/.test(value)) throw new Error('Numeric CLI options require unsigned decimal integers');
    return Number(value);
  };
  if (values.seed !== undefined) config.seed = numeric(values.seed);
  if (values.population !== undefined) config.populationSize = numeric(values.population);
  if (values['duration-seconds'] !== undefined) config.durationSeconds = numeric(values['duration-seconds']);
  const started = performance.now();
  const output = serializeSimulation(simulate(config));
  const directory = resolve(values.out ?? `artifacts/synthetic-${output.summary.config.seed}`);
  // Claim a fresh directory; never overwrite user files or mix runs.
  await mkdir(resolve(directory, '..'), { recursive: true });
  await mkdir(directory);
  await writeFile(join(directory, 'events.jsonl'), output.events, { flag: 'wx' });
  await writeFile(join(directory, 'inference.jsonl'), output.inference, { flag: 'wx' });
  await writeFile(join(directory, 'labels.jsonl'), output.labels, { flag: 'wx' });
  await writeFile(join(directory, 'manifest.json'), output.manifest, { flag: 'wx' });
  console.log(JSON.stringify({ ...output.summary, outputDirectory: directory, runtimeMs: Math.round(performance.now() - started) }, null, 2));
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Simulation failed');
  process.exitCode = 1;
});
