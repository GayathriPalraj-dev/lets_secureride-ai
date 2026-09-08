import type {
  AdminCarImage,
  CarImageFailure,
  CarImageScanState,
  CarImageStatus,
} from '@lets-secureride-ai/contracts';

export interface ImageRecord extends Omit<
  AdminCarImage,
  'createdAt' | 'updatedAt' | 'uploadExpiresAt' | 'completedAt' | 'verifiedAt'
> {
  carId: string;
  slot: number;
  quarantineObjectKey: string;
  quarantineVersionId: string | null;
  readyObjectKey: string | null;
  readyVersionId: string | null;
  declaredContentType: 'image/jpeg' | 'image/png' | 'image/webp';
  normalizedContentType: 'image/webp' | null;
  expectedSize: number;
  encodedSize: number | null;
  expectedChecksumSha256: string;
  trustedChecksumSha256: string | null;
  width: number | null;
  height: number | null;
  status: CarImageStatus;
  scanState: CarImageScanState;
  reconciliationState: 'none' | 'required' | 'in_progress' | 'failed';
  failureCategory: CarImageFailure | null;
  lastScanEventTime: Date | null;
  lastScanProviderEventId: string | null;
  uploadExpiresAt: Date;
  scanExpiresAt: Date;
  completedAt: Date | null;
  verifiedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
export type ScanOutcome = 'clean' | 'threat' | 'unsupported' | 'failed';
export interface ScanEvent {
  providerEventId: string;
  imageId: string;
  eventTime: Date;
  outcome: ScanOutcome;
}
