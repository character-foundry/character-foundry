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
 * Build the signing string from headers
 */
export function buildSigningString(
  method: string,
  path: string,
  headers: Headers,
  headerNames: string[]
): string {
  const lines: string[] = [];

  for (const name of headerNames) {
    if (name === '(request-target)') {
      lines.push(`(request-target): ${method.toLowerCase()} ${path}`);
    } else if (name === '(created)') {
      // Skip for now - optional
    } else if (name === '(expires)') {
      // Skip for now - optional
    } else {
      const value = headers.get(name);
      if (value !== null) {
        lines.push(`${name.toLowerCase()}: ${value}`);
      }
    }
  }

  return lines.join('\n');
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

  // Verify Date header freshness
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

  // Extract actor ID from keyId (format: actorId#main-key)
  const actorId = parsed.keyId.split('#')[0]!;

  // Verify the keyId matches the activity actor
  if (!activity.actor.startsWith(actorId)) {
    return { valid: false, error: 'Key ID does not match activity actor' };
  }

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
 */
export async function signRequest(
  options: SigningOptions
): Promise<{ signature: string; date: string }> {
  const now = new Date();
  const dateString = now.toUTCString();

  // Build headers for signing
  const headersToSign = ['(request-target)', 'host', 'date'];
  const headerValues = new Headers();
  headerValues.set('date', dateString);

  if (options.host) {
    headerValues.set('host', options.host);
  }

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

  return { signature: signatureHeader, date: dateString };
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
