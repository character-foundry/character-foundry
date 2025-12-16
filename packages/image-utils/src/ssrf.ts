/**
 * SSRF (Server-Side Request Forgery) Protection
 *
 * Validates URLs to prevent SSRF attacks.
 * Browser-safe implementation (no Node.js dependencies).
 */

export interface SSRFPolicy {
  /** Allow private IP addresses (10.x, 172.16-31.x, 192.168.x) (default: false) */
  allowPrivateIPs?: boolean;
  /** Allow localhost/loopback (127.x, ::1) (default: false) */
  allowLocalhost?: boolean;
  /** Blocked domain patterns (e.g., ['internal.company.com', '*.local']) */
  blockedDomains?: string[];
  /** Allowed domain patterns - if provided, ONLY these are allowed */
  allowedDomains?: string[];
  /** Allow data URLs (data:image/...) (default: false) */
  allowDataUrls?: boolean;
}

export interface SafetyCheck {
  /** Whether the URL is safe according to policy */
  safe: boolean;
  /** Reason why URL is unsafe (if safe=false) */
  reason?: string;
}

/**
 * Default SSRF policy - blocks private IPs, localhost, and data URLs.
 */
export const DEFAULT_SSRF_POLICY: Required<SSRFPolicy> = {
  allowPrivateIPs: false,
  allowLocalhost: false,
  blockedDomains: [],
  allowedDomains: [],
  allowDataUrls: false,
};

/**
 * Check if URL is safe to fetch according to SSRF policy.
 *
 * This is the canonical SSRF protection - all apps should use this
 * before fetching external URLs.
 *
 * **Limitations (browser-side validation only):**
 * - Cannot detect domains that resolve to private IPs (e.g., `attacker.com` -> `127.0.0.1`)
 * - Cannot prevent DNS rebinding attacks (domain resolves differently on subsequent requests)
 * - Cannot validate redirect destinations (server may redirect to internal URLs)
 * - Does not perform actual DNS resolution - only validates URL syntax and hostname patterns
 *
 * For server-side applications requiring stronger SSRF protection, perform DNS resolution
 * and validate the resolved IP address before making the request, and validate redirect
 * destinations or disable redirects entirely.
 *
 * @param url - URL to validate
 * @param policy - SSRF policy (uses defaults if not provided)
 * @returns Safety check result with reason if unsafe
 *
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html
 *
 * @example
 * ```typescript
 * const check = isURLSafe('http://10.0.0.1/secret');
 * if (!check.safe) {
 *   console.error('Unsafe URL:', check.reason);
 * }
 * ```
 */
export function isURLSafe(
  url: string,
  policy: SSRFPolicy = {},
): SafetyCheck {
  const config = { ...DEFAULT_SSRF_POLICY, ...policy };

  // Parse URL
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { safe: false, reason: 'Invalid URL format' };
  }

  // Check protocol
  if (parsed.protocol === 'data:') {
    if (!config.allowDataUrls) {
      return { safe: false, reason: 'Data URLs not allowed' };
    }
    return { safe: true };
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return {
      safe: false,
      reason: `Protocol '${parsed.protocol}' not allowed (only http/https)`,
    };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Check allowed domains (whitelist)
  if (config.allowedDomains.length > 0) {
    const isAllowed = config.allowedDomains.some((pattern) =>
      matchDomainPattern(hostname, pattern),
    );
    if (!isAllowed) {
      return {
        safe: false,
        reason: `Domain '${hostname}' not in allowed list`,
      };
    }
  }

  // Check blocked domains (blacklist)
  if (config.blockedDomains.length > 0) {
    const isBlocked = config.blockedDomains.some((pattern) =>
      matchDomainPattern(hostname, pattern),
    );
    if (isBlocked) {
      return {
        safe: false,
        reason: `Domain '${hostname}' is blocked`,
      };
    }
  }

  // Check localhost
  if (isLocalhost(hostname) && !config.allowLocalhost) {
    return { safe: false, reason: 'Localhost not allowed' };
  }

  // Check private IPs
  if (isPrivateIP(hostname) && !config.allowPrivateIPs) {
    return { safe: false, reason: 'Private IP addresses not allowed' };
  }

  return { safe: true };
}

/**
 * Quick check if URL is safe with default policy.
 *
 * Convenience wrapper for common case.
 *
 * @param url - URL to validate
 * @returns true if safe, false otherwise
 */
export function isSafeForFetch(url: string): boolean {
  return isURLSafe(url).safe;
}

/**
 * Match domain against pattern (supports wildcards).
 *
 * @example
 * ```typescript
 * matchDomainPattern('api.github.com', '*.github.com') // true
 * matchDomainPattern('github.com', '*.github.com') // false
 * matchDomainPattern('github.com', 'github.com') // true
 * ```
 */
function matchDomainPattern(domain: string, pattern: string): boolean {
  // Exact match
  if (domain === pattern) return true;

  // Wildcard match - only matches subdomains, not the base domain
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(2);
    return domain.endsWith('.' + suffix);
  }

  return false;
}

/**
 * Check if hostname is localhost/loopback.
 */
function isLocalhost(hostname: string): boolean {
  const lower = hostname.toLowerCase();

  // IPv4 loopback
  if (lower === 'localhost' || lower === '0.0.0.0' || lower.startsWith('127.')) {
    return true;
  }

  // IPv6 loopback
  if (lower === '::1' || lower === '[::1]') {
    return true;
  }

  return false;
}

/**
 * Check if hostname is a private IP address.
 *
 * Checks for:
 * - 10.0.0.0/8
 * - 172.16.0.0/12
 * - 192.168.0.0/16
 * - Link-local: 169.254.0.0/16 (includes AWS metadata endpoint)
 * - IPv6 private ranges
 */
function isPrivateIP(hostname: string): boolean {
  const lower = hostname.toLowerCase();

  // IPv4 private ranges
  const parts = hostname.split('.').map(Number);

  if (
    parts.length === 4 &&
    parts.every((p) => p >= 0 && p <= 255 && !isNaN(p))
  ) {
    const [octet1, octet2] = parts;

    // 10.0.0.0/8
    if (octet1 === 10) return true;

    // 172.16.0.0/12
    if (octet1 === 172 && octet2 !== undefined && octet2 >= 16 && octet2 <= 31)
      return true;

    // 192.168.0.0/16
    if (octet1 === 192 && octet2 === 168) return true;

    // 169.254.0.0/16 (link-local) - includes AWS metadata endpoint
    if (octet1 === 169 && octet2 === 254) return true;
  }

  // IPv6 private ranges using regex patterns
  // Strip brackets if present (URL parser adds them: [fc00::1])
  const cleanedHostname = lower.replace(/^\[|\]$/g, '');

  const ipv6Patterns = [
    /^f[cd][0-9a-f]{2}:/i, // fc00::/7 (includes both fc and fd ranges)
    /^fe80:/i, // fe80::/10 (link-local)
  ];

  for (const pattern of ipv6Patterns) {
    if (pattern.test(cleanedHostname)) {
      return true;
    }
  }

  return false;
}

/**
 * Filter array of URLs, keeping only safe ones.
 *
 * @param urls - Array of URLs to filter
 * @param policy - SSRF policy
 * @returns Array of safe URLs
 */
export function filterSafeUrls(
  urls: string[],
  policy?: SSRFPolicy,
): string[] {
  return urls.filter((url) => isURLSafe(url, policy).safe);
}
