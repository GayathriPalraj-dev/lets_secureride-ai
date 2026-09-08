import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCarImageRequests } from '../services/car-images';
const image = {
  id: 'i',
  altText: 'Front',
  displayOrder: 0,
  isPrimary: false,
  status: 'pending_upload',
  scanState: 'pending',
  failureCategory: null,
  revision: 0,
  uploadExpiresAt: 'x',
  completedAt: null,
  verifiedAt: null,
  createdAt: 'x',
  updatedAt: 'x',
};
const json = (data: unknown, status = 200, type = 'application/json') =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': type },
  });
describe('car image transport', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
  it('accepts strict customer image responses', async () => {
    const customer = {
      id: 'i',
      altText: 'Front',
      displayOrder: 0,
      isPrimary: true,
      contentUrl: '/api/v1/cars/c/images/i/content',
      width: 640,
      height: 360,
    };
    vi.mocked(fetch).mockResolvedValue(
      json({ success: true, data: { items: [customer] } }),
    );
    await expect(
      createCarImageRequests().customerList('t', 'c'),
    ).resolves.toEqual([customer]);
  });
  it('uses credentialed requests', async () => {
    vi.mocked(fetch).mockResolvedValue(
      json({ success: true, data: { items: [], revision: 0 } }),
    );
    await createCarImageRequests().adminList('t', 'c');
    expect(vi.mocked(fetch).mock.calls[0]![1]).toMatchObject({
      credentials: 'include',
      cache: 'no-store',
    });
  });
  it('aborts an in-flight transfer as a distinct cancellation', async () => {
    class PendingRequest {
      status = 0;
      upload = {
        onprogress: null as ((event: ProgressEvent) => void) | null,
      };
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onabort: (() => void) | null = null;
      open() {}
      send() {}
      abort() {
        this.onabort?.();
      }
    }
    vi.stubGlobal(
      'XMLHttpRequest',
      PendingRequest as unknown as typeof XMLHttpRequest,
    );
    const controller = new AbortController();
    const pending = createCarImageRequests().upload(
      { url: 'https://u.invalid', fields: { key: 'q' }, expiresAt: 'x' },
      new File(['x'], 'x.png', { type: 'image/png' }),
      undefined,
      controller.signal,
    );
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('sends quoted If-Match', async () => {
    vi.mocked(fetch).mockResolvedValue(
      json({
        success: true,
        data: {
          image,
          upload: { url: 'https://u.invalid', fields: {}, expiresAt: 'x' },
        },
      }),
    );
    await createCarImageRequests().authorize(
      't',
      'c',
      {
        contentType: 'image/png',
        size: 1,
        checksumSha256: 'A'.repeat(43) + '=',
        altText: 'Front',
      },
      3,
    );
    expect(
      (vi.mocked(fetch).mock.calls[0]![1]!.headers as Record<string, string>)[
        'If-Match'
      ],
    ).toBe('"3"');
  });
  it('sends CSRF marker on mutations', async () => {
    vi.mocked(fetch).mockResolvedValue(
      json({ success: true, data: { image } }),
    );
    await createCarImageRequests().complete('t', 'c', 'i', 0);
    expect(
      (vi.mocked(fetch).mock.calls[0]![1]!.headers as Record<string, string>)[
        'X-CSRF-Protection'
      ],
    ).toBe('1');
  });
  it('rejects unsafe envelopes', async () => {
    vi.mocked(fetch).mockResolvedValue(json({ ok: true }));
    await expect(
      createCarImageRequests().adminList('t', 'c'),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
  it('maps server error codes', async () => {
    vi.mocked(fetch).mockResolvedValue(
      json({ success: false, error: { code: 'CAR_IMAGE_STALE' } }, 412),
    );
    await expect(
      createCarImageRequests().complete('t', 'c', 'i', 0),
    ).rejects.toMatchObject({ code: 'CAR_IMAGE_STALE', status: 412 });
  });
  it('maps network failures safely', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('private'));
    await expect(
      createCarImageRequests().adminList('t', 'c'),
    ).rejects.toMatchObject({ code: 'NETWORK_UNAVAILABLE' });
  });
  it('requires WebP content responses', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('x', { headers: { 'content-type': 'text/plain' } }),
    );
    await expect(
      createCarImageRequests().content('t', '/x'),
    ).rejects.toMatchObject({ code: 'CAR_IMAGE_CONTENT_FAILED' });
  });
  it('reports transport progress and completes only after provider success', async () => {
    class FakeRequest {
      status = 204;
      upload = {
        onprogress: null as ((event: ProgressEvent) => void) | null,
      };
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onabort: (() => void) | null = null;
      open() {}
      send() {
        this.upload.onprogress?.({
          lengthComputable: true,
          loaded: 1,
          total: 2,
        } as ProgressEvent);
        this.onload?.();
      }
      abort() {
        this.onabort?.();
      }
    }
    vi.stubGlobal(
      'XMLHttpRequest',
      FakeRequest as unknown as typeof XMLHttpRequest,
    );
    const progress = vi.fn();
    await createCarImageRequests().upload(
      { url: 'https://u.invalid', fields: { key: 'q' }, expiresAt: 'x' },
      new File(['x'], 'x.png', { type: 'image/png' }),
      progress,
    );
    expect(progress.mock.calls.map(([value]) => value)).toEqual([50, 100]);
  });
});
