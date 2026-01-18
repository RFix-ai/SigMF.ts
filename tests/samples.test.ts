import { describe, it, expect } from 'vitest';
import {
  readSamples,
  readSamplesFromBlob,
  writeSamples,
  writeSamplesComplex,
  streamSamples,
  getComplexSample,
  magnitude,
  phase,
  magnitudes,
  phases,
  deinterleave,
  interleave,
} from '../src/samples.js';

describe('readSamples', () => {
  describe('complex float32 little-endian', () => {
    it('should read cf32_le samples', () => {
      // Create test data: 2 complex samples (1.0+0.0j, 0.5+0.5j)
      const buffer = new ArrayBuffer(16);
      const view = new DataView(buffer);
      view.setFloat32(0, 1.0, true); // I[0]
      view.setFloat32(4, 0.0, true); // Q[0]
      view.setFloat32(8, 0.5, true); // I[1]
      view.setFloat32(12, 0.5, true); // Q[1]

      const result = readSamples(buffer, 'cf32_le');

      expect(result.sampleCount).toBe(2);
      expect(result.complex).toBeDefined();
      expect(result.complex![0]).toBeCloseTo(1.0);
      expect(result.complex![1]).toBeCloseTo(0.0);
      expect(result.complex![2]).toBeCloseTo(0.5);
      expect(result.complex![3]).toBeCloseTo(0.5);
    });

    it('should read with offset', () => {
      const buffer = new ArrayBuffer(24); // 3 samples
      const view = new DataView(buffer);
      view.setFloat32(0, 1.0, true);
      view.setFloat32(4, 0.0, true);
      view.setFloat32(8, 2.0, true);
      view.setFloat32(12, 0.0, true);
      view.setFloat32(16, 3.0, true);
      view.setFloat32(20, 0.0, true);

      const result = readSamples(buffer, 'cf32_le', { offset: 1 });

      expect(result.sampleCount).toBe(2);
      expect(result.complex![0]).toBeCloseTo(2.0);
    });

    it('should read with count limit', () => {
      const buffer = new ArrayBuffer(24);
      const view = new DataView(buffer);
      view.setFloat32(0, 1.0, true);
      view.setFloat32(4, 0.0, true);
      view.setFloat32(8, 2.0, true);
      view.setFloat32(12, 0.0, true);
      view.setFloat32(16, 3.0, true);
      view.setFloat32(20, 0.0, true);

      const result = readSamples(buffer, 'cf32_le', { count: 2 });

      expect(result.sampleCount).toBe(2);
    });
  });

  describe('complex float32 big-endian', () => {
    it('should read cf32_be samples', () => {
      const buffer = new ArrayBuffer(8);
      const view = new DataView(buffer);
      view.setFloat32(0, 1.0, false); // big-endian
      view.setFloat32(4, 2.0, false);

      const result = readSamples(buffer, 'cf32_be');

      expect(result.complex![0]).toBeCloseTo(1.0);
      expect(result.complex![1]).toBeCloseTo(2.0);
    });
  });

  describe('complex int16 little-endian', () => {
    it('should read ci16_le samples', () => {
      const buffer = new ArrayBuffer(8);
      const view = new DataView(buffer);
      view.setInt16(0, 1000, true);
      view.setInt16(2, -1000, true);
      view.setInt16(4, 500, true);
      view.setInt16(6, 500, true);

      const result = readSamples(buffer, 'ci16_le');

      expect(result.sampleCount).toBe(2);
      expect(result.complex![0]).toBe(1000);
      expect(result.complex![1]).toBe(-1000);
      expect(result.complex![2]).toBe(500);
      expect(result.complex![3]).toBe(500);
    });
  });

  describe('complex unsigned 8-bit', () => {
    it('should read cu8 samples', () => {
      const buffer = new ArrayBuffer(4);
      const view = new DataView(buffer);
      view.setUint8(0, 128); // I[0]
      view.setUint8(1, 64); // Q[0]
      view.setUint8(2, 255); // I[1]
      view.setUint8(3, 0); // Q[1]

      const result = readSamples(buffer, 'cu8');

      expect(result.sampleCount).toBe(2);
      expect(result.complex![0]).toBe(128);
      expect(result.complex![1]).toBe(64);
      expect(result.complex![2]).toBe(255);
      expect(result.complex![3]).toBe(0);
    });
  });

  describe('real float32', () => {
    it('should read rf32_le samples', () => {
      const buffer = new ArrayBuffer(12);
      const view = new DataView(buffer);
      view.setFloat32(0, 1.0, true);
      view.setFloat32(4, 2.0, true);
      view.setFloat32(8, 3.0, true);

      const result = readSamples(buffer, 'rf32_le');

      expect(result.sampleCount).toBe(3);
      expect(result.real).toBeDefined();
      expect(result.complex).toBeUndefined();
      expect(result.real![0]).toBeCloseTo(1.0);
      expect(result.real![1]).toBeCloseTo(2.0);
      expect(result.real![2]).toBeCloseTo(3.0);
    });
  });

  describe('real int16', () => {
    it('should read ri16_le samples', () => {
      const buffer = new ArrayBuffer(6);
      const view = new DataView(buffer);
      view.setInt16(0, 32767, true);
      view.setInt16(2, -32768, true);
      view.setInt16(4, 0, true);

      const result = readSamples(buffer, 'ri16_le');

      expect(result.sampleCount).toBe(3);
      expect(result.real![0]).toBe(32767);
      expect(result.real![1]).toBe(-32768);
      expect(result.real![2]).toBe(0);
    });
  });
});

describe('writeSamples', () => {
  it('should write cf32_le samples', () => {
    const samples = [1.0, 0.0, 0.5, 0.5]; // 2 complex samples
    const bytes = writeSamples(samples, 'cf32_le');

    expect(bytes.length).toBe(16);

    const view = new DataView(bytes.buffer);
    expect(view.getFloat32(0, true)).toBeCloseTo(1.0);
    expect(view.getFloat32(4, true)).toBeCloseTo(0.0);
    expect(view.getFloat32(8, true)).toBeCloseTo(0.5);
    expect(view.getFloat32(12, true)).toBeCloseTo(0.5);
  });

  it('should write rf32_le samples', () => {
    const samples = [1.0, 2.0, 3.0];
    const bytes = writeSamples(samples, 'rf32_le');

    expect(bytes.length).toBe(12);

    const view = new DataView(bytes.buffer);
    expect(view.getFloat32(0, true)).toBeCloseTo(1.0);
    expect(view.getFloat32(4, true)).toBeCloseTo(2.0);
    expect(view.getFloat32(8, true)).toBeCloseTo(3.0);
  });

  it('should write ci16_le samples', () => {
    const samples = [1000, -1000, 500, 500];
    const bytes = writeSamples(samples, 'ci16_le');

    expect(bytes.length).toBe(8);

    const view = new DataView(bytes.buffer);
    expect(view.getInt16(0, true)).toBe(1000);
    expect(view.getInt16(2, true)).toBe(-1000);
  });

  it('should write cu8 samples', () => {
    const samples = [128, 64, 255, 0];
    const bytes = writeSamples(samples, 'cu8');

    expect(bytes.length).toBe(4);
    expect(bytes[0]).toBe(128);
    expect(bytes[1]).toBe(64);
    expect(bytes[2]).toBe(255);
    expect(bytes[3]).toBe(0);
  });

  it('should roundtrip samples', () => {
    const original = [1.5, -0.5, 0.25, 0.75, -1.0, 1.0];
    const bytes = writeSamples(original, 'cf32_le');
    const result = readSamples(bytes.buffer, 'cf32_le');

    expect(result.sampleCount).toBe(3);
    for (let i = 0; i < original.length; i++) {
      expect(result.complex![i]).toBeCloseTo(original[i]);
    }
  });
});

describe('writeSamplesComplex', () => {
  it('should write complex samples from objects', () => {
    const samples = [
      { i: 1.0, q: 0.0 },
      { i: 0.5, q: 0.5 },
    ];
    const bytes = writeSamplesComplex(samples, 'cf32_le');

    const view = new DataView(bytes.buffer);
    expect(view.getFloat32(0, true)).toBeCloseTo(1.0);
    expect(view.getFloat32(4, true)).toBeCloseTo(0.0);
    expect(view.getFloat32(8, true)).toBeCloseTo(0.5);
    expect(view.getFloat32(12, true)).toBeCloseTo(0.5);
  });

  it('should throw for non-complex datatype', () => {
    expect(() => writeSamplesComplex([{ i: 1, q: 0 }], 'rf32_le')).toThrow('complex datatype');
  });
});

describe('complex sample utilities', () => {
  describe('getComplexSample', () => {
    it('should get sample at index', () => {
      const data = new Float64Array([1.0, 2.0, 3.0, 4.0]);
      const sample = getComplexSample(data, 1);
      expect(sample.i).toBe(3.0);
      expect(sample.q).toBe(4.0);
    });
  });

  describe('magnitude', () => {
    it('should calculate magnitude', () => {
      expect(magnitude({ i: 3, q: 4 })).toBe(5);
      expect(magnitude({ i: 1, q: 0 })).toBe(1);
      expect(magnitude({ i: 0, q: 1 })).toBe(1);
    });
  });

  describe('phase', () => {
    it('should calculate phase', () => {
      expect(phase({ i: 1, q: 0 })).toBeCloseTo(0);
      expect(phase({ i: 0, q: 1 })).toBeCloseTo(Math.PI / 2);
      expect(phase({ i: -1, q: 0 })).toBeCloseTo(Math.PI);
      expect(phase({ i: 0, q: -1 })).toBeCloseTo(-Math.PI / 2);
    });
  });

  describe('magnitudes', () => {
    it('should calculate magnitudes for array', () => {
      const complex = [3, 4, 1, 0, 0, 1];
      const mags = magnitudes(complex);
      expect(mags[0]).toBe(5);
      expect(mags[1]).toBe(1);
      expect(mags[2]).toBe(1);
    });
  });

  describe('phases', () => {
    it('should calculate phases for array', () => {
      const complex = [1, 0, 0, 1];
      const ph = phases(complex);
      expect(ph[0]).toBeCloseTo(0);
      expect(ph[1]).toBeCloseTo(Math.PI / 2);
    });
  });
});

describe('interleave/deinterleave', () => {
  it('should deinterleave complex data', () => {
    const complex = new Float64Array([1, 2, 3, 4, 5, 6]);
    const { i, q } = deinterleave(complex);

    expect(Array.from(i)).toEqual([1, 3, 5]);
    expect(Array.from(q)).toEqual([2, 4, 6]);
  });

  it('should interleave I/Q data', () => {
    const i = [1, 3, 5];
    const q = [2, 4, 6];
    const complex = interleave(i, q);

    expect(Array.from(complex)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('should roundtrip interleave/deinterleave', () => {
    const original = new Float64Array([1, 2, 3, 4, 5, 6]);
    const { i, q } = deinterleave(original);
    const result = interleave(i, q);

    expect(Array.from(result)).toEqual(Array.from(original));
  });

  it('should throw for mismatched lengths', () => {
    expect(() => interleave([1, 2], [1])).toThrow('same length');
  });
});

describe('readSamplesFromBlob', () => {
  it('should read samples from a small Blob', async () => {
    // Create test data: 2 complex samples
    const buffer = new ArrayBuffer(16);
    const view = new DataView(buffer);
    view.setFloat32(0, 1.0, true);
    view.setFloat32(4, 2.0, true);
    view.setFloat32(8, 3.0, true);
    view.setFloat32(12, 4.0, true);

    const blob = new Blob([buffer]);
    const result = await readSamplesFromBlob(blob, 'cf32_le');

    expect(result.sampleCount).toBe(2);
    expect(result.complex![0]).toBeCloseTo(1.0);
    expect(result.complex![1]).toBeCloseTo(2.0);
  });

  it('should read with offset and count', async () => {
    const buffer = new ArrayBuffer(24); // 3 complex cf32 samples
    const view = new DataView(buffer);
    view.setFloat32(0, 1.0, true);
    view.setFloat32(4, 0.0, true);
    view.setFloat32(8, 2.0, true);
    view.setFloat32(12, 0.0, true);
    view.setFloat32(16, 3.0, true);
    view.setFloat32(20, 0.0, true);

    const blob = new Blob([buffer]);
    const result = await readSamplesFromBlob(blob, 'cf32_le', { offset: 1, count: 1 });

    expect(result.sampleCount).toBe(1);
    expect(result.complex![0]).toBeCloseTo(2.0);
  });

  it('should call progress callback for small files', async () => {
    const buffer = new ArrayBuffer(16);
    const blob = new Blob([buffer]);

    const progressCalls: Array<[number, number]> = [];
    await readSamplesFromBlob(blob, 'cf32_le', {}, (bytesRead, total) => {
      progressCalls.push([bytesRead, total]);
    });

    expect(progressCalls.length).toBeGreaterThan(0);
  });

  it('should read real samples from Blob', async () => {
    const buffer = new ArrayBuffer(12); // 3 real rf32 samples
    const view = new DataView(buffer);
    view.setFloat32(0, 1.0, true);
    view.setFloat32(4, 2.0, true);
    view.setFloat32(8, 3.0, true);

    const blob = new Blob([buffer]);
    const result = await readSamplesFromBlob(blob, 'rf32_le');

    expect(result.sampleCount).toBe(3);
    expect(result.real![0]).toBeCloseTo(1.0);
    expect(result.real![2]).toBeCloseTo(3.0);
  });
});

describe('streamSamples', () => {
  it('should stream samples from a Blob', async () => {
    // Create test data with multiple samples
    const sampleCount = 10;
    const buffer = new ArrayBuffer(sampleCount * 8); // cf32_le = 8 bytes per sample
    const view = new DataView(buffer);
    for (let i = 0; i < sampleCount; i++) {
      view.setFloat32(i * 8, i + 1, true);     // I
      view.setFloat32(i * 8 + 4, -(i + 1), true); // Q
    }

    const blob = new Blob([buffer]);
    const chunks: number[] = [];

    for await (const chunk of streamSamples(blob, 'cf32_le', 3)) {
      chunks.push(chunk.sampleCount);
    }

    // Should have yielded multiple chunks
    expect(chunks.reduce((a, b) => a + b, 0)).toBe(sampleCount);
  });

  it('should stream real samples', async () => {
    const sampleCount = 5;
    const buffer = new ArrayBuffer(sampleCount * 4); // rf32_le = 4 bytes per sample
    const view = new DataView(buffer);
    for (let i = 0; i < sampleCount; i++) {
      view.setFloat32(i * 4, i * 0.1, true);
    }

    const blob = new Blob([buffer]);
    let totalSamples = 0;

    for await (const chunk of streamSamples(blob, 'rf32_le', 2)) {
      expect(chunk.real).toBeDefined();
      totalSamples += chunk.sampleCount;
    }

    expect(totalSamples).toBe(sampleCount);
  });

  it('should handle empty Blob', async () => {
    const blob = new Blob([]);
    const chunks = [];

    for await (const chunk of streamSamples(blob, 'cf32_le')) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(0);
  });

  it('should handle partial samples at chunk boundaries', async () => {
    // Create data that doesn't align perfectly with chunk size
    const sampleCount = 7;
    const buffer = new ArrayBuffer(sampleCount * 8);
    const view = new DataView(buffer);
    for (let i = 0; i < sampleCount; i++) {
      view.setFloat32(i * 8, i, true);
      view.setFloat32(i * 8 + 4, i, true);
    }

    const blob = new Blob([buffer]);
    let totalSamples = 0;

    for await (const chunk of streamSamples(blob, 'cf32_le', 3)) {
      totalSamples += chunk.sampleCount;
    }

    expect(totalSamples).toBe(sampleCount);
  });

  it('should process remaining samples after stream ends', async () => {
    // Create data where the last chunk has remaining samples after loop exits
    // Use a very large chunk size so data accumulates but loop exits before processing
    const sampleCount = 2;
    const buffer = new ArrayBuffer(sampleCount * 8); // cf32_le = 8 bytes per sample
    const view = new DataView(buffer);
    view.setFloat32(0, 1.5, true);
    view.setFloat32(4, 2.5, true);
    view.setFloat32(8, 3.5, true);
    view.setFloat32(12, 4.5, true);

    const blob = new Blob([buffer]);
    const results: number[] = [];

    // Use a chunk size larger than the total data
    // This ensures the while loop accumulates all data then exits
    for await (const chunk of streamSamples(blob, 'cf32_le', 1000)) {
      results.push(chunk.sampleCount);
    }

    // All samples should still be processed
    expect(results.reduce((a, b) => a + b, 0)).toBe(sampleCount);
  });
});

describe('additional datatype support', () => {
  it('should read and write ci32_le samples', () => {
    const samples = [100000, -100000, 50000, 50000];
    const bytes = writeSamples(samples, 'ci32_le');
    const result = readSamples(bytes.buffer, 'ci32_le');

    expect(result.sampleCount).toBe(2);
    expect(result.complex![0]).toBe(100000);
    expect(result.complex![1]).toBe(-100000);
  });

  it('should read and write cu16_le samples', () => {
    const samples = [65535, 0, 32768, 32768];
    const bytes = writeSamples(samples, 'cu16_le');
    const result = readSamples(bytes.buffer, 'cu16_le');

    expect(result.sampleCount).toBe(2);
    expect(result.complex![0]).toBe(65535);
    expect(result.complex![1]).toBe(0);
  });

  it('should read and write ci8 samples', () => {
    const samples = [127, -128, 0, 64];
    const bytes = writeSamples(samples, 'ci8');
    const result = readSamples(bytes.buffer, 'ci8');

    expect(result.sampleCount).toBe(2);
    expect(result.complex![0]).toBe(127);
    expect(result.complex![1]).toBe(-128);
  });

  it('should read and write cf64_le samples', () => {
    const samples = [1.123456789, 2.987654321, 3.0, 4.0];
    const bytes = writeSamples(samples, 'cf64_le');
    const result = readSamples(bytes.buffer, 'cf64_le');

    expect(result.sampleCount).toBe(2);
    expect(result.complex![0]).toBeCloseTo(1.123456789, 8);
    expect(result.complex![1]).toBeCloseTo(2.987654321, 8);
  });

  it('should read and write cf64_be samples', () => {
    const samples = [1.5, 2.5];
    const bytes = writeSamples(samples, 'cf64_be');
    const result = readSamples(bytes.buffer, 'cf64_be');

    expect(result.sampleCount).toBe(1);
    expect(result.complex![0]).toBeCloseTo(1.5);
    expect(result.complex![1]).toBeCloseTo(2.5);
  });

  it('should read and write ri32_le samples', () => {
    const samples = [2147483647, -2147483648, 0];
    const bytes = writeSamples(samples, 'ri32_le');
    const result = readSamples(bytes.buffer, 'ri32_le');

    expect(result.sampleCount).toBe(3);
    expect(result.real![0]).toBe(2147483647);
    expect(result.real![1]).toBe(-2147483648);
  });

  it('should read and write ru16_le samples', () => {
    const samples = [0, 65535, 32768];
    const bytes = writeSamples(samples, 'ru16_le');
    const result = readSamples(bytes.buffer, 'ru16_le');

    expect(result.sampleCount).toBe(3);
    expect(result.real![0]).toBe(0);
    expect(result.real![1]).toBe(65535);
  });

  it('should read and write ru8 samples', () => {
    const samples = [0, 255, 128];
    const bytes = writeSamples(samples, 'ru8');
    const result = readSamples(bytes.buffer, 'ru8');

    expect(result.sampleCount).toBe(3);
    expect(result.real![0]).toBe(0);
    expect(result.real![1]).toBe(255);
  });

  it('should read and write rf64_le samples', () => {
    const samples = [Math.PI, Math.E, 0];
    const bytes = writeSamples(samples, 'rf64_le');
    const result = readSamples(bytes.buffer, 'rf64_le');

    expect(result.sampleCount).toBe(3);
    expect(result.real![0]).toBeCloseTo(Math.PI, 10);
    expect(result.real![1]).toBeCloseTo(Math.E, 10);
  });

  it('should handle big-endian int16', () => {
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setInt16(0, 1000, false); // big-endian
    view.setInt16(2, -1000, false);

    const result = readSamples(buffer, 'ci16_be');
    expect(result.complex![0]).toBe(1000);
    expect(result.complex![1]).toBe(-1000);
  });

  it('should handle big-endian int32', () => {
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    view.setInt32(0, 100000, false); // big-endian
    view.setInt32(4, -100000, false);

    const result = readSamples(buffer, 'ci32_be');
    expect(result.complex![0]).toBe(100000);
    expect(result.complex![1]).toBe(-100000);
  });
});
