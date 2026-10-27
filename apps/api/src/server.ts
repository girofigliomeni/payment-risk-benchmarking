import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { ApiEnvironmentSchema } from '@payment-risk/core';
import { app } from './app.js';
config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)), quiet: true });
const env = ApiEnvironmentSchema.parse(process.env);
app.listen(env.PORT, env.HOST, () => {
  console.log(`Payment Risk API listening at http://${env.HOST}:${env.PORT}`);
});
