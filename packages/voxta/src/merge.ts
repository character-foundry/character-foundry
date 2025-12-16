/**
 * Voxta Merge Utilities
 *
 * Functions for merging CCv3 edits into Voxta structures.
 */

import { zipSync, type Zippable } from 'fflate';
import {
  type BinaryData,
  fromString,
  ParseError,
  SizeLimitError,
  generateUUID,
} from '@character-foundry/core';
import {
  findZipStart,
  streamingUnzipSync,
  ZipPreflightError,
  type Unzipped,
} from '@character-foundry/core/zip';
import { detectImageFormat, getExtension } from '@character-foundry/media';
import type { CCv3Data, CCv3CharacterBook } from '@character-foundry/schemas';
import type {
  VoxtaCharacter,
  VoxtaBook,
  VoxtaBookItem,
  VoxtaPackage,
  ExtractedVoxtaCharacter,
  ExtractedVoxtaBook,
  CompressionLevel,
} from './types.js';
import { standardToVoxta } from './macros.js';

/**
 * Editable CCv3 fields (subset that can be changed in editors)
 */
export type CCv3Edits = Partial<CCv3Data['data']>;

/**
 * Merge partial CCv3 edits into an existing Voxta character.
 *
 * This function applies only the fields present in `edits` to the original
 * character, preserving Voxta-specific fields like Scripts, TTS, and
 * Augmentations that CCv3 cannot represent.
 *
 * @param original - The original extracted Voxta character
 * @param edits - Partial CCv3 data fields to apply
 * @returns Updated VoxtaCharacter with edits merged
 */
export function mergeCharacterEdits(
  original: ExtractedVoxtaCharacter | VoxtaCharacter,
  edits: CCv3Edits
): VoxtaCharacter {
  // Get the base character data
  const char: VoxtaCharacter =
    'data' in original ? { ...original.data } : { ...original };

  const dateNow = new Date().toISOString();

  // Core text fields - only update if present in edits
  if (edits.name !== undefined) {
    char.Name = edits.name;
  }

  if (edits.nickname !== undefined) {
    char.Label = edits.nickname || undefined;
  }

  if (edits.description !== undefined) {
    char.Profile = standardToVoxta(edits.description);
  }

  if (edits.personality !== undefined) {
    char.Personality = standardToVoxta(edits.personality ?? '');
  }

  if (edits.scenario !== undefined) {
    char.Scenario = standardToVoxta(edits.scenario);
  }

  if (edits.first_mes !== undefined) {
    char.FirstMessage = standardToVoxta(edits.first_mes);
  }

  if (edits.alternate_greetings !== undefined) {
    char.AlternativeFirstMessages = edits.alternate_greetings.map(standardToVoxta);
  }

  if (edits.mes_example !== undefined) {
    char.MessageExamples = standardToVoxta(edits.mes_example ?? '');
  }

  // System prompts
  if (edits.system_prompt !== undefined) {
    char.SystemPrompt = standardToVoxta(edits.system_prompt);
  }

  if (edits.post_history_instructions !== undefined) {
    char.PostHistoryInstructions = standardToVoxta(edits.post_history_instructions);
  }

  // Metadata
  if (edits.creator !== undefined) {
    char.Creator = edits.creator || undefined;
  }

  if (edits.creator_notes !== undefined) {
    char.CreatorNotes = edits.creator_notes || undefined;
  }

  if (edits.tags !== undefined) {
    char.Tags = edits.tags;
  }

  if (edits.character_version !== undefined) {
    char.Version = edits.character_version || undefined;
  }

  // Handle visual_description from extensions
  if (edits.extensions !== undefined) {
    const ext = edits.extensions as Record<string, unknown> | undefined;
    if (ext?.visual_description !== undefined) {
      char.Description = (ext.visual_description as string) || undefined;
    }
  }

  // Update modification timestamp
  char.DateModified = dateNow;

  return char;
}

/**
 * Merge partial CCv3 lorebook edits into an existing Voxta book.
 *
 * @param original - The original extracted Voxta book
 * @param edits - CCv3 character_book to merge
 * @returns Updated VoxtaBook with edits merged
 */
export function mergeBookEdits(
  original: ExtractedVoxtaBook | VoxtaBook,
  edits: CCv3CharacterBook
): VoxtaBook {
  const book: VoxtaBook = 'data' in original ? { ...original.data } : { ...original };
  const dateNow = new Date().toISOString();

  // Update book name if provided
  if (edits.name !== undefined) {
    book.Name = edits.name;
  }

  // Merge entries - match by name (stored as entry ID) or create new
  if (edits.entries !== undefined) {
    const existingById = new Map<string, VoxtaBookItem>();
    for (const item of book.Items || []) {
      existingById.set(item.Id, item);
    }

    const newItems: VoxtaBookItem[] = [];

    for (const entry of edits.entries) {
      // Try to match existing entry by name (which stores the original ID)
      const existingId = entry.name || '';
      const existing = existingById.get(existingId);

      if (existing) {
        // Update existing entry
        newItems.push({
          ...existing,
          Keywords: entry.keys || [],
          Text: standardToVoxta(entry.content || ''),
          Weight: entry.priority ?? existing.Weight ?? 10,
          Deleted: entry.enabled === false,
          LastUpdated: dateNow,
        });
        existingById.delete(existingId);
      } else {
        // Create new entry
        newItems.push({
          Id: generateUUID(),
          Keywords: entry.keys || [],
          Text: standardToVoxta(entry.content || ''),
          Weight: entry.priority ?? 10,
          Deleted: entry.enabled === false,
          CreatedAt: dateNow,
          LastUpdated: dateNow,
        });
      }
    }

    // Mark remaining entries as deleted (soft delete)
    for (const remaining of existingById.values()) {
      newItems.push({
        ...remaining,
        Deleted: true,
        DeletedAt: dateNow,
      });
    }

    book.Items = newItems;
  }

  book.DateModified = dateNow;

  return book;
}

/**
 * Delta changes to apply to a Voxta package
 */
export interface VoxtaDeltas {
  /** Updated characters by ID */
  characters?: Map<string, VoxtaCharacter>;
  /** Updated books by ID */
  books?: Map<string, VoxtaBook>;
  /** Updated package metadata (optional) */
  package?: Partial<VoxtaPackage>;
}

/**
 * Options for applying deltas
 */
export interface ApplyDeltaOptions {
  compressionLevel?: CompressionLevel;
}

/** Max total size for delta operations (500MB) */
const DELTA_MAX_TOTAL_SIZE = 500 * 1024 * 1024;
/** Max file size for delta operations (50MB) */
const DELTA_MAX_FILE_SIZE = 50 * 1024 * 1024;

/**
 * Apply delta changes to an existing Voxta package.
 *
 * This performs a minimal update - only files that have changed are rewritten.
 * All other files (assets, scenarios, unchanged characters/books) are preserved
 * exactly as they were in the original package.
 *
 * @param originalBuffer - The original .voxpkg file buffer
 * @param deltas - Changes to apply
 * @param options - Compression options
 * @returns New package buffer with changes applied
 */
export function applyVoxtaDeltas(
  originalBuffer: BinaryData,
  deltas: VoxtaDeltas,
  options: ApplyDeltaOptions = {}
): Uint8Array {
  const { compressionLevel = 6 } = options;

  // Handle SFX archives
  const zipData = findZipStart(originalBuffer);

  // SECURITY: Use streaming unzip with actual byte tracking and path validation
  // This protects against:
  // 1. Zip bombs (archives that lie about sizes in central directory)
  // 2. Path traversal attacks (Zip Slip)
  let unzipped: Unzipped;
  try {
    unzipped = streamingUnzipSync(zipData, {
      maxFileSize: DELTA_MAX_FILE_SIZE,
      maxTotalSize: DELTA_MAX_TOTAL_SIZE,
      maxFiles: 10000,
      unsafePathHandling: 'reject', // Fail on path traversal attempts
    });
  } catch (err) {
    if (err instanceof ZipPreflightError) {
      throw new SizeLimitError(
        err.totalSize || err.entrySize || 0,
        err.maxSize || err.maxEntrySize || DELTA_MAX_TOTAL_SIZE,
        err.oversizedEntry || 'Voxta package'
      );
    }
    throw new ParseError(
      `Failed to unzip Voxta package: ${err instanceof Error ? err.message : String(err)}`,
      'voxta'
    );
  }

  // Build new ZIP entries, starting with all originals
  const zipEntries: Zippable = {};

  for (const [fileName, fileData] of Object.entries(unzipped)) {
    // Check if this file should be replaced
    let replaced = false;

    // Check for character.json updates
    const charMatch = fileName.match(/^Characters\/([^/]+)\/character\.json$/);
    if (charMatch && deltas.characters?.has(charMatch[1]!)) {
      const updatedChar = deltas.characters.get(charMatch[1]!)!;
      zipEntries[fileName] = [
        fromString(JSON.stringify(updatedChar, null, 2)),
        { level: compressionLevel },
      ];
      replaced = true;
    }

    // Check for book.json updates
    const bookMatch = fileName.match(/^Books\/([^/]+)\/book\.json$/);
    if (bookMatch && deltas.books?.has(bookMatch[1]!)) {
      const updatedBook = deltas.books.get(bookMatch[1]!)!;
      zipEntries[fileName] = [
        fromString(JSON.stringify(updatedBook, null, 2)),
        { level: compressionLevel },
      ];
      replaced = true;
    }

    // Check for package.json update
    if (fileName === 'package.json' && deltas.package) {
      // Merge with existing package metadata
      const existing = JSON.parse(new TextDecoder().decode(fileData)) as VoxtaPackage;
      const updated: VoxtaPackage = {
        ...existing,
        ...deltas.package,
        DateModified: new Date().toISOString(),
      };
      zipEntries[fileName] = [
        fromString(JSON.stringify(updated, null, 2)),
        { level: compressionLevel },
      ];
      replaced = true;
    }

    // Keep original if not replaced
    if (!replaced) {
      zipEntries[fileName] = [fileData, { level: compressionLevel }];
    }
  }

  // Create new ZIP
  return zipSync(zipEntries);
}

/**
 * Async version of applyVoxtaDeltas
 */
export async function applyVoxtaDeltasAsync(
  originalBuffer: BinaryData,
  deltas: VoxtaDeltas,
  options: ApplyDeltaOptions = {}
): Promise<Uint8Array> {
  return applyVoxtaDeltas(originalBuffer, deltas, options);
}

/**
 * Character info in package manifest
 */
export interface ManifestCharacter {
  id: string;
  name: string;
}

/**
 * Book info in package manifest
 */
export interface ManifestBook {
  id: string;
  name: string;
  /** Character IDs that reference this book */
  usedBy: string[];
}

/**
 * Scenario info in package manifest
 */
export interface ManifestScenario {
  id: string;
  name: string;
}

/**
 * Package manifest for UI display
 */
export interface PackageManifest {
  packageId?: string;
  packageName?: string;
  characters: ManifestCharacter[];
  books: ManifestBook[];
  scenarios: ManifestScenario[];
}

/**
 * Get a manifest summary of a Voxta package for UI display.
 *
 * This provides a quick overview of package contents with relationship
 * information (which characters use which books).
 *
 * @param data - Extracted Voxta data from readVoxta()
 * @returns Package manifest for UI display
 */
export function getPackageManifest(data: import('./types.js').VoxtaData): PackageManifest {
  const characters: ManifestCharacter[] = data.characters.map((c) => ({
    id: c.id,
    name: c.data.Name,
  }));

  // Build a map of book ID -> character IDs that use it
  const bookUsers = new Map<string, string[]>();
  for (const char of data.characters) {
    const memoryBooks = char.data.MemoryBooks || [];
    for (const bookId of memoryBooks) {
      if (!bookUsers.has(bookId)) {
        bookUsers.set(bookId, []);
      }
      bookUsers.get(bookId)!.push(char.id);
    }
  }

  const books: ManifestBook[] = data.books.map((b) => ({
    id: b.id,
    name: b.data.Name,
    usedBy: bookUsers.get(b.id) || [],
  }));

  const scenarios: ManifestScenario[] = data.scenarios.map((s) => ({
    id: s.id,
    name: s.data.Name,
  }));

  return {
    packageId: data.package?.Id,
    packageName: data.package?.Name,
    characters,
    books,
    scenarios,
  };
}

/**
 * Options for extracting a character package
 */
export interface ExtractCharacterOptions {
  compressionLevel?: CompressionLevel;
  /** Include books referenced by the character */
  includeBooks?: boolean;
  /** New package name (defaults to character name) */
  packageName?: string;
}

/**
 * Extract a single character from a multi-character package.
 *
 * Creates a new standalone .voxpkg containing just the specified character,
 * their assets, and optionally their referenced books.
 *
 * NOTE: Scenarios are NOT extracted since they may contain scripts that
 * reference other characters in the package.
 *
 * @param originalBuffer - The original .voxpkg file buffer
 * @param characterId - ID of the character to extract
 * @param options - Extraction options
 * @returns New package buffer with just the specified character
 */
export function extractCharacterPackage(
  originalBuffer: BinaryData,
  characterId: string,
  options: ExtractCharacterOptions = {}
): Uint8Array {
  const { compressionLevel = 6, includeBooks = true, packageName } = options;

  // Handle SFX archives
  const zipData = findZipStart(originalBuffer);

  // SECURITY: Use streaming unzip with actual byte tracking and path validation
  let unzipped: Unzipped;
  try {
    unzipped = streamingUnzipSync(zipData, {
      maxFileSize: DELTA_MAX_FILE_SIZE,
      maxTotalSize: DELTA_MAX_TOTAL_SIZE,
      maxFiles: 10000,
      unsafePathHandling: 'reject',
    });
  } catch (err) {
    if (err instanceof ZipPreflightError) {
      throw new SizeLimitError(
        err.totalSize || err.entrySize || 0,
        err.maxSize || err.maxEntrySize || DELTA_MAX_TOTAL_SIZE,
        err.oversizedEntry || 'Voxta package'
      );
    }
    throw new ParseError(
      `Failed to unzip Voxta package: ${err instanceof Error ? err.message : String(err)}`,
      'voxta'
    );
  }

  // Find the character's data to get their name and book refs
  const charJsonPath = `Characters/${characterId}/character.json`;
  const charJsonData = unzipped[charJsonPath];
  if (!charJsonData) {
    throw new ParseError(`Character ${characterId} not found in package`, 'voxta');
  }

  const charData = JSON.parse(new TextDecoder().decode(charJsonData)) as VoxtaCharacter;
  const memoryBooks = new Set(charData.MemoryBooks || []);

  // Generate new package ID
  const newPackageId = generateUUID();
  const dateNow = new Date().toISOString();

  // Build new ZIP with only this character's files
  const zipEntries: Zippable = {};

  for (const [fileName, fileData] of Object.entries(unzipped)) {
    // Skip empty directories
    if (fileName.endsWith('/') || fileData.length === 0) continue;

    // Include all files under this character's directory
    if (fileName.startsWith(`Characters/${characterId}/`)) {
      // Update character.json with new package ID
      if (fileName === charJsonPath) {
        const updatedChar: VoxtaCharacter = {
          ...charData,
          PackageId: newPackageId,
          DateModified: dateNow,
        };
        zipEntries[fileName] = [
          fromString(JSON.stringify(updatedChar, null, 2)),
          { level: compressionLevel },
        ];
      } else {
        zipEntries[fileName] = [fileData, { level: compressionLevel }];
      }
      continue;
    }

    // Include books if requested and referenced by this character
    if (includeBooks) {
      const bookMatch = fileName.match(/^Books\/([^/]+)\//);
      if (bookMatch && memoryBooks.has(bookMatch[1]!)) {
        // Update book.json with new package ID
        if (fileName.endsWith('/book.json')) {
          const bookData = JSON.parse(new TextDecoder().decode(fileData)) as VoxtaBook;
          const updatedBook: VoxtaBook = {
            ...bookData,
            PackageId: newPackageId,
            DateModified: dateNow,
          };
          zipEntries[fileName] = [
            fromString(JSON.stringify(updatedBook, null, 2)),
            { level: compressionLevel },
          ];
        } else {
          zipEntries[fileName] = [fileData, { level: compressionLevel }];
        }
        continue;
      }
    }
  }

  // Create new package.json
  const newPackage: VoxtaPackage = {
    $type: 'package',
    Id: newPackageId,
    Name: packageName || charData.Name,
    Version: charData.Version || '1.0.0',
    Description: charData.Profile || undefined,
    Creator: charData.Creator,
    ExplicitContent: charData.ExplicitContent,
    EntryResource: { Kind: 1, Id: characterId },
    ThumbnailResource: { Kind: 1, Id: characterId },
    DateCreated: charData.DateCreated || dateNow,
    DateModified: dateNow,
  };

  zipEntries['package.json'] = [
    fromString(JSON.stringify(newPackage, null, 2)),
    { level: compressionLevel },
  ];

  return zipSync(zipEntries);
}

/**
 * Options for adding a character to a package
 */
export interface AddCharacterOptions {
  compressionLevel?: CompressionLevel;
  /** Books to include with the character */
  books?: VoxtaBook[];
  /** Assets to include (path relative to character dir -> data) */
  assets?: Map<string, BinaryData>;
  /** Thumbnail image */
  thumbnail?: BinaryData;
}

/**
 * Add a character to an existing Voxta package.
 *
 * @param originalBuffer - The original .voxpkg file buffer
 * @param character - The character to add
 * @param options - Options including books and assets
 * @returns New package buffer with the character added
 */
export function addCharacterToPackage(
  originalBuffer: BinaryData,
  character: VoxtaCharacter,
  options: AddCharacterOptions = {}
): Uint8Array {
  const { compressionLevel = 6, books = [], assets, thumbnail } = options;

  // Handle SFX archives
  const zipData = findZipStart(originalBuffer);

  // SECURITY: Use streaming unzip with actual byte tracking and path validation
  let unzipped: Unzipped;
  try {
    unzipped = streamingUnzipSync(zipData, {
      maxFileSize: DELTA_MAX_FILE_SIZE,
      maxTotalSize: DELTA_MAX_TOTAL_SIZE,
      maxFiles: 10000,
      unsafePathHandling: 'reject',
    });
  } catch (err) {
    if (err instanceof ZipPreflightError) {
      throw new SizeLimitError(
        err.totalSize || err.entrySize || 0,
        err.maxSize || err.maxEntrySize || DELTA_MAX_TOTAL_SIZE,
        err.oversizedEntry || 'Voxta package'
      );
    }
    throw new ParseError(
      `Failed to unzip Voxta package: ${err instanceof Error ? err.message : String(err)}`,
      'voxta'
    );
  }

  // Get existing package metadata
  const packageJsonData = unzipped['package.json'];
  let packageMeta: VoxtaPackage | undefined;
  if (packageJsonData) {
    packageMeta = JSON.parse(new TextDecoder().decode(packageJsonData)) as VoxtaPackage;
  }

  const packageId = packageMeta?.Id || generateUUID();
  const dateNow = new Date().toISOString();

  // Build new ZIP with all original files plus new character
  const zipEntries: Zippable = {};

  // Copy all original files
  for (const [fileName, fileData] of Object.entries(unzipped)) {
    if (fileName === 'package.json') continue; // Will update separately
    zipEntries[fileName] = [fileData, { level: compressionLevel }];
  }

  // Ensure character has the right package ID
  const charToAdd: VoxtaCharacter = {
    ...character,
    PackageId: packageId,
    DateModified: dateNow,
  };

  // Add character.json
  const charId = charToAdd.Id;
  zipEntries[`Characters/${charId}/character.json`] = [
    fromString(JSON.stringify(charToAdd, null, 2)),
    { level: compressionLevel },
  ];

  // Add thumbnail if provided (detect format)
  if (thumbnail) {
    const thumbData = thumbnail instanceof Uint8Array ? thumbnail : new Uint8Array(thumbnail);
    const thumbFormat = detectImageFormat(thumbData);
    const thumbExt = thumbFormat ? getExtension(thumbFormat) : 'png';
    zipEntries[`Characters/${charId}/thumbnail.${thumbExt}`] = [thumbnail, { level: compressionLevel }];
  }

  // Add assets if provided
  if (assets) {
    for (const [assetPath, assetData] of assets) {
      zipEntries[`Characters/${charId}/${assetPath}`] = [assetData, { level: compressionLevel }];
    }
  }

  // Add books
  for (const book of books) {
    const bookToAdd: VoxtaBook = {
      ...book,
      PackageId: packageId,
      DateModified: dateNow,
    };
    zipEntries[`Books/${book.Id}/book.json`] = [
      fromString(JSON.stringify(bookToAdd, null, 2)),
      { level: compressionLevel },
    ];
  }

  // Update package.json
  const updatedPackage: VoxtaPackage = packageMeta
    ? { ...packageMeta, DateModified: dateNow }
    : {
        $type: 'package',
        Id: packageId,
        Name: charToAdd.Name,
        Version: '1.0.0',
        EntryResource: { Kind: 1, Id: charId },
        ThumbnailResource: { Kind: 1, Id: charId },
        DateCreated: dateNow,
        DateModified: dateNow,
      };

  zipEntries['package.json'] = [
    fromString(JSON.stringify(updatedPackage, null, 2)),
    { level: compressionLevel },
  ];

  return zipSync(zipEntries);
}
