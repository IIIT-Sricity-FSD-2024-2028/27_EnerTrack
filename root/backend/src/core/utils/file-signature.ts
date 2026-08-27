import * as fs from "fs";
import { BadRequestException } from "@nestjs/common";

/**
 * Magic-byte (file signature) validation.
 *
 * WHY THIS EXISTS
 * ───────────────
 * The multer fileFilter checks the file extension and the MIME type. Both are
 * supplied by the client and both can be forged: rename `payload.exe` to
 * `invoice.pdf`, set `Content-Type: application/pdf`, and the filter waves it
 * through. Before this, that upload was accepted and written to disk.
 *
 * The real file type is determined by the bytes at the start of the file, not
 * by its name. A genuine PDF begins "%PDF". A Windows executable begins "MZ".
 * No amount of renaming changes that.
 *
 * WHY IT IS NOT IN THE fileFilter
 * ───────────────────────────────
 * multer's fileFilter runs BEFORE any bytes are written — it only ever sees
 * the declared metadata, so it cannot inspect content. The check therefore has
 * to happen after the file lands, which is why a rejected file must also be
 * deleted here rather than simply refused.
 */

interface Signature {
  /** Human-readable name used in the error message. */
  label: string;
  /** Byte sequences, any one of which marks a valid file of this kind. */
  magic: number[][];
}

const SIGNATURES: Record<string, Signature> = {
  // "%PDF"
  pdf: { label: "PDF", magic: [[0x25, 0x50, 0x44, 0x46]] },
  image: {
    label: "JPEG or PNG",
    magic: [
      [0xff, 0xd8, 0xff], // JPEG
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], // PNG
    ],
  },
};

/** Reads the first `length` bytes of a file without loading the whole thing. */
function readHeader(filePath: string, length = 16): Buffer {
  const fd = fs.openSync(filePath, "r");
  try {
    const buffer = Buffer.alloc(length);
    const read = fs.readSync(fd, buffer, 0, length, 0);
    return buffer.subarray(0, read);
  } finally {
    fs.closeSync(fd);
  }
}

/** Deletes a rejected upload so refused files never accumulate on disk. */
function discard(filePath: string): void {
  try {
    fs.unlinkSync(filePath);
  } catch {
    // Already gone or locked — not worth failing the request over.
  }
}

/**
 * Throws BadRequestException (and deletes the file) unless its leading bytes
 * match the expected kind.
 *
 * @param kind  'pdf' | 'image' | 'csv'
 */
export function assertFileSignature(
  file: { path: string; originalname: string },
  kind: "pdf" | "image" | "csv",
): void {
  if (!file?.path || !fs.existsSync(file.path)) return;

  // CSV needs a wider sample than a magic number does: there is no signature
  // to match at offset 0, so the check scans a block of the file for evidence
  // of binary content instead.
  const header = readHeader(file.path, kind === "csv" ? 512 : 16);

  // CSV is plain text and has no signature to match, so the check is
  // inverted: reject anything that looks binary. A NUL byte is the clearest
  // tell — text files do not contain them, executables and images routinely do.
  if (kind === "csv") {
    if (header.includes(0x00)) {
      discard(file.path);
      throw new BadRequestException(
        `'${file.originalname}' is not a text CSV file — it contains binary data`,
      );
    }
    return;
  }

  const expected = SIGNATURES[kind];
  const matches = expected.magic.some((magic) =>
    magic.every((byte, i) => header[i] === byte),
  );

  if (!matches) {
    discard(file.path);
    throw new BadRequestException(
      `'${file.originalname}' is not a real ${expected.label} file. ` +
        `Its contents do not match its extension.`,
    );
  }
}

/** Convenience wrapper for endpoints that accept several files at once. */
export function assertFileSignatures(
  files: { path: string; originalname: string }[],
  kind: "pdf" | "image" | "csv",
): void {
  for (const file of files) assertFileSignature(file, kind);
}
