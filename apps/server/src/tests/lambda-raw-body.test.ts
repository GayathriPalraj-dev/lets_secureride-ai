import express from 'express';
import { createHmac } from 'node:crypto';
import Stripe from 'stripe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { paymentWebhookRouter } from '../routes/payment-webhook.js';
import { imageScanEventsRouter } from '../routes/image-scan-events.js';
import { createStripeProvider } from '../payments/stripe-provider.js';

const state = vi.hoisted(() => ({
  app: undefined as unknown as ReturnType<typeof express>,
}));
vi.mock('../config/runtime-config.js', () => ({
  loadRuntimeConfiguration: vi.fn().mockResolvedValue({}),
}));
vi.mock('../bootstrap.js', () => ({
  bootstrapApplication: vi.fn(async () => ({
    app: state.app,
    database: { connectDatabase: vi.fn().mockResolvedValue(undefined) },
  })),
}));

function event(body: Buffer, base64: boolean, headers: Record<string, string>) {
  return {
    version: '2.0',
    routeKey: 'POST /signed',
    rawPath: '/signed',
    rawQueryString: '',
    headers,
    body: base64 ? body.toString('base64') : body.toString('utf8'),
    requestContext: {
      http: {
        method: 'POST',
        path: '/signed',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test',
      },
      requestId: 'raw',
      routeKey: 'POST /signed',
      stage: '$default',
      time: '',
      timeEpoch: 0,
    },
    isBase64Encoded: base64,
  };
}

function signedEvent(
  path: string,
  body: Buffer,
  base64: boolean,
  headers: Record<string, string>,
) {
  const value = event(body, base64, headers);
  return {
    ...value,
    routeKey: `POST ${path}`,
    rawPath: path,
    requestContext: {
      ...value.requestContext,
      http: { ...value.requestContext.http, path },
      routeKey: `POST ${path}`,
    },
  };
}

describe('Lambda API Gateway raw bodies', () => {
  beforeEach(async () => {
    vi.resetModules();
    state.app = express();
    state.app.post(
      '/signed',
      express.raw({ type: 'application/json' }),
      (req, res) => {
        res.json({
          buffer: Buffer.isBuffer(req.body),
          hex: (req.body as Buffer).toString('hex'),
          signature: req.header('stripe-signature'),
        });
      },
    );
    process.env.SECURERIDE_CONFIG_PARAMETER = '/secureride/runtime';
    process.env.EXPECTED_CLIENT_ORIGIN = 'https://demo.cloudfront.net';
  });

  it.each([false, true])(
    'delivers exact UTF-8 bytes once (base64=%s)',
    async (base64) => {
      const raw = Buffer.from('{\n  "city": "München ☕"\n}\n', 'utf8');
      const { handler } = await import('../lambda.js');
      const response = (await handler(
        event(raw, base64, {
          'content-type': 'application/json',
          'StRiPe-SiGnAtUrE': 'test-signature',
        }),
        {},
      )) as { body: string };
      const result = JSON.parse(response.body) as {
        buffer: boolean;
        hex: string;
        signature: string;
      };
      expect(result).toEqual({
        buffer: true,
        hex: raw.toString('hex'),
        signature: 'test-signature',
      });
    },
  );

  it.each([false, true])(
    'preserves valid and rejects invalid Stripe signatures (base64=%s)',
    async (base64) => {
      const raw = Buffer.from(
        '{\n  "id":"evt_test","object":"event","api_version":"2026-08-27.basil","created":1,"data":{"object":{"id":"pi_test","object":"payment_intent","status":"succeeded","metadata":{}}},"livemode":false,"pending_webhooks":1,"request":null,"type":"payment_intent.succeeded"\n}',
        'utf8',
      );
      const secret = `whsec_${'s'.repeat(32)}`;
      const stripe = new Stripe(`sk_test_${'k'.repeat(32)}`);
      const signature = stripe.webhooks.generateTestHeaderString({
        payload: raw.toString('utf8'),
        secret,
      });
      const process = vi.fn().mockResolvedValue(undefined);
      const limiter = (_req: unknown, _res: unknown, next: () => void) =>
        next();
      state.app = express();
      state.app.use(
        '/api/v1/payments/webhook',
        paymentWebhookRouter({
          provider: createStripeProvider(`sk_test_${'k'.repeat(32)}`),
          service: { process } as never,
          signingSecret: secret,
          coarseLimiter: limiter,
          invalidLimiter: limiter,
          events: vi.fn(),
        }),
      );
      const { handler } = await import('../lambda.js');
      const valid = (await handler(
        signedEvent('/api/v1/payments/webhook', raw, base64, {
          'content-type': 'application/json',
          'StRiPe-SiGnAtUrE': signature,
        }),
        {},
      )) as { statusCode: number };
      const invalid = (await handler(
        signedEvent('/api/v1/payments/webhook', raw, base64, {
          'content-type': 'application/json',
          'stripe-signature': 'invalid-signature',
        }),
        {},
      )) as { statusCode: number };
      expect(valid.statusCode).toBe(200);
      expect(invalid.statusCode).toBe(400);
      expect(process).toHaveBeenCalledTimes(1);
    },
  );

  it.each([false, true])(
    'preserves valid and rejects invalid image HMACs (base64=%s)',
    async (base64) => {
      const raw = Buffer.from(
        '{\n"providerEventId":"1234567890123456","imageId":"123e4567-e89b-42d3-a456-426614174000","outcome":"clean","eventTime":"2026-09-14T00:00:00.000Z"\n}',
        'utf8',
      );
      const secret = 'i'.repeat(32);
      const signature = createHmac('sha256', secret).update(raw).digest('hex');
      const process = vi.fn().mockResolvedValue(undefined);
      const limiter = (_req: unknown, _res: unknown, next: () => void) =>
        next();
      state.app = express();
      state.app.use(
        imageScanEventsRouter({
          service: { process } as never,
          secret,
          limiter,
        }),
      );
      const { handler } = await import('../lambda.js');
      const valid = (await handler(
        signedEvent('/api/v1/internal/car-image-events', raw, base64, {
          'content-type': 'application/json',
          'X-Car-Image-Signature': signature,
        }),
        {},
      )) as { statusCode: number };
      const invalid = (await handler(
        signedEvent('/api/v1/internal/car-image-events', raw, base64, {
          'content-type': 'application/json',
          'x-car-image-signature': '0'.repeat(64),
        }),
        {},
      )) as { statusCode: number };
      expect(valid.statusCode).toBe(202);
      expect(invalid.statusCode).toBe(401);
      expect(process).toHaveBeenCalledTimes(1);
    },
  );
});
