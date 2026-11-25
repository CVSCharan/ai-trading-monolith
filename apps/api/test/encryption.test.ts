import { describe, expect, test } from 'bun:test';
import { encrypt, decrypt } from '../src/utils/encryption';
import { randomBytes } from 'crypto';

describe('AES-256-GCM encryption', () => {
  test('round-trips plaintext with 32-byte key', () => {
    const key = randomBytes(32);
    const secret = 'JBSWY3DPEHPK3PXP';
    const ciphertext = encrypt(secret, key);

    expect(ciphertext).not.toBe(secret);
    expect(decrypt(ciphertext, key)).toBe(secret);
  });

  test('produces unique ciphertexts for same plaintext (random IV)', () => {
    const key = randomBytes(32);
    const a = encrypt('same-secret', key);
    const b = encrypt('same-secret', key);
    expect(a).not.toBe(b);
  });

  test('fails authentication when ciphertext is tampered with', () => {
    const key = randomBytes(32);
    const buf = Buffer.from(encrypt('sensitive-token', key), 'base64');
    buf[buf.length - 1] = buf[buf.length - 1]! ^ 0xff;
    expect(() => decrypt(buf.toString('base64'), key)).toThrow();
  });

  test('fails when decrypted with wrong key', () => {
    const key1 = randomBytes(32);
    const key2 = randomBytes(32);
    const ct = encrypt('secret', key1);
    expect(() => decrypt(ct, key2)).toThrow();
  });
});
