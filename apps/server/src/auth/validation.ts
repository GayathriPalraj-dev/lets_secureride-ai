import { z } from 'zod';
import { AppError } from '../utils/app-error.js';
const email = z
  .string()
  .max(320)
  .transform((value) => value.trim().toLowerCase())
  .pipe(z.email().max(254));
const passwordInput = z
  .string()
  .refine(
    (value) =>
      [...value].length <= 128 && Buffer.byteLength(value, 'utf8') <= 512,
    'Invalid password length',
  );
const common = new Set([
  'passwordpassword',
  '123456789012345',
  '1234567890123456',
  'qwertyqwertyqwerty',
  'letmeinletmeinletmein',
]);
export const registerSchema = z.strictObject({
  email,
  password: passwordInput.refine(
    (value) => [...value].length >= 15 && !common.has(value.toLowerCase()),
    'Choose a stronger password',
  ),
});
export const loginSchema = z.strictObject({
  email,
  password: passwordInput.min(1),
});
export const emptySchema = z.strictObject({});
export function validate<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new AppError(400, 'INVALID_INPUT', 'Request fields are invalid');
  return result.data;
}
