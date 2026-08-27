import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { BadRequestException } from '@nestjs/common';

// Shared filename generator: random id + timestamp + original extension.
// Never trust the client's filename.
function safeFilename(file: Express.Multer.File): string {
  const ext = extname(file.originalname).toLowerCase();
  return `${randomUUID()}-${Date.now()}${ext}`;
}

function makeStorage() {
  return diskStorage({
    destination: './uploads',
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
