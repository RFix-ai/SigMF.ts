/**
 * SigMF TypeScript Library - Core Type Definitions
 *
 * Based on SigMF Specification v1.2.x
 * https://github.com/sigmf/SigMF
 */

/**
 * SigMF datatype string representing sample format.
 *
 * Format: `[c|r][f32|f64|i32|i16|u32|u16|i8|u8][_le|_be]`
 * - `c` = complex (interleaved I/Q), `r` = real
 * - Type: `f32`/`f64` (float), `i8`/`i16`/`i32` (signed int), `u8`/`u16`/`u32` (unsigned int)
 * - Endianness: `_le` (little-endian) or `_be` (big-endian), not required for 8-bit types
 *
 * @example 'cf32_le' - Complex float32, little-endian (most common SDR format)
 * @example 'ri16_le' - Real signed 16-bit integer, little-endian
 * @example 'cu8' - Complex unsigned 8-bit (RTL-SDR format)
 */
export type SigMFDatatype =
  // Complex float
  | 'cf32_le'
  | 'cf32_be'
  | 'cf64_le'
  | 'cf64_be'
  // Complex signed integer
  | 'ci32_le'
  | 'ci32_be'
  | 'ci16_le'
  | 'ci16_be'
  | 'ci8'
  // Complex unsigned integer
  | 'cu32_le'
  | 'cu32_be'
  | 'cu16_le'
  | 'cu16_be'
  | 'cu8'
  // Real float
  | 'rf32_le'
  | 'rf32_be'
  | 'rf64_le'
  | 'rf64_be'
  // Real signed integer
  | 'ri32_le'
  | 'ri32_be'
  | 'ri16_le'
  | 'ri16_be'
  | 'ri8'
  // Real unsigned integer
  | 'ru32_le'
  | 'ru32_be'
  | 'ru16_le'
  | 'ru16_be'
  | 'ru8';

/**
 * Regex pattern for validating SigMF datatype strings.
 */
export const DATATYPE_PATTERN = /^(c|r)(f32|f64|i32|i16|u32|u16|i8|u8)(_le|_be)?$/;

/**
 * GeoJSON Point geometry for location data.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc7946
 */
export interface GeoJSONPoint {
  /** Must be 'Point' for GeoJSON Point geometry */
  type: 'Point';
  /**
   * Coordinates as [longitude, latitude] or [longitude, latitude, altitude].
   * - Longitude: -180 to 180 degrees
   * - Latitude: -90 to 90 degrees
   * - Altitude: meters above WGS84 ellipsoid (optional)
   */
  coordinates: [number, number] | [number, number, number];
  /** Optional bounding box */
  bbox?: number[];
}

/**
 * Extension declaration in SigMF metadata.
 */
export interface SigMFExtension {
  /** Extension namespace name (e.g., 'antenna', 'signal') */
  name: string;
  /** Extension version (semver format) */
  version: string;
  /** If false, applications MUST understand this extension to process the file */
  optional: boolean;
}

/**
 * SigMF Global object containing metadata applicable to the entire dataset.
 *
 * Required fields: `core:datatype`, `core:version`
 */
export interface SigMFGlobal {
  /**
   * The format of the stored samples.
   * @required
   */
  'core:datatype': SigMFDatatype;

  /**
   * SigMF specification version used (format: X.Y.Z).
   * @required
   */
  'core:version': string;

  /**
   * Sample rate of the signal in samples per second.
   * Must be > 0 and ≤ 1e12.
   */
  'core:sample_rate'?: number;

  /**
   * Author of the recording (name, email, or callsign).
   */
  'core:author'?: string;

  /**
   * Text description of the recording.
   */
  'core:description'?: string;

  /**
   * Description of the hardware used for the recording.
   */
  'core:hw'?: string;

  /**
   * URL to the license document for this recording.
   */
  'core:license'?: string;

  /**
   * Number of interleaved channels in the dataset.
   * Default is 1. Must be ≥ 1.
   */
  'core:num_channels'?: number;

  /**
   * Index of the first sample in the dataset (for partial recordings).
   * Default is 0.
   */
  'core:offset'?: number;

  /**
   * Name of the recording software.
   */
  'core:recorder'?: string;

  /**
   * SHA-512 hash of the dataset file (128 hex characters).
   */
  'core:sha512'?: string;

  /**
   * GeoJSON Point location of the recording system.
   */
  'core:geolocation'?: GeoJSONPoint;

  /**
   * List of extensions used in this recording.
   */
  'core:extensions'?: SigMFExtension[];

  /**
   * Set to true if no dataset file exists (metadata-only recording).
   */
  'core:metadata_only'?: boolean;

  /**
   * Full filename of the dataset for Non-Conforming Datasets.
   */
  'core:dataset'?: string;

  /**
   * Name of the associated collection file (without extension).
   */
  'core:collection'?: string;

  /**
   * DOI (Digital Object Identifier) for the dataset file.
   */
  'core:data_doi'?: string;

  /**
   * DOI for the metadata file.
   */
  'core:meta_doi'?: string;

  /**
   * Number of trailing bytes to ignore at the end of a Non-Conforming Dataset.
   */
  'core:trailing_bytes'?: number;

  /**
   * Extension fields (namespace:field format).
   * Allows any additional fields from SigMF extensions.
   */
  [key: string]: unknown;
}

/**
 * SigMF Capture segment describing a contiguous block of samples.
 *
 * Required fields: `core:sample_start`
 */
export interface SigMFCapture {
  /**
   * Index of the first sample of this capture segment.
   * Must be ≥ 0.
   * @required
   */
  'core:sample_start': number;

  /**
   * ISO-8601 UTC timestamp when this capture started.
   * Format: YYYY-MM-DDTHH:MM:SS.SSSZ
   */
  'core:datetime'?: string;

  /**
   * Center frequency of the signal in Hz.
   * Range: -1e12 to 1e12.
   */
  'core:frequency'?: number;

  /**
   * Index in the original sample stream (before extraction).
   */
  'core:global_index'?: number;

  /**
   * Number of non-sample bytes before this segment (for NCDs).
   */
  'core:header_bytes'?: number;

  /**
   * GeoJSON Point location at the start of this capture.
   */
  'core:geolocation'?: GeoJSONPoint;

  /**
   * Extension fields.
   */
  [key: string]: unknown;
}

/**
 * SigMF Annotation describing a region of interest in the dataset.
 *
 * Required fields: `core:sample_start`
 */
export interface SigMFAnnotation {
  /**
   * Index of the first sample this annotation applies to.
   * Must be ≥ 0.
   * @required
   */
  'core:sample_start': number;

  /**
   * Number of samples this annotation covers.
   */
  'core:sample_count'?: number;

  /**
   * Lower frequency edge of the annotated region in Hz.
   * Must be paired with `core:freq_upper_edge`.
   */
  'core:freq_lower_edge'?: number;

  /**
   * Upper frequency edge of the annotated region in Hz.
   * Must be paired with `core:freq_lower_edge`.
   */
  'core:freq_upper_edge'?: number;

  /**
   * Short label for this annotation (≤20 characters recommended).
   */
  'core:label'?: string;

  /**
   * Longer human-readable comment.
   */
  'core:comment'?: string;

  /**
   * Entity that created this annotation.
   */
  'core:generator'?: string;

  /**
   * RFC-4122 UUID for this annotation.
   */
  'core:uuid'?: string;

  /**
   * Extension fields.
   */
  [key: string]: unknown;
}

/**
 * Complete SigMF metadata structure.
 */
export interface SigMFMetadata {
  /** Global metadata applicable to the entire dataset */
  global: SigMFGlobal;
  /** Array of capture segments, sorted by sample_start ascending */
  captures: SigMFCapture[];
  /** Array of annotations, sorted by sample_start ascending */
  annotations: SigMFAnnotation[];
}

/**
 * Parsed datatype information.
 */
export interface DatatypeInfo {
  /** Whether samples are complex (I/Q pairs) */
  isComplex: boolean;
  /** Numeric format: 'float' or 'int' */
  format: 'float' | 'int';
  /** Whether the integer type is signed */
  signed: boolean;
  /** Bits per component (8, 16, 32, or 64) */
  bitsPerComponent: number;
  /** Bytes per component */
  bytesPerComponent: number;
  /** Bytes per sample (doubles for complex) */
  bytesPerSample: number;
  /** Little-endian byte order (undefined for 8-bit types) */
  littleEndian: boolean | undefined;
  /** Original datatype string */
  datatype: SigMFDatatype;
}

/**
 * Options for reading samples from a dataset.
 */
export interface ReadSamplesOptions {
  /** Index of the first sample to read (default: 0) */
  offset?: number;
  /** Number of samples to read (default: all remaining) */
  count?: number;
  /** Channel index for multi-channel data (default: 0, or undefined for all channels) */
  channel?: number;
}

/**
 * Represents a complex sample as an I/Q pair.
 */
export interface ComplexSample {
  /** In-phase component */
  i: number;
  /** Quadrature component */
  q: number;
}

/**
 * Validation error details.
 */
export interface ValidationError {
  /** Field path that failed validation (e.g., 'global.core:sample_rate') */
  path: string;
  /** Error message */
  message: string;
  /** Actual value that failed validation */
  value?: unknown;
}

/**
 * Result of metadata validation.
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** List of validation errors (empty if valid) */
  errors: ValidationError[];
}

/**
 * Entry in a SigMF archive.
 */
export interface ArchiveEntry {
  /** Base name of the recording (without extension) */
  name: string;
  /** Parsed metadata */
  metadata: SigMFMetadata;
  /** Raw dataset bytes */
  data: Uint8Array;
}

/**
 * Options for creating a SigMF archive.
 */
export interface ArchiveOptions {
  /** Base name for the recording files */
  name: string;
  /** Metadata to include */
  metadata: SigMFMetadata;
  /** Dataset binary data */
  data: Uint8Array;
}

// ============================================================================
// SigMF Collection Types
// ============================================================================

/**
 * Reference to a SigMF Recording within a Collection.
 *
 * Contains the recording's base name and SHA-512 hash of its metadata file.
 */
export interface SigMFRecordingRef {
  /** Base name of the recording (without .sigmf-meta extension) */
  name: string;
  /** SHA-512 hash of the .sigmf-meta file (128 hex characters) */
  hash: string;
  /** Additional extension fields */
  [key: string]: unknown;
}

/**
 * SigMF Collection object containing metadata about related recordings.
 */
export interface SigMFCollectionObject {
  /**
   * SigMF specification version used (format: X.Y.Z).
   * @required
   */
  'core:version': string;

  /**
   * Text description of the collection.
   */
  'core:description'?: string;

  /**
   * Author of the collection (name, email, or callsign).
   */
  'core:author'?: string;

  /**
   * DOI (Digital Object Identifier) for the collection.
   */
  'core:collection_doi'?: string;

  /**
   * URL to the license document for this collection.
   */
  'core:license'?: string;

  /**
   * List of extensions used in this collection.
   */
  'core:extensions'?: SigMFExtension[];

  /**
   * Ordered array of recording references (channels/streams).
   */
  'core:streams'?: SigMFRecordingRef[];

  /**
   * Extension fields (namespace:field format).
   */
  [key: string]: unknown;
}

/**
 * Complete SigMF Collection file structure.
 */
export interface SigMFCollectionMetadata {
  /** Collection object containing all metadata */
  collection: SigMFCollectionObject;
}

// ============================================================================
// Extension Support Types
// ============================================================================

/**
 * Definition of an extension field.
 */
export interface ExtensionFieldDef {
  /** Field name without namespace prefix */
  name: string;
  /** Whether this field is required */
  required: boolean;
  /** Expected data type */
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null';
  /** Human-readable description */
  description?: string;
  /** Default value if not provided */
  default?: unknown;
}

/**
 * Definition of a SigMF extension namespace.
 */
export interface ExtensionDefinition {
  /** Extension namespace name (e.g., 'antenna', 'capture_details') */
  name: string;
  /** Extension version (semver format) */
  version: string;
  /** Human-readable description of the extension */
  description?: string;
  /** Fields allowed in the global object */
  globalFields?: ExtensionFieldDef[];
  /** Fields allowed in capture segments */
  captureFields?: ExtensionFieldDef[];
  /** Fields allowed in annotation segments */
  annotationFields?: ExtensionFieldDef[];
  /** Fields allowed in collection objects */
  collectionFields?: ExtensionFieldDef[];
}

// ============================================================================
// Non-Conforming Dataset Types
// ============================================================================

/**
 * Options for handling Non-Conforming Datasets (NCDs).
 *
 * NCDs are datasets that don't follow the standard .sigmf-data format,
 * such as existing data files with headers or trailers.
 */
export interface NonConformingOptions {
  /**
   * Full filename of the dataset (required for NCDs).
   * Must include extension and be in the same directory.
   */
  dataset: string;

  /**
   * Number of bytes to ignore at the end of the file.
   */
  trailingBytes?: number;

  /**
   * If true, indicates metadata-only distribution (no data file).
   */
  metadataOnly?: boolean;
}

/**
 * Capture segment options for Non-Conforming Datasets.
 */
export interface NonConformingCaptureOptions {
  /**
   * Number of header bytes before samples in this segment.
   * These bytes are skipped when reading sample data.
   */
  headerBytes: number;
}
