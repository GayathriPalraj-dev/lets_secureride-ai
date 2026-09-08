export interface ProcessedImage {
  body: Uint8Array;
  width: number;
  height: number;
  contentType: 'image/webp';
  checksumSha256: string;
}
export interface ImageProcessor {
  process(body: Uint8Array, declared: string): Promise<ProcessedImage>;
}
