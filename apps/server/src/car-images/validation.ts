import { z } from 'zod';
import { imageLimits } from '../config/images.js';
export const imageIdSchema = z.string().uuid();
const checksum = z.string().regex(/^[A-Za-z0-9+/]{43}=$/);
const alt = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .refine((v) =>
    [...v].every((character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && code !== 127;
    }),
  );
export const uploadSchema = z
  .object({
    contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    size: z.number().int().min(1).max(imageLimits.maxBytes),
    checksumSha256: checksum,
    altText: alt,
  })
  .strict();
export const updateImageSchema = z
  .object({
    altText: alt.optional(),
    displayOrder: z.number().int().min(0).max(7).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0);
export const scanEventSchema = z
  .object({
    providerEventId: z.string().min(1).max(200),
    imageId: imageIdSchema,
    eventTime: z.iso.datetime(),
    outcome: z.enum(['clean', 'threat', 'unsupported', 'failed']),
  })
  .strict();
export function parseRevision(value: unknown) {
  if (typeof value !== 'string' || !/^"(0|[1-9]\d*)"$/.test(value))
    throw new Error('Invalid If-Match');
  return Number(value.slice(1, -1));
}
