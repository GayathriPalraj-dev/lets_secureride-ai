import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { CarService } from '../cars/service.js';
import { fixture } from './helpers/auth.js';
const id = 'a'.repeat(24);
const adminCar = {
  id,
  inventoryCode: 'CAR_1',
  make: 'Tata',
  model: 'Nexon',
  year: 2025,
  category: 'suv' as const,
  transmission: 'automatic' as const,
  fuelType: 'electric' as const,
  seats: 5,
  dailyRate: { amountMinor: 250000, currency: 'INR' as const },
  description: 'Electric SUV',
  features: ['GPS'],
  registrationNumber: 'KA 01 AA 1000',
  status: 'inactive' as const,
  revision: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
function service() {
  return {
    list: vi.fn(async () => ({
      items: [adminCar],
      page: 1,
      pageSize: 20,
      totalItems: 1,
      totalPages: 1,
    })),
    detail: vi.fn(async () => adminCar),
    adminList: vi.fn(async () => ({
      items: [adminCar],
      page: 1,
      pageSize: 20,
      totalItems: 1,
      totalPages: 1,
    })),
    adminDetail: vi.fn(async () => adminCar),
    create: vi.fn(async () => adminCar),
    replace: vi.fn(async () => ({ ...adminCar, revision: 1 })),
    changeStatus: vi.fn(async (_id, _revision, status) => ({
      ...adminCar,
      status,
      revision: 1,
    })),
    remove: vi.fn(async () => ({ ...adminCar, revision: 1 })),
  } as unknown as CarService;
}
async function setup(role: 'customer' | 'admin') {
  const f = fixture();
  const account = await f.account();
  account.user.role = role;
  const cars = service();
  return {
    f,
    cars,
    app: f.appWithCars(cars),
    token: account.login.data.accessToken,
  };
}
const auth = (call: request.Test, token: string) =>
  call.set('Authorization', 'Bearer ' + token);
const write = (call: request.Test, token: string, origin: string) =>
  auth(call, token)
    .set('Origin', origin)
    .set('X-CSRF-Protection', '1')
    .set('Content-Type', 'application/json');
describe('car routes', () => {
  it('mounts the exact customer list path', async () =>
    request(fixture().app).get('/api/v1/cars').expect(404));
  it('returns 401 anonymously', async () => {
    const { app } = await setup('customer');
    await request(app).get('/api/v1/cars').expect(401);
  });
  it('allows customers to list active cars', async () => {
    const { app, token } = await setup('customer');
    await auth(request(app).get('/api/v1/cars'), token).expect(200);
  });
  it('allows administrators to list active cars', async () => {
    const { app, token } = await setup('admin');
    await auth(request(app).get('/api/v1/cars'), token).expect(200);
  });
  it('validates customer filters and pagination', async () => {
    const { app, token, cars } = await setup('customer');
    await auth(
      request(app).get('/api/v1/cars?make=Tata&page=2&pageSize=10'),
      token,
    ).expect(200);
    expect(cars.list).toHaveBeenCalledWith(
      expect.objectContaining({ make: 'tata', page: 2, pageSize: 10 }),
      expect.any(String),
    );
  });
  it('returns safe list envelopes and request IDs', async () => {
    const { app, token } = await setup('customer');
    const r = await auth(request(app).get('/api/v1/cars'), token);
    expect(r.body.requestId).toBe(r.headers['x-request-id']);
    expect(r.body.data.items[0]).not.toHaveProperty('registrationNumber');
  });
  it('returns active car detail', async () => {
    const { app, token } = await setup('customer');
    await auth(request(app).get('/api/v1/cars/' + id), token).expect(200);
  });
  it('uses uniform missing detail errors', async () => {
    const { app, token, cars } = await setup('customer');
    vi.mocked(cars.detail).mockRejectedValue(
      new (await import('../utils/app-error.js')).AppError(
        404,
        'CAR_NOT_FOUND',
        'Car was not found',
      ),
    );
    const r = await auth(request(app).get('/api/v1/cars/' + id), token).expect(
      404,
    );
    expect(r.body.error.code).toBe('CAR_NOT_FOUND');
  });
  it('forbids customers from administrator inventory', async () => {
    const { app, token } = await setup('customer');
    await auth(request(app).get('/api/v1/admin/cars'), token).expect(403);
  });
  it('lists inventory for administrators', async () => {
    const { app, token } = await setup('admin');
    await auth(request(app).get('/api/v1/admin/cars'), token).expect(200);
  });
  it('returns administrator detail with matching ETag', async () => {
    const { app, token } = await setup('admin');
    const r = await auth(
      request(app).get('/api/v1/admin/cars/' + id),
      token,
    ).expect(200);
    expect(r.headers.etag).toBe('"0"');
    expect(r.body.data.car.revision).toBe(0);
  });
  it('creates inventory with CSRF protection', async () => {
    const { app, token, f } = await setup('admin');
    const r = await write(
      request(app).post('/api/v1/admin/cars'),
      token,
      f.origin,
    )
      .send({
        inventoryCode: 'CAR_1',
        registrationNumber: 'KA 01 AA 1000',
        make: 'Tata',
        model: 'Nexon',
        year: 2025,
        category: 'suv',
        transmission: 'automatic',
        fuelType: 'electric',
        seats: 5,
        dailyRateMinor: 250000,
        description: 'Electric SUV',
        features: ['GPS'],
      })
      .expect(201);
    expect(r.headers.etag).toBe('"0"');
  });
  it('rejects invalid origin header and content type', async () => {
    const { app, token } = await setup('admin');
    await auth(request(app).post('/api/v1/admin/cars'), token)
      .send({})
      .expect(403);
  });
  it('rejects invalid create bodies', async () => {
    const { app, token, f } = await setup('admin');
    await write(request(app).post('/api/v1/admin/cars'), token, f.origin)
      .send({ unknown: true })
      .expect(400);
  });
  it('updates using If-Match', async () => {
    const { app, token, f } = await setup('admin');
    const body = {
      make: 'Tata',
      model: 'Nexon',
      year: 2025,
      category: 'suv',
      transmission: 'automatic',
      fuelType: 'electric',
      seats: 5,
      dailyRateMinor: 250000,
      description: 'Electric SUV',
      features: ['GPS'],
    };
    const r = await write(
      request(app).put('/api/v1/admin/cars/' + id),
      token,
      f.origin,
    )
      .set('If-Match', '"0"')
      .send(body)
      .expect(200);
    expect(r.headers.etag).toBe('"1"');
  });
  it('rejects missing or stale revisions', async () => {
    const { app, token, f, cars } = await setup('admin');
    await write(request(app).put('/api/v1/admin/cars/' + id), token, f.origin)
      .send({})
      .expect(400);
    vi.mocked(cars.replace).mockRejectedValue(
      new (await import('../utils/app-error.js')).AppError(
        409,
        'CAR_CONFLICT',
        'Car was changed; reload and try again',
      ),
    );
    await write(request(app).put('/api/v1/admin/cars/' + id), token, f.origin)
      .set('If-Match', '"0"')
      .send({
        make: 'Tata',
        model: 'Nexon',
        year: 2025,
        category: 'suv',
        transmission: 'automatic',
        fuelType: 'electric',
        seats: 5,
        dailyRateMinor: 250000,
        description: 'Electric SUV',
        features: [],
      })
      .expect(409);
  });
  it('activates with authorization and concurrency controls', async () => {
    const { app, token, f } = await setup('admin');
    await write(
      request(app).post('/api/v1/admin/cars/' + id + '/activate'),
      token,
      f.origin,
    )
      .set('If-Match', '"0"')
      .send({})
      .expect(200);
  });
  it('deactivates with authorization and concurrency controls', async () => {
    const { app, token, f } = await setup('admin');
    await write(
      request(app).post('/api/v1/admin/cars/' + id + '/deactivate'),
      token,
      f.origin,
    )
      .set('If-Match', '"0"')
      .send({})
      .expect(200);
  });
  it('enforces inactive-only soft deletion', async () => {
    const { app, token, f, cars } = await setup('admin');
    vi.mocked(cars.remove).mockRejectedValue(
      new (await import('../utils/app-error.js')).AppError(
        409,
        'CAR_MUST_BE_INACTIVE',
        'Deactivate the car before deletion',
      ),
    );
    await auth(request(app).delete('/api/v1/admin/cars/' + id), token)
      .set('Origin', f.origin)
      .set('X-CSRF-Protection', '1')
      .set('If-Match', '"0"')
      .expect(409);
  });
  it('uses no-store and sanitizes failures', async () => {
    const { app, token, cars } = await setup('admin');
    vi.mocked(cars.adminList).mockRejectedValue(
      new Error('private-database-detail'),
    );
    const r = await auth(request(app).get('/api/v1/admin/cars'), token).expect(
      500,
    );
    expect(r.headers['cache-control']).toBe('no-store');
    expect(JSON.stringify(r.body)).not.toContain('private-database-detail');
  });
});
