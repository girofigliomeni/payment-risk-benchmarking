import express from 'express';
import { HealthSchema } from '@payment-risk/core';
export const app = express();
app.disable('x-powered-by');
app.get('/health', (_request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Cache-Control', 'no-store');
  response.json(HealthSchema.parse({ status: 'ok', service: 'payment-risk-api' }));
});
