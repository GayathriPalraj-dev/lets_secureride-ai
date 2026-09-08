import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import type { ImageStorage, UploadPolicyInput } from './storage.js';

async function bytes(body: unknown): Promise<Uint8Array> {
  if (body && typeof body === 'object' && 'transformToByteArray' in body)
    return (
      body as { transformToByteArray(): Promise<Uint8Array> }
    ).transformToByteArray();
  throw new Error('Storage response unavailable');
}
export function createS3ImageStorage(
  client: S3Client,
  bucket: string,
): ImageStorage {
  return {
    async authorize(input: UploadPolicyInput) {
      return createPresignedPost(client, {
        Bucket: bucket,
        Key: input.key,
        Expires: 300,
        Fields: {
          'Content-Type': input.contentType,
          'x-amz-checksum-sha256': input.checksum,
          'x-amz-server-side-encryption': 'AES256',
          'x-amz-meta-uploadid': input.uploadId,
        },
        Conditions: [
          ['content-length-range', input.size, input.size],
          { 'Content-Type': input.contentType },
          { 'x-amz-checksum-sha256': input.checksum },
          { 'x-amz-server-side-encryption': 'AES256' },
          { 'x-amz-meta-uploadid': input.uploadId },
        ],
      });
    },
    async head(key) {
      try {
        const r = await client.send(
          new HeadObjectCommand({
            Bucket: bucket,
            Key: key,
            ChecksumMode: 'ENABLED',
          }),
        );
        return {
          size: r.ContentLength ?? -1,
          checksum: r.ChecksumSHA256 ?? '',
          contentType: r.ContentType ?? '',
          uploadId: r.Metadata?.uploadid ?? '',
          versionId: r.VersionId ?? null,
        };
      } catch (error) {
        if (
          typeof error === 'object' &&
          error !== null &&
          '$metadata' in error &&
          (error as { $metadata?: { httpStatusCode?: number } }).$metadata
            ?.httpStatusCode === 404
        )
          return null;
        throw new Error('Storage unavailable', { cause: error });
      }
    },
    async read(key, versionId) {
      const r = await client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
          ...(versionId ? { VersionId: versionId } : {}),
        }),
      );
      return bytes(r.Body);
    },
    async writeReady(key, body) {
      const r = await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: 'image/webp',
          ServerSideEncryption: 'AES256',
        }),
      );
      return { versionId: r.VersionId ?? null };
    },
    async remove(key, versionId) {
      await client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: key,
          ...(versionId ? { VersionId: versionId } : {}),
        }),
      );
    },
  };
}
