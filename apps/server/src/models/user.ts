import { Schema, type Connection, type InferSchemaType } from 'mongoose';
export const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ['customer', 'admin'],
      default: 'customer',
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'disabled'],
      default: 'active',
      required: true,
    },
    authVersion: {
      type: Number,
      default: 0,
      min: 0,
      required: true,
      select: false,
    },
    passwordChangedAt: { type: Date, default: null, select: false },
  },
  { timestamps: true, autoCreate: false, autoIndex: false, strict: 'throw' },
);
userSchema.index(
  { email: 1 },
  { unique: true, name: 'auth_user_email_unique' },
);
export type UserDocument = InferSchemaType<typeof userSchema>;
export function createUserModel(connection: Connection) {
  return connection.model('User', userSchema, 'users');
}
