import { describe, it, expect, vi } from 'vitest';
import { createArchive, readArchive, streamArchive, createArchiveFromRecording, prepareFiles, downloadBlob, downloadRecording } from '../src/archive.js';
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

  describe('streamArchive', () => {
    it('should stream archive entries', async () => {
      const recording = new SigMFRecording({
        datatype: 'cf32_le',
        sampleRate: 1e6,
      });
      recording.addCapture({ sampleStart: 0 });

      const samples = writeSamples([1.0, 0.0, 0.5, 0.5], 'cf32_le');
      const archive = createArchive([
        { name: 'stream-test', metadata: recording.toMetadata(), data: samples },
      ]);

      const entries = [];
      for await (const entry of streamArchive(archive)) {
        entries.push(entry);
      }

      expect(entries).toHaveLength(1);
      expect(entries[0].name).toBe('stream-test');
      expect(entries[0].metadata.global['core:datatype']).toBe('cf32_le');
    });

    it('should stream multiple recordings', async () => {
      const rec1 = new SigMFRecording({ datatype: 'cf32_le' });
      const rec2 = new SigMFRecording({ datatype: 'ri16_le' });

      const archive = createArchive([
        { name: 'rec-1', metadata: rec1.toMetadata(), data: new Uint8Array(8) },
        { name: 'rec-2', metadata: rec2.toMetadata(), data: new Uint8Array(4) },
      ]);

      const entries = [];
      for await (const entry of streamArchive(archive)) {
        entries.push(entry);
      }

      expect(entries).toHaveLength(2);
    });
  });

  describe('createArchiveFromRecording', () => {
    it('should create archive from recording instance', () => {
      const recording = new SigMFRecording({
        datatype: 'cf32_le',
        sampleRate: 2.4e6,
        description: 'Test recording from instance',
      });
      recording.addCapture({ sampleStart: 0, frequency: 100e6 });

      const samples = writeSamples([1.0, 0.0], 'cf32_le');
      const archive = createArchiveFromRecording(recording, samples, 'instance-test');

      expect(archive).toBeInstanceOf(Blob);
      expect(archive.size).toBeGreaterThan(0);
      expect(archive.type).toBe('application/x-tar');
    });

    it('should roundtrip archive created from recording', async () => {
      const recording = new SigMFRecording({
        datatype: 'ri16_le',
        sampleRate: 1e6,
      });
      recording.addCapture({ sampleStart: 0 });

      const samples = writeSamples([1000, 2000, 3000], 'ri16_le');
      const archive = createArchiveFromRecording(recording, samples, 'roundtrip');

      const entries = await readArchive(archive);
      expect(entries).toHaveLength(1);
      expect(entries[0].name).toBe('roundtrip');
      expect(entries[0].metadata.global['core:sample_rate']).toBe(1e6);
    });
  });

  describe('prepareFiles', () => {
    it('should prepare metadata and data files', () => {
      const recording = new SigMFRecording({
        datatype: 'cf32_le',
        sampleRate: 1e6,
        description: 'Prepared recording',
      });
      recording.addCapture({ sampleStart: 0 });

      const data = new Uint8Array([1, 2, 3, 4]);
      const files = prepareFiles(recording, data);

      expect(files.meta).toContain('core:datatype');
      expect(files.meta).toContain('cf32_le');
      expect(files.meta).toContain('Prepared recording');
      expect(files.data).toEqual(data);
    });

    it('should return valid JSON in meta field', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      const files = prepareFiles(recording, new Uint8Array(0));

      const parsed = JSON.parse(files.meta);
      expect(parsed.global['core:datatype']).toBe('cf32_le');
      expect(parsed.captures).toEqual([]);
      expect(parsed.annotations).toEqual([]);
    });
  });

  describe('downloadBlob', () => {
    it('should create and click a download link', () => {
      // Mock DOM methods - these are browser-only functions
      // In Node.js environment, we need to stub the global document
      const mockAnchor = {
        href: '',
        download: '',
        click: vi.fn(),
      };
      
      // Stub global document if not available
      const originalDocument = globalThis.document;
      globalThis.document = {
        createElement: vi.fn().mockReturnValue(mockAnchor),
      } as unknown as Document;
      
      const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
      const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      const blob = new Blob(['test data'], { type: 'text/plain' });
      downloadBlob(blob, 'test-file.txt');

      expect(globalThis.document.createElement).toHaveBeenCalledWith('a');
      expect(mockAnchor.href).toBe('blob:mock-url');
      expect(mockAnchor.download).toBe('test-file.txt');
      expect(mockAnchor.click).toHaveBeenCalled();
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');

      // Cleanup
      globalThis.document = originalDocument;
      createObjectURLSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
    });
  });

  describe('downloadRecording', () => {
    it('should download both meta and data files', () => {
      // Mock DOM methods
      const clicks: string[] = [];
      
      // Stub global document if not available
      const originalDocument = globalThis.document;
      globalThis.document = {
        createElement: vi.fn().mockImplementation(() => {
          const anchor = {
            href: '',
            download: '',
            click: function() { clicks.push(this.download); },
          };
          return anchor;
        }),
      } as unknown as Document;
      
      const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
      const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      const recording = new SigMFRecording({ datatype: 'cf32_le', sampleRate: 1e6 });
      const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      
      downloadRecording(recording, data, 'my-capture');

      expect(clicks).toContain('my-capture.sigmf-meta');
      expect(clicks).toContain('my-capture.sigmf-data');

      // Cleanup
      globalThis.document = originalDocument;
      createObjectURLSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
    });
  });

  describe('TAR prefix handling', () => {
    it('should read archives with TAR prefix fields (long paths)', async () => {
      // Create a TAR archive manually with a prefix field set
      // TAR format uses prefix field (bytes 345-500) for paths > 100 chars
      const BLOCK_SIZE = 512;
      
      // Create a simple JSON metadata
      const metadata = JSON.stringify({
        global: { 'core:datatype': 'cf32_le', 'core:version': '1.0.0' },
        captures: [{ 'core:sample_start': 0 }],
        annotations: []
      });
      const metaBytes = new TextEncoder().encode(metadata);
      const dataBytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      
      // Calculate padded sizes
      const metaPaddedSize = Math.ceil(metaBytes.length / BLOCK_SIZE) * BLOCK_SIZE;
      const dataPaddedSize = Math.ceil(dataBytes.length / BLOCK_SIZE) * BLOCK_SIZE;
      
      // Total archive size: 2 headers + 2 data blocks + 2 zero blocks
      const archiveSize = BLOCK_SIZE * 2 + metaPaddedSize + dataPaddedSize + BLOCK_SIZE * 2;
      const archive = new Uint8Array(archiveSize);
      
      // Helper to write a TAR header with prefix
      function writeTarHeader(offset: number, name: string, prefix: string, size: number): void {
        const header = archive.subarray(offset, offset + BLOCK_SIZE);
        
        // Name field (bytes 0-99)
        const nameBytes = new TextEncoder().encode(name);
        header.set(nameBytes.slice(0, 100), 0);
        
        // Mode (bytes 100-107) - "0000644\0"
        header.set(new TextEncoder().encode('0000644\0'), 100);
        
        // UID (bytes 108-115) - "0000000\0"
        header.set(new TextEncoder().encode('0000000\0'), 108);
        
        // GID (bytes 116-123) - "0000000\0"
        header.set(new TextEncoder().encode('0000000\0'), 116);
        
        // Size (bytes 124-135) - octal
        const sizeOctal = size.toString(8).padStart(11, '0') + '\0';
        header.set(new TextEncoder().encode(sizeOctal), 124);
        
        // Mtime (bytes 136-147) - "00000000000\0"
        header.set(new TextEncoder().encode('00000000000\0'), 136);
        
        // Typeflag (byte 156) - '0' for regular file
        header[156] = '0'.charCodeAt(0);
        
        // Magic (bytes 257-262) - "ustar\0"
        header.set(new TextEncoder().encode('ustar\0'), 257);
        
        // Version (bytes 263-264) - "00"
        header.set(new TextEncoder().encode('00'), 263);
        
        // Prefix field (bytes 345-500) - for long paths
        if (prefix) {
          const prefixBytes = new TextEncoder().encode(prefix);
          header.set(prefixBytes.slice(0, 155), 345);
        }
        
        // Calculate checksum (bytes 148-155)
        // First fill with spaces
        header.set(new TextEncoder().encode('        '), 148);
        
        // Sum all bytes
        let checksum = 0;
        for (let i = 0; i < BLOCK_SIZE; i++) {
          checksum += header[i];
        }
        
        // Write checksum as octal
        const checksumOctal = checksum.toString(8).padStart(6, '0') + '\0 ';
        header.set(new TextEncoder().encode(checksumOctal), 148);
      }
      
      // Write first file with prefix: "some/long/directory/path" + "/" + "test.sigmf-meta"
      const prefix = 'archive-with-prefix';
      writeTarHeader(0, 'test.sigmf-meta', prefix, metaBytes.length);
      archive.set(metaBytes, BLOCK_SIZE);
      
      // Write second file with same prefix: data file
      const secondHeaderOffset = BLOCK_SIZE + metaPaddedSize;
      writeTarHeader(secondHeaderOffset, 'test.sigmf-data', prefix, dataBytes.length);
      archive.set(dataBytes, secondHeaderOffset + BLOCK_SIZE);
      
      // Read the archive
      const blob = new Blob([archive], { type: 'application/x-tar' });
      const entries = await readArchive(blob);
      
      // Should have parsed the file correctly with prefix
      expect(entries.length).toBe(1);
      expect(entries[0].name).toBe('test');
      expect(entries[0].metadata.global['core:datatype']).toBe('cf32_le');
    });
  });
});
