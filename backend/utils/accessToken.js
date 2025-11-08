import crypto from 'crypto';

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'dev-secret-change-me';

function toBase64Url(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(str) {
  const padLength = (4 - (str.length % 4)) % 4;
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(padLength);
  return Buffer.from(base64, 'base64');
}

function sign(payloadSegment) {
  return toBase64Url(crypto.createHmac('sha256', ACCESS_TOKEN_SECRET).update(payloadSegment).digest());
}

export function createAccessToken(payload, expiresInSeconds = 300) {
  const exp = Date.now() + expiresInSeconds * 1000;
  const tokenId = crypto.randomUUID();
  const body = { ...payload, tokenId, exp };
  const payloadSegment = toBase64Url(Buffer.from(JSON.stringify(body)));
  const signature = sign(payloadSegment);
  return {
    token: `${payloadSegment}.${signature}`,
    tokenId,
    exp,
  };
}

export function verifyAccessToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return { valid: false, error: 'Malformed token' };
  }

  const [payloadSegment, providedSignature] = token.split('.');
  const expectedSignature = sign(payloadSegment || '');
  const safeProvided = fromBase64Url(providedSignature || '');
  const safeExpected = fromBase64Url(expectedSignature);

  if (
    safeProvided.length !== safeExpected.length ||
    !crypto.timingSafeEqual(safeProvided, safeExpected)
  ) {
    return { valid: false, error: 'Invalid signature' };
  }

  const payloadJson = fromBase64Url(payloadSegment || '').toString('utf8');
  const payload = JSON.parse(payloadJson);

  if (payload.exp && Date.now() > payload.exp) {
    return { valid: false, error: 'Token expired', payload };
  }

  return { valid: true, payload };
}
