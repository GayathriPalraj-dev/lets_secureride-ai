import { Schema, type Connection } from 'mongoose';
export const sessionSchema = new Schema(
  {
    _id: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    authVersion: { type: Number, required: true, select: false },
    currentHash: { type: String, required: true, select: false },
    usedHashes: { type: [String], default: [], select: false },
    rotation: { type: Number, default: 0, required: true },
    lastRefreshedAt: { type: Date, required: true },
    idleExpiresAt: { type: Date, required: true },
    absoluteExpiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    revokeReason: {
      type: String,
      enum: ['logout', 'logout-all', 'reuse', 'rotation-limit'],
      default: null,
      select: false,
    },
  },
  { timestamps: true, autoCreate: false, autoIndex: false, strict: 'throw' },
);
sessionSchema.index(
  { userId: 1, revokedAt: 1 },
  { name: 'auth_session_user_revoked' },
);
sessionSchema.index(
  { absoluteExpiresAt: 1 },
  { name: 'auth_session_expiry', expireAfterSeconds: 0 },
);
export function createSessionModel(connection: Connection) {
  return connection.model('AuthSession', sessionSchema, 'auth_sessions');
}
