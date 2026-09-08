import type { ImageModels } from './repository.js';
export const expectedCarImageIndexes = {
  images: [
    { name: 'car_image_public_id_unique', key: { publicId: 1 }, unique: true },
    {
      name: 'car_image_quarantine_key_unique',
      key: { quarantineObjectKey: 1 },
      unique: true,
    },
    {
      name: 'car_image_ready_key_unique',
      key: { readyObjectKey: 1 },
      unique: true,
      partialFilterExpression: { readyObjectKey: { $type: 'string' } },
    },
    {
      name: 'car_image_car_status_order',
      key: { carId: 1, status: 1, displayOrder: 1, _id: 1 },
    },
    {
      name: 'car_image_car_live_order_unique',
      key: { carId: 1, displayOrder: 1 },
      unique: true,
      partialFilterExpression: { deletedAt: null },
    },
    {
      name: 'car_image_car_primary_unique',
      key: { carId: 1, isPrimary: 1 },
      unique: true,
      partialFilterExpression: {
        status: 'ready',
        isPrimary: true,
        deletedAt: null,
      },
    },
    {
      name: 'car_image_cleanup_due',
      key: { status: 1, uploadExpiresAt: 1, scanExpiresAt: 1, _id: 1 },
    },
  ],
  sets: [{ name: 'car_image_set_car_unique', key: { carId: 1 }, unique: true }],
  events: [
    {
      name: 'car_image_scan_event_provider_unique',
      key: { providerEventId: 1 },
      unique: true,
    },
    {
      name: 'car_image_scan_event_image_created',
      key: { imageId: 1, eventTime: -1, _id: 1 },
    },
  ],
} as const;
type Expected = {
  name: string;
  key: object;
  unique?: true;
  partialFilterExpression?: object;
};
async function verify(
  model: {
    collection: { indexes(): Promise<readonly Record<string, unknown>[]> };
  },
  expected: readonly Expected[],
) {
  const actual = await model.collection.indexes();
  for (const item of expected) {
    const found = actual.find((candidate) => candidate.name === item.name);
    if (
      !found ||
      JSON.stringify(found.key) !== JSON.stringify(item.key) ||
      Boolean(found.unique) !== Boolean(item.unique) ||
      JSON.stringify(found.partialFilterExpression ?? null) !==
        JSON.stringify(item.partialFilterExpression ?? null) ||
      found.sparse ||
      found.collation ||
      found.expireAfterSeconds !== undefined
    )
      throw new Error('Car image indexes are unavailable');
  }
}
export async function verifyCarImageIndexes(models: ImageModels) {
  try {
    await verify(models.images, expectedCarImageIndexes.images);
    await verify(models.sets, expectedCarImageIndexes.sets);
    await verify(models.events, expectedCarImageIndexes.events);
  } catch {
    throw new Error('Car image indexes are unavailable');
  }
}
export async function provisionCarImageIndexes(models: ImageModels) {
  await models.images.createCollection();
  await models.sets.createCollection();
  await models.events.createCollection();
  await models.images.createIndexes();
  await models.sets.createIndexes();
  await models.events.createIndexes();
  await verifyCarImageIndexes(models);
}
