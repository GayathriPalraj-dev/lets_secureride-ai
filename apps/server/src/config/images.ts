import { z } from 'zod';
const schema = z.object({
  AWS_REGION: z.string().trim().min(1),
  CAR_IMAGE_BUCKET: z.string().trim().min(3),
  CAR_IMAGE_EVENT_SECRET: z.string().min(32),
});
export const imageLimits = {
  maxBytes: 8_388_608,
  maxImages: 8,
  uploadSeconds: 300,
  scanSeconds: 86_400,
  minWidth: 640,
  minHeight: 360,
  maxDimension: 8000,
  maxPixels: 40_000_000,
} as const;
export function parseImageConfig(env: Record<string, unknown>) {
  const value = schema.safeParse(env);
  if (!value.success) throw new Error('Image configuration is invalid');
  return value.data;
}
