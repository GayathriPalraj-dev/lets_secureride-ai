import { describe, expect, it } from 'vitest';
import { canTransition, requireTransition } from '../car-images/lifecycle.js';
describe('car image lifecycle', () => {
  it.each([
    ['pending_upload', 'uploaded'],
    ['pending_upload', 'expired'],
    ['pending_upload', 'deleted'],
    ['uploaded', 'verification_pending'],
    ['uploaded', 'rejected'],
    ['uploaded', 'deleted'],
    ['verification_pending', 'ready'],
    ['verification_pending', 'rejected'],
    ['verification_pending', 'deleted'],
    ['ready', 'deleted'],
  ] as const)('allows %s to %s', (from, to) =>
    expect(canTransition(from, to)).toBe(true),
  );
  it('rejects ready to uploaded', () =>
    expect(() => requireTransition('ready', 'uploaded')).toThrow());
  it('treats an identical state as an idempotent no-op', () =>
    expect(requireTransition('ready', 'ready')).toBe(false));
});
