import { describe, expect, it } from 'vitest';
import { advanceProtection, cancelProtectionRelaxation, DAY_MS, editProtectionCaps, evaluateProtection,
  ProtectionDecisionSchema, ProtectionInputSchema, startProtectionCoolingOff } from './protection.js';

// Hand-worked oracle: t=10 days, daily cap 100, weekly cap 200 (minor units).
const now = 10 * DAY_MS;
const policy = { version: 1, source: 'synthetic' as const, currency: 'USD' as const,
  caps: { dayMinor: 100, weekMinor: 200 }, coolingOffUntil: null, effectiveAt: 0 };
const base = { now, consent: { version: 1, termsVersion: 'demo-v1', enrolled: true, aiConsent: false },
  policy, quote: { amountMinor: 40, currency: 'USD' }, committed: [], reservations: [] };
const capture = (id: string, amountMinor: number, capturedAt = now, source: 'synthetic' | 'paypal_sandbox' = 'synthetic') =>
  ({ id, amountMinor, capturedAt, source, currency: 'USD' as const });
const reservation = (amountMinor: number) => ({ id: 'r', amountMinor, source: 'synthetic', currency: 'USD' });

describe('independent protection-policy-v1 decision fixtures', () => {
  it.each([
    { name: 'exact daily equality: 60+40=100', committed: [capture('a', 60)], reservations: [], reason: 'allowed', remaining: [40, 140] },
    { name: 'one above daily: 61+40=101', committed: [capture('a', 61)], reservations: [], reason: 'limit_exceeded', remaining: [39, 139] },
    { name: 'weekly equality: 160+40=200', committed: [capture('a', 160, now - 2 * DAY_MS)], reservations: [], reason: 'allowed', remaining: [100, 40] },
    { name: 'weekly exceed: 161+40=201', committed: [capture('a', 161, now - 2 * DAY_MS)], reservations: [], reason: 'limit_exceeded', remaining: [100, 39] },
    { name: '24h start excluded, week start excluded', committed: [capture('a', 60, now - DAY_MS), capture('b', 200, now - 7 * DAY_MS)], reservations: [], reason: 'allowed', remaining: [100, 140] },
    { name: '1ms inside daily window', committed: [capture('a', 61, now - DAY_MS + 1)], reservations: [], reason: 'limit_exceeded', remaining: [39, 139] },
    { name: '1ms inside weekly window', committed: [capture('a', 161, now - 7 * DAY_MS + 1)], reservations: [], reason: 'limit_exceeded', remaining: [100, 39] },
    { name: 'reservations count in both windows', committed: [capture('a', 30)], reservations: [reservation(31)], reason: 'limit_exceeded', remaining: [39, 139] },
    { name: 'other source never pools', committed: [capture('a', 200, now, 'paypal_sandbox')], reservations: [{ ...reservation(200), source: 'paypal_sandbox' }], reason: 'allowed', remaining: [100, 200] },
  ])('$name', ({ committed, reservations, reason, remaining }) => {
    const result = evaluateProtection({ ...base, committed, reservations });
    expect(result.reason).toBe(reason);
    expect(result.decision).toBe(reason === 'allowed' ? 'allow' : 'deny');
    expect(result.windows?.map(w => w.remainingMinor)).toEqual(remaining);
    expect(ProtectionDecisionSchema.parse(result)).toEqual(result);
  });

  it('handles zero caps, overdrawn tightening, and safe integer overflow', () => {
    expect(evaluateProtection({ ...base, policy: { ...policy, caps: { dayMinor: 0, weekMinor: 0 } } }).reason).toBe('limit_exceeded');
    const overdrawn = evaluateProtection({ ...base, committed: [capture('a', 201)] });
    expect(overdrawn.windows?.map(w => w.remainingMinor)).toEqual([0, 0]);
    const max = Number.MAX_SAFE_INTEGER;
    expect(evaluateProtection({ ...base, quote: { amountMinor: 0, currency: 'USD' }, policy: { ...policy, caps: { dayMinor: max, weekMinor: max } }, committed: [capture('a', max)] }).reason).toBe('allowed');
    const overflow = evaluateProtection({ ...base, committed: [capture('a', max)], reservations: [reservation(1)] });
    expect(overflow.reason).toBe('arithmetic_overflow');
    expect(overflow.windows).toBeNull();
  });

  it('defines consent, currency and cooling-off precedence and exact expiry', () => {
    const blocked = { ...base, policy: { ...policy, coolingOffUntil: now + 1 }, quote: { amountMinor: 999, currency: 'EUR' } };
    expect(evaluateProtection({ ...blocked, consent: { ...base.consent, enrolled: false } }).reason).toBe('consent_required');
    expect(evaluateProtection(blocked).reason).toBe('unsupported_currency');
    expect(evaluateProtection({ ...blocked, quote: base.quote }).reason).toBe('cooling_off_active');
    expect(evaluateProtection({ ...base, policy: { ...policy, coolingOffUntil: now } }).reason).toBe('allowed');
  });

  it('is deterministic and optional AI consent has no eligibility authority', () => {
    expect(evaluateProtection(base)).toEqual(evaluateProtection(structuredClone(base)));
    expect(evaluateProtection({ ...base, consent: { ...base.consent, aiConsent: true } })).toEqual(evaluateProtection(base));
    expect(() => evaluateProtection({ ...base, aiDecision: 'allow' })).toThrow();
  });

  it.each([
    { ...base, quote: { amountMinor: -1, currency: 'USD' } },
    { ...base, quote: { amountMinor: 0.5, currency: 'USD' } },
    { ...base, quote: { amountMinor: Number.MAX_SAFE_INTEGER + 1, currency: 'USD' } },
    { ...base, now: NaN }, { ...base, now: Infinity },
    { ...base, committed: [capture('a', 1, now + 1)] },
    { ...base, committed: [capture('a', 1), capture('a', 2)] },
    { ...base, reservations: [reservation(1), reservation(2)] },
    { ...base, policy: { ...policy, effectiveAt: now + 1 } },
    { ...base, policy: { ...policy, currency: 'EUR' } },
    { ...base, consent: { ...base.consent, version: 0 } },
  ])('rejects invalid snapshots without producing an allow %#', input => {
    expect(ProtectionInputSchema.safeParse(input).success).toBe(false);
    expect(() => evaluateProtection(input)).toThrow();
  });
});

describe('versioned pure policy transitions', () => {
  const state = { policy, pending: null };
  it('applies mixed tightening immediately and delays only increases exactly 24h', () => {
    const edited = editProtectionCaps(state, { dayMinor: 50, weekMinor: 300 }, now, 1);
    expect(edited.policy).toEqual({ ...policy, version: 2, effectiveAt: now, caps: { dayMinor: 50, weekMinor: 200 } });
    expect(edited.pending).toEqual({ baseVersion: 2, caps: { dayMinor: 50, weekMinor: 300 }, confirmedAt: now, activatesAt: now + DAY_MS });
    expect(advanceProtection(edited, now + DAY_MS - 1)).toEqual(edited);
    expect(advanceProtection(edited, now + DAY_MS)).toEqual({ policy: { ...edited.policy, version: 3, effectiveAt: now + DAY_MS, caps: { dayMinor: 50, weekMinor: 300 } }, pending: null });
    expect(evaluateProtection({ ...base, policy: edited.policy, quote: { amountMinor: 51, currency: 'USD' } }).reason).toBe('limit_exceeded');
  });
  it('supersedes explicitly, restarts resubmitted delay and cancels without headroom', () => {
    const first = editProtectionCaps(state, { dayMinor: 200, weekMinor: 300 }, now, 1);
    const second = editProtectionCaps(first, { dayMinor: 150, weekMinor: 250 }, now + 1, 2);
    expect(second.pending?.activatesAt).toBe(now + 1 + DAY_MS);
    expect(cancelProtectionRelaxation(second, now + 2, 3)).toEqual({ policy: { ...policy, version: 4, effectiveAt: now + 2 }, pending: null });
    expect(editProtectionCaps(first, { dayMinor: 20, weekMinor: 30 }, now + 1, 2).pending).toBeNull();
    expect(() => editProtectionCaps(first, policy.caps, now + DAY_MS, 2)).toThrow('version conflict');
  });
  it('starts, extends and never shortens cooling-off; preserves pending delay', () => {
    const pending = editProtectionCaps(state, { dayMinor: 200, weekMinor: 300 }, now, 1);
    const cooled = startProtectionCoolingOff(pending, 30, now, 2);
    expect(cooled.policy.coolingOffUntil).toBe(now + 30 * DAY_MS);
    expect(cooled.pending?.activatesAt).toBe(pending.pending?.activatesAt);
    const shorter = startProtectionCoolingOff(cooled, 1, now + 1, 3);
    expect(shorter.policy.coolingOffUntil).toBe(cooled.policy.coolingOffUntil);
    const extended = startProtectionCoolingOff(shorter, 30, now + 2, 4);
    expect(extended.policy.coolingOffUntil).toBe(now + 2 + 30 * DAY_MS);
    const week = startProtectionCoolingOff(state, 7, now, 1);
    expect(week.policy.coolingOffUntil).toBe(now + 7 * DAY_MS);
    expect(evaluateProtection({ ...base, policy: week.policy, now: now + 7 * DAY_MS }).reason).toBe('allowed');
  });
  it('revocation/re-enrollment never resets supplied policy or reservations', () => {
    const input = { ...base, reservations: [reservation(70)] };
    expect(evaluateProtection({ ...input, consent: { ...base.consent, enrolled: false } }).reason).toBe('consent_required');
    expect(evaluateProtection(input).reason).toBe('limit_exceeded');
  });
  it('rejects stale versions, invalid pending states, invalid times and transition overflow', () => {
    expect(() => editProtectionCaps(state, policy.caps, now, 2)).toThrow();
    expect(() => cancelProtectionRelaxation(state, now, 2)).toThrow();
    expect(() => startProtectionCoolingOff(state, 1, now, 2)).toThrow();
    expect(() => advanceProtection({ ...state, policy: { ...policy, effectiveAt: now } }, now - 1)).toThrow();
    expect(() => advanceProtection({ ...state, pending: { baseVersion: 1, caps: policy.caps, confirmedAt: now, activatesAt: now + 1 } }, now)).toThrow();
    expect(() => editProtectionCaps(state, { dayMinor: 200, weekMinor: 300 }, 8_640_000_000_000_000, 1)).toThrow();
    expect(() => cancelProtectionRelaxation({ ...state, policy: { ...policy, version: Number.MAX_SAFE_INTEGER } }, now, Number.MAX_SAFE_INTEGER)).toThrow();
  });
});
