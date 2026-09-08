import { describe, expect, it, vi } from 'vitest';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { createS3ImageStorage } from '../car-images/s3-storage.js';
const client = (reply: unknown) => ({ send: vi.fn().mockResolvedValue(reply) });
describe('S3 image storage adapter', () => {
  it('heads an exact private object', async () => {
    const c = client({
      ContentLength: 3,
      ChecksumSHA256: 'sum',
      ContentType: 'image/png',
      Metadata: { uploadid: 'id' },
      VersionId: 'v',
    });
    expect(
      await createS3ImageStorage(c as never, 'bucket').head('key'),
    ).toEqual({
      size: 3,
      checksum: 'sum',
      contentType: 'image/png',
      uploadId: 'id',
      versionId: 'v',
    });
    expect(c.send.mock.calls[0]![0]).toBeInstanceOf(HeadObjectCommand);
  });
  it('maps absent optional head values safely', async () =>
    expect(
      await createS3ImageStorage(client({}) as never, 'bucket').head('key'),
    ).toEqual({
      size: -1,
      checksum: '',
      contentType: '',
      uploadId: '',
      versionId: null,
    }));
  it('maps a 404 to missing', async () => {
    const c = {
      send: vi.fn().mockRejectedValue({ $metadata: { httpStatusCode: 404 } }),
    };
    await expect(
      createS3ImageStorage(c as never, 'bucket').head('key'),
    ).resolves.toBeNull();
  });
  it('sanitizes other head failures', async () => {
    const c = { send: vi.fn().mockRejectedValue(new Error('private')) };
    await expect(
      createS3ImageStorage(c as never, 'bucket').head('key'),
    ).rejects.toThrow('Storage unavailable');
  });
  it('reads bytes', async () => {
    const c = client({
      Body: { transformToByteArray: async () => new Uint8Array([1, 2]) },
    });
    expect(
      await createS3ImageStorage(c as never, 'bucket').read('key'),
    ).toEqual(new Uint8Array([1, 2]));
  });
  it('uses GetObject for reads', async () => {
    const c = client({
      Body: { transformToByteArray: async () => new Uint8Array() },
    });
    await createS3ImageStorage(c as never, 'bucket').read('key', 'v');
    expect(c.send.mock.calls[0]![0]).toBeInstanceOf(GetObjectCommand);
  });
  it('rejects unreadable bodies', async () =>
    await expect(
      createS3ImageStorage(client({ Body: null }) as never, 'bucket').read(
        'key',
      ),
    ).rejects.toThrow());
  it('writes normalized objects with AES256', async () => {
    const c = client({ VersionId: 'v' });
    expect(
      await createS3ImageStorage(c as never, 'bucket').writeReady(
        'ready',
        new Uint8Array([1]),
      ),
    ).toEqual({ versionId: 'v' });
    expect(c.send.mock.calls[0]![0]).toBeInstanceOf(PutObjectCommand);
  });
  it('maps missing write versions to null', async () =>
    expect(
      await createS3ImageStorage(client({}) as never, 'bucket').writeReady(
        'ready',
        new Uint8Array(),
      ),
    ).toEqual({ versionId: null }));
  it('deletes an exact object version', async () => {
    const c = client({});
    await createS3ImageStorage(c as never, 'bucket').remove('key', 'v');
    expect(c.send.mock.calls[0]![0]).toBeInstanceOf(DeleteObjectCommand);
  });
});
