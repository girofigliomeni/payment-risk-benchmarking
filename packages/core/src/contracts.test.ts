import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ActorSchema, ApiEnvironmentSchema, DashboardEnvironmentSchema, DetectorOutputSchema, ExperimentMetadataSchema, MoneySchema, PaymentEventSchema, ScenarioLabelSchema } from './index.js';
const fixture: unknown = JSON.parse(readFileSync(new URL('../fixtures/sample-synthetic.json', import.meta.url), 'utf8'));
const sample = PaymentEventSchema.parse(fixture);
describe('shared contracts', () => {
  it('validates the explicitly synthetic fixture and freezes provenance', () => {
    expect(sample.source).toBe('synthetic');
    expect(Object.isFrozen(sample)).toBe(true);
    expect(Object.isFrozen(sample.provenance)).toBe(true);
  });
  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity])('rejects invalid minor units %s', amountMinor => {
    expect(MoneySchema.safeParse({ amountMinor, currency: 'USD' }).success).toBe(false);
  });
  it('accepts zero and rejects malformed currency', () => {
    expect(MoneySchema.safeParse({ amountMinor: 0, currency: 'USD' }).success).toBe(true);
    expect(MoneySchema.safeParse({ amountMinor: 1, currency: 'usd' }).success).toBe(false);
  });
  it('requires provenance and matching source', () => {
    expect(PaymentEventSchema.safeParse({ ...sample, provenance: undefined }).success).toBe(false);
    expect(PaymentEventSchema.safeParse({ ...sample, source: 'paypal_sandbox' }).success).toBe(false);
  });
  it('rejects ground truth and scenario metadata in detector-visible events', () => {
    expect(PaymentEventSchema.safeParse({ ...sample, label: 'anomalous' }).success).toBe(false);
    expect(PaymentEventSchema.safeParse({ ...sample, provenance: { ...sample.provenance, scenarioTemplateId: 'hidden' } }).success).toBe(false);
    expect(ScenarioLabelSchema.safeParse({ eventId: sample.eventId, scenarioTemplateId: 'evaluation-only', label: 'benign', split: 'test' }).success).toBe(true);
  });
  it('requires verified provider metadata without synthetic metadata', () => {
    // Validation-only invented identifiers, never ingested as payment evidence.
    const provider = { ...sample, source: 'paypal_sandbox', provenance: {
      source: 'paypal_sandbox', providerOrderId: 'validation-only-order', providerEventId: 'validation-only-event',
      verificationStatus: 'verified', verifiedAt: sample.occurredAt,
    } };
    expect(PaymentEventSchema.safeParse(provider).success).toBe(true);
    expect(PaymentEventSchema.safeParse({ ...provider, provenance: { ...provider.provenance, verificationStatus: 'unverified' } }).success).toBe(false);
    expect(PaymentEventSchema.safeParse({ ...provider, provenance: { ...provider.provenance, seed: 1 } }).success).toBe(false);
  });
  it('validates actor, detector output, and experiment metadata', () => {
    expect(ActorSchema.safeParse({ actorId: '' }).success).toBe(false);
    const output = { detectorId: 'schema-test', version: '1', score: 0.5, decision: 'flag', evidenceEventIds: [sample.eventId] };
    expect(DetectorOutputSchema.safeParse(output).success).toBe(true);
    expect(DetectorOutputSchema.safeParse({ ...output, score: 2 }).success).toBe(false);
    expect(ExperimentMetadataSchema.safeParse({ experimentId: 'schema-test', name: 'Validation only', createdAt: sample.occurredAt, datasetId: 'sample-data-only', seed: 1, status: 'draft' }).success).toBe(true);
  });
  it('defaults only nonsecret configuration and rejects invalid configuration', () => {
    expect(ApiEnvironmentSchema.parse({}).PORT).toBe(3001);
    expect(DashboardEnvironmentSchema.parse({}).VITE_API_BASE_URL).toBe('http://127.0.0.1:3001');
    expect(ApiEnvironmentSchema.safeParse({ PORT: 'invalid' }).success).toBe(false);
    expect(DashboardEnvironmentSchema.safeParse({ VITE_API_BASE_URL: '' }).success).toBe(false);
  });
});
