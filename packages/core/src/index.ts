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
  providerEventId: z.string().min(1), verificationStatus: z.literal('verified'),
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

