import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import { BadRequestException } from '@nestjs/common';
import { currentOrgId } from '../tenancy/tenant-context';

// Root folder for every upload. Resolved from the process working directory
// so it does not depend on where node was launched from.
const UPLOAD_ROOT = join(process.cwd(), 'uploads');

// multer's diskStorage does NOT create missing directories — it fails with
// ENOENT instead. uploads/ is gitignored, so a fresh clone has no copy of it
// and the very first upload would 500. Create it once at module load, the
// same way logger.middleware.ts and security.middleware.ts create logs/.
fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

// Shared filename generator: random id + timestamp + original extension.
// Never trust the client's filename.
function safeFilename(file: Express.Multer.File): string {
  const ext = extname(file.originalname).toLowerCase();
  return `${randomUUID()}-${Date.now()}${ext}`;
}

/**
 * Turns the tenant id into a single safe path segment.
 *
 * currentOrgId() ultimately comes from the x-org-id request header, which is
 * attacker-controlled: a value like "../../src" would otherwise let an upload
 * escape the uploads folder and overwrite source files. Anything that is not
 * a letter, digit, dash or underscore is stripped, so the result can never
 * contain a slash or a "..".
 */
function tenantFolder(): string {
  const orgId = currentOrgId();
  if (!orgId) return '_platform';
  const safe = orgId.replace(/[^A-Za-z0-9_-]/g, '');
  return safe.length > 0 ? safe : '_platform';
}

/**
 * Files are stored under uploads/<organisation-id>/ so one tenant can never
 * read another's documents by guessing a filename. Callers with no tenant
 * context (EnerTrack staff) fall back to uploads/_platform/.
 */
function makeStorage() {
  return diskStorage({
    destination: (req, file, callback) => {
      const tenantDir = join(UPLOAD_ROOT, tenantFolder());
      fs.mkdirSync(tenantDir, { recursive: true });
      callback(null, tenantDir);
    },
    filename: (req, file, callback) => {
      callback(null, safeFilename(file));
    },
  });
}

// --- Recipe 1: Spreadsheet (bulk meter readings) ---
export const spreadsheetUploadConfig = {
  storage: makeStorage(),
  fileFilter: (req: any, file: Express.Multer.File, callback: Function) => {
    const extOk = extname(file.originalname).toLowerCase() === '.csv';
    const mimeOk = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/csv',
    ].includes(file.mimetype);
    if (!extOk || !mimeOk) {
      return callback(new BadRequestException('Only .csv files are accepted'), false);
    }
    callback(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
};

// --- Recipe 2: Document (invoice PDF attachment) ---
export const documentUploadConfig = {
  storage: makeStorage(),
  fileFilter: (req: any, file: Express.Multer.File, callback: Function) => {
    const extOk = extname(file.originalname).toLowerCase() === '.pdf';
    const mimeOk = file.mimetype === 'application/pdf';
    if (!extOk || !mimeOk) {
      return callback(new BadRequestException('Only .pdf files are accepted'), false);
    }
    callback(null, true);
  },
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
};

// --- Recipe 3: Photo (wastage report evidence, up to 4) ---
export const photoUploadConfig = {
  storage: makeStorage(),
  fileFilter: (req: any, file: Express.Multer.File, callback: Function) => {
    const allowedExt = ['.jpg', '.jpeg', '.png'];
    const allowedMime = ['image/jpeg', 'image/png'];
    const extOk = allowedExt.includes(extname(file.originalname).toLowerCase());
    const mimeOk = allowedMime.includes(file.mimetype);
    if (!extOk || !mimeOk) {
      return callback(new BadRequestException('Only .jpg, .jpeg, .png files are accepted'), false);
    }
    callback(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024, files: 4 },
};
