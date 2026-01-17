/**
 * SigMF TypeScript Library
 *
 * A browser-first library for reading and writing SigMF (Signal Metadata Format) files.
 *
 * @packageDocumentation
 * @module sigmf
 *
 * @example
 * ```ts
 * import {
 *   SigMFRecording,
 *   readSamples,
 *   writeSamples,
 *   createArchive,
 *   readArchive,
 * } from 'sigmf';
 *
 * // Create a new recording
 * const recording = new SigMFRecording({
 *   datatype: 'cf32_le',
 *   sampleRate: 2.4e6,
 *   description: 'FM radio capture',
 * });
 *
 * recording.addCapture({
 *   sampleStart: 0,
 *   frequency: 100e6,
 *   datetime: new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z'),
 * });
 *
 * // Write samples
 * const samples = writeSamples(myIQData, 'cf32_le');
 *
 * // Create archive
 * const archive = createArchive([{
 *   name: 'my-capture',
 *   metadata: recording.toMetadata(),
 *   data: samples,
 * }]);
 *
 * // Download
 * downloadBlob(archive, 'my-capture.sigmf');
 * ```
 */

// Types
export type {
  SigMFMetadata,
  SigMFGlobal,
  SigMFCapture,
  SigMFAnnotation,
  SigMFDatatype,
  SigMFExtension,
  GeoJSONPoint,
  DatatypeInfo,
  ValidationResult,
  ValidationError,
  ReadSamplesOptions,
  ComplexSample,
  ArchiveEntry,
  ArchiveOptions,
  // Collection types
  SigMFCollectionMetadata,
  SigMFCollectionObject,
  SigMFRecordingRef,
  // Extension types
  ExtensionDefinition,
  ExtensionFieldDef,
  // Non-conforming dataset types
  NonConformingOptions,
  NonConformingCaptureOptions,
} from './types.js';

export { DATATYPE_PATTERN } from './types.js';

// Metadata
export { SigMFRecording, parseDatatype, SIGMF_VERSION } from './metadata.js';

// Collection
export { SigMFCollection } from './collection.js';

// Extensions
export {
  registerExtension,
  unregisterExtension,
  getExtension,
  getAllExtensions,
  clearExtensions,
  hasExtension,
  getNamespace,
  getFieldName,
  createFieldKey,
  getUsedExtensions,
  validateExtensionDeclarations,
  validateExtensionFields,
  getUnsupportedRequiredExtensions,
  createExtensionDeclaration,
  registerCommonExtensions,
  ANTENNA_EXTENSION,
  CAPTURE_DETAILS_EXTENSION,
} from './extensions.js';

// Samples
export {
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
} from './samples.js';

export type { SampleData } from './samples.js';

// Archive
export {
  readArchive,
  streamArchive,
  createArchive,
  createArchiveFromRecording,
  prepareFiles,
  downloadBlob,
  downloadRecording,
} from './archive.js';

// Hash
export {
  sha512,
  verifySha512,
  sha512Streaming,
  verifyHashDetailed,
} from './hash.js';

export type { HashVerificationResult } from './hash.js';
