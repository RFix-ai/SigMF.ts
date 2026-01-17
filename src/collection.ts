/**
 * SigMF Collection Handling
 *
 * Provides the SigMFCollection class for creating and managing collections
 * of related SigMF recordings, such as multi-channel captures.
 */

import {
  SigMFCollectionMetadata,
  SigMFCollectionObject,
  SigMFRecordingRef,
  SigMFExtension,
  ValidationResult,
  ValidationError,
} from './types.js';
import { SIGMF_VERSION } from './metadata.js';
import { sha512 } from './hash.js';

/** SHA-512 hash length in hex characters */
const SHA512_HEX_LENGTH = 128;

/** SigMF version pattern */
const VERSION_PATTERN = /^\d+\.\d+\.\d+/;

/**
 * SigMF Collection class for managing groups of related recordings.
 *
 * Collections are used to describe relationships between multiple SigMF
 * recordings, such as channels from a phased array or synchronized captures.
 *
 * @example
 * ```ts
 * // Create a new collection
 * const collection = new SigMFCollection({
 *   description: 'Phased array capture - 4 channels',
 *   author: 'John Doe <john@example.com>',
 * });
 *
 * // Add recordings to the collection
 * await collection.addRecording('channel-0', metadataJson0);
 * await collection.addRecording('channel-1', metadataJson1);
 *
 * // Serialize to JSON
 * const json = collection.toJSON();
 * ```
 */
export class SigMFCollection {
  /** Collection object */
  public collection: SigMFCollectionObject;

  /**
   * Create a new SigMF collection.
   *
   * @param options - Collection options
   */
  constructor(options: {
    version?: string;
    description?: string;
    author?: string;
    collectionDoi?: string;
    license?: string;
    extensions?: SigMFExtension[];
  } = {}) {
    this.collection = {
      'core:version': options.version ?? SIGMF_VERSION,
    };

    if (options.description !== undefined) {
      this.collection['core:description'] = options.description;
    }
    if (options.author !== undefined) {
      this.collection['core:author'] = options.author;
    }
    if (options.collectionDoi !== undefined) {
      this.collection['core:collection_doi'] = options.collectionDoi;
    }
    if (options.license !== undefined) {
      this.collection['core:license'] = options.license;
    }
    if (options.extensions !== undefined) {
      this.collection['core:extensions'] = [...options.extensions];
    }
  }

  /**
   * Parse a SigMF collection JSON string or object.
   *
   * @param input - JSON string or parsed object
   * @returns SigMFCollection instance
   * @throws Error if parsing fails
   *
   * @example
   * ```ts
   * const collection = SigMFCollection.fromJSON(jsonString);
   * ```
   */
  static fromJSON(input: string | SigMFCollectionMetadata): SigMFCollection {
    const data: SigMFCollectionMetadata =
      typeof input === 'string' ? JSON.parse(input) : input;

    if (!data.collection || typeof data.collection !== 'object') {
      throw new Error('Invalid SigMF Collection: missing or invalid collection object');
    }

    if (!data.collection['core:version']) {
      throw new Error('Invalid SigMF Collection: missing required field core:version');
    }

    const collection = new SigMFCollection({
      version: data.collection['core:version'],
    });

    // Copy all collection fields
    collection.collection = { ...data.collection };

    return collection;
  }

  /**
   * Get the streams (recording references) in this collection.
   *
   * @returns Array of recording references
   */
  getStreams(): SigMFRecordingRef[] {
    return this.collection['core:streams'] ?? [];
  }

  /**
   * Add a recording reference to the collection.
   *
   * The hash is the SHA-512 of the metadata JSON file contents.
   *
   * @param name - Base name of the recording (without extension)
   * @param metadataJson - The JSON string of the .sigmf-meta file
   *
   * @example
   * ```ts
   * await collection.addRecording('channel-0', recording.toJSON());
   * ```
   */
  async addRecording(name: string, metadataJson: string): Promise<void> {
    const encoder = new TextEncoder();
    const data = encoder.encode(metadataJson);
    const hash = await sha512(data);

    this.addRecordingRef({ name, hash });
  }

  /**
   * Add a pre-computed recording reference to the collection.
   *
   * Use this when you already have the hash computed.
   *
   * @param ref - Recording reference with name and hash
   */
  addRecordingRef(ref: SigMFRecordingRef): void {
    if (!this.collection['core:streams']) {
      this.collection['core:streams'] = [];
    }
    this.collection['core:streams'].push(ref);
  }

  /**
   * Remove a recording from the collection by name.
   *
   * @param name - Base name of the recording to remove
   * @returns true if the recording was found and removed
   */
  removeRecording(name: string): boolean {
    const streams = this.collection['core:streams'];
    if (!streams) return false;

    const index = streams.findIndex((r) => r.name === name);
    if (index === -1) return false;

    streams.splice(index, 1);
    return true;
  }

  /**
   * Find a recording reference by name.
   *
   * @param name - Base name of the recording
   * @returns Recording reference or undefined if not found
   */
  findRecording(name: string): SigMFRecordingRef | undefined {
    return this.collection['core:streams']?.find((r) => r.name === name);
  }

  /**
   * Set a custom extension field on the collection.
   *
   * @param key - Field name in namespace:name format
   * @param value - Field value
   *
   * @example
   * ```ts
   * collection.setExtensionField('antenna:hagl', 120);
   * collection.setExtensionField('antenna:azimuth_angle', 98);
   * ```
   */
  setExtensionField(key: string, value: unknown): void {
    if (!key.includes(':')) {
      throw new Error('Extension field must be in namespace:name format');
    }
    this.collection[key] = value;
  }

  /**
   * Get a custom extension field from the collection.
   *
   * @param key - Field name in namespace:name format
   * @returns Field value or undefined if not set
   */
  getExtensionField(key: string): unknown {
    return this.collection[key];
  }

  /**
   * Validate the collection against SigMF specification.
   *
   * @returns Validation result with errors if any
   */
  validate(): ValidationResult {
    const errors: ValidationError[] = [];

    // Required: version
    if (!this.collection['core:version']) {
      errors.push({
        path: 'collection.core:version',
        message: 'is required',
      });
    } else if (!VERSION_PATTERN.test(this.collection['core:version'])) {
      errors.push({
        path: 'collection.core:version',
        message: 'must match pattern X.Y.Z',
        value: this.collection['core:version'],
      });
    }

    // Validate streams
    const streams = this.collection['core:streams'];
    if (streams !== undefined) {
      if (!Array.isArray(streams)) {
        errors.push({
          path: 'collection.core:streams',
          message: 'must be an array',
          value: streams,
        });
      } else {
        for (let i = 0; i < streams.length; i++) {
          const stream = streams[i];
          const path = `collection.core:streams[${i}]`;

          if (typeof stream !== 'object' || stream === null) {
            errors.push({
              path,
              message: 'must be an object',
              value: stream,
            });
            continue;
          }

          // Required: name
          if (!stream.name || typeof stream.name !== 'string') {
            errors.push({
              path: `${path}.name`,
              message: 'is required and must be a string',
              value: stream.name,
            });
          }

          // Required: hash
          if (!stream.hash || typeof stream.hash !== 'string') {
            errors.push({
              path: `${path}.hash`,
              message: 'is required and must be a string',
              value: stream.hash,
            });
          } else if (stream.hash.length !== SHA512_HEX_LENGTH) {
            errors.push({
              path: `${path}.hash`,
              message: `must be ${SHA512_HEX_LENGTH} hex characters`,
              value: stream.hash,
            });
          } else if (!/^[0-9a-f]+$/i.test(stream.hash)) {
            errors.push({
              path: `${path}.hash`,
              message: 'must contain only hex characters',
              value: stream.hash,
            });
          }
        }
      }
    }

    // Validate extensions array
    const extensions = this.collection['core:extensions'];
    if (extensions !== undefined) {
      if (!Array.isArray(extensions)) {
        errors.push({
          path: 'collection.core:extensions',
          message: 'must be an array',
          value: extensions,
        });
      } else {
        for (let i = 0; i < extensions.length; i++) {
          const ext = extensions[i];
          const path = `collection.core:extensions[${i}]`;

          if (typeof ext !== 'object' || ext === null) {
            errors.push({ path, message: 'must be an object', value: ext });
            continue;
          }

          if (!ext.name || typeof ext.name !== 'string') {
            errors.push({ path: `${path}.name`, message: 'is required', value: ext.name });
          }
          if (!ext.version || typeof ext.version !== 'string') {
            errors.push({ path: `${path}.version`, message: 'is required', value: ext.version });
          }
          if (typeof ext.optional !== 'boolean') {
            errors.push({ path: `${path}.optional`, message: 'must be a boolean', value: ext.optional });
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Convert the collection to a SigMF collection metadata object.
   *
   * @returns SigMF collection metadata object
   */
  toMetadata(): SigMFCollectionMetadata {
    return {
      collection: { ...this.collection },
    };
  }

  /**
   * Serialize the collection to a JSON string.
   *
   * @param pretty - Whether to format with indentation (default: true)
   * @returns JSON string
   */
  toJSON(pretty = true): string {
    return JSON.stringify(this.toMetadata(), null, pretty ? 2 : undefined);
  }
}
