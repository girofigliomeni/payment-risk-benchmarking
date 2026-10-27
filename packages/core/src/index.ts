import { z } from 'zod';

export const MoneySchema = z.object({
  amountMinor: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  currency: z.string().regex(/^[A-Z]{3}$/),
}).strict().readonly();
export type Money = z.infer<typeof MoneySchema>;
export const ActorSchema = z.object({ actorId: z.string().min(1) }).strict().readonly();
export type Actor = z.infer<typeof ActorSchema>;
const SyntheticProvenanceSchema = z.object({
  source: z.literal('synthetic'), datasetId: z.string().min(1),
  generatorVersion: z.string().min(1), seed: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
}).strict().readonly();
const PayPalProvenanceSchema = z.object({
  source: z.literal('paypal_sandbox'), providerOrderId: z.string().min(1),
  providerEventId: z.string().min(1), providerCaptureId: z.string().min(1).optional(), verificationStatus: z.literal('verified'),
  verifiedAt: z.iso.datetime(),
}).strict().readonly();
export const ProvenanceSchema = z.discriminatedUnion('source', [SyntheticProvenanceSchema, PayPalProvenanceSchema]);
export type Provenance = z.infer<typeof ProvenanceSchema>;
const eventFields = {
  eventId: z.string().min(1), occurredAt: z.iso.datetime(), actorId: ActorSchema.unwrap().shape.actorId,
  amountMinor: MoneySchema.unwrap().shape.amountMinor, currency: MoneySchema.unwrap().shape.currency,
  eventType: z.enum(['deposit', 'withdrawal', 'order_created', 'capture']),
  status: z.enum(['pending', 'completed', 'failed', 'cancelled']),
};
export const PaymentEventSchema = z.discriminatedUnion('source', [
  z.object({ ...eventFields, source: z.literal('synthetic'), provenance: SyntheticProvenanceSchema }).strict().readonly(),
  z.object({ ...eventFields, source: z.literal('paypal_sandbox'), provenance: PayPalProvenanceSchema }).strict().readonly(),
]);
export type PaymentEvent = z.infer<typeof PaymentEventSchema>;
// Explicit allowlist: inference never receives dataset IDs, seeds, or generator metadata.
export const ObservablePaymentEventSchema = z.object({
  ...eventFields, source: z.enum(['synthetic', 'paypal_sandbox']),
}).strict().readonly();
export type ObservablePaymentEvent = z.infer<typeof ObservablePaymentEventSchema>;
export function toObservablePaymentEvent(event: PaymentEvent): ObservablePaymentEvent {
  return ObservablePaymentEventSchema.parse({
    eventId: event.eventId, occurredAt: event.occurredAt, actorId: event.actorId,
    amountMinor: event.amountMinor, currency: event.currency, eventType: event.eventType,
    status: event.status, source: event.source,
  });
}

// Evaluation records are stored separately and never supplied as detector input.
export const ScenarioLabelSchema = z.object({
  eventId: z.string().min(1), scenarioTemplateId: z.string().min(1),
  label: z.enum(['benign', 'anomalous']), split: z.enum(['train', 'tune', 'test']),
}).strict().readonly();
export type ScenarioLabel = z.infer<typeof ScenarioLabelSchema>;
export const DetectorOutputSchema = z.object({
  detectorId: z.string().min(1), version: z.string().min(1), score: z.number().min(0).max(1),
  decision: z.enum(['flag', 'pass']), evidenceEventIds: z.array(z.string().min(1)).min(1),
}).strict().readonly();
export type DetectorOutput = z.infer<typeof DetectorOutputSchema>;
export const ExperimentMetadataSchema = z.object({
  experimentId: z.string().min(1), name: z.string().min(1), createdAt: z.iso.datetime(),
  datasetId: z.string().min(1), seed: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  status: z.enum(['draft', 'running', 'completed', 'failed']),
}).strict().readonly();
export type ExperimentMetadata = z.infer<typeof ExperimentMetadataSchema>;
export const HealthSchema = z.object({ status: z.literal('ok'), service: z.literal('payment-risk-api') }).strict();
export type Health = z.infer<typeof HealthSchema>;
export const ApiEnvironmentSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  HOST: z.string().min(1).default('127.0.0.1'),
});
export const DashboardEnvironmentSchema = z.object({
  VITE_API_BASE_URL: z.url().default('http://127.0.0.1:3001'),
});


// Browser-facing sandbox contracts contain neither credentials nor provider payloads.
export const SandboxConfigurationSchema = z.object({
  setupRequired: z.boolean(), missing: z.array(z.string()), source: z.literal('paypal_sandbox'),
  amountMinor: z.number().int().positive(), currency: z.literal('USD'),
}).strict();
export const SandboxSessionSchema = z.object({
  state: z.enum(['ready', 'approval_required', 'cancelled', 'verified']),
  orderId: z.string().optional(), approvalUrl: z.url().optional(),
  event: PaymentEventSchema.options[1].optional(), verifiedWebhookCount: z.number().int().nonnegative(),
}).strict();
export type SandboxSession = z.infer<typeof SandboxSessionSchema>;
