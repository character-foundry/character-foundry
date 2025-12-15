/**
 * HTTP Signatures
 *
 * Implements HTTP message signing per draft-cavage-http-signatures
 * for ActivityPub federation.
 *
 * Works in both Node.js and browser/Workers environments using
 * the Web Crypto API.
 */

import type { FederatedActivity, FederatedActor } from './types.js';

/**
 * Parsed HTTP signature header
 */
export interface ParsedSignature {
  keyId: string;
  algorithm: string;
  headers: string[];
  signature: string;
}

/**
 * Required headers for strict signature validation.
 * These headers MUST be included in the signed header list when strictMode is enabled.
 */
export const REQUIRED_SIGNED_HEADERS = ['(request-target)', 'host', 'date'] as const;

/**
 * Signature validation options
 */
export interface SignatureValidationOptions {
  /** HTTP method (GET, POST, etc.) */
  method: string;
  /** Request path (e.g., /inbox) */
  path: string;
  /** Function to fetch actor by ID */
  fetchActor: (actorId: string) => Promise<FederatedActor | null>;
  /** Maximum age in seconds for Date header. Default: 300 (5 minutes) */
  maxAge?: number;
  /**
   * Enable strict signature validation mode.
   *
   * When enabled, signatures MUST include these headers: (request-target), host, date.
   * This prevents replay attacks and cross-host request reuse.
   *
   * Default: false (for backwards compatibility with existing federation peers)
   * Recommended: true for new deployments
   *
   * @security Without strict mode, attackers can:
   * - Replay captured requests if Date is not signed
   * - Reuse signatures across different hosts if host is not signed
   */
  strictMode?: boolean;
}

/**
 * Signature validation result
 */
export interface SignatureValidationResult {
  valid: boolean;
  error?: string;
  actor?: FederatedActor;
  keyId?: string;
}

/**
 * Request signing options
 */
export interface SigningOptions {
  /** Private key in PEM format */
  privateKeyPem: string;
  /** Key ID (usually actor#main-key) */
  keyId: string;
  /** HTTP method */
  method: string;
  /** Request path */
  path: string;
  /** Optional: target host header */
  host?: string;
  /** Optional: digest header */
  digest?: string;
  /** Optional: content-type header */
  contentType?: string;
}

/**
 * Parse an HTTP Signature header
 *
 * Format: keyId="...",algorithm="...",headers="...",signature="..."
 */
export function parseSignatureHeader(header: string): ParsedSignature | null {
  const params: Record<string, string> = {};

  // Parse key="value" pairs
  const regex = /(\w+)="([^"]+)"/g;
  let match;
  while ((match = regex.exec(header)) !== null) {
    params[match[1]!] = match[2]!;
  }

  if (!params.keyId || !params.signature) {
    return null;
  }

  return {
    keyId: params.keyId,
    algorithm: params.algorithm || 'rsa-sha256',
    headers: (params.headers || '(request-target) host date').split(' '),
    signature: params.signature,
  };
}

/**
 * Successful signing string result
 */
export interface SigningStringSuccess {
  success: true;
  signingString: string;
}

/**
 * Failed signing string result (missing headers)
 */
export interface SigningStringFailure {
  success: false;
  error: string;
  missingHeaders: string[];
}

/**
 * Result of building a signing string
 */
export type SigningStringResult = SigningStringSuccess | SigningStringFailure;

/**
 * Build the signing string from headers
 *
 * @security If a header is listed in headerNames but missing from the request,
 * this function returns an error. This prevents downgrade attacks where an
 * attacker claims to sign headers that aren't actually present.
 *
 * Synthetic headers ((request-target), (created), (expires)) are always allowed.
 */
export function buildSigningString(
  method: string,
  path: string,
  headers: Headers,
  headerNames: string[]
): string {
  const result = buildSigningStringStrict(method, path, headers, headerNames);
  if (!result.success) {
    // For backwards compatibility, log warning but return partial string
    // Callers using verifyHttpSignature will get signature mismatch
    console.warn(`[federation] Signature verification may fail: ${result.error}`);
    // Build partial string for backwards compat
    const lines: string[] = [];
    for (const name of headerNames) {
      if (name === '(request-target)') {
        lines.push(`(request-target): ${method.toLowerCase()} ${path}`);
      } else if (name === '(created)' || name === '(expires)') {
        // Synthetic headers - skip if not implemented
      } else {
        const value = headers.get(name);
        if (value !== null) {
          lines.push(`${name.toLowerCase()}: ${value}`);
        }
      }
    }
    return lines.join('\n');
  }
  return result.signingString;
}

/**
 * Build signing string with strict header validation
 *
 * Returns an error if any non-synthetic header in headerNames is missing.
 * Use this for new code that wants strict validation.
 */
export function buildSigningStringStrict(
  method: string,
  path: string,
  headers: Headers,
  headerNames: string[]
): SigningStringResult {
  const lines: string[] = [];
  const missingHeaders: string[] = [];

  // Synthetic headers that don't need to be present in the request
  const syntheticHeaders = new Set(['(request-target)', '(created)', '(expires)']);

  for (const name of headerNames) {
    if (name === '(request-target)') {
      lines.push(`(request-target): ${method.toLowerCase()} ${path}`);
    } else if (name === '(created)') {
      // Skip for now - optional synthetic header
    } else if (name === '(expires)') {
      // Skip for now - optional synthetic header
    } else {
      const value = headers.get(name);
      if (value !== null) {
        lines.push(`${name.toLowerCase()}: ${value}`);
      } else if (!syntheticHeaders.has(name)) {
        // Header is listed as signed but not present - this is an error
        missingHeaders.push(name);
      }
    }
  }

  if (missingHeaders.length > 0) {
    return {
      success: false,
      error: `Signature claims to sign headers that are missing from request: ${missingHeaders.join(', ')}`,
      missingHeaders,
    };
  }

  return {
    success: true,
    signingString: lines.join('\n'),
  };
}

/**
 * Verify an HTTP signature using Web Crypto API
 */
export async function verifyHttpSignature(
  parsed: ParsedSignature,
  publicKeyPem: string,
  method: string,
  path: string,
  headers: Headers
): Promise<boolean> {
  try {
    // Build the signing string
    const signingString = buildSigningString(method, path, headers, parsed.headers);

    // Import the public key
    const publicKey = await importPublicKey(publicKeyPem);
    if (!publicKey) {
      return false;
    }

    // Decode the signature from base64
    const signatureBytes = base64ToArrayBuffer(parsed.signature);

    // Verify the signature
    const encoder = new TextEncoder();
    const data = encoder.encode(signingString);

    const algorithm = parsed.algorithm === 'hs2019' ? 'RSASSA-PKCS1-v1_5' : 'RSASSA-PKCS1-v1_5';

    return await crypto.subtle.verify(
      { name: algorithm, hash: 'SHA-256' },
      publicKey,
      signatureBytes,
      data
    );
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}

/**
 * Validate an incoming activity's HTTP signature
 *
 * @security Enable `strictMode` for production deployments to prevent:
 * - Replay attacks (requires Date header in signature)
 * - Cross-host request reuse (requires host header in signature)
 */
export async function validateActivitySignature(
  activity: FederatedActivity,
  headers: Headers,
  options: SignatureValidationOptions
): Promise<SignatureValidationResult> {
  // Check for Signature header
  const signatureHeader = headers.get('Signature');
  if (!signatureHeader) {
    return { valid: false, error: 'Missing Signature header' };
  }

  // Parse the signature
  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) {
    return { valid: false, error: 'Invalid Signature header format' };
  }

  // STRICT MODE: Enforce required headers in signature
  // This prevents replay attacks and cross-host request reuse
  if (options.strictMode) {
    const missingHeaders = REQUIRED_SIGNED_HEADERS.filter(
      (h) => !parsed.headers.includes(h)
    );
    if (missingHeaders.length > 0) {
      return {
        valid: false,
        error: `Strict mode: signature missing required headers: ${missingHeaders.join(', ')}`,
      };
    }

    // In strict mode, Date header MUST be present (not just signed)
    if (!headers.get('Date')) {
      return { valid: false, error: 'Strict mode: Date header required' };
    }

    // In strict mode, host header MUST be present
    if (!headers.get('host') && !headers.get('Host')) {
      return { valid: false, error: 'Strict mode: host header required' };
    }
  }

  // Verify Date header freshness (if present)
  const dateHeader = headers.get('Date');
  if (dateHeader) {
    const requestDate = new Date(dateHeader);
    const maxAge = options.maxAge ?? 300; // 5 minutes
    const now = Date.now();
    const requestTime = requestDate.getTime();

    if (isNaN(requestTime)) {
      return { valid: false, error: 'Invalid Date header' };
    }

    if (Math.abs(now - requestTime) > maxAge * 1000) {
      return { valid: false, error: 'Request too old or in future' };
    }
  }

  // Verify the keyId matches the activity actor using strict URL equality
  // Key ID format: "https://example.com/actors/alice#main-key"
  // Actor format: "https://example.com/actors/alice"
  // @security Strict equality prevents URL confusion attacks where:
  // - actor: https://evil.com/victim
  // - keyId: https://evil.com/victim-fake#main-key (would match with startsWith)
  let keyIdBase: string;
  let actorBase: string;
  try {
    const keyIdUrl = new URL(parsed.keyId);
    const actorUrl = new URL(activity.actor);
    // Extract base (origin + pathname) - key ID has fragment, actor doesn't
    keyIdBase = `${keyIdUrl.origin}${keyIdUrl.pathname}`;
    actorBase = `${actorUrl.origin}${actorUrl.pathname}`;
  } catch {
    return { valid: false, error: 'Invalid key ID or actor URL' };
  }

  if (keyIdBase !== actorBase) {
    return { valid: false, error: 'Key ID does not match activity actor' };
  }

  // Extract actor ID from keyId for fetching
  const actorId = keyIdBase;

  // Fetch the actor to get their public key
  const actor = await options.fetchActor(actorId);
  if (!actor) {
    return { valid: false, error: 'Could not fetch actor' };
  }

  if (!actor.publicKey?.publicKeyPem) {
    return { valid: false, error: 'Actor has no public key' };
  }

  // Verify the key ID matches
  if (actor.publicKey.id !== parsed.keyId) {
    return { valid: false, error: 'Key ID mismatch' };
  }

  // Verify the signature
  const valid = await verifyHttpSignature(
    parsed,
    actor.publicKey.publicKeyPem,
    options.method,
    options.path,
    headers
  );

  if (!valid) {
    return { valid: false, error: 'Invalid signature' };
  }

  return { valid: true, actor, keyId: parsed.keyId };
}

/**
 * Sign an outgoing HTTP request
 *
 * @param options.host - Required. The target host for the request.
 * @throws If host is not provided (required for valid signatures)
 */
export async function signRequest(
  options: SigningOptions
): Promise<{ signature: string; date: string; host: string }> {
  // Host is required for valid signatures
  if (!options.host) {
    throw new Error('signRequest requires options.host - cannot generate valid signature without it');
  }

  const now = new Date();
  const dateString = now.toUTCString();

  // Build headers for signing
  const headersToSign = ['(request-target)', 'host', 'date'];
  const headerValues = new Headers();
  headerValues.set('date', dateString);
  headerValues.set('host', options.host);

  if (options.digest) {
    headersToSign.push('digest');
    headerValues.set('digest', options.digest);
  }

  if (options.contentType) {
    headersToSign.push('content-type');
    headerValues.set('content-type', options.contentType);
  }

  // Build signing string
  const signingString = buildSigningString(
    options.method,
    options.path,
    headerValues,
    headersToSign
  );

  // Import private key and sign
  const privateKey = await importPrivateKey(options.privateKeyPem);
  if (!privateKey) {
    throw new Error('Failed to import private key');
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(signingString);

  const signatureBuffer = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    privateKey,
    data
  );

  const signatureBase64 = arrayBufferToBase64(signatureBuffer);

  // Build Signature header
  const signatureHeader =
    `keyId="${options.keyId}",` +
    `algorithm="rsa-sha256",` +
    `headers="${headersToSign.join(' ')}",` +
    `signature="${signatureBase64}"`;

  return { signature: signatureHeader, date: dateString, host: options.host };
}

/**
 * Calculate SHA-256 digest for request body
 */
export async function calculateDigest(body: string | ArrayBuffer): Promise<string> {
  const encoder = new TextEncoder();
  const data = typeof body === 'string' ? encoder.encode(body) : body;

  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashBase64 = arrayBufferToBase64(hashBuffer);

  return `SHA-256=${hashBase64}`;
}

// ============ Crypto Utilities ============

/**
 * Import a PEM-encoded public key
 */
async function importPublicKey(pem: string): Promise<CryptoKey | null> {
  try {
    // Remove PEM headers and convert to binary
    const pemContents = pem
      .replace(/-----BEGIN PUBLIC KEY-----/, '')
      .replace(/-----END PUBLIC KEY-----/, '')
      .replace(/-----BEGIN RSA PUBLIC KEY-----/, '')
      .replace(/-----END RSA PUBLIC KEY-----/, '')
      .replace(/\s/g, '');

    const binaryDer = base64ToArrayBuffer(pemContents);

    return await crypto.subtle.importKey(
      'spki',
      binaryDer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
  } catch (error) {
    console.error('Failed to import public key:', error);
    return null;
  }
}

/**
 * Import a PEM-encoded private key
 */
async function importPrivateKey(pem: string): Promise<CryptoKey | null> {
  try {
    // Remove PEM headers and convert to binary
    const pemContents = pem
      .replace(/-----BEGIN PRIVATE KEY-----/, '')
      .replace(/-----END PRIVATE KEY-----/, '')
      .replace(/-----BEGIN RSA PRIVATE KEY-----/, '')
      .replace(/-----END RSA PRIVATE KEY-----/, '')
      .replace(/\s/g, '');

    const binaryDer = base64ToArrayBuffer(pemContents);

    return await crypto.subtle.importKey(
      'pkcs8',
      binaryDer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    );
  } catch (error) {
    console.error('Failed to import private key:', error);
    return null;
  }
}

/**
 * Convert base64 string to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  // Handle URL-safe base64
  const normalized = base64.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}
