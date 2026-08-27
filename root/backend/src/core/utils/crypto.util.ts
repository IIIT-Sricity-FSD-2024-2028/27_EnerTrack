import * as crypto from 'crypto';

/**
 * Hashes a plaintext password using scrypt and a random salt.
 * Returns a string in the format "salt:hash".
 */
export function hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${derivedKey}`;
}

/**
 * Verifies a plaintext password against a stored "salt:hash" string.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
    if (!storedHash || !storedHash.includes(':')) {
        // Fallback for any unhashed passwords during migration/dev
        return password === storedHash;
    }
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) return false;
    const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
    return key === derivedKey;
}
