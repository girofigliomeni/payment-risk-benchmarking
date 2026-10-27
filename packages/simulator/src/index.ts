import { createHash } from 'node:crypto';
import { z } from 'zod';
import { MoneySchema, PaymentEventSchema, ScenarioLabelSchema, toObservablePaymentEvent } from '@payment-risk/core';
import type { PaymentEvent, ScenarioLabel } from '@payment-risk/core';

export const GENERATOR_VERSION = 'synthetic-v1';
export const SCENARIOS = ['normal', 'deposit_velocity', 'repeated_failures', 'abrupt_amount_change', 'unusual_withdrawal_timing'] as const;
export type Scenario = typeof SCENARIOS[number];
const weight = z.number().finite().nonnegative().max(1000);
const RangeSchema = z.object({
  min: z.number().int().min(1).max(1_000_000_000),
  max: z.number().int().min(1).max(1_000_000_000),
}).strict().refine(range => range.min <= range.max, 'min must not exceed max');
export const SimulationConfigSchema = z.object({
  seed: z.number().int().min(0).max(0xffffffff).default(42),
  populationSize: z.number().int().min(1).max(10_000).default(100),
  durationSeconds: z.number().int().min(3600).max(31_536_000).default(604800),
  scenarioMix: z.object({
    normal: weight, deposit_velocity: weight, repeated_failures: weight,
    abrupt_amount_change: weight, unusual_withdrawal_timing: weight,
  }).strict().refine(mix => Object.values(mix).some(value => value > 0), 'At least one scenario weight must be positive')
    .default({ normal: 60, deposit_velocity: 10, repeated_failures: 10, abrupt_amount_change: 10, unusual_withdrawal_timing: 10 }),
  amountRanges: z.object({ deposit: RangeSchema, withdrawal: RangeSchema }).strict()
    .default({ deposit: { min: 100, max: 50000 }, withdrawal: { min: 100, max: 50000 } }),
  currency: MoneySchema.unwrap().shape.currency.default('USD'),
}).strict();
export type SimulationConfig = z.infer<typeof SimulationConfigSchema>;
export type SyntheticPaymentEvent = Extract<PaymentEvent, { source: 'synthetic' }>;
export interface Simulation {
  readonly config: SimulationConfig;
  readonly events: readonly SyntheticPaymentEvent[];
  readonly labels: readonly ScenarioLabel[];
  readonly countsByScenario: Readonly<Record<Scenario, { actors: number; events: number }>>;
}

// Mulberry32 uses explicit 32-bit operations; no wall clock or global randomness.
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
function sha256(value: string): string { return createHash('sha256').update(value, 'utf8').digest('hex'); }
function compare(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
const EPOCH = Date.UTC(2026, 0, 1);

export function simulate(input: unknown = {}): Simulation {
  const config = SimulationConfigSchema.parse(input);
  const rng = random(config.seed);
  const integer = (min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
  const totalWeight = SCENARIOS.reduce((total, scenario) => total + config.scenarioMix[scenario], 0);
  const datasetId = sha256(JSON.stringify({ generatorVersion: GENERATOR_VERSION, config }));
  const provenance = { source: 'synthetic' as const, datasetId, generatorVersion: GENERATOR_VERSION, seed: config.seed };
  const events: SyntheticPaymentEvent[] = [];
  const labelById = new Map<string, ScenarioLabel>();
  const countsByScenario = Object.fromEntries(SCENARIOS.map(scenario => [scenario, { actors: 0, events: 0 }])) as Record<Scenario, { actors: number; events: number }>;
  let sequence = 0;
  for (let actorIndex = 0; actorIndex < config.populationSize; actorIndex++) {
    let draw = rng() * totalWeight;
    const scenario = SCENARIOS.find(name => { draw -= config.scenarioMix[name]; return draw < 0; });
    if (!scenario) throw new Error('Scenario weights could not be resolved');
    const actorId = `fictional-${sha256(`actor:${config.seed}:${actorIndex}`).slice(0, 24)}`;
    const count = integer(8, 16);
    const start = integer(0, config.durationSeconds - 601);
    const baseline = integer(config.amountRanges.deposit.min, config.amountRanges.deposit.max);
    countsByScenario[scenario].actors++;
    for (let index = 0; index < count; index++) {
      // Normal activity can contain failures, short bursts, high amounts and fast withdrawals.
      // These overlaps prevent a single event attribute from perfectly identifying a label.
      let offset = integer(0, config.durationSeconds - 1);
      let eventType: 'deposit' | 'withdrawal' = rng() < 0.7 ? 'deposit' : 'withdrawal';
      let status: 'failed' | 'completed' = rng() < 0.12 ? 'failed' : 'completed';
      if (scenario === 'deposit_velocity' || (scenario === 'normal' && index < 2)) {
        offset = start + index * integer(2, 20);
        eventType = 'deposit';
      }
      if (scenario === 'repeated_failures') {
        offset = start + index * integer(5, 30);
        status = index < count - 2 || rng() < 0.35 ? 'failed' : 'completed';
      }
      if (scenario === 'unusual_withdrawal_timing') {
        offset = start + Math.floor(index / 2) * 60 + (index % 2) * integer(1, 10);
        eventType = index % 2 === 0 ? 'deposit' : 'withdrawal';
      }
      const range = config.amountRanges[eventType];
      let amountMinor = integer(range.min, range.max);
      if (scenario === 'abrupt_amount_change') {
        offset = Math.floor(index * config.durationSeconds / count);
        eventType = 'deposit';
        const deposit = config.amountRanges.deposit;
        amountMinor = index < Math.floor(count / 2)
          ? integer(deposit.min, Math.min(deposit.max, deposit.min + Math.floor((deposit.max - deposit.min) / 10)))
          : integer(Math.max(deposit.min, deposit.max - Math.floor((deposit.max - deposit.min) / 10)), deposit.max);
      } else if (scenario === 'normal' && eventType === 'deposit' && rng() < 0.6) {
        amountMinor = Math.max(range.min, Math.min(range.max, baseline + integer(-100, 100)));
      }
      // Identity depends on seed and sequence only, never scenario names or labels.
      const eventId = sha256(`event:${config.seed}:${sequence++}`).slice(0, 32);
      const event = PaymentEventSchema.parse({
        eventId, actorId, occurredAt: new Date(EPOCH + offset * 1000).toISOString(),
        eventType, amountMinor, currency: config.currency, status, source: 'synthetic', provenance,
      });
      if (event.source !== 'synthetic') throw new Error('Simulator must only produce synthetic events');
      events.push(event);
      labelById.set(eventId, ScenarioLabelSchema.parse({
        eventId, scenarioTemplateId: `${scenario}/development-v1`,
        label: scenario === 'normal' ? 'benign' : 'anomalous', split: 'train',
      }));
      countsByScenario[scenario].events++;
    }
  }
  events.sort((a, b) => compare(a.occurredAt, b.occurredAt) || compare(a.eventId, b.eventId));
  const labels = events.map(event => {
    const label = labelById.get(event.eventId);
    if (!label) throw new Error('Missing evaluation label');
    return label;
  });
  return { config, events, labels, countsByScenario };
}

function jsonl(records: readonly unknown[]): string { return records.map(record => JSON.stringify(record)).join('\n') + '\n'; }
/** Pure serialization: hashes cover exact UTF-8 bytes, including final newlines. */
export function serializeSimulation(simulation: Simulation) {
  const events = jsonl(simulation.events);
  const inference = jsonl(simulation.events.map(toObservablePaymentEvent));
  const labels = jsonl(simulation.labels);
  const hashes = { events: sha256(events), inference: sha256(inference), labels: sha256(labels) };
  const eventTypes = { deposit: 0, withdrawal: 0 };
  for (const event of simulation.events) {
    if (event.eventType === 'deposit' || event.eventType === 'withdrawal') eventTypes[event.eventType]++;
  }
  const manifest = {
    formatVersion: 1, generatorVersion: GENERATOR_VERSION, source: 'synthetic',
    description: 'Fictional development data only; no PayPal activity or real payment results.',
    config: simulation.config, virtualStart: new Date(EPOCH).toISOString(),
    eventCount: simulation.events.length, actorCount: simulation.config.populationSize,
    countsByScenario: simulation.countsByScenario, countsByEventType: eventTypes,
    hashes, datasetHash: sha256(JSON.stringify(hashes)),
  };
  return { events, inference, labels, manifest: JSON.stringify(manifest, null, 2) + '\n', summary: manifest };
}
