import { describe, it, expect } from 'vitest';
import { createArchive, readArchive } from '../src/archive.js';
import { SigMFRecording } from '../src/metadata.js';
import { writeSamples } from '../src/samples.js';

describe('Archive', () => {
  describe('createArchive', () => {
    it('should create a valid TAR archive', async () => {
      const recording = new SigMFRecording({
        datatype: 'cf32_le',
        sampleRate: 1e6,
      });
      recording.addCapture({ sampleStart: 0, frequency: 100e6 });

      const samples = writeSamples([1.0, 0.0, 0.5, 0.5], 'cf32_le');

      const archive = createArchive([
        {
          name: 'test-recording',
          metadata: recording.toMetadata(),
          data: samples,
        },
      ]);

      expect(archive).toBeInstanceOf(Blob);
      expect(archive.size).toBeGreaterThan(0);
      expect(archive.type).toBe('application/x-tar');
    });

    it('should create archive with multiple recordings', async () => {
      const recording1 = new SigMFRecording({ datatype: 'cf32_le' });
      const recording2 = new SigMFRecording({ datatype: 'ri16_le' });

      const archive = createArchive([
        { name: 'recording-1', metadata: recording1.toMetadata(), data: new Uint8Array(8) },
        { name: 'recording-2', metadata: recording2.toMetadata(), data: new Uint8Array(4) },
      ]);

      expect(archive.size).toBeGreaterThan(0);
    });
  });

  describe('readArchive', () => {
    it('should read a TAR archive created by createArchive', async () => {
      const recording = new SigMFRecording({
        datatype: 'cf32_le',
        sampleRate: 2.4e6,
        description: 'Test recording',
      });
      recording.addCapture({ sampleStart: 0, frequency: 100e6 });
      recording.addAnnotation({ sampleStart: 100, label: 'Signal' });

      const samples = writeSamples([1.0, 2.0, 3.0, 4.0], 'cf32_le');

      const archive = createArchive([
        {
          name: 'roundtrip-test',
          metadata: recording.toMetadata(),
          data: samples,
        },
      ]);

      const entries = await readArchive(archive);

      expect(entries).toHaveLength(1);
      expect(entries[0].name).toBe('roundtrip-test');
      expect(entries[0].metadata.global['core:datatype']).toBe('cf32_le');
      expect(entries[0].metadata.global['core:sample_rate']).toBe(2.4e6);
      expect(entries[0].metadata.global['core:description']).toBe('Test recording');
      expect(entries[0].metadata.captures).toHaveLength(1);
      expect(entries[0].metadata.annotations).toHaveLength(1);
      expect(entries[0].data.length).toBe(16);
    });

    it('should roundtrip multiple recordings', async () => {
      const rec1 = new SigMFRecording({ datatype: 'cf32_le', sampleRate: 1e6 });
      const rec2 = new SigMFRecording({ datatype: 'ri16_le', sampleRate: 2e6 });

      const archive = createArchive([
        { name: 'channel-0', metadata: rec1.toMetadata(), data: new Uint8Array(16) },
        { name: 'channel-1', metadata: rec2.toMetadata(), data: new Uint8Array(8) },
      ]);

      const entries = await readArchive(archive);

      expect(entries).toHaveLength(2);
      expect(entries.find((e) => e.name === 'channel-0')).toBeDefined();
      expect(entries.find((e) => e.name === 'channel-1')).toBeDefined();
    });

    it('should handle metadata-only recordings', async () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      recording.global['core:metadata_only'] = true;

      const archive = createArchive([
        { name: 'meta-only', metadata: recording.toMetadata(), data: new Uint8Array(0) },
      ]);

      const entries = await readArchive(archive);

      expect(entries).toHaveLength(1);
      expect(entries[0].data.length).toBe(0);
      expect(entries[0].metadata.global['core:metadata_only']).toBe(true);
    });
  });

  describe('TAR format compliance', () => {
    it('should create valid TAR with correct block alignment', async () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      const data = new Uint8Array(100); // Not a multiple of 512

      const archive = createArchive([
        { name: 'test', metadata: recording.toMetadata(), data },
      ]);

      // TAR should be block-aligned (512 bytes)
      expect(archive.size % 512).toBe(0);
    });
  });
});
