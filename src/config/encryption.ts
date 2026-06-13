import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'hive-default-32-char-encryption-key-for-dev';

// Ensure the key is exactly 32 bytes
const getKey = (): Buffer => {
  // If the provided key is too short or too long, pad it or slice it to ensure 32 bytes
  const key = ENCRYPTION_KEY.padEnd(32, '0').substring(0, 32);
  return Buffer.from(key, 'utf8');
};

/**
 * Encrypts a plain text string.
 * Returns the encrypted string in the format ivHex:encryptedHex
 */
export function encrypt(text: string): string {
  if (!text) return '';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts an encrypted hex string.
 * Expects the format ivHex:encryptedHex
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return '';
  const parts = encryptedText.split(':');
  const ivHex = parts.shift();
  const encryptedData = parts.join(':');
  
  if (!ivHex || !encryptedData) {
    throw new Error('Malformed encrypted data structure');
  }
  
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
