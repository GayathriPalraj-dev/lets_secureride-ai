import type { CarImageEvents } from './events.js';
import type { ImageProcessor } from './processor.js';
import type { ImageRepository } from './repository.js';
import type { ImageStorage } from './storage.js';
import type { ImageRecord, ScanEvent } from './types.js';
export function createScanService(
  repository: ImageRepository,
  storage: ImageStorage,
  processor: ImageProcessor,
  events: CarImageEvents,
) {
  const finalize = (
    image: ImageRecord,
    event: ScanEvent,
    set: Partial<ImageRecord>,
  ) =>
    repository.transaction((session) =>
      repository.finalizeScan(image, event, set, session),
    );
  return {
    async process(
      event: ScanEvent,
      requestId: string,
    ): Promise<'processed' | 'duplicate' | 'ignored'> {
      if (
        !(event.eventTime instanceof Date) ||
        Number.isNaN(event.eventTime.getTime())
      )
        return 'ignored';
      const claim = await repository.transaction((session) =>
        repository.claimScanEvent(event, session),
      );
      if (claim.result !== 'claimed') return claim.result;
      const image = claim.image;
      if (event.outcome !== 'clean') {
        const result = await finalize(image, event, {
          status: 'rejected',
          scanState:
            event.outcome === 'threat'
              ? 'threat'
              : event.outcome === 'unsupported'
                ? 'unsupported'
                : 'failed',
          failureCategory:
            event.outcome === 'threat'
              ? 'scan_threat'
              : event.outcome === 'unsupported'
                ? 'scan_unsupported'
                : 'scan_failed',
        });
        if (result.result !== 'updated') return 'ignored';
        events({
          event: 'CAR_IMAGE_REJECTED',
          outcome: 'failure',
          operation: 'scan',
          requestId,
        });
        return 'processed';
      }
      let readyKey: string | undefined,
        readyVersionId: string | null = null;
      try {
        const input = await storage.read(
          image.quarantineObjectKey,
          image.quarantineVersionId,
        );
        const output = await processor.process(
          input,
          image.declaredContentType,
        );
        readyKey = ['ready', image.carId, image.id + '.webp'].join('/');
        const stored = await storage.writeReady(readyKey, output.body);
        readyVersionId = stored.versionId;
        const result = await finalize(image, event, {
          status: 'ready',
          scanState: 'clean',
          readyObjectKey: readyKey,
          readyVersionId,
          normalizedContentType: 'image/webp',
          encodedSize: output.body.byteLength,
          trustedChecksumSha256: output.checksumSha256,
          width: output.width,
          height: output.height,
          verifiedAt: new Date(),
        });
        if (result.result !== 'updated') {
          await storage.remove(readyKey, readyVersionId);
          return 'ignored';
        }
        events({
          event: 'CAR_IMAGE_ACCEPTED',
          outcome: 'success',
          operation: 'scan',
          requestId,
        });
        return 'processed';
      } catch {
        if (readyKey) {
          try {
            await storage.remove(readyKey, readyVersionId);
          } catch {
            /* reconciliation occurs through the retained verification state */
          }
        }
        const result = await finalize(image, event, {
          status: 'rejected',
          scanState: 'failed',
          failureCategory: 'invalid_media',
        });
        if (result.result !== 'updated') return 'ignored';
        events({
          event: 'CAR_IMAGE_REJECTED',
          outcome: 'failure',
          operation: 'scan',
          requestId,
        });
        return 'processed';
      }
    },
  };
}
export type ScanService = ReturnType<typeof createScanService>;
