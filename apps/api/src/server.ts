import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { ApiEnvironmentSchema } from '@payment-risk/core';
import { createApp } from './app.js';
import { checkoutConfig } from './paypal/config.js';
import { SandboxPayPalProvider } from './paypal/provider.js';
import { CheckoutService } from './paypal/service.js';
config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)), quiet: true });
const env = ApiEnvironmentSchema.parse(process.env);
const settings = checkoutConfig(process.env);
const app = createApp(new CheckoutService(settings, new SandboxPayPalProvider(settings)));
app.listen(env.PORT, env.HOST, () => {
  console.log(`Payment Risk API listening at http://${env.HOST}:${env.PORT}`);
});
