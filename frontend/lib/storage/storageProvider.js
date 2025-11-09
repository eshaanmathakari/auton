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
  try {
    const module = await import('./s3Storage.js');
    return module;
  } catch (error) {
    // If S3 module can't be loaded (e.g., @aws-sdk/client-s3 not installed), fall back to local storage
    console.warn('S3 storage module not available, falling back to local storage:', error.message);
    throw new Error('S3 is not available');
  }
}

export async function saveObject({ key, buffer, contentType }) {
  if (shouldUseS3) {
    try {
      const { saveObjectToS3 } = await importS3Module();
      return saveObjectToS3({ key, buffer, contentType });
    } catch (error) {
      // Fall back to local storage if S3 is not available
      console.warn('Falling back to local storage:', error.message);
      return saveObjectToDisk({ key, buffer });
    }
  }

  return saveObjectToDisk({ key, buffer });
}

export async function readObject(key) {
  if (shouldUseS3) {
    try {
      const { readObjectFromS3 } = await importS3Module();
      return readObjectFromS3(key);
    } catch (error) {
      // Fall back to local storage if S3 is not available
      console.warn('Falling back to local storage:', error.message);
      return readObjectFromDisk(key);
    }
  }
  return readObjectFromDisk(key);
}

export async function deleteObject(key) {
  if (shouldUseS3) {
    try {
      const { deleteObjectFromS3 } = await importS3Module();
      return deleteObjectFromS3(key);
    } catch (error) {
      // Fall back to local storage if S3 is not available
      console.warn('Falling back to local storage:', error.message);
      return deleteObjectFromDisk(key);
    }
  }
  return deleteObjectFromDisk(key);
}
