import { z } from 'zod';
import { ProtectionCapsSchema, ProtectionSourceSchema } from './protection.js';

export const PROTECTION_TERMS = 'protection-terms-v1' as const;
export const AI_TERMS = 'ai-analysis-terms-v1' as const;
const version = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const source = { source: ProtectionSourceSchema };
const expected = { expectedVersion: version.positive() };
export const ConsentChangeSchema = z.object({ ...source,
  purpose: z.enum(['protection', 'ai_analysis']), termsVersion: z.enum([PROTECTION_TERMS, AI_TERMS]),
  accept: z.boolean(), expectedConsentVersion: version, caps: ProtectionCapsSchema.optional(),
}).strict().superRefine((v, ctx) => {
  if (v.termsVersion !== (v.purpose === 'protection' ? PROTECTION_TERMS : AI_TERMS) ||
    (v.caps && (v.purpose !== 'protection' || !v.accept))) {
    ctx.addIssue({ code: 'custom', message: 'Consent purpose and terms must match' });
  }
});
export const PolicyChangeSchema = z.object({ ...source, ...expected, caps: ProtectionCapsSchema }).strict();
export const CoolingOffSchema = z.object({ ...source, ...expected, days: z.union([z.literal(1), z.literal(7), z.literal(30)]) }).strict();
export const CancelChangeSchema = z.object({ ...source, ...expected }).strict();
export const SourceBodySchema = z.object(source).strict();
export const InvitationSchema = z.object({ externalReference: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/) }).strict();
export const ApproveLinkSchema = z.object({ ...source, invitationId: z.uuid() }).strict();
export const HistoryQuerySchema = z.object({ ...source,
  after: z.coerce.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).default(0), pageSize: z.coerce.number().int().min(1).max(100).default(50),
}).strict();
