import type {
  AdminCarImage,
  AdminCarImageListData,
  CarImage,
  CarImageUploadAuthorization,
  CreateCarImageUploadRequest,
  UpdateCarImageRequest,
} from '@lets-secureride-ai/contracts';
import { AuthError } from './auth';

const base = () =>
  (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function admin(value: unknown): AdminCarImage {
  if (
    !record(value) ||
    typeof value.id !== 'string' ||
    typeof value.altText !== 'string' ||
    !Number.isInteger(value.revision) ||
    !Number.isInteger(value.displayOrder) ||
    typeof value.isPrimary !== 'boolean' ||
    typeof value.status !== 'string' ||
    typeof value.scanState !== 'string'
  )
    throw new AuthError(503, 'INVALID_RESPONSE');
  return value as unknown as AdminCarImage;
}

function customer(value: unknown): CarImage {
  if (
    !record(value) ||
    typeof value.id !== 'string' ||
    typeof value.altText !== 'string' ||
    !Number.isInteger(value.displayOrder) ||
    typeof value.isPrimary !== 'boolean' ||
    typeof value.contentUrl !== 'string' ||
    !Number.isInteger(value.width) ||
    !Number.isInteger(value.height)
  )
    throw new AuthError(503, 'INVALID_RESPONSE');
  return value as unknown as CarImage;
}

export function createCarImageRequests() {
  async function request(
    path: string,
    method: string,
    token: string,
    body?: unknown,
    revision?: number,
  ) {
    let response: Response;
    try {
      response = await fetch(base() + path, {
        method,
        credentials: 'include',
        cache: 'no-store',
        signal: AbortSignal.timeout(15_000),
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer ' + token,
          ...(body !== undefined
            ? { 'Content-Type': 'application/json', 'X-CSRF-Protection': '1' }
            : {}),
          ...(revision !== undefined ? { 'If-Match': `"${revision}"` } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new AuthError(503, 'NETWORK_UNAVAILABLE');
    }
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      throw new AuthError(503, 'INVALID_RESPONSE');
    }
    if (!response.ok)
      throw new AuthError(
        response.status,
        record(value) &&
          record(value.error) &&
          typeof value.error.code === 'string'
          ? value.error.code
          : 'CAR_IMAGE_REQUEST_FAILED',
      );
    if (!record(value) || value.success !== true || !record(value.data))
      throw new AuthError(503, 'INVALID_RESPONSE');
    return value.data;
  }

  return {
    async customerList(token: string, carId: string): Promise<CarImage[]> {
      const data = await request(
        `/cars/${encodeURIComponent(carId)}/images`,
        'GET',
        token,
      );
      if (!Array.isArray(data.items))
        throw new AuthError(503, 'INVALID_RESPONSE');
      return data.items.map(customer);
    },
    async adminList(
      token: string,
      carId: string,
    ): Promise<AdminCarImageListData> {
      const data = await request(
        `/admin/cars/${encodeURIComponent(carId)}/images`,
        'GET',
        token,
      );
      if (!Array.isArray(data.items) || !Number.isInteger(data.revision))
        throw new AuthError(503, 'INVALID_RESPONSE');
      return { items: data.items.map(admin), revision: Number(data.revision) };
    },
    async authorize(
      token: string,
      carId: string,
      body: CreateCarImageUploadRequest,
      revision: number,
    ): Promise<CarImageUploadAuthorization> {
      const data = await request(
        `/admin/cars/${encodeURIComponent(carId)}/images/uploads`,
        'POST',
        token,
        body,
        revision,
      );
      if (
        !record(data.upload) ||
        typeof data.upload.url !== 'string' ||
        !record(data.upload.fields) ||
        typeof data.upload.expiresAt !== 'string'
      )
        throw new AuthError(503, 'INVALID_RESPONSE');
      return {
        image: admin(data.image),
        upload: data.upload as unknown as CarImageUploadAuthorization['upload'],
      };
    },
    complete: async (
      token: string,
      carId: string,
      imageId: string,
      revision: number,
    ) =>
      request(
        `/admin/cars/${encodeURIComponent(carId)}/images/${encodeURIComponent(imageId)}/complete`,
        'POST',
        token,
        {},
        revision,
      ) as Promise<{ image: AdminCarImage }>,
    update: async (
      token: string,
      carId: string,
      imageId: string,
      revision: number,
      body: UpdateCarImageRequest,
    ) =>
      request(
        `/admin/cars/${encodeURIComponent(carId)}/images/${encodeURIComponent(imageId)}`,
        'PATCH',
        token,
        body,
        revision,
      ) as Promise<{ image: AdminCarImage }>,
    primary: async (
      token: string,
      carId: string,
      imageId: string,
      revision: number,
    ) =>
      request(
        `/admin/cars/${encodeURIComponent(carId)}/images/${encodeURIComponent(imageId)}/primary`,
        'POST',
        token,
        {},
        revision,
      ) as Promise<{ image: AdminCarImage }>,
    remove: async (
      token: string,
      carId: string,
      imageId: string,
      revision: number,
    ) =>
      request(
        `/admin/cars/${encodeURIComponent(carId)}/images/${encodeURIComponent(imageId)}`,
        'DELETE',
        token,
        {},
        revision,
      ) as Promise<{ image: AdminCarImage }>,
    async content(token: string, url: string, signal?: AbortSignal) {
      try {
        const response = await fetch(url, {
          credentials: 'include',
          cache: 'no-store',
          ...(signal ? { signal } : {}),
          headers: { Authorization: 'Bearer ' + token, Accept: 'image/webp' },
        });
        if (
          !response.ok ||
          response.headers.get('content-type')?.split(';')[0] !== 'image/webp'
        )
          throw new AuthError(response.status, 'CAR_IMAGE_CONTENT_FAILED');
        return response.blob();
      } catch (error) {
        if (error instanceof AuthError) throw error;
        throw new AuthError(503, 'NETWORK_UNAVAILABLE');
      }
    },
    upload(
      authorization: CarImageUploadAuthorization['upload'],
      file: File,
      onProgress?: (value: number) => void,
      signal?: AbortSignal,
    ): Promise<void> {
      return new Promise((resolve, reject) => {
        const form = new FormData();
        Object.entries(authorization.fields).forEach(([key, value]) =>
          form.append(key, value),
        );
        form.append('file', file);
        const xhr = new XMLHttpRequest();
        let lastProgress = 0;
        const cleanup = () => signal?.removeEventListener('abort', cancel);
        const cancel = () => xhr.abort();
        xhr.open('POST', authorization.url);
        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable || event.total <= 0) return;
          const next = Math.min(
            99,
            Math.floor((event.loaded / event.total) * 100),
          );
          if (next > lastProgress) {
            lastProgress = next;
            onProgress?.(next);
          }
        };
        xhr.onload = () => {
          cleanup();
          if (xhr.status >= 200 && xhr.status < 300) {
            onProgress?.(100);
            resolve();
          } else reject(new AuthError(503, 'CAR_IMAGE_UPLOAD_FAILED'));
        };
        xhr.onerror = () => {
          cleanup();
          reject(new AuthError(503, 'CAR_IMAGE_UPLOAD_FAILED'));
        };
        xhr.onabort = () => {
          cleanup();
          reject(new DOMException('Upload cancelled', 'AbortError'));
        };
        if (signal?.aborted) {
          xhr.abort();
          return;
        }
        signal?.addEventListener('abort', cancel, { once: true });
        xhr.send(form);
      });
    },
  };
}
export type CarImageRequests = ReturnType<typeof createCarImageRequests>;
