import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

function sanitizeKey(key) {
  if (!key) {
    throw new Error('Storage key is required');
  }
  if (key.includes('..')) {
    throw new Error('Storage key may not contain parent directory references');
  }
  return key.replace(/^\/+/, '');
}

export async function saveObjectToDisk({ key, buffer }) {
  const safeKey = sanitizeKey(key);
  const fullPath = path.join(UPLOAD_ROOT, safeKey);
  await ensureDir(path.dirname(fullPath));
  await fs.writeFile(fullPath, buffer);
  return {
    key: safeKey,
    storagePath: fullPath,
  };
}

export async function readObjectFromDisk(key) {
  const safeKey = sanitizeKey(key);
  const fullPath = path.join(UPLOAD_ROOT, safeKey);
  return fs.readFile(fullPath);
}

export async function deleteObjectFromDisk(key) {
  const safeKey = sanitizeKey(key);
  const fullPath = path.join(UPLOAD_ROOT, safeKey);
  await fs.rm(fullPath, { force: true });
}
