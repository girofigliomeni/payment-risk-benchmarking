import { describe, expect, it } from 'vitest';
import { ObservablePaymentEventSchema, PaymentEventSchema, ScenarioLabelSchema } from '@payment-risk/core';
import { createHash } from 'node:crypto';
import { SCENARIOS, SimulationConfigSchema, serializeSimulation, simulate } from './index.js';

const hash = (text: string) => createHash('sha256').update(text).digest('hex');
describe('deterministic synthetic simulator', () => {
  it('produces byte-identical files and hashes independent of input property order', () => {
    const first = serializeSimulation(simulate({ seed: 42, populationSize: 20 }));
    const second = serializeSimulation(simulate({ populationSize: 20, seed: 42 }));
    expect(second).toEqual(first);
    expect(first.summary.hashes.events).toBe(hash(first.events));
    expect(first.summary.hashes.inference).toBe(hash(first.inference));
    expect(first.summary.hashes.labels).toBe(hash(first.labels));
    expect(first.summary.datasetHash).toBe(hash(JSON.stringify(first.summary.hashes)));
    const other = serializeSimulation(simulate({ seed: 43, populationSize: 20 }));
    expect(other.summary.datasetHash).not.toBe(first.summary.datasetHash);
    expect(other.inference).not.toBe(first.inference);
  });
  it('validates every event and label, stable chronology, unique IDs, and exact label joins', () => {
    const simulation = simulate({ seed: 42, populationSize: 1000 });
    expect(new Set(simulation.events.map(event => event.eventId)).size).toBe(simulation.events.length);
    expect(new Set(simulation.events.map(event => event.actorId)).size).toBe(1000);
    for (const [index, event] of simulation.events.entries()) {
      expect(PaymentEventSchema.safeParse(event).success).toBe(true);
      expect(event.source).toBe('synthetic');
      expect(Object.isFrozen(event.provenance)).toBe(true);
      expect(Date.parse(event.occurredAt)).toBeGreaterThanOrEqual(Date.UTC(2026, 0, 1));
      expect(Date.parse(event.occurredAt)).toBeLessThan(Date.UTC(2026, 0, 8));
      const previous = simulation.events[index - 1];
      if (previous) {
        expect(event.occurredAt >= previous.occurredAt).toBe(true);
        if (event.occurredAt === previous.occurredAt) expect(event.eventId > previous.eventId).toBe(true);
      }
      const label = simulation.labels[index];
      expect(ScenarioLabelSchema.safeParse(label).success).toBe(true);
      expect(label?.eventId).toBe(event.eventId);
    }
    expect(Object.values(simulation.countsByScenario).reduce((sum, count) => sum + count.events, 0)).toBe(simulation.events.length);
    for (const count of Object.values(simulation.countsByScenario)) expect(count.actors).toBeGreaterThan(0);
  });
  it('allowlists inference fields, excluding provenance, settings, labels and scenario names', () => {
    const output = serializeSimulation(simulate({ populationSize: 100 }));
    const fields = ['eventId', 'occurredAt', 'actorId', 'amountMinor', 'currency', 'eventType', 'status', 'source'].sort();
    for (const line of output.inference.trim().split('\n')) {
      const event: unknown = JSON.parse(line);
      expect(ObservablePaymentEventSchema.safeParse(event).success).toBe(true);
      expect(Object.keys(ObservablePaymentEventSchema.parse(event)).sort()).toEqual(fields);
    }
    expect(output.inference).not.toMatch(/scenario|anomalous|benign|seed|generator|datasetId|provenance/);
    expect(ObservablePaymentEventSchema.safeParse({ ...simulate({ populationSize: 1 }).events[0] }).success).toBe(false);
  });
  it.each(SCENARIOS)('implements %s independently with evaluation-only labels', scenario => {
    const mix = Object.fromEntries(SCENARIOS.map(name => [name, name === scenario ? 1 : 0]));
    const simulation = simulate({ seed: 5, populationSize: 2, scenarioMix: mix, durationSeconds: 3600 });
    expect(simulation.countsByScenario[scenario].actors).toBe(2);
    expect(simulation.labels.every(label => label.scenarioTemplateId === `${scenario}/development-v1` && label.label === (scenario === 'normal' ? 'benign' : 'anomalous'))).toBe(true);
    if (scenario === 'deposit_velocity') expect(simulation.events.every(event => event.eventType === 'deposit')).toBe(true);
    if (scenario === 'repeated_failures') expect(simulation.events.filter(event => event.status === 'failed').length).toBeGreaterThan(simulation.events.length / 2);
    if (scenario === 'unusual_withdrawal_timing') {
      const actorEvents = simulation.events.filter(event => event.actorId === simulation.events[0]?.actorId);
      expect(actorEvents[0]?.eventType).toBe('deposit');
      expect(actorEvents[1]?.eventType).toBe('withdrawal');
      expect(Date.parse(actorEvents[1]?.occurredAt ?? '') - Date.parse(actorEvents[0]?.occurredAt ?? '')).toBeLessThanOrEqual(10000);
    }
    if (scenario === 'abrupt_amount_change') {
      const actorEvents = simulation.events.filter(event => event.actorId === simulation.events[0]?.actorId);
      expect(actorEvents[0]?.amountMinor).toBeLessThan(5100);
      expect(actorEvents.at(-1)?.amountMinor).toBeGreaterThan(45000);
    }
  });
  it('respects narrow integer amount ranges, boundary seed, and virtual duration', () => {
    const simulation = simulate({ seed: 0xffffffff, populationSize: 10, durationSeconds: 3600,
      amountRanges: { deposit: { min: 7, max: 7 }, withdrawal: { min: 9, max: 9 } } });
    for (const event of simulation.events) {
      expect(event.amountMinor).toBe(event.eventType === 'deposit' ? 7 : 9);
      expect(Date.parse(event.occurredAt)).toBeLessThan(Date.UTC(2026, 0, 1, 1));
    }
  });
  it.each([
    { seed: -1 }, { seed: 0x100000000 }, { seed: 1.5 }, { populationSize: 0 }, { populationSize: 10001 },
    { durationSeconds: 0 }, { durationSeconds: Infinity }, { secret: 'not-allowed' },
    { scenarioMix: { normal: 0, deposit_velocity: 0, repeated_failures: 0, abrupt_amount_change: 0, unusual_withdrawal_timing: 0 } },
    { amountRanges: { deposit: { min: 9, max: 8 }, withdrawal: { min: 1, max: 2 } } },
    { amountRanges: { deposit: { min: 0.5, max: 8 }, withdrawal: { min: 1, max: 2 } } },
  ])('rejects invalid or unbounded configuration %j', config => {
    expect(SimulationConfigSchema.safeParse(config).success).toBe(false);
  });
});
