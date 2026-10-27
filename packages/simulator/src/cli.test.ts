import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it.each([['--config', ''], ['--config=']])('rejects an empty config operand: %j', (...args) => {
  const directory = mkdtempSync(join(tmpdir(), 'payment-risk-simulator-'));
  const output = join(directory, 'output');
  const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url));
  try {
    const result = spawnSync(process.execPath, [cli, ...args, '--out', output], { encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr.trim()).toBe('--config requires a nonempty path');
    expect(existsSync(output)).toBe(false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

it('CLI writes reproducible separate files and refuses overwrite or invalid input', () => {
  const directory = mkdtempSync(join(tmpdir(), 'payment-risk-simulator-'));
  const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url));
  const run = (out: string, seed: string) => execFileSync(process.execPath, [cli, '--seed', seed, '--population', '5', '--out', out], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const first = join(directory, 'first');
    const second = join(directory, 'second');
    expect(run(first, '42')).toContain('runtimeMs');
    run(second, '42');
    for (const file of ['events.jsonl', 'inference.jsonl', 'labels.jsonl', 'manifest.json']) {
      expect(readFileSync(join(first, file))).toEqual(readFileSync(join(second, file)));
    }
    expect(() => run(first, '43')).toThrow();
    expect(() => run(join(directory, 'invalid'), 'NaN')).toThrow();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
