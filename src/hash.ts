/**
 * SigMF Hash Utilities
 *
 * Provides opt-in SHA-512 hash calculation and verification for dataset files
 * using the Web Crypto API.
 */

/**
 * Calculate SHA-512 hash of data using Web Crypto API.
 *
 * @param data - Data to hash (ArrayBuffer, Uint8Array, or Blob)
 * @returns SHA-512 hash as lowercase hex string (128 characters)
 *
 * @example
 * ```ts
 * const hash = await sha512(dataBuffer);
 * recording.setSha512(hash);
 * ```
 */
export async function sha512(data: ArrayBuffer | Uint8Array | Blob): Promise<string> {
  let buffer: ArrayBuffer;

  if (data instanceof Blob) {
    buffer = await data.arrayBuffer();
  } else if (data instanceof Uint8Array) {
    // Create a proper ArrayBuffer copy to handle SharedArrayBuffer case
    const copy = new Uint8Array(data.byteLength);
    copy.set(data);
    buffer = copy.buffer as ArrayBuffer;
  } else {
    buffer = data;
  }

  const hashBuffer = await crypto.subtle.digest('SHA-512', buffer);
  const hashArray = new Uint8Array(hashBuffer);

  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verify that data matches an expected SHA-512 hash.
 *
 * @param data - Data to verify
 * @param expectedHash - Expected hash as hex string (128 characters)
 * @returns True if hash matches, false otherwise
 *
 * @example
 * ```ts
 * const expectedHash = metadata.global['core:sha512'];
 * if (expectedHash) {
 *   const valid = await verifySha512(dataFile, expectedHash);
 *   if (!valid) {
 *     console.error('Data file hash mismatch!');
 *   }
 * }
 * ```
 */
export async function verifySha512(
  data: ArrayBuffer | Uint8Array | Blob,
  expectedHash: string
): Promise<boolean> {
  const actualHash = await sha512(data);
  return actualHash.toLowerCase() === expectedHash.toLowerCase();
}

/**
 * Calculate SHA-512 hash of a large file using streaming.
 *
 * For files larger than available memory, this function reads the file
 * in chunks. Note: This requires a streaming hash implementation which
 * is not available in Web Crypto. For very large files in browsers,
 * consider using a library like hash-wasm.
 *
 * This implementation loads the entire file into memory, so it's limited
 * by browser memory constraints (~2GB typically).
 *
 * @param file - File or Blob to hash
 * @param onProgress - Optional progress callback (bytesRead, totalBytes)
 * @returns SHA-512 hash as lowercase hex string
 *
 * @example
 * ```ts
 * const hash = await sha512Streaming(file, (read, total) => {
 *   console.log(`Hashing: ${(read / total * 100).toFixed(1)}%`);
 * });
 * ```
 */
export async function sha512Streaming(
  file: Blob,
  onProgress?: (bytesRead: number, totalBytes: number) => void
): Promise<string> {
  // Web Crypto doesn't support incremental hashing
  // For true streaming, you'd need hash-wasm or similar
  // This implementation reports progress while reading

  const totalBytes = file.size;
  const chunkSize = 10 * 1024 * 1024; // 10MB chunks for progress reporting
  const chunks: Uint8Array[] = [];

  let bytesRead = 0;

  // Read in chunks for progress reporting
  while (bytesRead < totalBytes) {
    const chunk = file.slice(bytesRead, bytesRead + chunkSize);
    const buffer = await chunk.arrayBuffer();
    chunks.push(new Uint8Array(buffer));
    bytesRead += buffer.byteLength;
    onProgress?.(bytesRead, totalBytes);
  }

  // Concatenate all chunks
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  return sha512(combined);
}

/**
 * Result of hash verification including timing information.
 */
export interface HashVerificationResult {
  /** Whether the hash matched */
  valid: boolean;
  /** Expected hash from metadata */
  expected: string;
  /** Actual hash calculated from data */
  actual: string;
  /** Time taken to calculate hash in milliseconds */
  durationMs: number;
}

/**
 * Verify hash with detailed result including timing.
 *
 * @param data - Data to verify
 * @param expectedHash - Expected hash from metadata
 * @returns Verification result with timing information
 *
 * @example
 * ```ts
 * const result = await verifyHashDetailed(dataFile, metadata.global['core:sha512']!);
 * console.log(`Hash ${result.valid ? 'valid' : 'INVALID'} (took ${result.durationMs}ms)`);
 * ```
 */
export async function verifyHashDetailed(
  data: ArrayBuffer | Uint8Array | Blob,
  expectedHash: string
): Promise<HashVerificationResult> {
  const startTime = performance.now();
  const actual = await sha512(data);
  const endTime = performance.now();

  return {
    valid: actual.toLowerCase() === expectedHash.toLowerCase(),
    expected: expectedHash.toLowerCase(),
    actual: actual.toLowerCase(),
    durationMs: endTime - startTime,
  };
}
