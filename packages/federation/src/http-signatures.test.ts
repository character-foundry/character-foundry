/**
 * HTTP Signatures Tests
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  parseSignatureHeader,
  buildSigningString,
  calculateDigest,
} from './http-signatures.js';

describe('HTTP Signatures', () => {
  describe('parseSignatureHeader', () => {
    it('should parse a valid signature header', () => {
      const header =
        'keyId="https://example.com/users/test#main-key",' +
        'algorithm="rsa-sha256",' +
        'headers="(request-target) host date",' +
        'signature="base64signature=="';

      const parsed = parseSignatureHeader(header);

      expect(parsed).not.toBeNull();
      expect(parsed?.keyId).toBe('https://example.com/users/test#main-key');
      expect(parsed?.algorithm).toBe('rsa-sha256');
      expect(parsed?.headers).toEqual(['(request-target)', 'host', 'date']);
      expect(parsed?.signature).toBe('base64signature==');
    });

    it('should parse signature with hs2019 algorithm', () => {
      const header =
        'keyId="https://example.com/actor#main-key",' +
        'algorithm="hs2019",' +
        'headers="(request-target) host date digest",' +
        'signature="abc123=="';

      const parsed = parseSignatureHeader(header);

      expect(parsed?.algorithm).toBe('hs2019');
      expect(parsed?.headers).toEqual(['(request-target)', 'host', 'date', 'digest']);
    });

    it('should use default headers if not specified', () => {
      const header = 'keyId="https://example.com/actor#key",signature="sig=="';

      const parsed = parseSignatureHeader(header);

      expect(parsed).not.toBeNull();
      expect(parsed?.headers).toEqual(['(request-target)', 'host', 'date']);
    });

    it('should return null for missing keyId', () => {
      const header = 'algorithm="rsa-sha256",signature="sig=="';

      const parsed = parseSignatureHeader(header);

      expect(parsed).toBeNull();
    });

    it('should return null for missing signature', () => {
      const header = 'keyId="https://example.com/actor#key",algorithm="rsa-sha256"';

      const parsed = parseSignatureHeader(header);

      expect(parsed).toBeNull();
    });
  });

  describe('buildSigningString', () => {
    it('should build signing string with request-target', () => {
      const headers = new Headers({
        'Host': 'example.com',
        'Date': 'Sun, 06 Nov 1994 08:49:37 GMT',
      });

      const result = buildSigningString(
        'POST',
        '/inbox',
        headers,
        ['(request-target)', 'host', 'date']
      );

      expect(result).toBe(
        '(request-target): post /inbox\n' +
        'host: example.com\n' +
        'date: Sun, 06 Nov 1994 08:49:37 GMT'
      );
    });

    it('should handle GET requests', () => {
      const headers = new Headers({
        'Host': 'example.com',
      });

      const result = buildSigningString(
        'GET',
        '/users/test',
        headers,
        ['(request-target)', 'host']
      );

      expect(result).toBe(
        '(request-target): get /users/test\n' +
        'host: example.com'
      );
    });

    it('should include digest header when present', () => {
      const headers = new Headers({
        'Host': 'example.com',
        'Digest': 'SHA-256=abc123',
      });

      const result = buildSigningString(
        'POST',
        '/inbox',
        headers,
        ['(request-target)', 'host', 'digest']
      );

      expect(result).toContain('digest: SHA-256=abc123');
    });
  });

  describe('calculateDigest', () => {
    it('should calculate SHA-256 digest for string body', async () => {
      const body = '{"hello":"world"}';

      const digest = await calculateDigest(body);

      // Should be in format SHA-256=base64
      expect(digest).toMatch(/^SHA-256=[\w+/=]+$/);
    });

    it('should produce consistent digests', async () => {
      const body = 'test body content';

      const digest1 = await calculateDigest(body);
      const digest2 = await calculateDigest(body);

      expect(digest1).toBe(digest2);
    });

    it('should produce different digests for different content', async () => {
      const digest1 = await calculateDigest('content A');
      const digest2 = await calculateDigest('content B');

      expect(digest1).not.toBe(digest2);
    });
  });

  // Note: Full signature verification tests would require actual RSA key pairs
  // These would be integration tests using test vectors from Mastodon/Pleroma
});
