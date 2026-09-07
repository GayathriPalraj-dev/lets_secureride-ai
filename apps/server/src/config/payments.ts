import { z } from 'zod';
const schema = z.object({
  STRIPE_SECRET_KEY: z.string().regex(/^sk_(?:test|live)_[A-Za-z0-9]{16,}$/),
  STRIPE_PUBLISHABLE_KEY: z
    .string()
    .regex(/^pk_(?:test|live)_[A-Za-z0-9]{16,}$/),
  STRIPE_WEBHOOK_SECRET: z.string().regex(/^whsec_[A-Za-z0-9]{16,}$/),
});
export type PaymentConfig = z.infer<typeof schema>;
export function parsePaymentEnv(input: Record<string, unknown>): PaymentConfig {
  const result = schema.safeParse(input);
  if (!result.success) {
    const fields = [
      ...new Set(result.error.issues.map((i) => String(i.path[0]))),
    ];
    throw new Error(
      'Invalid payment configuration fields: ' + fields.join(', '),
    );
  }
  return result.data;
}
