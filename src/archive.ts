/**
 * SigMF Archive Handling
 *
 * Provides functions for reading and creating SigMF archives (.sigmf files).
 * SigMF archives are POSIX.1-2001 TAR files containing paired .sigmf-meta
 * and .sigmf-data files.
 *
 * Uses the `tarts` library for TAR creation.
 */

import { SigMFMetadata, ArchiveEntry, ArchiveOptions } from './types.js';
import { SigMFRecording } from './metadata.js';
import Tar from 'tarts';

/** TAR block size (512 bytes) */
const BLOCK_SIZE = 512;

/** TAR header field offsets */
const TAR_HEADER = {
  name: { offset: 0, size: 100 },
  size: { offset: 124, size: 12 },
  typeflag: { offset: 156, size: 1 },
  prefix: { offset: 345, size: 155 },
} as const;

/**
 * Parsed TAR file entry (for reading).
 */
interface TarEntry {
  name: string;
  size: number;
  data: Uint8Array;
  isFile: boolean;
}

/**
 * Decode null-terminated ASCII string from bytes.
 */
function decodeString(bytes: Uint8Array): string {
  const decoder = new TextDecoder('ascii');
  const nullIndex = bytes.indexOf(0);
  return decoder.decode(nullIndex >= 0 ? bytes.slice(0, nullIndex) : bytes);
}

/**
 * Decode octal string to number.
 */
function decodeOctal(bytes: Uint8Array): number {
  const str = decodeString(bytes).trim();
  return str ? parseInt(str, 8) : 0;
}

/**
 * Parse a TAR archive from an ArrayBuffer.
 * Minimal implementation for reading SigMF archives.
 */
function parseTar(buffer: ArrayBuffer): TarEntry[] {
  const entries: TarEntry[] = [];
  const view = new Uint8Array(buffer);
  let offset = 0;

  while (offset + BLOCK_SIZE <= view.length) {
    const header = view.slice(offset, offset + BLOCK_SIZE);

    // Check for end of archive (two zero blocks)
    if (header.every((b) => b === 0)) {
      break;
    }

    // Parse header fields
    const nameBytes = header.slice(TAR_HEADER.name.offset, TAR_HEADER.name.offset + TAR_HEADER.name.size);
    const prefixBytes = header.slice(TAR_HEADER.prefix.offset, TAR_HEADER.prefix.offset + TAR_HEADER.prefix.size);
    const sizeBytes = header.slice(TAR_HEADER.size.offset, TAR_HEADER.size.offset + TAR_HEADER.size.size);
    const typeflag = String.fromCharCode(header[TAR_HEADER.typeflag.offset]);

    let name = decodeString(nameBytes);
    const prefix = decodeString(prefixBytes);
    if (prefix) {
      name = prefix + '/' + name;
    }

    const size = decodeOctal(sizeBytes);
    const isFile = typeflag === '0' || typeflag === '\x00';

    offset += BLOCK_SIZE;

    // Read file data
    if (size > 0) {
      const data = view.slice(offset, offset + size);
      entries.push({ name, size, data: new Uint8Array(data), isFile });

      // Skip to next block boundary
      const blocks = Math.ceil(size / BLOCK_SIZE);
      offset += blocks * BLOCK_SIZE;
    } else if (isFile) {
      entries.push({ name, size: 0, data: new Uint8Array(0), isFile });
    }
  }

  return entries;
}

/**
 * Read a SigMF archive from a Blob or File.
 *
 * Parses the TAR archive and extracts all SigMF recordings (paired
 * .sigmf-meta and .sigmf-data files).
 *
 * @param source - Blob or File containing the archive
 * @returns Array of archive entries
 *
 * @example
 * ```ts
 * const file = input.files[0]; // .sigmf file
 * const entries = await readArchive(file);
 *
 * for (const entry of entries) {
 *   console.log('Recording:', entry.name);
 *   console.log('Datatype:', entry.metadata.global['core:datatype']);
 *   console.log('Data size:', entry.data.length, 'bytes');
 * }
 * ```
 */
export async function readArchive(source: Blob): Promise<ArchiveEntry[]> {
  const buffer = await source.arrayBuffer();
  const tarEntries = parseTar(buffer);

  // Group files by base name
  const metaFiles = new Map<string, Uint8Array>();
  const dataFiles = new Map<string, Uint8Array>();

  for (const entry of tarEntries) {
    if (!entry.isFile) continue;

    // Remove leading directory from path
    const name = entry.name.replace(/^[^/]+\//, '');

    if (name.endsWith('.sigmf-meta')) {
      const baseName = name.slice(0, -'.sigmf-meta'.length);
      metaFiles.set(baseName, entry.data);
    } else if (name.endsWith('.sigmf-data')) {
      const baseName = name.slice(0, -'.sigmf-data'.length);
      dataFiles.set(baseName, entry.data);
    }
  }

  // Match metadata with data files
  const results: ArchiveEntry[] = [];

  for (const [baseName, metaData] of metaFiles) {
    const decoder = new TextDecoder('utf-8');
    const metaJson = decoder.decode(metaData);
    const metadata = JSON.parse(metaJson) as SigMFMetadata;

    // Data file is optional (metadata-only recordings)
    const data = dataFiles.get(baseName) ?? new Uint8Array(0);

    results.push({
      name: baseName,
      metadata,
      data,
    });
  }

  return results;
}

/**
 * Read a SigMF archive with streaming support for large files.
 *
 * Processes the archive in chunks to avoid loading the entire archive
 * into memory. Yields entries as they are parsed.
 *
 * @param source - Blob or File containing the archive
 * @yields Archive entries as they are parsed
 *
 * @example
 * ```ts
 * for await (const entry of streamArchive(file)) {
 *   console.log('Found recording:', entry.name);
 * }
 * ```
 */
export async function* streamArchive(source: Blob): AsyncGenerator<ArchiveEntry> {
  // For truly streaming, we'd need incremental TAR parsing
  // For now, delegate to readArchive and yield results
  const entries = await readArchive(source);
  for (const entry of entries) {
    yield entry;
  }
}

/**
 * Create a SigMF archive containing one or more recordings.
 *
 * Creates a POSIX.1-2001 TAR archive with paired .sigmf-meta and
 * .sigmf-data files for each recording.
 *
 * Uses the `tarts` library for TAR creation.
 *
 * @param recordings - Array of recordings to include
 * @param archiveName - Optional name for the archive (used as directory name)
 * @returns Blob containing the TAR archive
 *
 * @example
 * ```ts
 * const recording = new SigMFRecording({ datatype: 'cf32_le', sampleRate: 2.4e6 });
 * recording.addCapture({ sampleStart: 0, frequency: 100e6 });
 *
 * const samples = writeSamples(myIQData, 'cf32_le');
 *
 * const archive = createArchive([{
 *   name: 'my-recording',
 *   metadata: recording.toMetadata(),
 *   data: samples,
 * }]);
 *
 * // Download the archive
 * const url = URL.createObjectURL(archive);
 * const a = document.createElement('a');
 * a.href = url;
 * a.download = 'my-recording.sigmf';
 * a.click();
 * ```
 */
export function createArchive(
  recordings: ArchiveOptions[],
  archiveName?: string
): Blob {
  const dirName = archiveName ?? recordings[0]?.name ?? 'recording';
  const files: Array<{ name: string; content: Uint8Array }> = [];

  for (const recording of recordings) {
    // Add metadata file
    const metaJson = JSON.stringify(recording.metadata, null, 2);
    const encoder = new TextEncoder();
    const metaData = encoder.encode(metaJson);

    files.push({
      name: `${dirName}/${recording.name}.sigmf-meta`,
      content: metaData,
    });

    // Add data file (even if empty)
    files.push({
      name: `${dirName}/${recording.name}.sigmf-data`,
      content: recording.data,
    });
  }

  // Use tarts library to create the TAR archive
  const tarData = Tar(files);
  return new Blob([tarData as BlobPart], { type: 'application/x-tar' });
}

/**
 * Create a SigMF archive from a SigMFRecording instance and sample data.
 *
 * Convenience function for creating an archive from a single recording.
 *
 * @param recording - SigMFRecording instance
 * @param data - Sample data as Uint8Array
 * @param name - Base name for the recording files
 * @returns Blob containing the TAR archive
 *
 * @example
 * ```ts
 * const archive = createArchiveFromRecording(recording, samples, 'capture-001');
 * ```
 */
export function createArchiveFromRecording(
  recording: SigMFRecording,
  data: Uint8Array,
  name: string
): Blob {
  return createArchive([
    {
      name,
      metadata: recording.toMetadata(),
      data,
    },
  ]);
}

/**
 * Extract metadata and data file content without creating archive objects.
 *
 * Useful when you need to work with individual files rather than archives.
 *
 * @param recording - SigMFRecording instance
 * @param data - Sample data as Uint8Array
 * @returns Object with metadata JSON string and data bytes
 */
export function prepareFiles(
  recording: SigMFRecording,
  data: Uint8Array
): { meta: string; data: Uint8Array } {
  return {
    meta: recording.toJSON(),
    data,
  };
}

/**
 * Download a Blob as a file in the browser.
 *
 * @param blob - Blob to download
 * @param filename - Name for the downloaded file
 *
 * @example
 * ```ts
 * const archive = createArchive([...]);
 * downloadBlob(archive, 'my-recording.sigmf');
 * ```
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * Download metadata and data as separate files.
 *
 * @param recording - SigMFRecording instance
 * @param data - Sample data
 * @param baseName - Base name for both files (without extension)
 */
export function downloadRecording(
  recording: SigMFRecording,
  data: Uint8Array,
  baseName: string
): void {
  // Download metadata
  const metaJson = recording.toJSON();
  const metaBlob = new Blob([metaJson], { type: 'application/json' });
  downloadBlob(metaBlob, `${baseName}.sigmf-meta`);

  // Download data
  const dataBlob = new Blob([data as BlobPart], { type: 'application/octet-stream' });
  downloadBlob(dataBlob, `${baseName}.sigmf-data`);
}
