/**
 * File I/O Utilities
 *
 * Read and write files with proper error handling.
 */

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * Read file as Uint8Array
 */
export async function readFileBytes(path: string): Promise<Uint8Array> {
  const buffer = await readFile(path);
  return new Uint8Array(buffer);
}

/**
 * Write Uint8Array to file, creating directories if needed
 */
export async function writeFileBytes(path: string, data: Uint8Array): Promise<void> {
  const dir = dirname(path);
  await mkdir(dir, { recursive: true });
  await writeFile(path, data);
}

/**
 * Write JSON to file
 */
export async function writeJsonFile(path: string, data: unknown): Promise<void> {
  const dir = dirname(path);
  await mkdir(dir, { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2));
}

/**
 * Check if file exists
 */
export async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
