// Fallback declaration for pdf-parse.
// TypeScript uses @types/pdf-parse when it's installed (node_modules takes
// precedence over ambient declarations). This file is used ONLY when
// @types/pdf-parse is not available in the build environment (e.g. Render).
declare module 'pdf-parse' {
  interface PDFData {
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: Record<string, unknown>;
    text: string;
    version: string;
  }

  function pdfParse(
    dataBuffer: Buffer | Uint8Array,
    options?: Record<string, unknown>,
  ): Promise<PDFData>;

  export = pdfParse;
}
