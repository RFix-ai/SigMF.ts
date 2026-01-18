import { describe, it, expect } from 'vitest';
import {
  SigMFRecording,
  parseDatatype,
  SIGMF_VERSION,
} from '../src/metadata.js';

describe('parseDatatype', () => {
  it('should parse complex float32 little-endian', () => {
    const info = parseDatatype('cf32_le');
    expect(info.isComplex).toBe(true);
    expect(info.format).toBe('float');
    expect(info.signed).toBe(true);
    expect(info.bitsPerComponent).toBe(32);
    expect(info.bytesPerComponent).toBe(4);
    expect(info.bytesPerSample).toBe(8);
    expect(info.littleEndian).toBe(true);
  });

  it('should parse complex float64 big-endian', () => {
    const info = parseDatatype('cf64_be');
    expect(info.isComplex).toBe(true);
    expect(info.format).toBe('float');
    expect(info.bitsPerComponent).toBe(64);
    expect(info.bytesPerSample).toBe(16);
    expect(info.littleEndian).toBe(false);
  });

  it('should parse real int16 little-endian', () => {
    const info = parseDatatype('ri16_le');
    expect(info.isComplex).toBe(false);
    expect(info.format).toBe('int');
    expect(info.signed).toBe(true);
    expect(info.bitsPerComponent).toBe(16);
    expect(info.bytesPerSample).toBe(2);
    expect(info.littleEndian).toBe(true);
  });

  it('should parse complex unsigned 8-bit (no endianness)', () => {
    const info = parseDatatype('cu8');
    expect(info.isComplex).toBe(true);
    expect(info.format).toBe('int');
    expect(info.signed).toBe(false);
    expect(info.bitsPerComponent).toBe(8);
    expect(info.bytesPerSample).toBe(2);
    expect(info.littleEndian).toBeUndefined();
  });

  it('should parse real signed 8-bit', () => {
    const info = parseDatatype('ri8');
    expect(info.isComplex).toBe(false);
    expect(info.signed).toBe(true);
    expect(info.bytesPerSample).toBe(1);
  });

  it('should throw for invalid datatype', () => {
    expect(() => parseDatatype('invalid')).toThrow('Invalid datatype');
    expect(() => parseDatatype('cf128_le')).toThrow('Invalid datatype');
    expect(() => parseDatatype('cx32_le')).toThrow('Invalid datatype'); // Invalid format
  });
});

describe('SigMFRecording', () => {
  describe('constructor', () => {
    it('should create a recording with required fields', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      expect(recording.global['core:datatype']).toBe('cf32_le');
      expect(recording.global['core:version']).toBe(SIGMF_VERSION);
      expect(recording.captures).toEqual([]);
      expect(recording.annotations).toEqual([]);
    });

    it('should create a recording with optional fields', () => {
      const recording = new SigMFRecording({
        datatype: 'cf32_le',
        sampleRate: 2.4e6,
        author: 'Test Author',
        description: 'Test description',
        hw: 'RTL-SDR',
        license: 'https://creativecommons.org/licenses/by/4.0/',
        numChannels: 2,
        recorder: 'sigmf-ts',
      });

      expect(recording.global['core:sample_rate']).toBe(2.4e6);
      expect(recording.global['core:author']).toBe('Test Author');
      expect(recording.global['core:description']).toBe('Test description');
      expect(recording.global['core:hw']).toBe('RTL-SDR');
      expect(recording.global['core:license']).toBe('https://creativecommons.org/licenses/by/4.0/');
      expect(recording.global['core:num_channels']).toBe(2);
      expect(recording.global['core:recorder']).toBe('sigmf-ts');
    });
  });

  describe('fromJSON', () => {
    it('should parse valid JSON string', () => {
      const json = JSON.stringify({
        global: {
          'core:datatype': 'cf32_le',
          'core:version': '1.2.0',
          'core:sample_rate': 1e6,
        },
        captures: [{ 'core:sample_start': 0 }],
        annotations: [],
      });

      const recording = SigMFRecording.fromJSON(json);
      expect(recording.global['core:datatype']).toBe('cf32_le');
      expect(recording.global['core:sample_rate']).toBe(1e6);
      expect(recording.captures).toHaveLength(1);
    });

    it('should parse valid object', () => {
      const recording = SigMFRecording.fromJSON({
        global: {
          'core:datatype': 'ri16_le',
          'core:version': '1.2.0',
        },
        captures: [],
        annotations: [],
      });

      expect(recording.global['core:datatype']).toBe('ri16_le');
    });

    it('should throw for missing global', () => {
      expect(() => SigMFRecording.fromJSON('{}' as string)).toThrow('missing or invalid global');
    });

    it('should throw for missing datatype', () => {
      expect(() =>
        SigMFRecording.fromJSON({
          global: { 'core:version': '1.2.0' },
          captures: [],
          annotations: [],
        } as unknown as string)
      ).toThrow('missing required field core:datatype');
    });
  });

  describe('addCapture', () => {
    it('should add a capture segment', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      recording.addCapture({
        sampleStart: 0,
        frequency: 100e6,
        datetime: '2026-01-15T12:00:00Z',
      });

      expect(recording.captures).toHaveLength(1);
      expect(recording.captures[0]['core:sample_start']).toBe(0);
      expect(recording.captures[0]['core:frequency']).toBe(100e6);
      expect(recording.captures[0]['core:datetime']).toBe('2026-01-15T12:00:00Z');
    });

    it('should sort captures by sample_start', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      recording.addCapture({ sampleStart: 1000 });
      recording.addCapture({ sampleStart: 0 });
      recording.addCapture({ sampleStart: 500 });

      expect(recording.captures.map((c) => c['core:sample_start'])).toEqual([0, 500, 1000]);
    });
  });

  describe('addAnnotation', () => {
    it('should add an annotation', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      recording.addAnnotation({
        sampleStart: 100,
        sampleCount: 500,
        label: 'Signal',
        freqLowerEdge: 99e6,
        freqUpperEdge: 101e6,
      });

      expect(recording.annotations).toHaveLength(1);
      expect(recording.annotations[0]['core:sample_start']).toBe(100);
      expect(recording.annotations[0]['core:sample_count']).toBe(500);
      expect(recording.annotations[0]['core:label']).toBe('Signal');
    });

    it('should sort annotations by sample_start', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      recording.addAnnotation({ sampleStart: 500 });
      recording.addAnnotation({ sampleStart: 100 });

      expect(recording.annotations.map((a) => a['core:sample_start'])).toEqual([100, 500]);
    });
  });

  describe('validate', () => {
    it('should pass for valid recording', () => {
      const recording = new SigMFRecording({
        datatype: 'cf32_le',
        sampleRate: 2.4e6,
      });
      recording.addCapture({ sampleStart: 0 });

      const result = recording.validate();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail for invalid datatype', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      recording.global['core:datatype'] = 'invalid' as 'cf32_le';

      const result = recording.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === 'global.core:datatype')).toBe(true);
    });

    it('should fail for invalid sample rate', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le', sampleRate: -1 });

      const result = recording.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === 'global.core:sample_rate')).toBe(true);
    });

    it('should fail for sample rate exceeding maximum', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le', sampleRate: 2e12 });

      const result = recording.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === 'global.core:sample_rate')).toBe(true);
    });

    it('should fail for invalid SHA-512 hash', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      recording.setSha512('invalid');

      const result = recording.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === 'global.core:sha512')).toBe(true);
    });

    it('should fail for unsorted captures', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      recording.captures = [{ 'core:sample_start': 100 }, { 'core:sample_start': 50 }];

      const result = recording.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('sorted'))).toBe(true);
    });

    it('should fail for invalid datetime format', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      recording.addCapture({ sampleStart: 0, datetime: '2026-01-15' });

      const result = recording.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path.includes('datetime'))).toBe(true);
    });

    it('should fail for mismatched frequency edges', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      recording.annotations = [{ 'core:sample_start': 0, 'core:freq_lower_edge': 100e6 }];

      const result = recording.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('freq_lower_edge'))).toBe(true);
    });

    it('should fail for invalid UUID', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      recording.annotations = [{ 'core:sample_start': 0, 'core:uuid': 'not-a-uuid' }];

      const result = recording.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path.includes('uuid'))).toBe(true);
    });

    it('should validate GeoJSON', () => {
      const recording = new SigMFRecording({
        datatype: 'cf32_le',
        geolocation: { type: 'Point', coordinates: [200, 0] }, // Invalid longitude
      });

      const result = recording.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('longitude'))).toBe(true);
    });
  });

  describe('toJSON', () => {
    it('should serialize to JSON string', () => {
      const recording = new SigMFRecording({
        datatype: 'cf32_le',
        sampleRate: 1e6,
      });
      recording.addCapture({ sampleStart: 0 });

      const json = recording.toJSON();
      const parsed = JSON.parse(json);

      expect(parsed.global['core:datatype']).toBe('cf32_le');
      expect(parsed.global['core:sample_rate']).toBe(1e6);
      expect(parsed.captures).toHaveLength(1);
    });

    it('should support non-pretty output', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      const json = recording.toJSON(false);
      expect(json).not.toContain('\n');
    });
  });

  describe('getDatatypeInfo', () => {
    it('should return datatype info', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      const info = recording.getDatatypeInfo();
      expect(info.isComplex).toBe(true);
      expect(info.bytesPerSample).toBe(8);
    });
  });

  describe('getSampleRate and setSampleRate', () => {
    it('should get undefined when sample rate is not set', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      expect(recording.getSampleRate()).toBeUndefined();
    });

    it('should get the sample rate when set via constructor', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le', sampleRate: 2.4e6 });
      expect(recording.getSampleRate()).toBe(2.4e6);
    });

    it('should set and get sample rate', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      recording.setSampleRate(1e6);
      expect(recording.getSampleRate()).toBe(1e6);
    });
  });

  describe('calculateDataSize', () => {
    it('should calculate data size for single channel', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      expect(recording.calculateDataSize(1000)).toBe(8000); // 1000 samples * 8 bytes
    });

    it('should calculate data size for multiple channels', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le', numChannels: 2 });
      expect(recording.calculateDataSize(1000)).toBe(16000); // 1000 samples * 8 bytes * 2 channels
    });
  });

  describe('Non-Conforming Dataset support', () => {
    it('should create recording with NCD options', () => {
      const recording = new SigMFRecording({
        datatype: 'cf32_le',
        nonConforming: {
          dataset: 'my-data.bin',
          trailingBytes: 100,
        },
      });

      expect(recording.global['core:dataset']).toBe('my-data.bin');
      expect(recording.global['core:trailing_bytes']).toBe(100);
    });

    it('should detect non-conforming recording', () => {
      const conforming = new SigMFRecording({ datatype: 'cf32_le' });
      expect(conforming.isNonConforming()).toBe(false);

      const ncd = new SigMFRecording({
        datatype: 'cf32_le',
        nonConforming: { dataset: 'data.bin' },
      });
      expect(ncd.isNonConforming()).toBe(true);
    });

    it('should detect non-conforming by header_bytes', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      recording.addCapture({ sampleStart: 0, headerBytes: 512 });
      expect(recording.isNonConforming()).toBe(true);
    });

    it('should handle metadata-only recordings', () => {
      const recording = new SigMFRecording({
        datatype: 'cf32_le',
        nonConforming: { dataset: '', metadataOnly: true },
      });

      expect(recording.isMetadataOnly()).toBe(true);
    });

    it('should set and get dataset filename', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      recording.setDatasetFilename('custom.dat');
      expect(recording.getDatasetFilename()).toBe('custom.dat');
    });

    it('should set and get trailing bytes', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      recording.setTrailingBytes(256);
      expect(recording.getTrailingBytes()).toBe(256);
    });

    it('should set and get metadata-only flag', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      recording.setMetadataOnly(true);
      expect(recording.isMetadataOnly()).toBe(true);
    });
  });

  describe('Extension support', () => {
    it('should create recording with extensions', () => {
      const recording = new SigMFRecording({
        datatype: 'cf32_le',
        extensions: [
          { name: 'antenna', version: '1.0.0', optional: true },
        ],
      });

      expect(recording.getExtensions()).toHaveLength(1);
      expect(recording.getExtensions()[0].name).toBe('antenna');
    });

    it('should add extension declarations', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      recording.addExtension({ name: 'antenna', version: '1.0.0', optional: true });
      recording.addExtension({ name: 'capture_details', version: '1.0.0', optional: false });

      expect(recording.getExtensions()).toHaveLength(2);
    });

    it('should not duplicate extension declarations', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      recording.addExtension({ name: 'antenna', version: '1.0.0', optional: true });
      recording.addExtension({ name: 'antenna', version: '2.0.0', optional: true }); // Duplicate

      expect(recording.getExtensions()).toHaveLength(1);
    });

    it('should set and get extension fields', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      recording.setExtensionField('antenna:gain', 10);
      recording.setExtensionField('antenna:model', 'Discone');

      expect(recording.getExtensionField('antenna:gain')).toBe(10);
      expect(recording.getExtensionField('antenna:model')).toBe('Discone');
    });

    it('should throw for invalid extension field format', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      expect(() => recording.setExtensionField('invalid', 123)).toThrow('namespace:name format');
    });
  });

  describe('Collection support', () => {
    it('should set and get collection name', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      recording.setCollection('my-collection');
      expect(recording.getCollection()).toBe('my-collection');
    });
  });

  describe('additional validation edge cases', () => {
    it('should fail for invalid version format', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      recording.global['core:version'] = 'invalid';

      const result = recording.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path.includes('version'))).toBe(true);
    });

    it('should fail for non-integer num_channels', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      recording.global['core:num_channels'] = 1.5;

      const result = recording.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path.includes('num_channels'))).toBe(true);
    });

    it('should fail for negative num_channels', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      recording.global['core:num_channels'] = -1;

      const result = recording.validate();
      expect(result.valid).toBe(false);
    });

    it('should fail for non-integer offset', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      recording.global['core:offset'] = 1.5;

      const result = recording.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path.includes('offset'))).toBe(true);
    });

    it('should fail for negative offset', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      recording.global['core:offset'] = -10;

      const result = recording.validate();
      expect(result.valid).toBe(false);
    });

    it('should fail for SHA-512 with non-hex characters', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      recording.global['core:sha512'] = 'g'.repeat(128); // g is not hex

      const result = recording.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('hex'))).toBe(true);
    });

    it('should fail for missing capture sample_start', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      recording.captures = [{ 'core:sample_start': undefined as unknown as number }];

      const result = recording.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path.includes('sample_start'))).toBe(true);
    });

    it('should fail for non-integer capture sample_start', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      recording.captures = [{ 'core:sample_start': 1.5 }];

      const result = recording.validate();
      expect(result.valid).toBe(false);
    });

    it('should fail for negative capture sample_start', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      recording.captures = [{ 'core:sample_start': -100 }];

      const result = recording.validate();
      expect(result.valid).toBe(false);
    });

    it('should fail for frequency exceeding maximum', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      recording.addCapture({ sampleStart: 0, frequency: 2e12 }); // Exceeds 1 THz

      const result = recording.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path.includes('frequency'))).toBe(true);
    });

    it('should fail for missing annotation sample_start', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      recording.annotations = [{ 'core:sample_start': undefined as unknown as number }];

      const result = recording.validate();
      expect(result.valid).toBe(false);
    });

    it('should fail for non-integer annotation sample_start', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      recording.annotations = [{ 'core:sample_start': 1.5 }];

      const result = recording.validate();
      expect(result.valid).toBe(false);
    });

    it('should fail for negative annotation sample_start', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      recording.annotations = [{ 'core:sample_start': -50 }];

      const result = recording.validate();
      expect(result.valid).toBe(false);
    });

    it('should fail for unsorted annotations', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      recording.annotations = [
        { 'core:sample_start': 500 },
        { 'core:sample_start': 100 },
      ];

      const result = recording.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('sorted'))).toBe(true);
    });

    it('should fail for non-integer sample_count', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      recording.annotations = [{ 'core:sample_start': 0, 'core:sample_count': 1.5 }];

      const result = recording.validate();
      expect(result.valid).toBe(false);
    });

    it('should fail for negative sample_count', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      recording.annotations = [{ 'core:sample_start': 0, 'core:sample_count': -100 }];

      const result = recording.validate();
      expect(result.valid).toBe(false);
    });

    it('should fail for freq_lower_edge > freq_upper_edge', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      recording.annotations = [{
        'core:sample_start': 0,
        'core:freq_lower_edge': 200e6,
        'core:freq_upper_edge': 100e6, // Lower than lower edge
      }];

      const result = recording.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('freq_lower_edge'))).toBe(true);
    });

    it('should fail for non-number freq_lower_edge', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      recording.annotations = [{
        'core:sample_start': 0,
        'core:freq_lower_edge': 'not a number' as unknown as number,
        'core:freq_upper_edge': 100e6,
      }];

      const result = recording.validate();
      expect(result.valid).toBe(false);
    });

    it('should fail for non-number freq_upper_edge', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      recording.annotations = [{
        'core:sample_start': 0,
        'core:freq_lower_edge': 100e6,
        'core:freq_upper_edge': 'not a number' as unknown as number,
      }];

      const result = recording.validate();
      expect(result.valid).toBe(false);
    });

    it('should validate GeoJSON with invalid type', () => {
      const recording = new SigMFRecording({
        datatype: 'cf32_le',
        geolocation: { type: 'LineString' as 'Point', coordinates: [0, 0] },
      });

      const result = recording.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('Point'))).toBe(true);
    });

    it('should validate GeoJSON with non-array coordinates', () => {
      const recording = new SigMFRecording({
        datatype: 'cf32_le',
        geolocation: { type: 'Point', coordinates: 'invalid' as unknown as [number, number] },
      });

      const result = recording.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('array'))).toBe(true);
    });

    it('should validate GeoJSON with wrong coordinate count', () => {
      const recording = new SigMFRecording({
        datatype: 'cf32_le',
        geolocation: { type: 'Point', coordinates: [0] as unknown as [number, number] },
      });

      const result = recording.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('2 or 3 elements'))).toBe(true);
    });

    it('should validate GeoJSON with invalid latitude', () => {
      const recording = new SigMFRecording({
        datatype: 'cf32_le',
        geolocation: { type: 'Point', coordinates: [0, 100] }, // latitude > 90
      });

      const result = recording.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('latitude'))).toBe(true);
    });

    it('should validate GeoJSON with non-number altitude', () => {
      const recording = new SigMFRecording({
        datatype: 'cf32_le',
        geolocation: { type: 'Point', coordinates: [0, 0, 'high' as unknown as number] },
      });

      const result = recording.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('altitude'))).toBe(true);
    });

    it('should validate GeoJSON that is not an object', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      recording.global['core:geolocation'] = 'not an object' as unknown;

      const result = recording.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('object'))).toBe(true);
    });

    it('should validate GeoJSON in capture segment', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      recording.captures = [{
        'core:sample_start': 0,
        'core:geolocation': { type: 'Point', coordinates: [200, 0] }, // Invalid longitude
      }];

      const result = recording.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('longitude'))).toBe(true);
    });

    it('should pass validation for valid 3D GeoJSON', () => {
      const recording = new SigMFRecording({
        datatype: 'cf32_le',
        geolocation: { type: 'Point', coordinates: [-122.4194, 37.7749, 100] },
      });

      const result = recording.validate();
      expect(result.valid).toBe(true);
    });
  });

  describe('fromJSON edge cases', () => {
    it('should throw for missing version', () => {
      expect(() =>
        SigMFRecording.fromJSON({
          global: { 'core:datatype': 'cf32_le' },
          captures: [],
          annotations: [],
        } as unknown as string)
      ).toThrow('missing required field core:version');
    });

    it('should parse recording without captures or annotations arrays', () => {
      const recording = SigMFRecording.fromJSON({
        global: {
          'core:datatype': 'cf32_le',
          'core:version': '1.2.0',
        },
      } as unknown as string);

      expect(recording.captures).toEqual([]);
      expect(recording.annotations).toEqual([]);
    });
  });

  describe('fromMetadata', () => {
    it('should create recording from metadata object', () => {
      const metadata = {
        global: {
          'core:datatype': 'ri16_le' as const,
          'core:version': '1.2.0',
          'core:sample_rate': 500000,
        },
        captures: [{ 'core:sample_start': 0 }],
        annotations: [{ 'core:sample_start': 100, 'core:label': 'Test' }],
      };

      const recording = SigMFRecording.fromMetadata(metadata);
      
      expect(recording.global['core:datatype']).toBe('ri16_le');
      expect(recording.global['core:sample_rate']).toBe(500000);
      expect(recording.captures).toHaveLength(1);
      expect(recording.annotations).toHaveLength(1);
    });
  });

  describe('addCapture with all options', () => {
    it('should add capture with globalIndex', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      recording.addCapture({
        sampleStart: 0,
        globalIndex: 1000000,
      });

      expect(recording.captures[0]['core:global_index']).toBe(1000000);
    });

    it('should add capture with geolocation', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      recording.addCapture({
        sampleStart: 0,
        geolocation: { type: 'Point', coordinates: [-122.4194, 37.7749] },
      });

      expect(recording.captures[0]['core:geolocation']).toBeDefined();
    });
  });

  describe('addAnnotation with all options', () => {
    it('should add annotation with comment', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      recording.addAnnotation({
        sampleStart: 0,
        comment: 'This is a comment',
      });

      expect(recording.annotations[0]['core:comment']).toBe('This is a comment');
    });

    it('should add annotation with generator', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      recording.addAnnotation({
        sampleStart: 0,
        generator: 'manual',
      });

      expect(recording.annotations[0]['core:generator']).toBe('manual');
    });

    it('should add annotation with uuid', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      recording.addAnnotation({
        sampleStart: 0,
        uuid: '550e8400-e29b-41d4-a716-446655440000',
      });

      expect(recording.annotations[0]['core:uuid']).toBe('550e8400-e29b-41d4-a716-446655440000');
    });
  });

  describe('getSha512', () => {
    it('should return undefined when sha512 is not set', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      expect(recording.getSha512()).toBeUndefined();
    });

    it('should return the hash when set', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      const hash = 'a'.repeat(128);
      recording.setSha512(hash);
      expect(recording.getSha512()).toBe(hash);
    });
  });

  describe('validation missing required fields', () => {
    it('should fail for missing core:datatype', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      delete (recording.global as any)['core:datatype'];

      const result = recording.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message === 'is required' && e.path === 'global.core:datatype')).toBe(true);
    });

    it('should fail for missing core:version', () => {
      const recording = new SigMFRecording({ datatype: 'cf32_le' });
      delete (recording.global as any)['core:version'];

      const result = recording.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message === 'is required' && e.path === 'global.core:version')).toBe(true);
    });
  });
});
