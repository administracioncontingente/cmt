const DEV_JWT_FALLBACK = 'agsch-jamboree-poland-2027-super-secret-key-32chars!';

/**
 * Returns the HMAC JWT signing/verification secret as UTF-8 bytes.
 * Requires JWT_SECRET in production; falls back to a deterministic dev secret otherwise.
 */
export function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (secret) {
    return new TextEncoder().encode(secret);
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production');
  }
  return new TextEncoder().encode(DEV_JWT_FALLBACK);
}
