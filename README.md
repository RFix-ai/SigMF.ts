# SigMF.ts

A browser-first TypeScript library for reading and writing [SigMF](https://github.com/sigmf/SigMF) (Signal Metadata Format) files.

[![npm version](https://badge.fury.io/js/sigmf.svg)](https://www.npmjs.com/package/sigmf)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 📦 **Full SigMF v1.2.x support** — Read and write metadata, samples, and archives
- 🌐 **Browser-first** — Works in modern browsers with no Node.js dependencies
- 📊 **All datatypes** — Supports all 20+ SigMF sample formats (cf32_le, ri16_le, cu8, etc.)
- 🔄 **Streaming** — Handle large files with streaming API for memory efficiency
- ✅ **Validation** — Comprehensive metadata validation against SigMF specification
- 🔒 **SHA-512** — Opt-in hash verification for data integrity
- 📁 **Archives** — Create and read .sigmf TAR archives
- 📚 **Collections** — Group related recordings with SigMF Collection files
- 🔌 **Extensions** — Framework for SigMF extension namespaces
- 📄 **Non-Conforming Datasets** — Support for legacy/non-standard data files

## Installation

```bash
npm install sigmf
```

## Quick Start

### Creating a SigMF Recording

```typescript
import { SigMFRecording, writeSamples, createArchive, downloadBlob } from 'sigmf';

// Create metadata
const recording = new SigMFRecording({
  datatype: 'cf32_le',
  sampleRate: 2.4e6,
  description: 'FM radio capture at 100 MHz',
  author: 'Your Name',
  hw: 'RTL-SDR v3',
});

// Add capture segment
recording.addCapture({
  sampleStart: 0,
  frequency: 100e6,
  datetime: '2026-01-15T12:00:00.000Z',
});

// Add annotation
recording.addAnnotation({
  sampleStart: 1000,
  sampleCount: 50000,
  label: 'FM Broadcast',
  freqLowerEdge: 99.9e6,
  freqUpperEdge: 100.1e6,
});

// Write sample data (interleaved I/Q for complex)
const iqSamples = [1.0, 0.0, 0.5, 0.5, -0.5, 0.5]; // 3 complex samples
const sampleData = writeSamples(iqSamples, 'cf32_le');

// Create and download archive
const archive = createArchive([{
  name: 'my-capture',
  metadata: recording.toMetadata(),
  data: sampleData,
}]);

downloadBlob(archive, 'my-capture.sigmf');
```

### Reading a SigMF Archive

```typescript
import { readArchive, readSamples, SigMFRecording } from 'sigmf';

// From file input
const fileInput = document.querySelector('input[type="file"]');
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  
  // Read archive
  const entries = await readArchive(file);
  
  for (const entry of entries) {
    console.log('Recording:', entry.name);
    console.log('Datatype:', entry.metadata.global['core:datatype']);
    console.log('Sample rate:', entry.metadata.global['core:sample_rate']);
    
    // Read samples
    const samples = readSamples(entry.data.buffer, entry.metadata.global['core:datatype']);
    console.log('Sample count:', samples.sampleCount);
    
    if (samples.complex) {
      console.log('First I/Q:', samples.complex[0], samples.complex[1]);
    }
  }
});
```

### Reading Metadata Only

```typescript
import { SigMFRecording } from 'sigmf';

// Parse from JSON
const json = await fetch('recording.sigmf-meta').then(r => r.text());
const recording = SigMFRecording.fromJSON(json);

// Access metadata
console.log('Datatype:', recording.global['core:datatype']);
console.log('Sample rate:', recording.getSampleRate());
console.log('Channels:', recording.getNumChannels());

// Validate
const result = recording.validate();
if (!result.valid) {
  console.error('Validation errors:', result.errors);
}
```

### Streaming Large Files

```typescript
import { streamSamples, readSamplesFromBlob } from 'sigmf';

// Stream samples in chunks
for await (const chunk of streamSamples(file, 'cf32_le', 65536)) {
  // Process 65536 samples at a time
  processSamples(chunk.complex);
}

// Or read with progress callback
const samples = await readSamplesFromBlob(file, 'cf32_le', {}, (bytesRead, total) => {
  console.log(`Progress: ${(bytesRead / total * 100).toFixed(1)}%`);
});
```

### Working with Complex Samples

```typescript
import { 
  readSamples, 
  getComplexSample, 
  magnitude, 
  phase, 
  magnitudes, 
  deinterleave 
} from 'sigmf';

const { complex, sampleCount } = readSamples(buffer, 'cf32_le');

// Get individual sample
const sample = getComplexSample(complex, 0);
console.log('I:', sample.i, 'Q:', sample.q);
console.log('Magnitude:', magnitude(sample));
console.log('Phase:', phase(sample), 'radians');

// Batch operations
const mags = magnitudes(complex);  // All magnitudes
const { i, q } = deinterleave(complex);  // Separate I and Q arrays
```

### Hash Verification (Opt-in)

```typescript
import { sha512, verifySha512 } from 'sigmf';

// Calculate hash for new recording
const hash = await sha512(sampleData);
recording.setSha512(hash);

// Verify existing recording
const expectedHash = metadata.global['core:sha512'];
if (expectedHash) {
  const valid = await verifySha512(dataFile, expectedHash);
  if (!valid) {
    console.error('Data integrity check failed!');
  }
}
```

### Working with Collections

Collections group related recordings, such as multi-channel captures:

```typescript
import { SigMFCollection, SigMFRecording } from 'sigmf';

// Create a collection
const collection = new SigMFCollection({
  description: 'Phased array capture - 4 channels',
  author: 'Jane Doe <jane@example.com>',
  extensions: [
    { name: 'antenna', version: '1.0.0', optional: true },
  ],
});

// Add extension fields to the collection
collection.setExtensionField('antenna:hagl', 120);
collection.setExtensionField('antenna:azimuth_angle', 45);

// Add recordings (computes SHA-512 hash of metadata)
const recording0 = new SigMFRecording({ datatype: 'cf32_le', sampleRate: 1e6 });
recording0.setCollection('my-collection');  // Link back to collection
await collection.addRecording('channel-0', recording0.toJSON());

const recording1 = new SigMFRecording({ datatype: 'cf32_le', sampleRate: 1e6 });
recording1.setCollection('my-collection');
await collection.addRecording('channel-1', recording1.toJSON());

// Validate and serialize
const result = collection.validate();
const json = collection.toJSON();
// Save as my-collection.sigmf-collection

// Parse existing collection
const loaded = SigMFCollection.fromJSON(json);
for (const stream of loaded.getStreams()) {
  console.log('Recording:', stream.name, 'Hash:', stream.hash);
}
```

### Using Extensions

Extensions allow custom metadata fields:

```typescript
import { 
  SigMFRecording,
  registerExtension,
  registerCommonExtensions,
  validateExtensionDeclarations,
  validateExtensionFields,
  getUnsupportedRequiredExtensions,
  createExtensionDeclaration,
  ANTENNA_EXTENSION,
} from 'sigmf';

// Register common extensions (antenna, capture_details)
registerCommonExtensions();

// Or register custom extension
registerExtension({
  name: 'custom',
  version: '1.0.0',
  description: 'My custom extension',
  globalFields: [
    { name: 'my_field', required: false, type: 'string' },
  ],
  captureFields: [
    { name: 'capture_field', required: false, type: 'number' },
  ],
});

// Use extensions in recordings
const recording = new SigMFRecording({
  datatype: 'cf32_le',
  extensions: [
    createExtensionDeclaration('antenna', '1.0.0', true),
  ],
});

// Set extension fields
recording.setExtensionField('antenna:gain', 10);
recording.setExtensionField('antenna:model', 'Discone');

// Validate extension usage
const metadata = recording.toMetadata();
const declErrors = validateExtensionDeclarations(metadata);
const fieldErrors = validateExtensionFields(metadata);

// Check if required extensions are supported
const supported = new Set(['antenna', 'capture_details']);
const unsupported = getUnsupportedRequiredExtensions(metadata, supported);
if (unsupported.length > 0) {
  console.error('Cannot process: unsupported required extensions:', unsupported);
}
```

### Non-Conforming Datasets

For existing data files that don't follow SigMF naming conventions:

```typescript
import { SigMFRecording } from 'sigmf';

// Describe an existing .dat file with headers
const recording = new SigMFRecording({
  datatype: 'ci16_le',
  sampleRate: 10e6,
  nonConforming: {
    dataset: 'legacy-capture.dat',  // Actual filename
    trailingBytes: 256,             // Footer to ignore
  },
});

// Add captures with header_bytes for per-segment headers
recording.addCapture({
  sampleStart: 0,
  headerBytes: 512,  // Skip 512-byte header
  frequency: 915e6,
});

recording.addCapture({
  sampleStart: 10000,
  headerBytes: 64,  // Each segment has a 64-byte header
});

// Check if recording is non-conforming
if (recording.isNonConforming()) {
  console.log('Dataset file:', recording.getDatasetFilename());
  console.log('Trailing bytes:', recording.getTrailingBytes());
}

// Metadata-only recordings (no data file)
const metaOnly = new SigMFRecording({
  datatype: 'cf32_le',
  description: 'Template for future captures',
  nonConforming: { dataset: '', metadataOnly: true },
});
metaOnly.setMetadataOnly(true);
```

## API Reference

### SigMFRecording

Main class for working with SigMF metadata.

```typescript
// Constructor
new SigMFRecording(options: {
  datatype: SigMFDatatype;
  version?: string;           // Default: '1.2.0'
  sampleRate?: number;
  author?: string;
  description?: string;
  hw?: string;
  license?: string;
  numChannels?: number;
  recorder?: string;
  geolocation?: GeoJSONPoint;
  extensions?: SigMFExtension[];
  nonConforming?: NonConformingOptions;
})

// Static methods
SigMFRecording.fromJSON(input: string | SigMFMetadata): SigMFRecording
SigMFRecording.fromMetadata(metadata: SigMFMetadata): SigMFRecording

// Instance methods
recording.addCapture(capture: { sampleStart, datetime?, frequency?, headerBytes?, ... }): void
recording.addAnnotation(annotation: { sampleStart, sampleCount?, label?, ... }): void
recording.validate(): ValidationResult
recording.toJSON(pretty?: boolean): string
recording.toMetadata(): SigMFMetadata
recording.getDatatypeInfo(): DatatypeInfo
recording.getSampleRate(): number | undefined
recording.setSampleRate(rate: number): void
recording.getNumChannels(): number
recording.setSha512(hash: string): void
recording.getSha512(): string | undefined
recording.calculateDataSize(sampleCount: number): number

// Extension support
recording.addExtension(ext: SigMFExtension): void
recording.getExtensions(): SigMFExtension[]
recording.setExtensionField(key: string, value: unknown): void
recording.getExtensionField(key: string): unknown

// Collection support
recording.setCollection(name: string): void
recording.getCollection(): string | undefined

// Non-Conforming Dataset support
recording.isNonConforming(): boolean
recording.isMetadataOnly(): boolean
recording.setDatasetFilename(filename: string): void
recording.getDatasetFilename(): string | undefined
recording.setTrailingBytes(bytes: number): void
recording.getTrailingBytes(): number | undefined
recording.setMetadataOnly(flag: boolean): void
```

### SigMFCollection

Class for working with SigMF Collection files:

```typescript
// Constructor
new SigMFCollection(options?: {
  version?: string;
  description?: string;
  author?: string;
  collectionDoi?: string;
  license?: string;
  extensions?: SigMFExtension[];
})

// Static methods
SigMFCollection.fromJSON(input: string | SigMFCollectionMetadata): SigMFCollection

// Instance methods
collection.getStreams(): SigMFRecordingRef[]
collection.addRecording(name: string, metadataJson: string): Promise<void>
collection.addRecordingRef(ref: SigMFRecordingRef): void
collection.removeRecording(name: string): boolean
collection.findRecording(name: string): SigMFRecordingRef | undefined
collection.setExtensionField(key: string, value: unknown): void
collection.getExtensionField(key: string): unknown
collection.validate(): ValidationResult
collection.toJSON(pretty?: boolean): string
collection.toMetadata(): SigMFCollectionMetadata
```

### Extension Functions

```typescript
// Registry management
registerExtension(definition: ExtensionDefinition): void
unregisterExtension(name: string): boolean
getExtension(name: string): ExtensionDefinition | undefined
getAllExtensions(): ExtensionDefinition[]
clearExtensions(): void
hasExtension(name: string): boolean

// Field key utilities
getNamespace(key: string): string | undefined
getFieldName(key: string): string
createFieldKey(namespace: string, fieldName: string): string

// Validation
getUsedExtensions(metadata: SigMFMetadata): Set<string>
validateExtensionDeclarations(metadata: SigMFMetadata): ValidationError[]
validateExtensionFields(metadata: SigMFMetadata): ValidationError[]
getUnsupportedRequiredExtensions(metadata, supported: Set<string>): string[]

// Helpers
createExtensionDeclaration(name: string, version: string, optional?: boolean): SigMFExtension
registerCommonExtensions(): void  // Registers antenna, capture_details

// Pre-defined extensions
ANTENNA_EXTENSION: ExtensionDefinition
CAPTURE_DETAILS_EXTENSION: ExtensionDefinition
```

### Sample Functions

```typescript
// Reading
readSamples(buffer: ArrayBuffer, datatype: string, options?: ReadSamplesOptions): SampleData
readSamplesFromBlob(source: Blob, datatype: string, options?, onProgress?): Promise<SampleData>
streamSamples(source: Blob, datatype: string, chunkSamples?): AsyncGenerator<SampleData>

// Writing
writeSamples(samples: number[], datatype: string): Uint8Array
writeSamplesComplex(samples: ComplexSample[], datatype: string): Uint8Array

// Utilities
getComplexSample(data: Float64Array, index: number): ComplexSample
magnitude(sample: ComplexSample): number
phase(sample: ComplexSample): number
magnitudes(complex: Float64Array): Float64Array
phases(complex: Float64Array): Float64Array
deinterleave(complex: Float64Array): { i: Float64Array, q: Float64Array }
interleave(i: Float64Array, q: Float64Array): Float64Array
```

### Archive Functions

```typescript
readArchive(source: Blob): Promise<ArchiveEntry[]>
streamArchive(source: Blob): AsyncGenerator<ArchiveEntry>
createArchive(recordings: ArchiveOptions[], archiveName?: string): Blob
createArchiveFromRecording(recording: SigMFRecording, data: Uint8Array, name: string): Blob
downloadBlob(blob: Blob, filename: string): void
downloadRecording(recording: SigMFRecording, data: Uint8Array, baseName: string): void
```

### Hash Functions

```typescript
sha512(data: ArrayBuffer | Uint8Array | Blob): Promise<string>
verifySha512(data: ArrayBuffer | Uint8Array | Blob, expectedHash: string): Promise<boolean>
sha512Streaming(file: Blob, onProgress?): Promise<string>
verifyHashDetailed(data, expectedHash): Promise<HashVerificationResult>
```

## Supported Datatypes

| Datatype | Description | Bytes/Sample |
|----------|-------------|--------------|
| `cf32_le` | Complex float32, little-endian | 8 |
| `cf32_be` | Complex float32, big-endian | 8 |
| `cf64_le` | Complex float64, little-endian | 16 |
| `cf64_be` | Complex float64, big-endian | 16 |
| `ci32_le` | Complex int32, little-endian | 8 |
| `ci16_le` | Complex int16, little-endian | 4 |
| `cu16_le` | Complex uint16, little-endian | 4 |
| `ci8` | Complex int8 | 2 |
| `cu8` | Complex uint8 (RTL-SDR) | 2 |
| `rf32_le` | Real float32, little-endian | 4 |
| `ri16_le` | Real int16, little-endian | 2 |
| ... | (and all other combinations) | ... |

## Browser Compatibility

- Chrome 76+
- Firefox 69+
- Safari 14.1+
- Edge 79+

Requires support for:
- `File.arrayBuffer()`
- `File.stream()` (for streaming API)
- `crypto.subtle` (for SHA-512)

## Limitations

- Maximum file size ~2GB (browser memory limit)
- SHA-512 streaming requires loading entire file (Web Crypto limitation)

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Lint
npm run lint

# Format
npm run format
```

## License

MIT © 2026

## See Also

- [SigMF Specification](https://github.com/sigmf/SigMF)
- [SigMF Schema](https://github.com/sigmf/SigMF/blob/main/sigmf-schema.json)
