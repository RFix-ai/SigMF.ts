/**
 * SigMF Sample Data Handling
 *
 * Provides functions for reading and writing binary sample data
 * with support for all SigMF datatypes, streaming, and multi-channel data.
 */

import { DatatypeInfo, SigMFDatatype, ReadSamplesOptions, ComplexSample } from './types.js';
import { parseDatatype } from './metadata.js';

/**
 * Result of reading samples from a dataset.
 */
export interface SampleData {
  /** Real samples as Float64Array (for real datatypes) */
  real?: Float64Array;
  /** Complex samples as interleaved Float64Array [I0, Q0, I1, Q1, ...] */
  complex?: Float64Array;
  /** Number of samples read */
  sampleCount: number;
  /** Datatype information */
  datatypeInfo: DatatypeInfo;
}

/**
 * Read a single value from a DataView based on format.
 */
function readValue(
  view: DataView,
  offset: number,
  info: DatatypeInfo
): number {
  const le = info.littleEndian ?? true;

  switch (info.format) {
    case 'float':
      return info.bitsPerComponent === 32
        ? view.getFloat32(offset, le)
        : view.getFloat64(offset, le);
    case 'int':
      if (info.signed) {
        switch (info.bitsPerComponent) {
          case 8:
            return view.getInt8(offset);
          case 16:
            return view.getInt16(offset, le);
          case 32:
            return view.getInt32(offset, le);
        }
      } else {
        switch (info.bitsPerComponent) {
          case 8:
            return view.getUint8(offset);
          case 16:
            return view.getUint16(offset, le);
          case 32:
            return view.getUint32(offset, le);
        }
      }
  }

  throw new Error(`Unsupported datatype: ${info.datatype}`);
}

/**
 * Write a single value to a DataView based on format.
 */
function writeValue(
  view: DataView,
  offset: number,
  value: number,
  info: DatatypeInfo
): void {
  const le = info.littleEndian ?? true;

  switch (info.format) {
    case 'float':
      if (info.bitsPerComponent === 32) {
        view.setFloat32(offset, value, le);
      } else {
        view.setFloat64(offset, value, le);
      }
      break;
    case 'int':
      if (info.signed) {
        switch (info.bitsPerComponent) {
          case 8:
            view.setInt8(offset, value);
            break;
          case 16:
            view.setInt16(offset, value, le);
            break;
          case 32:
            view.setInt32(offset, value, le);
            break;
        }
      } else {
        switch (info.bitsPerComponent) {
          case 8:
            view.setUint8(offset, value);
            break;
          case 16:
            view.setUint16(offset, value, le);
            break;
          case 32:
            view.setUint32(offset, value, le);
            break;
        }
      }
      break;
    default:
      throw new Error(`Unsupported datatype: ${info.datatype}`);
  }
}

/**
 * Read samples from an ArrayBuffer.
 *
 * @param buffer - Binary data containing samples
 * @param datatype - SigMF datatype string
 * @param options - Read options (offset, count)
 * @returns Sample data
 *
 * @example
 * ```ts
 * const data = await file.arrayBuffer();
 * const samples = readSamples(data, 'cf32_le');
 * console.log('Read', samples.sampleCount, 'complex samples');
 * ```
 */
export function readSamples(
  buffer: ArrayBuffer,
  datatype: SigMFDatatype | string,
  options: ReadSamplesOptions = {}
): SampleData {
  const info = parseDatatype(datatype);
  const { offset = 0, count } = options;

  const byteOffset = offset * info.bytesPerSample;
  const availableBytes = buffer.byteLength - byteOffset;
  const maxSamples = Math.floor(availableBytes / info.bytesPerSample);
  const sampleCount = count !== undefined ? Math.min(count, maxSamples) : maxSamples;

  const view = new DataView(buffer, byteOffset, sampleCount * info.bytesPerSample);

  if (info.isComplex) {
    // Complex samples: return interleaved I/Q as Float64Array
    const complex = new Float64Array(sampleCount * 2);

    for (let i = 0; i < sampleCount; i++) {
      const sampleOffset = i * info.bytesPerSample;
      complex[i * 2] = readValue(view, sampleOffset, info); // I
      complex[i * 2 + 1] = readValue(view, sampleOffset + info.bytesPerComponent, info); // Q
    }

    return { complex, sampleCount, datatypeInfo: info };
  } else {
    // Real samples
    const real = new Float64Array(sampleCount);

    for (let i = 0; i < sampleCount; i++) {
      real[i] = readValue(view, i * info.bytesPerSample, info);
    }

    return { real, sampleCount, datatypeInfo: info };
  }
}

/**
 * Read samples from a File or Blob with streaming support for large files.
 *
 * This function processes the file in chunks to avoid loading the entire
 * file into memory at once.
 *
 * @param source - File or Blob containing sample data
 * @param datatype - SigMF datatype string
 * @param options - Read options
 * @param onProgress - Optional progress callback (bytesRead, totalBytes)
 * @returns Sample data
 *
 * @example
 * ```ts
 * const file = input.files[0];
 * const samples = await readSamplesFromBlob(file, 'cf32_le', {}, (read, total) => {
 *   console.log(`Progress: ${(read / total * 100).toFixed(1)}%`);
 * });
 * ```
 */
export async function readSamplesFromBlob(
  source: Blob,
  datatype: SigMFDatatype | string,
  options: ReadSamplesOptions = {},
  onProgress?: (bytesRead: number, totalBytes: number) => void
): Promise<SampleData> {
  const info = parseDatatype(datatype);
  const { offset = 0, count } = options;

  const byteOffset = offset * info.bytesPerSample;
  const totalBytes = source.size - byteOffset;
  const maxSamples = Math.floor(totalBytes / info.bytesPerSample);
  const sampleCount = count !== undefined ? Math.min(count, maxSamples) : maxSamples;
  const bytesToRead = sampleCount * info.bytesPerSample;

  // For small files (< 50MB), read directly
  if (bytesToRead < 50 * 1024 * 1024) {
    const slice = source.slice(byteOffset, byteOffset + bytesToRead);
    const buffer = await slice.arrayBuffer();
    onProgress?.(bytesToRead, bytesToRead);
    return readSamples(buffer, datatype, { offset: 0, count: sampleCount });
  }

  // For large files, use streaming
  const result = info.isComplex
    ? new Float64Array(sampleCount * 2)
    : new Float64Array(sampleCount);

  let samplesRead = 0;
  let bytesRead = 0;

  const stream = source.slice(byteOffset, byteOffset + bytesToRead).stream();
  const reader = stream.getReader();

  // Buffer for partial samples at chunk boundaries
  let partialBuffer = new Uint8Array(0);

  try {
    while (samplesRead < sampleCount) {
      const { done, value } = await reader.read();
      if (done) break;

      // Combine with any partial data from previous chunk
      let chunk: Uint8Array;
      if (partialBuffer.length > 0) {
        chunk = new Uint8Array(partialBuffer.length + value.length);
        chunk.set(partialBuffer);
        chunk.set(value, partialBuffer.length);
        partialBuffer = new Uint8Array(0);
      } else {
        chunk = value;
      }

      // Calculate complete samples in this chunk
      const completeSamples = Math.floor(chunk.length / info.bytesPerSample);
      const completeBytes = completeSamples * info.bytesPerSample;

      // Save any partial sample for next iteration
      if (chunk.length > completeBytes) {
        partialBuffer = chunk.slice(completeBytes);
      }

      // Process complete samples
      const view = new DataView(chunk.buffer, chunk.byteOffset, completeBytes);

      for (let i = 0; i < completeSamples && samplesRead < sampleCount; i++) {
        const sampleOffset = i * info.bytesPerSample;

        if (info.isComplex) {
          result[samplesRead * 2] = readValue(view, sampleOffset, info);
          result[samplesRead * 2 + 1] = readValue(
            view,
            sampleOffset + info.bytesPerComponent,
            info
          );
        } else {
          result[samplesRead] = readValue(view, sampleOffset, info);
        }
        samplesRead++;
      }

      bytesRead += value.length;
      onProgress?.(bytesRead, bytesToRead);
    }
  } finally {
    reader.releaseLock();
  }

  return {
    ...(info.isComplex ? { complex: result } : { real: result }),
    sampleCount: samplesRead,
    datatypeInfo: info,
  };
}

/**
 * Write samples to an ArrayBuffer.
 *
 * @param samples - Real samples as number array, or complex samples as ComplexSample array or interleaved array
 * @param datatype - SigMF datatype string
 * @returns Uint8Array containing binary sample data
 *
 * @example
 * ```ts
 * // Write real samples
 * const data = writeSamples([1.0, 2.0, 3.0], 'rf32_le');
 *
 * // Write complex samples (interleaved)
 * const iqData = writeSamples([1.0, 0.0, 0.5, 0.5], 'cf32_le'); // 2 samples
 *
 * // Write complex samples (object format)
 * const iqData = writeSamplesComplex([{ i: 1.0, q: 0.0 }], 'cf32_le');
 * ```
 */
export function writeSamples(
  samples: number[] | Float32Array | Float64Array,
  datatype: SigMFDatatype | string
): Uint8Array {
  const info = parseDatatype(datatype);
  const sampleCount = info.isComplex ? samples.length / 2 : samples.length;
  const buffer = new ArrayBuffer(sampleCount * info.bytesPerSample);
  const view = new DataView(buffer);

  if (info.isComplex) {
    for (let i = 0; i < sampleCount; i++) {
      const offset = i * info.bytesPerSample;
      writeValue(view, offset, samples[i * 2], info); // I
      writeValue(view, offset + info.bytesPerComponent, samples[i * 2 + 1], info); // Q
    }
  } else {
    for (let i = 0; i < sampleCount; i++) {
      writeValue(view, i * info.bytesPerSample, samples[i], info);
    }
  }

  return new Uint8Array(buffer);
}

/**
 * Write complex samples from an array of ComplexSample objects.
 *
 * @param samples - Array of complex samples
 * @param datatype - SigMF datatype string (must be complex type)
 * @returns Uint8Array containing binary sample data
 */
export function writeSamplesComplex(
  samples: ComplexSample[],
  datatype: SigMFDatatype | string
): Uint8Array {
  const info = parseDatatype(datatype);
  if (!info.isComplex) {
    throw new Error('writeSamplesComplex requires a complex datatype');
  }

  const buffer = new ArrayBuffer(samples.length * info.bytesPerSample);
  const view = new DataView(buffer);

  for (let i = 0; i < samples.length; i++) {
    const offset = i * info.bytesPerSample;
    writeValue(view, offset, samples[i].i, info);
    writeValue(view, offset + info.bytesPerComponent, samples[i].q, info);
  }

  return new Uint8Array(buffer);
}

/**
 * Generator function for streaming sample reading.
 *
 * Yields chunks of samples as they are read from the source.
 *
 * @param source - File or Blob containing sample data
 * @param datatype - SigMF datatype string
 * @param chunkSamples - Number of samples per chunk (default: 65536)
 * @yields Sample data chunks
 *
 * @example
 * ```ts
 * for await (const chunk of streamSamples(file, 'cf32_le')) {
 *   processChunk(chunk.complex);
 * }
 * ```
 */
export async function* streamSamples(
  source: Blob,
  datatype: SigMFDatatype | string,
  chunkSamples = 65536
): AsyncGenerator<SampleData> {
  const info = parseDatatype(datatype);
  const chunkBytes = chunkSamples * info.bytesPerSample;

  const stream = source.stream();
  const reader = stream.getReader();

  let buffer = new Uint8Array(0);
  let done = false;

  try {
    while (!done) {
      // Read until we have enough for a chunk
      while (buffer.length < chunkBytes && !done) {
        const result = await reader.read();
        if (result.done) {
          done = true;
          break;
        }

        const newBuffer = new Uint8Array(buffer.length + result.value.length);
        newBuffer.set(buffer);
        newBuffer.set(result.value, buffer.length);
        buffer = newBuffer;
      }

      if (buffer.length === 0) break;

      // Process complete samples
      const completeSamples = Math.floor(buffer.length / info.bytesPerSample);
      const completeBytes = completeSamples * info.bytesPerSample;

      if (completeSamples > 0) {
        const chunkBuffer = buffer.slice(0, completeBytes).buffer;
        const samples = readSamples(chunkBuffer, datatype);
        yield samples;

        // Keep remainder for next iteration
        buffer = buffer.slice(completeBytes);
      }
    }

    // Process any remaining complete samples
    if (buffer.length >= info.bytesPerSample) {
      const completeSamples = Math.floor(buffer.length / info.bytesPerSample);
      const completeBytes = completeSamples * info.bytesPerSample;
      const chunkBuffer = buffer.slice(0, completeBytes).buffer;
      yield readSamples(chunkBuffer, datatype);
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Get sample at a specific index from complex data.
 *
 * @param data - Interleaved complex data array
 * @param index - Sample index
 * @returns Complex sample
 */
export function getComplexSample(
  data: Float64Array | Float32Array | number[],
  index: number
): ComplexSample {
  return {
    i: data[index * 2],
    q: data[index * 2 + 1],
  };
}

/**
 * Calculate the magnitude of a complex sample.
 *
 * @param sample - Complex sample
 * @returns Magnitude (sqrt(I² + Q²))
 */
export function magnitude(sample: ComplexSample): number {
  return Math.sqrt(sample.i * sample.i + sample.q * sample.q);
}

/**
 * Calculate the phase of a complex sample in radians.
 *
 * @param sample - Complex sample
 * @returns Phase in radians (-π to π)
 */
export function phase(sample: ComplexSample): number {
  return Math.atan2(sample.q, sample.i);
}

/**
 * Calculate magnitudes for all samples in a complex array.
 *
 * @param complex - Interleaved complex data [I0, Q0, I1, Q1, ...]
 * @returns Float64Array of magnitudes
 */
export function magnitudes(complex: Float64Array | Float32Array | number[]): Float64Array {
  const count = complex.length / 2;
  const result = new Float64Array(count);

  for (let i = 0; i < count; i++) {
    const I = complex[i * 2];
    const Q = complex[i * 2 + 1];
    result[i] = Math.sqrt(I * I + Q * Q);
  }

  return result;
}

/**
 * Calculate phases for all samples in a complex array.
 *
 * @param complex - Interleaved complex data [I0, Q0, I1, Q1, ...]
 * @returns Float64Array of phases in radians
 */
export function phases(complex: Float64Array | Float32Array | number[]): Float64Array {
  const count = complex.length / 2;
  const result = new Float64Array(count);

  for (let i = 0; i < count; i++) {
    result[i] = Math.atan2(complex[i * 2 + 1], complex[i * 2]);
  }

  return result;
}

/**
 * Deinterleave complex samples into separate I and Q arrays.
 *
 * @param complex - Interleaved complex data [I0, Q0, I1, Q1, ...]
 * @returns Object with separate I and Q Float64Arrays
 */
export function deinterleave(
  complex: Float64Array | Float32Array | number[]
): { i: Float64Array; q: Float64Array } {
  const count = complex.length / 2;
  const i = new Float64Array(count);
  const q = new Float64Array(count);

  for (let n = 0; n < count; n++) {
    i[n] = complex[n * 2];
    q[n] = complex[n * 2 + 1];
  }

  return { i, q };
}

/**
 * Interleave separate I and Q arrays into complex samples.
 *
 * @param i - In-phase components
 * @param q - Quadrature components
 * @returns Interleaved Float64Array [I0, Q0, I1, Q1, ...]
 */
export function interleave(
  i: Float64Array | Float32Array | number[],
  q: Float64Array | Float32Array | number[]
): Float64Array {
  if (i.length !== q.length) {
    throw new Error('I and Q arrays must have the same length');
  }

  const result = new Float64Array(i.length * 2);

  for (let n = 0; n < i.length; n++) {
    result[n * 2] = i[n];
    result[n * 2 + 1] = q[n];
  }

  return result;
}
