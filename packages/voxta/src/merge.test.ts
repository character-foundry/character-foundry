/**
 * Voxta Merge Utilities Tests
 */

import { describe, it, expect } from 'vitest';
import { zipSync, unzipSync } from 'fflate';
import { fromString } from '@character-foundry/core';
import {
  mergeCharacterEdits,
  mergeBookEdits,
  applyVoxtaDeltas,
  getPackageManifest,
  extractCharacterPackage,
  addCharacterToPackage,
} from './merge.js';
import type {
  VoxtaCharacter,
  VoxtaBook,
  VoxtaData,
  VoxtaPackage,
  ExtractedVoxtaCharacter,
  ExtractedVoxtaBook,
} from './types.js';

const testCharacter: VoxtaCharacter = {
  $type: 'character',
  Id: 'char-123',
  PackageId: 'pkg-456',
  Name: 'Alice',
  Version: '1.0',
  Description: 'A friendly assistant',
  Personality: 'Helpful and kind',
  Profile: 'Alice is an AI assistant',
  Scenario: 'Chat scenario',
  FirstMessage: 'Hello!',
  MessageExamples: 'Example dialogue',
  Creator: 'Test',
  CreatorNotes: 'Test character',
  Tags: ['friendly', 'helpful'],
  Scripts: [{ Name: 'test', Content: 'script content' }],
  TextToSpeech: [
    {
      Voice: { parameters: { VoiceId: 'voice-1' }, label: 'Default' },
      Service: { ServiceName: 'TTS', ServiceId: 'tts-1' },
    },
  ],
  DateCreated: '2024-01-01T00:00:00Z',
  DateModified: '2024-01-02T00:00:00Z',
};

const testBook: VoxtaBook = {
  $type: 'book',
  Id: 'book-1',
  Name: 'World Lore',
  Items: [
    {
      Id: 'item-1',
      Keywords: ['dragon', 'fire'],
      Text: 'Dragons breathe fire.',
      Weight: 10,
    },
    {
      Id: 'item-2',
      Keywords: ['castle'],
      Text: 'The castle is tall.',
      Weight: 5,
    },
  ],
  DateCreated: '2024-01-01T00:00:00Z',
  DateModified: '2024-01-02T00:00:00Z',
};

describe('mergeCharacterEdits', () => {
  it('should update only specified fields', () => {
    const result = mergeCharacterEdits(testCharacter, {
      name: 'Alice Updated',
      description: 'New description',
    });

    expect(result.Name).toBe('Alice Updated');
    expect(result.Profile).toBe('New description');
    // Unchanged fields should remain
    expect(result.Personality).toBe('Helpful and kind');
    expect(result.Creator).toBe('Test');
  });

  it('should preserve Voxta-specific fields (Scripts, TTS)', () => {
    const result = mergeCharacterEdits(testCharacter, {
      name: 'New Name',
    });

    expect(result.Scripts).toEqual(testCharacter.Scripts);
    expect(result.TextToSpeech).toEqual(testCharacter.TextToSpeech);
  });

  it('should update DateModified', () => {
    const result = mergeCharacterEdits(testCharacter, {
      name: 'Updated',
    });

    expect(result.DateModified).not.toBe(testCharacter.DateModified);
  });

  it('should handle ExtractedVoxtaCharacter input', () => {
    const extracted: ExtractedVoxtaCharacter = {
      id: testCharacter.Id,
      data: testCharacter,
      assets: [],
    };

    const result = mergeCharacterEdits(extracted, {
      personality: 'New personality',
    });

    expect(result.Personality).toBe('New personality');
    expect(result.Name).toBe('Alice');
  });

  it('should convert macros in text fields', () => {
    const result = mergeCharacterEdits(testCharacter, {
      first_mes: 'Hello {{user}}!',
    });

    // standardToVoxta adds spaces around macros
    expect(result.FirstMessage).toBe('Hello {{ user }}!');
  });

  it('should handle visual_description from extensions', () => {
    const result = mergeCharacterEdits(testCharacter, {
      extensions: {
        visual_description: 'Blue eyes, tall',
      },
    });

    expect(result.Description).toBe('Blue eyes, tall');
  });
});

describe('mergeBookEdits', () => {
  it('should update book name', () => {
    const result = mergeBookEdits(testBook, {
      name: 'Updated Lore',
      entries: [],
    });

    expect(result.Name).toBe('Updated Lore');
  });

  it('should update existing entries by ID', () => {
    const result = mergeBookEdits(testBook, {
      entries: [
        {
          keys: ['dragon', 'flame'],
          content: 'Dragons are powerful.',
          enabled: true,
          insertion_order: 0,
          name: 'item-1', // matches existing ID
          id: 0,
          priority: 15,
          comment: '',
          selective: false,
          secondary_keys: [],
          constant: false,
          position: 'before_char',
        },
      ],
    });

    expect(result.Items.length).toBe(2); // 1 updated + 1 soft-deleted
    const updated = result.Items.find((i) => i.Id === 'item-1');
    expect(updated).toBeDefined();
    expect(updated!.Keywords).toEqual(['dragon', 'flame']);
    expect(updated!.Text).toBe('Dragons are powerful.');
    expect(updated!.Weight).toBe(15);
  });

  it('should add new entries', () => {
    const result = mergeBookEdits(testBook, {
      entries: [
        {
          keys: ['new', 'entry'],
          content: 'New lore content.',
          enabled: true,
          insertion_order: 0,
          name: '', // new entry
          id: 0,
          priority: 10,
          comment: '',
          selective: false,
          secondary_keys: [],
          constant: false,
          position: 'before_char',
        },
      ],
    });

    const newEntry = result.Items.find((i) => i.Keywords.includes('new'));
    expect(newEntry).toBeDefined();
    expect(newEntry!.Text).toBe('New lore content.');
  });

  it('should soft-delete removed entries', () => {
    const result = mergeBookEdits(testBook, {
      entries: [], // All entries removed
    });

    expect(result.Items.every((i) => i.Deleted === true)).toBe(true);
  });

  it('should handle ExtractedVoxtaBook input', () => {
    const extracted: ExtractedVoxtaBook = {
      id: testBook.Id,
      data: testBook,
    };

    const result = mergeBookEdits(extracted, {
      name: 'New Name',
      entries: [],
    });

    expect(result.Name).toBe('New Name');
  });
});

describe('applyVoxtaDeltas', () => {
  function createTestPackage(): Uint8Array {
    const pkg: VoxtaPackage = {
      $type: 'package',
      Id: 'pkg-456',
      Name: 'Test Package',
      Version: '1.0',
      DateCreated: '2024-01-01T00:00:00Z',
      DateModified: '2024-01-01T00:00:00Z',
    };

    return zipSync({
      'package.json': fromString(JSON.stringify(pkg)),
      [`Characters/${testCharacter.Id}/character.json`]: fromString(
        JSON.stringify(testCharacter)
      ),
      [`Books/${testBook.Id}/book.json`]: fromString(JSON.stringify(testBook)),
      [`Characters/${testCharacter.Id}/thumbnail.png`]: new Uint8Array([1, 2, 3]),
    });
  }

  it('should update character.json when provided in deltas', () => {
    const original = createTestPackage();
    const updatedChar: VoxtaCharacter = { ...testCharacter, Name: 'Updated Alice' };

    const result = applyVoxtaDeltas(original, {
      characters: new Map([[testCharacter.Id, updatedChar]]),
    });

    const unzipped = unzipSync(result);
    const charData = JSON.parse(
      new TextDecoder().decode(unzipped[`Characters/${testCharacter.Id}/character.json`])
    ) as VoxtaCharacter;

    expect(charData.Name).toBe('Updated Alice');
  });

  it('should update book.json when provided in deltas', () => {
    const original = createTestPackage();
    const updatedBook: VoxtaBook = { ...testBook, Name: 'Updated Lore' };

    const result = applyVoxtaDeltas(original, {
      books: new Map([[testBook.Id, updatedBook]]),
    });

    const unzipped = unzipSync(result);
    const bookData = JSON.parse(
      new TextDecoder().decode(unzipped[`Books/${testBook.Id}/book.json`])
    ) as VoxtaBook;

    expect(bookData.Name).toBe('Updated Lore');
  });

  it('should update package.json when provided in deltas', () => {
    const original = createTestPackage();

    const result = applyVoxtaDeltas(original, {
      package: { Name: 'New Package Name' },
    });

    const unzipped = unzipSync(result);
    const pkgData = JSON.parse(
      new TextDecoder().decode(unzipped['package.json'])
    ) as VoxtaPackage;

    expect(pkgData.Name).toBe('New Package Name');
    expect(pkgData.Id).toBe('pkg-456'); // Original preserved
  });

  it('should preserve unchanged files', () => {
    const original = createTestPackage();

    const result = applyVoxtaDeltas(original, {
      characters: new Map([[testCharacter.Id, { ...testCharacter, Name: 'New' }]]),
    });

    const unzipped = unzipSync(result);
    // Thumbnail should be unchanged
    expect(unzipped[`Characters/${testCharacter.Id}/thumbnail.png`]).toEqual(
      new Uint8Array([1, 2, 3])
    );
    // Book should be unchanged
    const bookData = JSON.parse(
      new TextDecoder().decode(unzipped[`Books/${testBook.Id}/book.json`])
    ) as VoxtaBook;
    expect(bookData.Name).toBe('World Lore');
  });
});

describe('getPackageManifest', () => {
  it('should create manifest from VoxtaData', () => {
    const data: VoxtaData = {
      package: {
        $type: 'package',
        Id: 'pkg-1',
        Name: 'Test Package',
        Version: '1.0',
      },
      characters: [
        {
          id: 'char-1',
          data: { ...testCharacter, Id: 'char-1', MemoryBooks: ['book-1'] },
          assets: [],
        },
        {
          id: 'char-2',
          data: { ...testCharacter, Id: 'char-2', Name: 'Bob', MemoryBooks: ['book-1'] },
          assets: [],
        },
      ],
      scenarios: [
        {
          id: 'scenario-1',
          data: { $type: 'scenario', Id: 'scenario-1', Name: 'Test Scenario' },
        },
      ],
      books: [{ id: 'book-1', data: testBook }],
    };

    const manifest = getPackageManifest(data);

    expect(manifest.packageId).toBe('pkg-1');
    expect(manifest.packageName).toBe('Test Package');
    expect(manifest.characters).toHaveLength(2);
    expect(manifest.books).toHaveLength(1);
    expect(manifest.books[0]!.usedBy).toEqual(['char-1', 'char-2']);
    expect(manifest.scenarios).toHaveLength(1);
  });

  it('should handle packages without metadata', () => {
    const data: VoxtaData = {
      characters: [{ id: 'char-1', data: testCharacter, assets: [] }],
      scenarios: [],
      books: [],
    };

    const manifest = getPackageManifest(data);

    expect(manifest.packageId).toBeUndefined();
    expect(manifest.packageName).toBeUndefined();
    expect(manifest.characters).toHaveLength(1);
  });
});

describe('extractCharacterPackage', () => {
  function createMultiCharPackage(): Uint8Array {
    const char1 = { ...testCharacter, Id: 'char-1', MemoryBooks: ['book-1'] };
    const char2 = { ...testCharacter, Id: 'char-2', Name: 'Bob', MemoryBooks: ['book-2'] };
    const book1 = { ...testBook, Id: 'book-1' };
    const book2 = { ...testBook, Id: 'book-2', Name: 'Bob Lore' };
    const pkg: VoxtaPackage = {
      $type: 'package',
      Id: 'pkg-multi',
      Name: 'Multi Char Package',
      Version: '1.0',
    };

    return zipSync({
      'package.json': fromString(JSON.stringify(pkg)),
      'Characters/char-1/character.json': fromString(JSON.stringify(char1)),
      'Characters/char-1/thumbnail.png': new Uint8Array([1, 2, 3]),
      'Characters/char-2/character.json': fromString(JSON.stringify(char2)),
      'Characters/char-2/thumbnail.png': new Uint8Array([4, 5, 6]),
      'Books/book-1/book.json': fromString(JSON.stringify(book1)),
      'Books/book-2/book.json': fromString(JSON.stringify(book2)),
    });
  }

  it('should extract single character with their books', () => {
    const original = createMultiCharPackage();
    const result = extractCharacterPackage(original, 'char-1');
    const unzipped = unzipSync(result);

    // Should have char-1 files
    expect(unzipped['Characters/char-1/character.json']).toBeDefined();
    expect(unzipped['Characters/char-1/thumbnail.png']).toBeDefined();

    // Should have book-1 (referenced by char-1)
    expect(unzipped['Books/book-1/book.json']).toBeDefined();

    // Should NOT have char-2 or book-2
    expect(unzipped['Characters/char-2/character.json']).toBeUndefined();
    expect(unzipped['Books/book-2/book.json']).toBeUndefined();

    // Should have new package.json
    const pkg = JSON.parse(
      new TextDecoder().decode(unzipped['package.json'])
    ) as VoxtaPackage;
    expect(pkg.Name).toBe('Alice');
    expect(pkg.Id).not.toBe('pkg-multi'); // New ID generated
  });

  it('should exclude books when includeBooks is false', () => {
    const original = createMultiCharPackage();
    const result = extractCharacterPackage(original, 'char-1', {
      includeBooks: false,
    });
    const unzipped = unzipSync(result);

    expect(unzipped['Characters/char-1/character.json']).toBeDefined();
    expect(unzipped['Books/book-1/book.json']).toBeUndefined();
  });

  it('should use custom package name', () => {
    const original = createMultiCharPackage();
    const result = extractCharacterPackage(original, 'char-1', {
      packageName: 'Custom Name',
    });
    const unzipped = unzipSync(result);

    const pkg = JSON.parse(
      new TextDecoder().decode(unzipped['package.json'])
    ) as VoxtaPackage;
    expect(pkg.Name).toBe('Custom Name');
  });

  it('should throw for non-existent character', () => {
    const original = createMultiCharPackage();
    expect(() => extractCharacterPackage(original, 'non-existent')).toThrow(
      'Character non-existent not found'
    );
  });
});

describe('addCharacterToPackage', () => {
  function createSingleCharPackage(): Uint8Array {
    const char1 = { ...testCharacter, Id: 'char-1' };
    const pkg: VoxtaPackage = {
      $type: 'package',
      Id: 'pkg-single',
      Name: 'Single Char Package',
      Version: '1.0',
    };

    return zipSync({
      'package.json': fromString(JSON.stringify(pkg)),
      'Characters/char-1/character.json': fromString(JSON.stringify(char1)),
    });
  }

  it('should add new character to existing package', () => {
    const original = createSingleCharPackage();
    const newChar: VoxtaCharacter = {
      ...testCharacter,
      Id: 'char-new',
      Name: 'New Character',
    };

    const result = addCharacterToPackage(original, newChar);
    const unzipped = unzipSync(result);

    // Should have both characters
    expect(unzipped['Characters/char-1/character.json']).toBeDefined();
    expect(unzipped['Characters/char-new/character.json']).toBeDefined();

    const addedChar = JSON.parse(
      new TextDecoder().decode(unzipped['Characters/char-new/character.json'])
    ) as VoxtaCharacter;
    expect(addedChar.Name).toBe('New Character');
    expect(addedChar.PackageId).toBe('pkg-single'); // Uses existing package ID
  });

  it('should add character with thumbnail', () => {
    const original = createSingleCharPackage();
    const newChar: VoxtaCharacter = { ...testCharacter, Id: 'char-new' };
    const thumbnail = new Uint8Array([9, 8, 7]);

    const result = addCharacterToPackage(original, newChar, { thumbnail });
    const unzipped = unzipSync(result);

    expect(unzipped['Characters/char-new/thumbnail.png']).toEqual(thumbnail);
  });

  it('should add character with assets', () => {
    const original = createSingleCharPackage();
    const newChar: VoxtaCharacter = { ...testCharacter, Id: 'char-new' };
    const assets = new Map<string, Uint8Array>([
      ['Assets/Avatars/Default/smile.png', new Uint8Array([1, 2, 3])],
    ]);

    const result = addCharacterToPackage(original, newChar, { assets });
    const unzipped = unzipSync(result);

    expect(
      unzipped['Characters/char-new/Assets/Avatars/Default/smile.png']
    ).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('should add character with books', () => {
    const original = createSingleCharPackage();
    const newChar: VoxtaCharacter = {
      ...testCharacter,
      Id: 'char-new',
      MemoryBooks: ['new-book'],
    };
    const newBook: VoxtaBook = { ...testBook, Id: 'new-book', Name: 'New Book' };

    const result = addCharacterToPackage(original, newChar, {
      books: [newBook],
    });
    const unzipped = unzipSync(result);

    expect(unzipped['Books/new-book/book.json']).toBeDefined();
    const bookData = JSON.parse(
      new TextDecoder().decode(unzipped['Books/new-book/book.json'])
    ) as VoxtaBook;
    expect(bookData.Name).toBe('New Book');
    expect(bookData.PackageId).toBe('pkg-single');
  });
});
