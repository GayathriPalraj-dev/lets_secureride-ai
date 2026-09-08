export interface UploadPolicyInput {
  key: string;
  contentType: string;
  size: number;
  checksum: string;
  uploadId: string;
  expiresAt: Date;
}
export interface StoredObject {
  size: number;
  checksum: string;
  contentType: string;
  uploadId: string;
  versionId: string | null;
  body?: Uint8Array;
}
export interface ImageStorage {
  authorize(
    input: UploadPolicyInput,
  ): Promise<{ url: string; fields: Record<string, string> }>;
  head(key: string): Promise<StoredObject | null>;
  read(key: string, versionId?: string | null): Promise<Uint8Array>;
  writeReady(
    key: string,
    body: Uint8Array,
  ): Promise<{ versionId: string | null }>;
  remove(key: string, versionId?: string | null): Promise<void>;
}
