import { z } from 'zod';
const optionalSecret = z.string().trim().optional().transform(value => value || undefined);
const Schema = z.object({
  PAYPAL_CLIENT_ID: optionalSecret, PAYPAL_CLIENT_SECRET: optionalSecret, PAYPAL_WEBHOOK_ID: optionalSecret,
  CHECKOUT_ACCESS_KEY: optionalSecret.pipe(z.string().min(32).max(256).optional()),
  CHECKOUT_ORIGIN: z.url().default('http://127.0.0.1:5173'),
  CHECKOUT_AMOUNT_MINOR: z.coerce.number().int().min(1).max(10000).default(100),
}).refine(value => {
  const url = new URL(value.CHECKOUT_ORIGIN);
  return url.origin === value.CHECKOUT_ORIGIN && (url.protocol === 'https:' ||
    (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)));
}, { path: ['CHECKOUT_ORIGIN'], message: 'Use an HTTPS origin or local HTTP origin, without a trailing slash' });
export type CheckoutConfig = z.infer<typeof Schema>;
export function checkoutConfig(input: unknown): CheckoutConfig {
  const result = Schema.safeParse(input);
  // Never include input values in configuration errors, which could expose credentials.
  if (!result.success) throw new Error(`Invalid checkout configuration: ${result.error.issues.map(issue => issue.path.join('.')).join(', ')}`);
  return result.data;
}
export function missingSetup(config: CheckoutConfig): string[] {
  return (['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_WEBHOOK_ID', 'CHECKOUT_ACCESS_KEY'] as const)
    .filter(key => !config[key]);
}
