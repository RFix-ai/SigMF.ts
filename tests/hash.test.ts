import { describe, it, expect, vi } from 'vitest';
import { sha512, verifySha512, verifyHashDetailed } from '../src/hash.js';

// Mock crypto.subtle for Node.js environment
const mockDigest = vi.fn(async (_algorithm: string, data: ArrayBuffer) => {
  // Simple mock that returns a deterministic hash based on data length
  const hashArray = new Uint8Array(64);
  const view = new DataView(data);
  for (let i = 0; i < 64; i++) {
    hashArray[i] = (data.byteLength + i) % 256;
  }
  return hashArray.buffer;
});

// Only mock if crypto.subtle is not available (Node.js without WebCrypto)
if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.subtle) {
  vi.stubGlobal('crypto', {
    subtle: {
      digest: mockDigest,
    },
  });
}

describe('Hash utilities', () => {
  describe('sha512', () => {
    it('should calculate hash of ArrayBuffer', async () => {
      const data = new ArrayBuffer(16);
      const hash = await sha512(data);

      expect(hash).toHaveLength(128);
      expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
    });

    it('should calculate hash of Uint8Array', async () => {
      const data = new Uint8Array([1, 2, 3, 4]);
      const hash = await sha512(data);

      expect(hash).toHaveLength(128);
    });

    it('should calculate hash of Blob', async () => {
      const data = new Blob([new Uint8Array([1, 2, 3, 4])]);
      const hash = await sha512(data);

      expect(hash).toHaveLength(128);
    });

    it('should return lowercase hex', async () => {
      const data = new ArrayBuffer(8);
      const hash = await sha512(data);

      expect(hash).toBe(hash.toLowerCase());
    });

    it('should return same hash for same data', async () => {
      const data1 = new Uint8Array([1, 2, 3, 4]);
      const data2 = new Uint8Array([1, 2, 3, 4]);

      const hash1 = await sha512(data1);
      const hash2 = await sha512(data2);

      expect(hash1).toBe(hash2);
    });

    it('should return different hash for different data', async () => {
      const data1 = new Uint8Array([1, 2, 3, 4]);
      const data2 = new Uint8Array([5, 6, 7, 8]);

      const hash1 = await sha512(data1);
      const hash2 = await sha512(data2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifySha512', () => {
    it('should return true for matching hash', async () => {
      const data = new Uint8Array([1, 2, 3, 4]);
      const hash = await sha512(data);

      const valid = await verifySha512(data, hash);
      expect(valid).toBe(true);
    });

    it('should return false for non-matching hash', async () => {
      const data = new Uint8Array([1, 2, 3, 4]);
      const wrongHash = '0'.repeat(128);

      const valid = await verifySha512(data, wrongHash);
      expect(valid).toBe(false);
    });

    it('should be case-insensitive', async () => {
      const data = new Uint8Array([1, 2, 3, 4]);
      const hash = await sha512(data);

      const validLower = await verifySha512(data, hash.toLowerCase());
      const validUpper = await verifySha512(data, hash.toUpperCase());

      expect(validLower).toBe(true);
      expect(validUpper).toBe(true);
    });
  });

  describe('verifyHashDetailed', () => {
    it('should return detailed result for valid hash', async () => {
      const data = new Uint8Array([1, 2, 3, 4]);
      const hash = await sha512(data);

      const result = await verifyHashDetailed(data, hash);

      expect(result.valid).toBe(true);
      expect(result.expected).toBe(hash.toLowerCase());
      expect(result.actual).toBe(hash.toLowerCase());
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should return detailed result for invalid hash', async () => {
      const data = new Uint8Array([1, 2, 3, 4]);
      const wrongHash = '0'.repeat(128);

      const result = await verifyHashDetailed(data, wrongHash);

      expect(result.valid).toBe(false);
      expect(result.expected).toBe(wrongHash);
      expect(result.actual).not.toBe(wrongHash);
    });
  });
});
