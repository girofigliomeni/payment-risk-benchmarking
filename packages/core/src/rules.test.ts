import { expect, it } from 'vitest';
import { scoreRules, extractFeatures, toObservablePaymentEvent, PaymentEventSchema } from './index.js';
import type { ObservablePaymentEvent } from './index.js';

function event(id: number, seconds: number, changes: Partial<ObservablePaymentEvent> = {}): ObservablePaymentEvent {
  return { eventId: String(id).padStart(3, '0'), actorId: 'fictional-a', occurredAt: new Date(Date.UTC(2026, 0, 1) + seconds * 1000).toISOString(),
    source: 'synthetic', eventType: 'deposit', status: 'completed', amountMinor: 100, currency: 'USD', ...changes };
}
const rules = (events: ObservablePaymentEvent[]) => scoreRules(events).at(-1)!.reasons.map(reason => reason.ruleId);
it('passes ordinary events with explicit evidence and stable version', () => {
  expect(scoreRules([event(0, 0)])[0]).toMatchObject({ detectorId: 'rules', version: 'rules-v1', score: 0, decision: 'pass', reasons: [], evidenceEventIds: ['000'] });
  expect(scoreRules([event(0, 0)])[0]!.evaluations.map(item => [item.ruleId, item.triggered])).toEqual([
    ['velocity', false], ['failure_ratio', false], ['amount_deviation', false], ['rapid_withdrawal', false],
  ]);
});
it('includes the velocity time and count boundaries; excludes older, pending and order-created records', () => {
  const history = [0, 1, 2, 3].map(i => event(i, i));
  expect(rules([...history, event(4, 300)])).toContain('velocity');
  expect(rules([...history, event(4, 300.001)])).not.toContain('velocity');
  expect(rules([...history, event(4, 4, { status: 'pending' })])).not.toContain('velocity');
  expect(rules([...history, event(4, 4, { eventType: 'order_created' })])).not.toContain('velocity');
});
it('requires four attempts and flags exactly half failed', () => {
  const history = [event(0, 0, { status: 'failed' }), event(1, 1, { status: 'failed' }), event(2, 2)];
  expect(rules(history)).not.toContain('failure_ratio');
  expect(rules([...history, event(3, 3)])).toContain('failure_ratio');
  expect(rules([event(0, 0, { status: 'failed' }), event(1, 1), event(2, 2), event(3, 3)])).not.toContain('failure_ratio');
});
it('compares amount with exact integer arithmetic, minimum history and 24h boundary', () => {
  const history = [event(0, 0), event(1, 1), event(2, 2)];
  expect(rules([...history, event(3, 86400, { amountMinor: 300 })])).toContain('amount_deviation');
  expect(rules([...history, event(3, 86400.001, { amountMinor: 300 })])).not.toContain('amount_deviation');
  expect(rules([...history, event(3, 4, { amountMinor: 299 })])).not.toContain('amount_deviation');
  const large = history.map(item => ({ ...item, amountMinor: Number.MAX_SAFE_INTEGER }));
  expect(rules([...large, event(3, 4, { amountMinor: Number.MAX_SAFE_INTEGER })])).not.toContain('amount_deviation');
  expect(rules([...history.map(item => ({ ...item, amountMinor: 0 })), event(3, 4)])).not.toContain('amount_deviation');
});
it('flags withdrawals within inclusive 30 seconds of a completed deposit', () => {
  expect(rules([event(0, 0), event(1, 30, { eventType: 'withdrawal' })])).toContain('rapid_withdrawal');
  expect(rules([event(0, 0), event(1, 30.001, { eventType: 'withdrawal' })])).not.toContain('rapid_withdrawal');
  expect(rules([event(0, 0, { status: 'failed' }), event(1, 1, { eventType: 'withdrawal' })])).not.toContain('rapid_withdrawal');
});
it('isolates actors, currencies and provenance sources and excludes future history', () => {
  const current = event(9, 10);
  const history = [event(0, 1, { actorId: 'other' }), event(1, 2, { currency: 'EUR' }), event(2, 3, { source: 'paypal_sandbox' }), event(3, 11)];
  expect(extractFeatures(current, history).attempts).toEqual([current]);
});
it('is independent of input order, wall clock and future events; rejects duplicates and hidden labels', () => {
  const events = [event(0, 0), event(1, 0), event(2, 1)];
  expect(scoreRules(events)).toEqual(scoreRules([...events].reverse()));
  expect(scoreRules([...events, event(3, 10)]).slice(0, 3)).toEqual(scoreRules(events));
  expect(() => scoreRules([event(0, 0), event(0, 1)])).toThrow('duplicate_event_id');
  expect(() => scoreRules([{ ...event(0, 0), label: 'anomalous' } as ObservablePaymentEvent])).toThrow();
});
it('scores a verified sandbox capture through the same observable contract', () => {
  const capture = PaymentEventSchema.parse({ ...event(0, 0), source: 'paypal_sandbox', eventType: 'capture',
    provenance: { source: 'paypal_sandbox', providerOrderId: 'ORDER', providerCaptureId: 'CAPTURE', providerEventId: 'CAPTURE', verificationStatus: 'verified', verifiedAt: '2026-01-01T00:00:00Z' } });
  expect(scoreRules([toObservablePaymentEvent(capture)])[0]!.decision).toBe('pass');
});
