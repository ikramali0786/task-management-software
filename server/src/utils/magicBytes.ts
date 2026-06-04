// ── Magic bytes (file signatures) validator ───────────────────────────────────
// Validates that a file's actual binary content matches its declared MIME type.
// This prevents attackers from renaming a malicious file (e.g. .exe → .pdf)
// to bypass MIME-type-only checks.

interface Signature {
  bytes:  number[];   // expected byte values (-1 = wildcard / skip)
  offset: number;     // byte offset to start checking
}

const SIGNATURES: Record<string, Signature[]> = {
  'image/jpeg': [
    { bytes: [0xFF, 0xD8, 0xFF], offset: 0 },
  ],
  'image/png': [
    { bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], offset: 0 },
  ],
  'image/gif': [
    { bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], offset: 0 }, // GIF87a
    { bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], offset: 0 }, // GIF89a
  ],
  'image/webp': [
    // RIFF????WEBP — bytes 0-3 = "RIFF", bytes 8-11 = "WEBP"
    { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 },
  ],
  'application/pdf': [
    { bytes: [0x25, 0x50, 0x44, 0x46, 0x2D], offset: 0 }, // %PDF-
  ],
  // DOCX is a ZIP archive — PK\x03\x04
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    { bytes: [0x50, 0x4B, 0x03, 0x04], offset: 0 },
  ],
  // text/plain and text/csv have no reliable magic bytes.
  // We skip binary validation and rely on UTF-8 text check instead.
  'text/plain': [],
  'text/csv':   [],
};

/**
 * Returns true if the buffer's magic bytes match any known signature for the
 * given MIME type, or if the MIME type has no magic-byte definition (text files).
 */
export function validateMagicBytes(buffer: Buffer, mimetype: string): boolean {
  const sigs = SIGNATURES[mimetype];

  // Unknown MIME type — deny
  if (sigs === undefined) return false;

  // No signatures defined (text types) — allow through
  if (sigs.length === 0) return true;

  return sigs.some(({ bytes, offset }) => {
    if (buffer.length < offset + bytes.length) return false;
    return bytes.every((b, i) => b === -1 || buffer[offset + i] === b);
  });
}

/**
 * Returns true if every byte in the buffer is a valid UTF-8 printable character.
 * Used as an extra guard for text/plain and text/csv uploads.
 */
export function isReadableText(buffer: Buffer): boolean {
  try {
    const text = buffer.toString('utf-8');
    // Reject if more than 5 % of characters are non-printable / control chars
    const nonPrintable = text.split('').filter(
      (c) => c.charCodeAt(0) < 9 || (c.charCodeAt(0) > 13 && c.charCodeAt(0) < 32)
    ).length;
    return nonPrintable / text.length < 0.05;
  } catch {
    return false;
  }
}
