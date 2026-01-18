/**
 * Index Export Tests
 *
 * This test file ensures that all exports from index.ts are accessible,
 * which is important for coverage reporting.
 */

import { describe, it, expect } from 'vitest';

// Import everything from the main entry point
import {
  // Types (these are type-only, so we import them as values where possible)
  DATATYPE_PATTERN,

  // Metadata
  SigMFRecording,
  parseDatatype,
  SIGMF_VERSION,

  // Collection
  SigMFCollection,

  // Extensions
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

  // Samples
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

  // Archive
  readArchive,
  streamArchive,
  createArchive,
  createArchiveFromRecording,
  prepareFiles,
  downloadBlob,
  downloadRecording,

  // Hash
  sha512,
  verifySha512,
  sha512Streaming,
  verifyHashDetailed,
} from '../src/index.js';

describe('Index Exports', () => {
  it('should export DATATYPE_PATTERN', () => {
    expect(DATATYPE_PATTERN).toBeInstanceOf(RegExp);
    expect('cf32_le').toMatch(DATATYPE_PATTERN);
  });

  it('should export SIGMF_VERSION', () => {
    expect(SIGMF_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('should export SigMFRecording class', () => {
    const recording = new SigMFRecording({ datatype: 'cf32_le' });
    expect(recording).toBeInstanceOf(SigMFRecording);
  });

  it('should export SigMFCollection class', () => {
    const collection = new SigMFCollection();
    expect(collection).toBeInstanceOf(SigMFCollection);
  });

  it('should export parseDatatype function', () => {
    const info = parseDatatype('cf32_le');
    expect(info.isComplex).toBe(true);
  });

  it('should export extension functions', () => {
    expect(typeof registerExtension).toBe('function');
    expect(typeof unregisterExtension).toBe('function');
    expect(typeof getExtension).toBe('function');
    expect(typeof getAllExtensions).toBe('function');
    expect(typeof clearExtensions).toBe('function');
    expect(typeof hasExtension).toBe('function');
    expect(typeof getNamespace).toBe('function');
    expect(typeof getFieldName).toBe('function');
    expect(typeof createFieldKey).toBe('function');
    expect(typeof getUsedExtensions).toBe('function');
    expect(typeof validateExtensionDeclarations).toBe('function');
    expect(typeof validateExtensionFields).toBe('function');
    expect(typeof getUnsupportedRequiredExtensions).toBe('function');
    expect(typeof createExtensionDeclaration).toBe('function');
    expect(typeof registerCommonExtensions).toBe('function');
  });

  it('should export ANTENNA_EXTENSION definition', () => {
    expect(ANTENNA_EXTENSION.name).toBe('antenna');
  });

  it('should export CAPTURE_DETAILS_EXTENSION definition', () => {
    expect(CAPTURE_DETAILS_EXTENSION.name).toBe('capture_details');
  });

  it('should export sample functions', () => {
    expect(typeof readSamples).toBe('function');
    expect(typeof readSamplesFromBlob).toBe('function');
    expect(typeof writeSamples).toBe('function');
    expect(typeof writeSamplesComplex).toBe('function');
    expect(typeof streamSamples).toBe('function');
    expect(typeof getComplexSample).toBe('function');
    expect(typeof magnitude).toBe('function');
    expect(typeof phase).toBe('function');
    expect(typeof magnitudes).toBe('function');
    expect(typeof phases).toBe('function');
    expect(typeof deinterleave).toBe('function');
    expect(typeof interleave).toBe('function');
  });

  it('should export archive functions', () => {
    expect(typeof readArchive).toBe('function');
    expect(typeof streamArchive).toBe('function');
    expect(typeof createArchive).toBe('function');
    expect(typeof createArchiveFromRecording).toBe('function');
    expect(typeof prepareFiles).toBe('function');
    expect(typeof downloadBlob).toBe('function');
    expect(typeof downloadRecording).toBe('function');
  });

  it('should export hash functions', () => {
    expect(typeof sha512).toBe('function');
    expect(typeof verifySha512).toBe('function');
    expect(typeof sha512Streaming).toBe('function');
    expect(typeof verifyHashDetailed).toBe('function');
  });
});
