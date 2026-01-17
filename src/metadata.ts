/**
 * SigMF Metadata Handling
 *
 * Provides the SigMFRecording class for parsing, creating, and validating
 * SigMF metadata files.
 */

import {
  SigMFMetadata,
  SigMFGlobal,
  SigMFCapture,
  SigMFAnnotation,
  SigMFDatatype,
  SigMFExtension,
  DatatypeInfo,
  ValidationResult,
  ValidationError,
  GeoJSONPoint,
  NonConformingOptions,
  DATATYPE_PATTERN,
} from './types.js';

/** Current SigMF specification version supported by this library */
export const SIGMF_VERSION = '1.2.0';

/** Maximum allowed sample rate (1 THz) */
const MAX_SAMPLE_RATE = 1e12;

/** Maximum allowed frequency (±1 THz) */
const MAX_FREQUENCY = 1e12;

/** SHA-512 hash length in hex characters */
const SHA512_HEX_LENGTH = 128;

/** ISO-8601 datetime pattern for SigMF */
const ISO8601_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/** UUID v4 pattern */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** SigMF version pattern */
const VERSION_PATTERN = /^\d+\.\d+\.\d+/;

/**
 * Parse a SigMF datatype string into its components.
 *
 * @param datatype - The datatype string (e.g., 'cf32_le')
 * @returns Parsed datatype information
 * @throws Error if datatype is invalid
 *
 * @example
 * ```ts
 * const info = parseDatatype('cf32_le');
 * // { isComplex: true, format: 'float', bitsPerComponent: 32, littleEndian: true, ... }
 * ```
 */
export function parseDatatype(datatype: string): DatatypeInfo {
  const match = datatype.match(DATATYPE_PATTERN);
  if (!match) {
    throw new Error(`Invalid datatype: ${datatype}`);
  }

  const [, complexOrReal, typeStr, endianStr] = match;

  const isComplex = complexOrReal === 'c';
  const format = typeStr.startsWith('f') ? 'float' : 'int';
  const signed = typeStr.startsWith('f') || typeStr.startsWith('i');
  const bitsPerComponent = parseInt(typeStr.slice(1), 10);
  const bytesPerComponent = bitsPerComponent / 8;
  const bytesPerSample = isComplex ? bytesPerComponent * 2 : bytesPerComponent;

  let littleEndian: boolean | undefined;
  if (bitsPerComponent > 8) {
    littleEndian = endianStr === '_le';
  }

  return {
    isComplex,
    format,
    signed,
    bitsPerComponent,
    bytesPerComponent,
    bytesPerSample,
    littleEndian,
    datatype: datatype as SigMFDatatype,
  };
}

/**
 * Validate a GeoJSON Point object.
 */
function validateGeoJSON(point: unknown, path: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (typeof point !== 'object' || point === null) {
    errors.push({ path, message: 'must be an object', value: point });
    return errors;
  }

  const obj = point as Record<string, unknown>;

  if (obj.type !== 'Point') {
    errors.push({ path: `${path}.type`, message: "must be 'Point'", value: obj.type });
  }

  if (!Array.isArray(obj.coordinates)) {
    errors.push({
      path: `${path}.coordinates`,
      message: 'must be an array',
      value: obj.coordinates,
    });
  } else {
    const coords = obj.coordinates as unknown[];
    if (coords.length < 2 || coords.length > 3) {
      errors.push({
        path: `${path}.coordinates`,
        message: 'must have 2 or 3 elements [lon, lat] or [lon, lat, alt]',
        value: coords,
      });
    } else {
      const [lon, lat, alt] = coords;
      if (typeof lon !== 'number' || lon < -180 || lon > 180) {
        errors.push({
          path: `${path}.coordinates[0]`,
          message: 'longitude must be between -180 and 180',
          value: lon,
        });
      }
      if (typeof lat !== 'number' || lat < -90 || lat > 90) {
        errors.push({
          path: `${path}.coordinates[1]`,
          message: 'latitude must be between -90 and 90',
          value: lat,
        });
      }
      if (alt !== undefined && typeof alt !== 'number') {
        errors.push({
          path: `${path}.coordinates[2]`,
          message: 'altitude must be a number',
          value: alt,
        });
      }
    }
  }

  return errors;
}

/**
 * SigMF Recording class for handling metadata.
 *
 * This class provides methods for parsing, creating, validating, and serializing
 * SigMF metadata. It represents a complete SigMF recording with global metadata,
 * capture segments, and annotations.
 *
 * @example
 * ```ts
 * // Parse existing metadata
 * const recording = SigMFRecording.fromJSON(jsonString);
 *
 * // Create new metadata
 * const recording = new SigMFRecording({
 *   datatype: 'cf32_le',
 *   sampleRate: 2.4e6,
 *   description: 'FM radio capture',
 * });
 *
 * // Add captures and annotations
 * recording.addCapture({ sampleStart: 0, frequency: 100e6 });
 * recording.addAnnotation({ sampleStart: 1000, sampleCount: 5000, label: 'Signal' });
 *
 * // Validate and serialize
 * const result = recording.validate();
 * const json = recording.toJSON();
 * ```
 */
export class SigMFRecording {
  /** Global metadata */
  public global: SigMFGlobal;

  /** Capture segments */
  public captures: SigMFCapture[];

  /** Annotations */
  public annotations: SigMFAnnotation[];

  /**
   * Create a new SigMF recording.
   *
   * @param options - Recording options
   */
  constructor(options: {
    datatype: SigMFDatatype;
    version?: string;
    sampleRate?: number;
    author?: string;
    description?: string;
    hw?: string;
    license?: string;
    numChannels?: number;
    recorder?: string;
    geolocation?: GeoJSONPoint;
    extensions?: SigMFExtension[];
    /** Non-conforming dataset options */
    nonConforming?: NonConformingOptions;
  }) {
    this.global = {
      'core:datatype': options.datatype,
      'core:version': options.version ?? SIGMF_VERSION,
    };

    if (options.sampleRate !== undefined) {
      this.global['core:sample_rate'] = options.sampleRate;
    }
    if (options.author !== undefined) {
      this.global['core:author'] = options.author;
    }
    if (options.description !== undefined) {
      this.global['core:description'] = options.description;
    }
    if (options.hw !== undefined) {
      this.global['core:hw'] = options.hw;
    }
    if (options.license !== undefined) {
      this.global['core:license'] = options.license;
    }
    if (options.numChannels !== undefined) {
      this.global['core:num_channels'] = options.numChannels;
    }
    if (options.recorder !== undefined) {
      this.global['core:recorder'] = options.recorder;
    }
    if (options.geolocation !== undefined) {
      this.global['core:geolocation'] = options.geolocation;
    }
    if (options.extensions !== undefined) {
      this.global['core:extensions'] = [...options.extensions];
    }

    // Non-conforming dataset options
    if (options.nonConforming !== undefined) {
      const ncd = options.nonConforming;
      if (ncd.dataset !== undefined) {
        this.global['core:dataset'] = ncd.dataset;
      }
      if (ncd.trailingBytes !== undefined) {
        this.global['core:trailing_bytes'] = ncd.trailingBytes;
      }
      if (ncd.metadataOnly !== undefined) {
        this.global['core:metadata_only'] = ncd.metadataOnly;
      }
    }

    this.captures = [];
    this.annotations = [];
  }

  /**
   * Parse a SigMF metadata JSON string or object.
   *
   * @param input - JSON string or parsed object
   * @returns SigMFRecording instance
   * @throws Error if parsing fails
   *
   * @example
   * ```ts
   * const recording = SigMFRecording.fromJSON('{"global":{"core:datatype":"cf32_le",...},...}');
   * ```
   */
  static fromJSON(input: string | SigMFMetadata): SigMFRecording {
    const data: SigMFMetadata = typeof input === 'string' ? JSON.parse(input) : input;

    if (!data.global || typeof data.global !== 'object') {
      throw new Error('Invalid SigMF: missing or invalid global object');
    }

    if (!data.global['core:datatype']) {
      throw new Error('Invalid SigMF: missing required field core:datatype');
    }

    if (!data.global['core:version']) {
      throw new Error('Invalid SigMF: missing required field core:version');
    }

    const recording = new SigMFRecording({
      datatype: data.global['core:datatype'],
      version: data.global['core:version'],
    });

    // Copy all global fields
    recording.global = { ...data.global };

    // Copy captures and annotations
    recording.captures = Array.isArray(data.captures) ? [...data.captures] : [];
    recording.annotations = Array.isArray(data.annotations) ? [...data.annotations] : [];

    return recording;
  }

  /**
   * Create a SigMFRecording from raw metadata object.
   *
   * @param metadata - Raw SigMF metadata
   * @returns SigMFRecording instance
   */
  static fromMetadata(metadata: SigMFMetadata): SigMFRecording {
    return SigMFRecording.fromJSON(metadata);
  }

  /**
   * Get the datatype information for this recording.
   *
   * @returns Parsed datatype information
   */
  getDatatypeInfo(): DatatypeInfo {
    return parseDatatype(this.global['core:datatype']);
  }

  /**
   * Get the sample rate in Hz.
   *
   * @returns Sample rate or undefined if not set
   */
  getSampleRate(): number | undefined {
    return this.global['core:sample_rate'];
  }

  /**
   * Set the sample rate in Hz.
   *
   * @param rate - Sample rate (must be > 0 and ≤ 1e12)
   */
  setSampleRate(rate: number): void {
    this.global['core:sample_rate'] = rate;
  }

  /**
   * Get the number of channels.
   *
   * @returns Number of channels (default: 1)
   */
  getNumChannels(): number {
    return this.global['core:num_channels'] ?? 1;
  }

  /**
   * Add a capture segment.
   *
   * @param capture - Capture segment to add
   *
   * @example
   * ```ts
   * recording.addCapture({
   *   sampleStart: 0,
   *   frequency: 100e6,
   *   datetime: '2026-01-15T12:00:00Z',
   * });
   * ```
   */
  addCapture(capture: {
    sampleStart: number;
    datetime?: string;
    frequency?: number;
    globalIndex?: number;
    headerBytes?: number;
    geolocation?: GeoJSONPoint;
  }): void {
    const captureObj: SigMFCapture = {
      'core:sample_start': capture.sampleStart,
    };

    if (capture.datetime !== undefined) {
      captureObj['core:datetime'] = capture.datetime;
    }
    if (capture.frequency !== undefined) {
      captureObj['core:frequency'] = capture.frequency;
    }
    if (capture.globalIndex !== undefined) {
      captureObj['core:global_index'] = capture.globalIndex;
    }
    if (capture.headerBytes !== undefined) {
      captureObj['core:header_bytes'] = capture.headerBytes;
    }
    if (capture.geolocation !== undefined) {
      captureObj['core:geolocation'] = capture.geolocation;
    }

    this.captures.push(captureObj);
    this.sortCaptures();
  }

  /**
   * Add an annotation.
   *
   * @param annotation - Annotation to add
   *
   * @example
   * ```ts
   * recording.addAnnotation({
   *   sampleStart: 1000,
   *   sampleCount: 5000,
   *   label: 'FM Signal',
   *   freqLowerEdge: 99.9e6,
   *   freqUpperEdge: 100.1e6,
   * });
   * ```
   */
  addAnnotation(annotation: {
    sampleStart: number;
    sampleCount?: number;
    freqLowerEdge?: number;
    freqUpperEdge?: number;
    label?: string;
    comment?: string;
    generator?: string;
    uuid?: string;
  }): void {
    const annotationObj: SigMFAnnotation = {
      'core:sample_start': annotation.sampleStart,
    };

    if (annotation.sampleCount !== undefined) {
      annotationObj['core:sample_count'] = annotation.sampleCount;
    }
    if (annotation.freqLowerEdge !== undefined) {
      annotationObj['core:freq_lower_edge'] = annotation.freqLowerEdge;
    }
    if (annotation.freqUpperEdge !== undefined) {
      annotationObj['core:freq_upper_edge'] = annotation.freqUpperEdge;
    }
    if (annotation.label !== undefined) {
      annotationObj['core:label'] = annotation.label;
    }
    if (annotation.comment !== undefined) {
      annotationObj['core:comment'] = annotation.comment;
    }
    if (annotation.generator !== undefined) {
      annotationObj['core:generator'] = annotation.generator;
    }
    if (annotation.uuid !== undefined) {
      annotationObj['core:uuid'] = annotation.uuid;
    }

    this.annotations.push(annotationObj);
    this.sortAnnotations();
  }

  /**
   * Sort captures by sample_start ascending.
   */
  private sortCaptures(): void {
    this.captures.sort((a, b) => a['core:sample_start'] - b['core:sample_start']);
  }

  /**
   * Sort annotations by sample_start ascending.
   */
  private sortAnnotations(): void {
    this.annotations.sort((a, b) => a['core:sample_start'] - b['core:sample_start']);
  }

  /**
   * Validate the metadata against SigMF specification.
   *
   * @returns Validation result with errors if any
   *
   * @example
   * ```ts
   * const result = recording.validate();
   * if (!result.valid) {
   *   console.error('Validation errors:', result.errors);
   * }
   * ```
   */
  validate(): ValidationResult {
    const errors: ValidationError[] = [];

    // Validate global object
    this.validateGlobal(errors);

    // Validate captures
    this.validateCaptures(errors);

    // Validate annotations
    this.validateAnnotations(errors);

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private validateGlobal(errors: ValidationError[]): void {
    const g = this.global;

    // Required fields
    if (!g['core:datatype']) {
      errors.push({
        path: 'global.core:datatype',
        message: 'is required',
      });
    } else if (!DATATYPE_PATTERN.test(g['core:datatype'])) {
      errors.push({
        path: 'global.core:datatype',
        message: 'is not a valid datatype',
        value: g['core:datatype'],
      });
    }

    if (!g['core:version']) {
      errors.push({
        path: 'global.core:version',
        message: 'is required',
      });
    } else if (!VERSION_PATTERN.test(g['core:version'])) {
      errors.push({
        path: 'global.core:version',
        message: 'must match pattern X.Y.Z',
        value: g['core:version'],
      });
    }

    // Optional field constraints
    if (g['core:sample_rate'] !== undefined) {
      if (typeof g['core:sample_rate'] !== 'number' || g['core:sample_rate'] <= 0) {
        errors.push({
          path: 'global.core:sample_rate',
          message: 'must be a positive number',
          value: g['core:sample_rate'],
        });
      } else if (g['core:sample_rate'] > MAX_SAMPLE_RATE) {
        errors.push({
          path: 'global.core:sample_rate',
          message: `must be ≤ ${MAX_SAMPLE_RATE}`,
          value: g['core:sample_rate'],
        });
      }
    }

    if (g['core:num_channels'] !== undefined) {
      if (
        typeof g['core:num_channels'] !== 'number' ||
        !Number.isInteger(g['core:num_channels']) ||
        g['core:num_channels'] < 1
      ) {
        errors.push({
          path: 'global.core:num_channels',
          message: 'must be a positive integer',
          value: g['core:num_channels'],
        });
      }
    }

    if (g['core:offset'] !== undefined) {
      if (
        typeof g['core:offset'] !== 'number' ||
        !Number.isInteger(g['core:offset']) ||
        g['core:offset'] < 0
      ) {
        errors.push({
          path: 'global.core:offset',
          message: 'must be a non-negative integer',
          value: g['core:offset'],
        });
      }
    }

    if (g['core:sha512'] !== undefined) {
      if (typeof g['core:sha512'] !== 'string' || g['core:sha512'].length !== SHA512_HEX_LENGTH) {
        errors.push({
          path: 'global.core:sha512',
          message: `must be ${SHA512_HEX_LENGTH} hex characters`,
          value: g['core:sha512'],
        });
      } else if (!/^[0-9a-f]+$/i.test(g['core:sha512'])) {
        errors.push({
          path: 'global.core:sha512',
          message: 'must contain only hex characters',
          value: g['core:sha512'],
        });
      }
    }

    if (g['core:geolocation'] !== undefined) {
      errors.push(...validateGeoJSON(g['core:geolocation'], 'global.core:geolocation'));
    }
  }

  private validateCaptures(errors: ValidationError[]): void {
    let lastSampleStart = -1;

    for (let i = 0; i < this.captures.length; i++) {
      const capture = this.captures[i];
      const path = `captures[${i}]`;

      // Required field
      if (capture['core:sample_start'] === undefined) {
        errors.push({
          path: `${path}.core:sample_start`,
          message: 'is required',
        });
      } else {
        const sampleStart = capture['core:sample_start'];

        if (typeof sampleStart !== 'number' || !Number.isInteger(sampleStart) || sampleStart < 0) {
          errors.push({
            path: `${path}.core:sample_start`,
            message: 'must be a non-negative integer',
            value: sampleStart,
          });
        } else if (sampleStart < lastSampleStart) {
          errors.push({
            path: `${path}.core:sample_start`,
            message: 'captures must be sorted by sample_start ascending',
            value: sampleStart,
          });
        }
        lastSampleStart = sampleStart;
      }

      // Optional fields
      if (capture['core:datetime'] !== undefined) {
        if (!ISO8601_PATTERN.test(capture['core:datetime'])) {
          errors.push({
            path: `${path}.core:datetime`,
            message: 'must be ISO-8601 UTC format (YYYY-MM-DDTHH:MM:SS.SSSZ)',
            value: capture['core:datetime'],
          });
        }
      }

      if (capture['core:frequency'] !== undefined) {
        const freq = capture['core:frequency'];
        if (typeof freq !== 'number' || Math.abs(freq) > MAX_FREQUENCY) {
          errors.push({
            path: `${path}.core:frequency`,
            message: `must be a number between -${MAX_FREQUENCY} and ${MAX_FREQUENCY}`,
            value: freq,
          });
        }
      }

      if (capture['core:geolocation'] !== undefined) {
        errors.push(...validateGeoJSON(capture['core:geolocation'], `${path}.core:geolocation`));
      }
    }
  }

  private validateAnnotations(errors: ValidationError[]): void {
    let lastSampleStart = -1;

    for (let i = 0; i < this.annotations.length; i++) {
      const annotation = this.annotations[i];
      const path = `annotations[${i}]`;

      // Required field
      if (annotation['core:sample_start'] === undefined) {
        errors.push({
          path: `${path}.core:sample_start`,
          message: 'is required',
        });
      } else {
        const sampleStart = annotation['core:sample_start'];

        if (typeof sampleStart !== 'number' || !Number.isInteger(sampleStart) || sampleStart < 0) {
          errors.push({
            path: `${path}.core:sample_start`,
            message: 'must be a non-negative integer',
            value: sampleStart,
          });
        } else if (sampleStart < lastSampleStart) {
          errors.push({
            path: `${path}.core:sample_start`,
            message: 'annotations must be sorted by sample_start ascending',
            value: sampleStart,
          });
        }
        lastSampleStart = sampleStart;
      }

      // Sample count
      if (annotation['core:sample_count'] !== undefined) {
        const count = annotation['core:sample_count'];
        if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
          errors.push({
            path: `${path}.core:sample_count`,
            message: 'must be a non-negative integer',
            value: count,
          });
        }
      }

      // Frequency edges must come in pairs
      const hasLower = annotation['core:freq_lower_edge'] !== undefined;
      const hasUpper = annotation['core:freq_upper_edge'] !== undefined;
      if (hasLower !== hasUpper) {
        errors.push({
          path: `${path}`,
          message: 'core:freq_lower_edge and core:freq_upper_edge must both be present or absent',
        });
      }

      if (hasLower && hasUpper) {
        const lower = annotation['core:freq_lower_edge']!;
        const upper = annotation['core:freq_upper_edge']!;

        if (typeof lower !== 'number') {
          errors.push({
            path: `${path}.core:freq_lower_edge`,
            message: 'must be a number',
            value: lower,
          });
        }
        if (typeof upper !== 'number') {
          errors.push({
            path: `${path}.core:freq_upper_edge`,
            message: 'must be a number',
            value: upper,
          });
        }
        if (typeof lower === 'number' && typeof upper === 'number' && lower > upper) {
          errors.push({
            path: `${path}`,
            message: 'core:freq_lower_edge must be ≤ core:freq_upper_edge',
            value: { lower, upper },
          });
        }
      }

      // UUID format
      if (annotation['core:uuid'] !== undefined) {
        if (!UUID_PATTERN.test(annotation['core:uuid'])) {
          errors.push({
            path: `${path}.core:uuid`,
            message: 'must be a valid UUID',
            value: annotation['core:uuid'],
          });
        }
      }
    }
  }

  /**
   * Convert the recording to a SigMF metadata object.
   *
   * @returns SigMF metadata object
   */
  toMetadata(): SigMFMetadata {
    return {
      global: { ...this.global },
      captures: [...this.captures],
      annotations: [...this.annotations],
    };
  }

  /**
   * Serialize the recording to a JSON string.
   *
   * @param pretty - Whether to format with indentation (default: true)
   * @returns JSON string
   */
  toJSON(pretty = true): string {
    return JSON.stringify(this.toMetadata(), null, pretty ? 2 : undefined);
  }

  /**
   * Set the SHA-512 hash of the dataset.
   *
   * @param hash - SHA-512 hash as 128 hex characters
   */
  setSha512(hash: string): void {
    this.global['core:sha512'] = hash.toLowerCase();
  }

  /**
   * Get the SHA-512 hash of the dataset.
   *
   * @returns SHA-512 hash or undefined if not set
   */
  getSha512(): string | undefined {
    return this.global['core:sha512'];
  }

  /**
   * Check if this recording uses a Non-Conforming Dataset.
   *
   * @returns true if the recording has NCD-specific fields
   */
  isNonConforming(): boolean {
    return (
      this.global['core:dataset'] !== undefined ||
      this.global['core:trailing_bytes'] !== undefined ||
      this.captures.some((c) => c['core:header_bytes'] !== undefined && c['core:header_bytes'] > 0)
    );
  }

  /**
   * Check if this is a metadata-only recording (no dataset file).
   *
   * @returns true if metadata_only is set to true
   */
  isMetadataOnly(): boolean {
    return this.global['core:metadata_only'] === true;
  }

  /**
   * Set the dataset filename for Non-Conforming Datasets.
   *
   * @param filename - Full filename including extension (must be in same directory)
   */
  setDatasetFilename(filename: string): void {
    this.global['core:dataset'] = filename;
  }

  /**
   * Get the dataset filename for Non-Conforming Datasets.
   *
   * @returns Dataset filename or undefined for conforming datasets
   */
  getDatasetFilename(): string | undefined {
    return this.global['core:dataset'];
  }

  /**
   * Set trailing bytes to ignore at end of Non-Conforming Dataset.
   *
   * @param bytes - Number of bytes to ignore
   */
  setTrailingBytes(bytes: number): void {
    this.global['core:trailing_bytes'] = bytes;
  }

  /**
   * Get trailing bytes setting.
   *
   * @returns Number of trailing bytes or undefined
   */
  getTrailingBytes(): number | undefined {
    return this.global['core:trailing_bytes'];
  }

  /**
   * Mark this recording as metadata-only (no dataset file).
   *
   * @param metadataOnly - Whether this is metadata-only
   */
  setMetadataOnly(metadataOnly: boolean): void {
    this.global['core:metadata_only'] = metadataOnly;
  }

  /**
   * Add an extension declaration to the recording.
   *
   * @param extension - Extension to add
   */
  addExtension(extension: SigMFExtension): void {
    if (!this.global['core:extensions']) {
      this.global['core:extensions'] = [];
    }
    // Check if already declared
    const existing = this.global['core:extensions'].find((e) => e.name === extension.name);
    if (!existing) {
      this.global['core:extensions'].push(extension);
    }
  }

  /**
   * Get declared extensions.
   *
   * @returns Array of extension declarations
   */
  getExtensions(): SigMFExtension[] {
    return this.global['core:extensions'] ?? [];
  }

  /**
   * Set an extension field value.
   *
   * @param key - Field key in namespace:name format (e.g., 'antenna:gain')
   * @param value - Field value
   */
  setExtensionField(key: string, value: unknown): void {
    if (!key.includes(':')) {
      throw new Error('Extension field must be in namespace:name format');
    }
    this.global[key] = value;
  }

  /**
   * Get an extension field value from global.
   *
   * @param key - Field key in namespace:name format
   * @returns Field value or undefined
   */
  getExtensionField(key: string): unknown {
    return this.global[key];
  }

  /**
   * Set the collection this recording belongs to.
   *
   * @param collectionName - Base name of the collection file (without extension)
   */
  setCollection(collectionName: string): void {
    this.global['core:collection'] = collectionName;
  }

  /**
   * Get the collection this recording belongs to.
   *
   * @returns Collection name or undefined
   */
  getCollection(): string | undefined {
    return this.global['core:collection'];
  }

  /**
   * Calculate the expected file size in bytes based on sample count.
   *
   * @param sampleCount - Total number of samples
   * @returns Expected file size in bytes
   */
  calculateDataSize(sampleCount: number): number {
    const info = this.getDatatypeInfo();
    const numChannels = this.getNumChannels();
    return sampleCount * info.bytesPerSample * numChannels;
  }
}
