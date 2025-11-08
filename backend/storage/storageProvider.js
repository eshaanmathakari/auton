import { saveObjectToDisk, readObjectFromDisk, deleteObjectFromDisk } from './localStorage.js';

const shouldUseS3 = Boolean(
  process.env.S3_BUCKET &&
    process.env.S3_REGION &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.USE_LOCAL_STORAGE !== 'true'
);

async function importS3Module() {
  if (!shouldUseS3) {
    throw new Error('S3 is not configured');
  }
  const module = await import('./s3Storage.js');
  return module;
}

export async function saveObject({ key, buffer, contentType }) {
  if (shouldUseS3) {
    const { saveObjectToS3 } = await importS3Module();
    return saveObjectToS3({ key, buffer, contentType });
  }

  return saveObjectToDisk({ key, buffer });
}

export async function readObject(key) {
  if (shouldUseS3) {
    const { readObjectFromS3 } = await importS3Module();
    return readObjectFromS3(key);
  }
  return readObjectFromDisk(key);
}

export async function deleteObject(key) {
  if (shouldUseS3) {
    const { deleteObjectFromS3 } = await importS3Module();
    return deleteObjectFromS3(key);
  }
  return deleteObjectFromDisk(key);
}
