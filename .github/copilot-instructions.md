# SigMF.ts Copilot Instructions

## Project Overview

TypeScript library for reading/writing [SigMF](https://github.com/sigmf/SigMF) (Signal Metadata Format) files. Browser-first design, no Node.js dependencies.

## Structure

```
src/
├── index.ts        # Public API exports
├── metadata.ts     # SigMFRecording class - metadata parsing/validation
├── samples.ts      # IQ sample reading/writing (all 20+ datatypes)
├── archive.ts      # TAR archive creation/reading (.sigmf files)
├── collection.ts   # SigMFCollection for multi-recording groups
├── extensions.ts   # SigMF extension framework
├── hash.ts         # SHA-512 verification (Web Crypto)
└── types.ts        # TypeScript interfaces and type definitions
```

## Build & Test

```bash
npm install
npm run build       # TypeScript compilation
npm test            # Vitest tests
npm run test:watch  # Watch mode
npm run test:coverage
```

## Key Patterns

### SigMFRecording Class
Main entry point for metadata. See [src/metadata.ts](src/metadata.ts):

```typescript
const recording = new SigMFRecording({
  datatype: 'cf32_le',    // Required: complex float32 little-endian
  sampleRate: 2.4e6,
  description: 'FM capture',
});
recording.addCapture({ sampleStart: 0, frequency: 100e6 });
recording.addAnnotation({ sampleStart: 1000, sampleCount: 5000, label: 'Signal' });
const result = recording.validate();  // Always validate before export
```

### Datatype String Format
Pattern: `[c|r][f|i|u][bits]_[le|be]`
- `c` = complex (I/Q interleaved), `r` = real
- `f` = float, `i` = signed int, `u` = unsigned int
- `_le`/`_be` only for >8 bits
- Examples: `cf32_le`, `ri16_le`, `cu8`

### Sample Operations
```typescript
// Reading
const { complex, sampleCount } = readSamples(buffer, 'cf32_le');
// Writing
const data = writeSamples(iqArray, 'cf32_le');
// Streaming for large files
for await (const chunk of streamSamples(blob, 'cf32_le', 65536)) { ... }
```

## Conventions

- All exports in [src/index.ts](src/index.ts) - re-export from there
- SigMF field names use `core:` prefix (e.g., `core:datatype`, `core:sample_rate`)
- Validation returns `{ valid: boolean, errors: ValidationError[] }`
- ISO-8601 datetime format: `YYYY-MM-DDTHH:MM:SS.SSSZ`
- Hash functions return lowercase hex strings

## Browser Compatibility

Requires:
- `File.arrayBuffer()`, `File.stream()`
- `crypto.subtle` for SHA-512
- Target: Chrome 76+, Firefox 69+, Safari 14.1+

## Dependencies

- **tarts**: TAR archive handling for .sigmf files
