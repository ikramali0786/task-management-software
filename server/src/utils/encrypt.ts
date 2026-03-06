import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_HEX = process.env.ENCRYPTION_SECRET || '';

function getKey(): Buffer {
  if (!KEY_HEX || KEY_HEX.length < 32) {
    throw new Error('ENCRYPTION_SECRET env var must be set (min 32 chars).');
  }
  // Use first 32 bytes of the secret as the key
  return Buffer.from(KEY_HEX.slice(0, 64), 'hex').slice(0, 32);
}

export interface EncryptedPayload {
  encryptedKey: string; // hex
  iv: string;           // hex
  authTag: string;      // hex
}

export function encrypt(plaintext: string): EncryptedPayload {
  const key = getKey();
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    encryptedKey: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

export function decrypt({ encryptedKey, iv, authTag }: EncryptedPayload): string {
  const key = getKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedKey, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
