import { z } from 'zod';
const secret = z.string().refine((value) => {
  const decoded = Buffer.from(value, 'base64');
  return (
    decoded.length >= 32 &&
    decoded.length <= 128 &&
    decoded.toString('base64') === value &&
    !/replace|generate|placeholder/i.test(value)
  );
});
const schema = z
  .object({
    JWT_ACCESS_SECRET: secret,
    JWT_ACCESS_KEY_ID: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
    JWT_ACCESS_PREVIOUS_SECRET: secret.optional(),
    JWT_ACCESS_PREVIOUS_KEY_ID: z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,64}$/)
      .optional(),
    JWT_ISSUER: z.string().min(1).max(200).regex(/^\S+$/),
    JWT_AUDIENCE: z.string().min(1).max(200).regex(/^\S+$/),
    AUTH_RATE_LIMIT_SECRET: secret,
    AUTH_ACCESS_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(60)
      .max(900)
      .default(300),
    AUTH_REFRESH_IDLE_SECONDS: z.coerce
      .number()
      .int()
      .min(3600)
      .max(604800)
      .default(604800),
    AUTH_REFRESH_ABSOLUTE_SECONDS: z.coerce
      .number()
      .int()
      .min(3600)
      .max(2592000)
      .default(2592000),
  })
  .superRefine((value, ctx) => {
    if (
      Boolean(value.JWT_ACCESS_PREVIOUS_SECRET) !==
        Boolean(value.JWT_ACCESS_PREVIOUS_KEY_ID) ||
      value.JWT_ACCESS_PREVIOUS_KEY_ID === value.JWT_ACCESS_KEY_ID ||
      (value.JWT_ACCESS_PREVIOUS_SECRET !== undefined &&
        value.JWT_ACCESS_PREVIOUS_SECRET === value.JWT_ACCESS_SECRET)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_ACCESS_PREVIOUS_KEY_ID'],
        message: 'Invalid previous key configuration',
      });
    }
    if (
      value.AUTH_RATE_LIMIT_SECRET === value.JWT_ACCESS_SECRET ||
      value.AUTH_RATE_LIMIT_SECRET === value.JWT_ACCESS_PREVIOUS_SECRET
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['AUTH_RATE_LIMIT_SECRET'],
        message: 'Independent key required',
      });
    }
    if (value.AUTH_REFRESH_IDLE_SECONDS > value.AUTH_REFRESH_ABSOLUTE_SECONDS) {
      ctx.addIssue({
        code: 'custom',
        path: ['AUTH_REFRESH_IDLE_SECONDS'],
        message: 'Invalid lifetime',
      });
    }
  });
export type AuthConfig = z.infer<typeof schema>;
export function parseAuthEnv(
  input: Record<string, unknown>,
  production = false,
  clientOrigin = '',
): AuthConfig {
  const result = schema.safeParse(input);
  if (!result.success) {
    const fields = [
      ...new Set(result.error.issues.map((issue) => String(issue.path[0]))),
    ];
    throw new Error(
      'Invalid authentication configuration fields: ' + fields.join(', '),
    );
  }
  if (production && !clientOrigin.startsWith('https://')) {
    throw new Error(
      'Invalid authentication configuration fields: CLIENT_ORIGIN',
    );
  }
  return result.data;
}
