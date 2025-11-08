import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

export function encryptBuffer(buffer) {
  const key = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: encrypted,
    key: key.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

export function decryptBuffer({ ciphertext, key, iv, authTag }) {
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(key, 'base64'), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted;
}

export function buildTextPreview(buffer, limit = 280) {
  try {
    const text = buffer.toString('utf8');
    return text.length > limit ? `${text.slice(0, limit)}...` : text;
  } catch {
    return null;
  }
}
