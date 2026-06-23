/**
 * HIPAA-Compliant Encryption Utility
 * 
 * Provides AES-256-GCM encryption for PHI data at rest.
 * Uses a server-side encryption key stored in environment variables.
 * 
 * Every encrypted value includes:
 * - A unique IV (initialization vector) per encryption
 * - An authentication tag for tamper detection
 * - The encrypted ciphertext
 * 
 * Format: iv:authTag:ciphertext (all base64)
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const ENCODING: BufferEncoding = 'base64';

function getEncryptionKey(): Buffer {
  const key = process.env.PHI_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('PHI_ENCRYPTION_KEY environment variable is required for HIPAA compliance');
  }
  // Derive a 32-byte key from the environment variable using SHA-256
  return crypto.createHash('sha256').update(key).digest();
}

/**
 * Encrypt a string value
 * Returns null if the input is null/undefined/empty
 */
export function encryptPHI(plaintext: string | null | undefined): string | null {
  if (!plaintext) return null;
  
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', ENCODING);
    encrypted += cipher.final(ENCODING);
    
    const authTag = cipher.getAuthTag();
    
    // Format: iv:authTag:ciphertext
    return `${iv.toString(ENCODING)}:${authTag.toString(ENCODING)}:${encrypted}`;
  } catch (error) {
    console.error('[HIPAA ENCRYPT] Encryption failed:', error);
    throw new Error('Failed to encrypt PHI data');
  }
}

/**
 * Decrypt an encrypted string value
 * Returns null if the input is null/undefined/empty
 */
export function decryptPHI(encrypted: string | null | undefined): string | null {
  if (!encrypted) return null;
  
  // If the value doesn't look encrypted (no colons), return as-is
  // This handles legacy unencrypted data
  if (!encrypted.includes(':')) {
    return encrypted;
  }
  
  try {
    const parts = encrypted.split(':');
    if (parts.length !== 3) {
      // Not in our encrypted format, return as-is (legacy data)
      return encrypted;
    }
    
    const key = getEncryptionKey();
    const iv = Buffer.from(parts[0], ENCODING);
    const authTag = Buffer.from(parts[1], ENCODING);
    const ciphertext = parts[2];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(ciphertext, ENCODING, 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    // If decryption fails, the data might be legacy unencrypted data
    console.warn('[HIPAA DECRYPT] Decryption failed, returning raw value (legacy data?)');
    return encrypted;
  }
}

/**
 * Encrypt an object's string values (shallow)
 * Useful for encrypting note content sections
 */
export function encryptPHIObject(obj: Record<string, any> | null | undefined): Record<string, any> | null {
  if (!obj) return null;
  
  const encrypted: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      encrypted[key] = encryptPHI(value);
    } else {
      encrypted[key] = value;
    }
  }
  return encrypted;
}

/**
 * Decrypt an object's string values (shallow)
 */
export function decryptPHIObject(obj: Record<string, any> | null | undefined): Record<string, any> | null {
  if (!obj) return null;
  
  const decrypted: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      decrypted[key] = decryptPHI(value);
    } else {
      decrypted[key] = value;
    }
  }
  return decrypted;
}

/**
 * Generate a new encryption key (for initial setup)
 * Run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}
