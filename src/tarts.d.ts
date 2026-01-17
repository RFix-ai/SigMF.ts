/**
 * Type declarations for the tarts library.
 * @see https://github.com/porsager/tarts
 */

declare module 'tarts' {
  interface TarFile {
    /** File name/path */
    name: string;
    /** File content as string or Uint8Array */
    content: string | Uint8Array;
  }

  /**
   * Create a TAR archive from an array of files.
   * @param files - Array of files to include in the archive
   * @returns Uint8Array containing the TAR archive
   */
  function Tar(files: TarFile[]): Uint8Array;

  export default Tar;
}
