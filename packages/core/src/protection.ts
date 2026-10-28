import { z } from 'zod';

export const PROTECTION_ENGINE = 'protection-policy-v1' as const;
export const DAY_MS = 86_400_000;
const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
// Epoch milliseconds are bounded to JavaScript's supported UTC date range.
const time = integer.max(8_640_000_000_000_000);
const version = integer.positive();
const id = z.string().min(1).max(200);
export const ProtectionSourceSchema = z.enum(['synthetic', 'paypal_sandbox']);
export const ProtectionCapsSchema = z.object({ dayMinor: integer, weekMinor: integer }).strict();
export const ProtectionConsentSchema = z.object({
  version, termsVersion: id, enrolled: z.boolean(), aiConsent: z.boolean(),
}).strict();
export const ProtectionPolicySchema = z.object({
  version, source: ProtectionSourceSchema, currency: z.literal('USD'),
  caps: ProtectionCapsSchema, coolingOffUntil: time.nullable(), effectiveAt: time,
}).strict();
export const PendingRelaxationSchema = z.object({
  baseVersion: version, caps: ProtectionCapsSchema, confirmedAt: time, activatesAt: time,
}).strict().refine(p => p.activatesAt - p.confirmedAt === DAY_MS, 'Relaxation requires exactly 24 hours');
export const ProtectionStateSchema = z.object({
  policy: ProtectionPolicySchema, pending: PendingRelaxationSchema.nullable(),
}).strict().superRefine((s, ctx) => {
  if (s.pending && (s.pending.baseVersion !== s.policy.version ||
    s.pending.caps.dayMinor < s.policy.caps.dayMinor || s.pending.caps.weekMinor < s.policy.caps.weekMinor)) {
    ctx.addIssue({ code: 'custom', message: 'Pending relaxation must extend the current version and caps' });
  }
});
export type ProtectionState = z.infer<typeof ProtectionStateSchema>;
export const ProtectionQuoteSchema = z.object({ amountMinor: integer, currency: z.string().regex(/^[A-Z]{3}$/) }).strict();
export const ReservationSnapshotSchema = z.object({
  id, source: ProtectionSourceSchema, amountMinor: integer, currency: z.literal('USD'),
}).strict();
export const CommittedSpendSchema = z.object({
  id, source: ProtectionSourceSchema, amountMinor: integer, currency: z.literal('USD'), capturedAt: time,
}).strict();
export const ProtectionInputSchema = z.object({
  now: time, consent: ProtectionConsentSchema, policy: ProtectionPolicySchema,
  quote: ProtectionQuoteSchema, committed: z.array(CommittedSpendSchema).max(100_000),
  reservations: z.array(ReservationSnapshotSchema).max(100_000),
}).strict().superRefine((s, ctx) => {
  for (const rows of [s.committed, s.reservations]) {
    if (new Set(rows.map(r => r.id)).size !== rows.length) ctx.addIssue({ code: 'custom', message: 'Duplicate snapshot IDs' });
  }
  if (s.policy.effectiveAt > s.now || s.committed.some(r => r.capturedAt > s.now)) {
    ctx.addIssue({ code: 'custom', message: 'Future policy or capture in effective snapshot' });
  }
});
export const ProtectionReasonSchema = z.enum(['allowed', 'consent_required', 'unsupported_currency', 'cooling_off_active', 'arithmetic_overflow', 'limit_exceeded']);
export const ProtectionWindowSchema = z.object({
  durationMs: z.union([z.literal(DAY_MS), z.literal(7 * DAY_MS)]),
  startExclusive: z.number().int(), endInclusive: time, capMinor: integer,
  committedMinor: integer, reservedMinor: integer, remainingMinor: integer,
  exceeds: z.boolean(),
}).strict();
export const ProtectionDecisionSchema = z.object({
  engine: z.literal(PROTECTION_ENGINE), decision: z.enum(['allow', 'deny']), reason: ProtectionReasonSchema,
  policyVersion: version, consentVersion: version, source: ProtectionSourceSchema,
  evaluatedAt: time, windows: z.array(ProtectionWindowSchema).length(2).nullable(),
}).strict();
export type ProtectionDecision = z.infer<typeof ProtectionDecisionSchema>;

/** Snapshot evaluator only. Invalid snapshots throw ZodError; they are never an allow. */
export function evaluateProtection(input: unknown): ProtectionDecision {
  const s = ProtectionInputSchema.parse(input);
  const windows = ([DAY_MS, 7 * DAY_MS] as const).map((durationMs, i) => {
    const committed = s.committed.filter(r => r.source === s.policy.source && r.capturedAt > s.now - durationMs)
      .reduce((sum, r) => sum + BigInt(r.amountMinor), 0n);
    const reserved = s.reservations.filter(r => r.source === s.policy.source)
      .reduce((sum, r) => sum + BigInt(r.amountMinor), 0n);
    const cap = BigInt(i === 0 ? s.policy.caps.dayMinor : s.policy.caps.weekMinor);
    const used = committed + reserved;
    return { durationMs, startExclusive: s.now - durationMs, endInclusive: s.now,
      capMinor: Number(cap), committedMinor: Number(committed), reservedMinor: Number(reserved),
      remainingMinor: Number(used < cap ? cap - used : 0n), exceeds: used + BigInt(s.quote.amountMinor) > cap,
      overflow: used + BigInt(s.quote.amountMinor) > BigInt(Number.MAX_SAFE_INTEGER) };
  });
  const overflow = windows.some(w => w.overflow);
  const reason = !s.consent.enrolled ? 'consent_required' : s.quote.currency !== 'USD' ? 'unsupported_currency'
    : s.policy.coolingOffUntil !== null && s.now < s.policy.coolingOffUntil ? 'cooling_off_active'
      : overflow ? 'arithmetic_overflow' : windows.some(w => w.exceeds) ? 'limit_exceeded' : 'allowed';
  return ProtectionDecisionSchema.parse({ engine: PROTECTION_ENGINE, decision: reason === 'allowed' ? 'allow' : 'deny',
    reason, policyVersion: s.policy.version, consentVersion: s.consent.version, source: s.policy.source,
    evaluatedAt: s.now, windows: overflow ? null : windows.map(({ overflow: _overflow, ...w }) => { void _overflow; return w; }) });
}

/** The caller serializes these transitions under the subject lock in a later phase. */
export function advanceProtection(state: unknown, now: number): ProtectionState {
  const s = ProtectionStateSchema.parse(state);
  time.parse(now);
  if (now < s.policy.effectiveAt || (s.pending && now < s.pending.confirmedAt)) throw new RangeError('Time precedes effective policy');
  if (!s.pending || now < s.pending.activatesAt) return s;
  return ProtectionStateSchema.parse({ policy: { ...s.policy, version: s.policy.version + 1,
    caps: s.pending.caps, effectiveAt: s.pending.activatesAt }, pending: null });
}

export function editProtectionCaps(state: unknown, input: unknown, now: number, expectedVersion: number): ProtectionState {
  const s = advanceProtection(state, now);
  if (s.policy.version !== expectedVersion) throw new RangeError('Policy version conflict');
  const caps = ProtectionCapsSchema.parse(input);
  const immediate = { dayMinor: Math.min(caps.dayMinor, s.policy.caps.dayMinor), weekMinor: Math.min(caps.weekMinor, s.policy.caps.weekMinor) };
  const nextVersion = s.policy.version + 1;
  return ProtectionStateSchema.parse({ policy: { ...s.policy, version: nextVersion, caps: immediate, effectiveAt: now },
    pending: caps.dayMinor > immediate.dayMinor || caps.weekMinor > immediate.weekMinor
      ? { baseVersion: nextVersion, caps, confirmedAt: now, activatesAt: now + DAY_MS } : null });
}

export function cancelProtectionRelaxation(state: unknown, now: number, expectedVersion: number): ProtectionState {
  const s = advanceProtection(state, now);
  if (s.policy.version !== expectedVersion) throw new RangeError('Policy version conflict');
  return ProtectionStateSchema.parse({ policy: { ...s.policy, version: s.policy.version + 1, effectiveAt: now }, pending: null });
}

export function startProtectionCoolingOff(state: unknown, days: 1 | 7 | 30, now: number, expectedVersion: number): ProtectionState {
  z.union([z.literal(1), z.literal(7), z.literal(30)]).parse(days);
  const s = advanceProtection(state, now);
  if (s.policy.version !== expectedVersion) throw new RangeError('Policy version conflict');
  const nextVersion = s.policy.version + 1;
  return ProtectionStateSchema.parse({ policy: { ...s.policy, version: nextVersion, effectiveAt: now,
    coolingOffUntil: Math.max(s.policy.coolingOffUntil ?? 0, now + days * DAY_MS) },
    pending: s.pending ? { ...s.pending, baseVersion: nextVersion } : null });
}
