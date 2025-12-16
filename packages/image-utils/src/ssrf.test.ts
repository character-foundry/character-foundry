/**
 * SSRF protection tests
 */

import { describe, it, expect } from 'vitest';
import { isURLSafe, isSafeForFetch, filterSafeUrls } from './ssrf.js';

describe('isURLSafe', () => {
  describe('valid URLs', () => {
    it('allows public HTTPS URLs', () => {
      const check = isURLSafe('https://example.com/image.png');
      expect(check.safe).toBe(true);
    });

    it('allows public HTTP URLs', () => {
      const check = isURLSafe('http://example.com/image.png');
      expect(check.safe).toBe(true);
    });

    it('allows CDN URLs', () => {
      const check = isURLSafe('https://cdn.example.com/assets/img.png');
      expect(check.safe).toBe(true);
    });
  });

  describe('localhost blocking', () => {
    it('blocks localhost by default', () => {
      const check = isURLSafe('http://localhost/secret');
      expect(check.safe).toBe(false);
      expect(check.reason).toContain('Localhost');
    });

    it('blocks 127.0.0.1', () => {
      const check = isURLSafe('http://127.0.0.1:8080/admin');
      expect(check.safe).toBe(false);
      expect(check.reason).toContain('Localhost');
    });

    it('blocks 127.x.x.x range', () => {
      const check = isURLSafe('http://127.1.2.3/internal');
      expect(check.safe).toBe(false);
    });

    it('blocks IPv6 localhost ::1', () => {
      const check = isURLSafe('http://[::1]/admin');
      expect(check.safe).toBe(false);
      expect(check.reason).toContain('Localhost');
    });

    it('allows localhost when explicitly enabled', () => {
      const check = isURLSafe('http://localhost/dev', {
        allowLocalhost: true,
      });
      expect(check.safe).toBe(true);
    });
  });

  describe('private IP blocking', () => {
    it('blocks 10.x.x.x range', () => {
      const check = isURLSafe('http://10.0.0.1/internal');
      expect(check.safe).toBe(false);
      expect(check.reason).toContain('Private IP');
    });

    it('blocks 172.16-31.x.x range', () => {
      expect(isURLSafe('http://172.16.0.1/admin').safe).toBe(false);
      expect(isURLSafe('http://172.31.255.255/admin').safe).toBe(false);
    });

    it('allows 172.15.x.x and 172.32.x.x (outside range)', () => {
      expect(isURLSafe('http://172.15.0.1/public').safe).toBe(true);
      expect(isURLSafe('http://172.32.0.1/public').safe).toBe(true);
    });

    it('blocks 192.168.x.x range', () => {
      const check = isURLSafe('http://192.168.1.1/router');
      expect(check.safe).toBe(false);
      expect(check.reason).toContain('Private IP');
    });

    it('blocks link-local 169.254.x.x', () => {
      const check = isURLSafe('http://169.254.169.254/metadata');
      expect(check.safe).toBe(false);
    });

    it('allows private IPs when explicitly enabled', () => {
      const check = isURLSafe('http://192.168.1.1/admin', {
        allowPrivateIPs: true,
      });
      expect(check.safe).toBe(true);
    });
  });

  describe('IPv6 private ranges', () => {
    it('blocks fc00::/7 unique local addresses', () => {
      expect(isURLSafe('http://[fc00::1]/internal').safe).toBe(false);
      expect(isURLSafe('http://[fd12:3456::1]/internal').safe).toBe(false);
    });

    it('blocks fe80::/10 link-local', () => {
      const check = isURLSafe('http://[fe80::1]/local');
      expect(check.safe).toBe(false);
    });
  });

  describe('protocol validation', () => {
    it('blocks data URLs by default', () => {
      const check = isURLSafe('data:image/png;base64,abc123');
      expect(check.safe).toBe(false);
      expect(check.reason).toContain('Data URLs');
    });

    it('allows data URLs when enabled', () => {
      const check = isURLSafe('data:image/png;base64,abc', {
        allowDataUrls: true,
      });
      expect(check.safe).toBe(true);
    });

    it('blocks file:// protocol', () => {
      const check = isURLSafe('file:///etc/passwd');
      expect(check.safe).toBe(false);
      expect(check.reason).toContain('Protocol');
    });

    it('blocks ftp:// protocol', () => {
      const check = isURLSafe('ftp://example.com/file.txt');
      expect(check.safe).toBe(false);
      expect(check.reason).toContain('Protocol');
    });

    it('blocks javascript: protocol', () => {
      const check = isURLSafe('javascript:alert(1)');
      expect(check.safe).toBe(false);
    });
  });

  describe('domain allowlist', () => {
    it('allows only whitelisted domains', () => {
      const policy = { allowedDomains: ['example.com', 'cdn.example.net'] };

      expect(isURLSafe('https://example.com/img.png', policy).safe).toBe(true);
      expect(isURLSafe('https://cdn.example.net/img.png', policy).safe).toBe(
        true,
      );
      expect(isURLSafe('https://evil.com/img.png', policy).safe).toBe(false);
    });

    it('supports wildcard subdomains', () => {
      const policy = { allowedDomains: ['*.example.com'] };

      expect(isURLSafe('https://cdn.example.com/img.png', policy).safe).toBe(
        true,
      );
      expect(isURLSafe('https://api.example.com/img.png', policy).safe).toBe(
        true,
      );
      expect(isURLSafe('https://example.com/img.png', policy).safe).toBe(
        false,
      ); // No subdomain
      expect(isURLSafe('https://evil.com/img.png', policy).safe).toBe(false);
    });

    it('wildcard matches base domain when used alone', () => {
      const policy = { allowedDomains: ['*.example.com', 'example.com'] };

      expect(isURLSafe('https://example.com/img.png', policy).safe).toBe(true);
      expect(isURLSafe('https://www.example.com/img.png', policy).safe).toBe(
        true,
      );
    });
  });

  describe('domain blocklist', () => {
    it('blocks specific domains', () => {
      const policy = { blockedDomains: ['evil.com', 'malicious.net'] };

      expect(isURLSafe('https://evil.com/img.png', policy).safe).toBe(false);
      expect(isURLSafe('https://malicious.net/img.png', policy).safe).toBe(
        false,
      );
      expect(isURLSafe('https://good.com/img.png', policy).safe).toBe(true);
    });

    it('supports wildcard blocking', () => {
      const policy = { blockedDomains: ['*.internal.company.com'] };

      expect(
        isURLSafe('https://api.internal.company.com/data', policy).safe,
      ).toBe(false);
      expect(isURLSafe('https://company.com/public', policy).safe).toBe(true);
    });
  });

  describe('invalid URLs', () => {
    it('rejects malformed URLs', () => {
      const check = isURLSafe('not-a-url');
      expect(check.safe).toBe(false);
      expect(check.reason).toContain('Invalid URL');
    });

    it('rejects empty string', () => {
      const check = isURLSafe('');
      expect(check.safe).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('handles URLs with ports', () => {
      expect(isURLSafe('https://example.com:8080/api').safe).toBe(true);
      expect(isURLSafe('http://10.0.0.1:3000/admin').safe).toBe(false);
    });

    it('handles URLs with paths and query strings', () => {
      const check = isURLSafe(
        'https://example.com/path/to/image.png?size=large&format=webp',
      );
      expect(check.safe).toBe(true);
    });

    it('handles URLs with fragments', () => {
      const check = isURLSafe('https://example.com/page#section');
      expect(check.safe).toBe(true);
    });

    it('is case-insensitive for hostnames', () => {
      expect(isURLSafe('https://EXAMPLE.COM/img.png').safe).toBe(true);
      expect(isURLSafe('http://LOCALHOST/admin').safe).toBe(false);
    });
  });
});

describe('isSafeForFetch', () => {
  it('returns true for safe URLs', () => {
    expect(isSafeForFetch('https://example.com/img.png')).toBe(true);
  });

  it('returns false for unsafe URLs', () => {
    expect(isSafeForFetch('http://localhost/admin')).toBe(false);
    expect(isSafeForFetch('http://10.0.0.1/secret')).toBe(false);
  });
});

describe('filterSafeUrls', () => {
  it('filters out unsafe URLs', () => {
    const urls = [
      'https://example.com/public.png',
      'http://localhost/admin',
      'http://10.0.0.1/internal',
      'https://cdn.example.net/image.jpg',
    ];

    const safe = filterSafeUrls(urls);

    expect(safe).toEqual([
      'https://example.com/public.png',
      'https://cdn.example.net/image.jpg',
    ]);
  });

  it('returns empty array when all URLs unsafe', () => {
    const urls = ['http://localhost/a', 'http://10.0.0.1/b'];
    expect(filterSafeUrls(urls)).toEqual([]);
  });

  it('returns all URLs when all safe', () => {
    const urls = ['https://a.com/1', 'https://b.com/2'];
    expect(filterSafeUrls(urls)).toEqual(urls);
  });

  it('applies custom policy', () => {
    const urls = ['https://evil.com/a', 'https://good.com/b'];
    const safe = filterSafeUrls(urls, { blockedDomains: ['evil.com'] });

    expect(safe).toEqual(['https://good.com/b']);
  });
});
