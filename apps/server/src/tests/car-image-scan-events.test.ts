/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHmac } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createScanController } from '../car-images/scan-controller.js';
import { createScanService } from '../car-images/scan-service.js';
const secret = 's'.repeat(32),
  body = {
    providerEventId: 'evt',
    imageId: '72b7b3ad-62a2-4f3d-8ee1-eabcf120eb2c',
    eventTime: '2026-01-01T00:00:00.000Z',
    outcome: 'clean',
  };
function app(
  process = vi.fn().mockResolvedValue('processed'),
  value: unknown = body,
  signature = true,
) {
  const bytes = Buffer.from(JSON.stringify(value));
  const a = express();
  a.use((req, _res, next) => {
    req.requestId = 'request';
    next();
  });
  a.post(
    '/event',
    express.raw({ type: 'application/json', limit: '32kb' }),
    (req, res, next) => {
      if (signature)
        req.headers['x-car-image-signature'] = createHmac('sha256', secret)
          .update(bytes)
          .digest('hex');
      createScanController({ process } as never, secret)(req, res, next);
    },
  );
  a.use((error: any, _req: any, res: any, _next: any) =>
    res.status(error.status ?? 500).json({ code: error.code ?? 'UNKNOWN' }),
  );
  return { a, bytes, process };
}
describe('image scan events', () => {
  it('accepts a valid signed clean event', async () =>
    expect(
      (
        await request(app().a)
          .post('/event')
          .set('content-type', 'application/json')
          .send(body)
      ).status,
    ).toBe(202));
  it('returns a generic accepted body', async () =>
    expect(
      (
        await request(app().a)
          .post('/event')
          .set('content-type', 'application/json')
          .send(body)
      ).body.data,
    ).toEqual({ accepted: true }));
  it('passes a Date to the service', async () => {
    const x = app();
    await request(x.a)
      .post('/event')
      .set('content-type', 'application/json')
      .send(body);
    expect(x.process.mock.calls[0]![0].eventTime).toBeInstanceOf(Date);
  });
  it('passes the request id', async () => {
    const x = app();
    await request(x.a)
      .post('/event')
      .set('content-type', 'application/json')
      .send(body);
    expect(x.process).toHaveBeenCalledWith(expect.anything(), 'request');
  });
  it('rejects a missing signature', async () =>
    expect(
      (
        await request(app(vi.fn(), body, false).a)
          .post('/event')
          .set('content-type', 'application/json')
          .send(body)
      ).status,
    ).toBe(401));
  it('rejects a malformed signature', async () => {
    const x = app(vi.fn(), body, false);
    expect(
      (
        await request(x.a)
          .post('/event')
          .set('content-type', 'application/json')
          .set('x-car-image-signature', 'bad')
          .send(body)
      ).status,
    ).toBe(401);
  });
  it('rejects a wrong signature', async () => {
    const x = app(vi.fn(), body, false);
    expect(
      (
        await request(x.a)
          .post('/event')
          .set('content-type', 'application/json')
          .set('x-car-image-signature', '0'.repeat(64))
          .send(body)
      ).status,
    ).toBe(401);
  });
  it('rejects an invalid provider id', async () =>
    expect(
      (
        await request(app(vi.fn(), { ...body, providerEventId: '' }).a)
          .post('/event')
          .set('content-type', 'application/json')
          .send({ ...body, providerEventId: '' })
      ).status,
    ).toBe(400));
  it('rejects an invalid image id', async () =>
    expect(
      (
        await request(app(vi.fn(), { ...body, imageId: 'bad' }).a)
          .post('/event')
          .set('content-type', 'application/json')
          .send({ ...body, imageId: 'bad' })
      ).status,
    ).toBe(400));
  it('rejects an invalid event time', async () =>
    expect(
      (
        await request(app(vi.fn(), { ...body, eventTime: 'today' }).a)
          .post('/event')
          .set('content-type', 'application/json')
          .send({ ...body, eventTime: 'today' })
      ).status,
    ).toBe(400));
  it('rejects an unknown outcome', async () =>
    expect(
      (
        await request(app(vi.fn(), { ...body, outcome: 'maybe' }).a)
          .post('/event')
          .set('content-type', 'application/json')
          .send({ ...body, outcome: 'maybe' })
      ).status,
    ).toBe(400));
  it('rejects extra properties', async () =>
    expect(
      (
        await request(app(vi.fn(), { ...body, secret: 'x' }).a)
          .post('/event')
          .set('content-type', 'application/json')
          .send({ ...body, secret: 'x' })
      ).status,
    ).toBe(400));
  it('moves a claimed scan through verification pending before rejection', async () => {
    const repository = {
      transaction: vi.fn(async (work: (session: object) => Promise<unknown>) =>
        work({}),
      ),
      claimScanEvent: vi.fn().mockResolvedValue({
        result: 'claimed',
        image: { status: 'verification_pending', revision: 4 },
      }),
      finalizeScan: vi.fn().mockResolvedValue({
        result: 'updated',
        image: { status: 'rejected' },
      }),
    };
    const service = createScanService(
      repository as never,
      {} as never,
      {} as never,
      vi.fn(),
    );
    await expect(
      service.process(
        {
          ...body,
          eventTime: new Date(body.eventTime),
          outcome: 'threat',
        },
        'request',
      ),
    ).resolves.toBe('processed');
    expect(repository.finalizeScan.mock.calls[0]![2]).toMatchObject({
      status: 'rejected',
      scanState: 'threat',
    });
  });
  it('does not process a duplicate provider event twice', async () => {
    const repository = {
      transaction: vi.fn(async (work: (session: object) => Promise<unknown>) =>
        work({}),
      ),
      claimScanEvent: vi.fn().mockResolvedValue({ result: 'duplicate' }),
      finalizeScan: vi.fn(),
    };
    const service = createScanService(
      repository as never,
      {} as never,
      {} as never,
      vi.fn(),
    );
    await expect(
      service.process(
        {
          ...body,
          eventTime: new Date(body.eventTime),
          outcome: 'clean' as const,
        },
        'request',
      ),
    ).resolves.toBe('duplicate');
    expect(repository.finalizeScan).not.toHaveBeenCalled();
  });
});
