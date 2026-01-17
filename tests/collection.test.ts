/**
 * SigMF Collection Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SigMFCollection } from '../src/collection.js';
import { SigMFRecording } from '../src/metadata.js';

describe('SigMFCollection', () => {
  describe('constructor', () => {
    it('should create a collection with default version', () => {
      const collection = new SigMFCollection();
      expect(collection.collection['core:version']).toBe('1.2.0');
    });

    it('should create a collection with custom options', () => {
      const collection = new SigMFCollection({
        version: '1.0.0',
        description: 'Test collection',
        author: 'Test Author',
        license: 'https://example.com/license',
        collectionDoi: '10.1234/example',
      });

      expect(collection.collection['core:version']).toBe('1.0.0');
      expect(collection.collection['core:description']).toBe('Test collection');
      expect(collection.collection['core:author']).toBe('Test Author');
      expect(collection.collection['core:license']).toBe('https://example.com/license');
      expect(collection.collection['core:collection_doi']).toBe('10.1234/example');
    });

    it('should create a collection with extensions', () => {
      const collection = new SigMFCollection({
        extensions: [
          { name: 'antenna', version: '1.0.0', optional: true },
        ],
      });

      expect(collection.collection['core:extensions']).toHaveLength(1);
      expect(collection.collection['core:extensions']![0].name).toBe('antenna');
    });
  });

  describe('fromJSON', () => {
    it('should parse a collection from JSON string', () => {
      const json = JSON.stringify({
        collection: {
          'core:version': '1.0.0',
          'core:description': 'Parsed collection',
          'core:streams': [
            { name: 'recording-0', hash: 'a'.repeat(128) },
          ],
        },
      });

      const collection = SigMFCollection.fromJSON(json);
      expect(collection.collection['core:version']).toBe('1.0.0');
      expect(collection.collection['core:description']).toBe('Parsed collection');
      expect(collection.getStreams()).toHaveLength(1);
    });

    it('should parse a collection from object', () => {
      const obj = {
        collection: {
          'core:version': '1.2.0',
        },
      };

      const collection = SigMFCollection.fromJSON(obj);
      expect(collection.collection['core:version']).toBe('1.2.0');
    });

    it('should throw for missing collection object', () => {
      expect(() => SigMFCollection.fromJSON('{}')).toThrow('missing or invalid collection object');
    });

    it('should throw for missing version', () => {
      expect(() => SigMFCollection.fromJSON('{"collection":{}}')).toThrow('missing required field core:version');
    });
  });

  describe('recording management', () => {
    let collection: SigMFCollection;

    beforeEach(() => {
      collection = new SigMFCollection({ description: 'Test' });
    });

    it('should add recording references', () => {
      collection.addRecordingRef({ name: 'rec-0', hash: 'a'.repeat(128) });
      collection.addRecordingRef({ name: 'rec-1', hash: 'b'.repeat(128) });

      const streams = collection.getStreams();
      expect(streams).toHaveLength(2);
      expect(streams[0].name).toBe('rec-0');
      expect(streams[1].name).toBe('rec-1');
    });

    it('should add recording with computed hash', async () => {
      const recording = new SigMFRecording({
        datatype: 'cf32_le',
        sampleRate: 1e6,
      });

      await collection.addRecording('test-recording', recording.toJSON());

      const streams = collection.getStreams();
      expect(streams).toHaveLength(1);
      expect(streams[0].name).toBe('test-recording');
      expect(streams[0].hash).toHaveLength(128);
    });

    it('should find recording by name', () => {
      collection.addRecordingRef({ name: 'target', hash: 'c'.repeat(128) });
      collection.addRecordingRef({ name: 'other', hash: 'd'.repeat(128) });

      const found = collection.findRecording('target');
      expect(found).toBeDefined();
      expect(found!.name).toBe('target');

      const notFound = collection.findRecording('missing');
      expect(notFound).toBeUndefined();
    });

    it('should remove recording by name', () => {
      collection.addRecordingRef({ name: 'keep', hash: 'e'.repeat(128) });
      collection.addRecordingRef({ name: 'remove', hash: 'f'.repeat(128) });

      const removed = collection.removeRecording('remove');
      expect(removed).toBe(true);
      expect(collection.getStreams()).toHaveLength(1);
      expect(collection.getStreams()[0].name).toBe('keep');

      const notRemoved = collection.removeRecording('missing');
      expect(notRemoved).toBe(false);
    });
  });

  describe('extension fields', () => {
    it('should set and get extension fields', () => {
      const collection = new SigMFCollection();
      collection.setExtensionField('antenna:hagl', 120);
      collection.setExtensionField('antenna:azimuth_angle', 45.5);

      expect(collection.getExtensionField('antenna:hagl')).toBe(120);
      expect(collection.getExtensionField('antenna:azimuth_angle')).toBe(45.5);
    });

    it('should throw for invalid field format', () => {
      const collection = new SigMFCollection();
      expect(() => collection.setExtensionField('invalid', 123)).toThrow('namespace:name format');
    });
  });

  describe('validation', () => {
    it('should validate a valid collection', () => {
      const collection = new SigMFCollection({
        description: 'Valid collection',
      });
      collection.addRecordingRef({ name: 'rec-0', hash: 'a'.repeat(128) });

      const result = collection.validate();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for missing version', () => {
      const collection = new SigMFCollection();
      collection.collection['core:version'] = '';

      const result = collection.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path.includes('version'))).toBe(true);
    });

    it('should fail validation for invalid hash length', () => {
      const collection = new SigMFCollection();
      collection.addRecordingRef({ name: 'bad', hash: 'short' });

      const result = collection.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('128 hex characters'))).toBe(true);
    });

    it('should fail validation for non-hex hash', () => {
      const collection = new SigMFCollection();
      collection.addRecordingRef({ name: 'bad', hash: 'g'.repeat(128) });

      const result = collection.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('hex characters'))).toBe(true);
    });

    it('should fail validation for missing stream name', () => {
      const collection = new SigMFCollection();
      collection.collection['core:streams'] = [{ name: '', hash: 'a'.repeat(128) }];

      const result = collection.validate();
      expect(result.valid).toBe(false);
    });

    it('should validate extension declarations', () => {
      const collection = new SigMFCollection({
        extensions: [
          { name: 'antenna', version: '1.0.0', optional: true },
        ],
      });

      const result = collection.validate();
      expect(result.valid).toBe(true);
    });

    it('should fail validation for invalid extension declaration', () => {
      const collection = new SigMFCollection();
      collection.collection['core:extensions'] = [
        { name: '', version: '1.0.0', optional: true } as any,
      ];

      const result = collection.validate();
      expect(result.valid).toBe(false);
    });
  });

  describe('serialization', () => {
    it('should serialize to metadata object', () => {
      const collection = new SigMFCollection({ description: 'Test' });
      collection.addRecordingRef({ name: 'rec', hash: 'a'.repeat(128) });

      const metadata = collection.toMetadata();
      expect(metadata.collection).toBeDefined();
      expect(metadata.collection['core:description']).toBe('Test');
      expect(metadata.collection['core:streams']).toHaveLength(1);
    });

    it('should serialize to JSON', () => {
      const collection = new SigMFCollection({ version: '1.0.0' });
      const json = collection.toJSON();
      const parsed = JSON.parse(json);

      expect(parsed.collection['core:version']).toBe('1.0.0');
    });

    it('should serialize without pretty printing', () => {
      const collection = new SigMFCollection();
      const json = collection.toJSON(false);

      expect(json).not.toContain('\n');
    });
  });
});
