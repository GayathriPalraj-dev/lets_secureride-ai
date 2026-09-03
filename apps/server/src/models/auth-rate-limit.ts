import { Schema, type Connection } from 'mongoose';
export const rateLimitSchema = new Schema(
  {
    _id: { type: String, required: true },
    count: { type: Number, required: true },
    expiresAt: { type: Date, required: true },
  },
  { autoCreate: false, autoIndex: false, strict: 'throw', versionKey: false },
);
rateLimitSchema.index(
  { expiresAt: 1 },
  { name: 'auth_limit_expiry', expireAfterSeconds: 0 },
);
export function createRateLimitModel(connection: Connection) {
  return connection.model('AuthRateLimit', rateLimitSchema, 'auth_rate_limits');
}
