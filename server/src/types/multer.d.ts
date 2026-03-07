// Fallback declaration for multer.
// TypeScript uses @types/multer when it's installed (node_modules takes
// precedence over ambient declarations). This file is used ONLY when
// @types/multer is not available in the build environment (e.g. Render).
declare module 'multer' {
  import { RequestHandler } from 'express';

  interface File {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
    destination: string;
    filename: string;
    path: string;
    stream: NodeJS.ReadableStream;
  }

  interface FileFilterCallback {
    (error: Error): void;
    (error: null, acceptFile: boolean): void;
  }

  interface StorageEngine {
    _handleFile(
      req: Express.Request,
      file: File,
      callback: (error?: unknown, info?: Partial<File>) => void,
    ): void;
    _removeFile(
      req: Express.Request,
      file: File,
      callback: (error: Error | null) => void,
    ): void;
  }

  interface Options {
    storage?: StorageEngine;
    limits?: {
      fieldNameSize?: number;
      fieldSize?: number;
      fields?: number;
      fileSize?: number;
      files?: number;
      parts?: number;
      headerPairs?: number;
    };
    preservePath?: boolean;
    fileFilter?: (
      req: Express.Request,
      file: File,
      callback: FileFilterCallback,
    ) => void;
  }

  interface Multer {
    single(fieldname: string): RequestHandler;
    array(fieldname: string, maxCount?: number): RequestHandler;
    fields(fields: { name: string; maxCount?: number }[]): RequestHandler;
    none(): RequestHandler;
    any(): RequestHandler;
  }

  function multer(options?: Options): Multer;
  namespace multer {
    function memoryStorage(): StorageEngine;
    function diskStorage(options: {
      destination?:
        | string
        | ((
            req: Express.Request,
            file: File,
            cb: (error: Error | null, destination: string) => void,
          ) => void);
      filename?: (
        req: Express.Request,
        file: File,
        cb: (error: Error | null, filename: string) => void,
      ) => void;
    }): StorageEngine;

    class MulterError extends Error {
      code: string;
      field?: string;
      constructor(code: string, field?: string);
    }
  }

  export = multer;
}
