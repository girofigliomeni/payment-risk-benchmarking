import { z } from 'zod';
import { DetectorOutputSchema, ObservablePaymentEventSchema } from './contracts.js';
import type { ObservablePaymentEvent } from './contracts.js';

export const RULES_VERSION = 'rules-v1';
export const RuleReasonSchema = z.object({
  ruleId: z.enum(['velocity', 'failure_ratio', 'amount_deviation', 'rapid_withdrawal']),
  observed: z.string(), threshold: z.string(), evidenceEventIds: z.array(z.string()).min(1),
}).strict();
export const RulesDecisionSchema = DetectorOutputSchema.unwrap().extend({
  eventId: z.string(), reasons: z.array(RuleReasonSchema),
  evaluations: z.array(RuleReasonSchema.extend({ triggered: z.boolean() })).length(4),
}).strict();
export type RulesDecision = z.infer<typeof RulesDecisionSchema>;
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
export function orderedEvents(input: readonly ObservablePaymentEvent[]): ObservablePaymentEvent[] {
  const events = input.map(event => ObservablePaymentEventSchema.parse(event));
  if (new Set(events.map(event => event.eventId)).size !== events.length) throw new Error('duplicate_event_id');
  return events.sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt) || compare(a.eventId, b.eventId));
}

// One actor, currency and source per window; never mix synthetic and provider history.
// Equal timestamps are ordered by event ID, so neither input order nor future events affect scoring.
export function extractFeatures(current: ObservablePaymentEvent, history: readonly ObservablePaymentEvent[]) {
  const events = orderedEvents([...history, current]);
  const index = events.findIndex(event => event.eventId === current.eventId);
  return featuresFromPrior(current, events.slice(0, index));
}
function featuresFromPrior(current: ObservablePaymentEvent, history: readonly ObservablePaymentEvent[]) {
  const prior = history.filter(event => event.actorId === current.actorId &&
    event.currency === current.currency && event.source === current.source);
  const age = (event: ObservablePaymentEvent) => Date.parse(current.occurredAt) - Date.parse(event.occurredAt);
  const attempts = [...prior.filter(event => age(event) <= 300_000), current]
    .filter(event => event.eventType !== 'order_created' && ['completed', 'failed'].includes(event.status));
  const failures = attempts.filter(event => event.status === 'failed');
  const baseline = prior.filter(event => age(event) <= 86_400_000 && event.eventType === current.eventType && event.status === 'completed');
  const baselineTotal = baseline.reduce((total, event) => total + BigInt(event.amountMinor), 0n);
  const deposits = prior.filter(event => age(event) <= 30_000 && event.eventType === 'deposit' && event.status === 'completed');
  return { attempts, failures, baseline, baselineTotal, deposits };
}

export function scoreRules(input: readonly ObservablePaymentEvent[]): RulesDecision[] {
  const events = orderedEvents(input);
  const histories = new Map<string, ObservablePaymentEvent[]>();
  return events.map(event => {
    const key = JSON.stringify([event.actorId, event.currency, event.source]);
    const history = histories.get(key) ?? [];
    const features = featuresFromPrior(event, history);
    history.push(event);
    histories.set(key, history);
    const reasons: RulesDecision['reasons'] = [];
    const evaluations: RulesDecision['evaluations'] = [];
    const evaluate = (ruleId: RulesDecision['reasons'][number]['ruleId'], triggered: boolean, observed: string, threshold: string,
      evidence: readonly ObservablePaymentEvent[]) => {
      const reason = { ruleId, observed, threshold,
        evidenceEventIds: [...new Set([...evidence.map(item => item.eventId), event.eventId])] };
      evaluations.push({ ...reason, triggered });
      if (triggered) reasons.push(reason);
    };
    const eligible = event.eventType !== 'order_created' && ['completed', 'failed'].includes(event.status);
    evaluate('velocity', eligible && features.attempts.length >= 5,
      eligible ? String(features.attempts.length) : 'current event is not a terminal attempt',
      '>=5 terminal attempts in inclusive 300s', features.attempts);
    evaluate('failure_ratio', eligible && features.attempts.length >= 4 && features.failures.length * 2 >= features.attempts.length,
      `${features.failures.length}/${features.attempts.length}; eligible=${eligible}`,
      '>=1/2 failures with >=4 terminal attempts in inclusive 300s', features.attempts);
    evaluate('amount_deviation', eligible && event.status === 'completed' && features.baseline.length >= 3 && features.baselineTotal > 0n &&
      BigInt(event.amountMinor) * BigInt(features.baseline.length) >= 3n * features.baselineTotal,
      `${event.amountMinor} versus prior sum ${features.baselineTotal}/${features.baseline.length}; completed terminal=${eligible && event.status === 'completed'}`,
      '>=3x prior completed same-type mean in inclusive 24h; >=3 prior events, positive mean', features.baseline);
    evaluate('rapid_withdrawal', event.eventType === 'withdrawal' && event.status === 'completed' && features.deposits.length > 0,
      features.deposits.length ? `${Date.parse(event.occurredAt) - Date.parse(features.deposits[features.deposits.length - 1]!.occurredAt)}ms; completed withdrawal=${event.eventType === 'withdrawal' && event.status === 'completed'}` : 'no completed deposit in preceding 30s',
      '<=30000ms after completed deposit for a completed withdrawal', features.deposits);
    return RulesDecisionSchema.parse({ detectorId: 'rules', version: RULES_VERSION, eventId: event.eventId,
      score: reasons.length / 4, decision: reasons.length ? 'flag' : 'pass', reasons, evaluations,
      evidenceEventIds: [...new Set(evaluations.flatMap(evaluation => evaluation.evidenceEventIds))] });
  });
}

