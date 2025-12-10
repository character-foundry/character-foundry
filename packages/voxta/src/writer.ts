/**
 * Voxta Writer
 *
 * Creates .voxpkg files from CCv3 card data.
 */

import { zipSync, type Zippable } from 'fflate';
import { type BinaryData, fromString, generateUUID } from '@character-foundry/core';
import type { CCv3Data } from '@character-foundry/schemas';
import type {
  VoxtaWriteAsset,
  VoxtaWriteOptions,
  VoxtaBuildResult,
  VoxtaCharacter,
  VoxtaScenario,
  VoxtaExtensionData,
  CompressionLevel,
} from './types.js';
import { standardToVoxta } from './macros.js';
import { ccv3LorebookToVoxtaBook } from './mapper.js';

/**
 * Sanitize a name for use in file paths
 */
function sanitizeName(name: string, ext: string): string {
  let safeName = name;

  if (safeName.toLowerCase().endsWith(`.${ext.toLowerCase()}`)) {
    safeName = safeName.substring(0, safeName.length - (ext.length + 1));
  }

  safeName = safeName
    .replace(/[._]/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!safeName) safeName = 'asset';

  return safeName;
}

/**
 * Build a Voxta package from CCv3 card data
 */
export function writeVoxta(
  card: CCv3Data,
  assets: VoxtaWriteAsset[],
  options: VoxtaWriteOptions = {}
): VoxtaBuildResult {
  let { compressionLevel = 6, includePackageJson = false } = options;
  const cardData = card.data;

  // Get Voxta extension data if present
  const extensions = cardData.extensions as Record<string, unknown> | undefined;
  const voxtaExt = extensions?.voxta as VoxtaExtensionData | undefined;

  // Generate IDs
  const characterId = options.characterId || voxtaExt?.id || generateUUID();
  const packageId = options.packageId || voxtaExt?.packageId || generateUUID();
  const dateNow = new Date().toISOString();

  // Get appearance from voxta extension or visual_description
  const appearance = voxtaExt?.appearance || (extensions?.visual_description as string) || '';

  // Create ZIP entries
  const zipEntries: Zippable = {};

  // Handle Lorebook (MemoryBook)
  const book = ccv3LorebookToVoxtaBook(card);
  const memoryBooks: string[] = voxtaExt?.original?.MemoryBooks || [];

  if (book) {
    // Ensure we have a unique ID for the book
    if (!book.Id) book.Id = generateUUID();
    
    // Add to memory books list if not already present
    if (!memoryBooks.includes(book.Id)) {
      memoryBooks.push(book.Id);
    }

    // Write book to ZIP
    zipEntries[`Books/${book.Id}/book.json`] = [
      fromString(JSON.stringify(book, null, 2)),
      { level: compressionLevel as CompressionLevel },
    ];

    // Force package.json for multi-asset bundles
    includePackageJson = true;
  }

  // 1. Package.json (optional, but required if lorebook exists)
  if (includePackageJson) {
    const packageMeta = {
      $type: 'package',
      Id: packageId,
      Name: cardData.name,
      Version: cardData.character_version || '1.0.0',
      Description: cardData.description,
      Creator: cardData.creator,
      ExplicitContent: true,
      EntryResource: { Kind: 1, Id: characterId },
      ThumbnailResource: { Kind: 1, Id: characterId },
      DateCreated: voxtaExt?.original?.DateCreated || dateNow,
      DateModified: dateNow,
    };
    zipEntries['package.json'] = [
      fromString(JSON.stringify(packageMeta, null, 2)),
      { level: compressionLevel as CompressionLevel },
    ];
  }

  // 2. Character.json
  const character: VoxtaCharacter = {
    $type: 'character',
    Id: characterId,
    PackageId: packageId,
    Name: cardData.name,
    Version: cardData.character_version,

    // Core Info - apply macro conversion
    Description: appearance,
    Personality: standardToVoxta(cardData.personality),
    Profile: standardToVoxta(cardData.description),
    Scenario: standardToVoxta(cardData.scenario),
    FirstMessage: standardToVoxta(cardData.first_mes),
    AlternativeFirstMessages: (cardData.alternate_greetings || []).map(standardToVoxta),
    MessageExamples: standardToVoxta(cardData.mes_example || ''),

    // Metadata
    Creator: cardData.creator,
    CreatorNotes: cardData.creator_notes,
    Tags: cardData.tags,

    // References
    MemoryBooks: memoryBooks.length > 0 ? memoryBooks : undefined,

    // Voxta-specific from extension
    TextToSpeech: voxtaExt?.textToSpeech,
    ChatStyle: voxtaExt?.chatSettings?.chatStyle,
    EnableThinkingSpeech: voxtaExt?.chatSettings?.enableThinkingSpeech,
    NotifyUserAwayReturn: voxtaExt?.chatSettings?.notifyUserAwayReturn,
    TimeAware: voxtaExt?.chatSettings?.timeAware,
    UseMemory: voxtaExt?.chatSettings?.useMemory,
    MaxTokens: voxtaExt?.chatSettings?.maxTokens,
    MaxSentences: voxtaExt?.chatSettings?.maxSentences,
    SystemPromptOverrideType: voxtaExt?.chatSettings?.systemPromptOverrideType,
    
    // Simulation Settings
    ClimaxSensitivity: voxtaExt?.simulationSettings?.climaxSensitivity,
    PleasureDecay: voxtaExt?.simulationSettings?.pleasureDecay,

    Scripts: voxtaExt?.scripts,

    DateCreated: voxtaExt?.original?.DateCreated || dateNow,
    DateModified: dateNow,
  };

  zipEntries[`Characters/${characterId}/character.json`] = [
    fromString(JSON.stringify(character, null, 2)),
    { level: compressionLevel as CompressionLevel },
  ];

  // 3. Add assets
  let assetCount = 0;
  let mainThumbnail: VoxtaWriteAsset | undefined;

  for (const asset of assets) {
    const safeName = sanitizeName(asset.name, asset.ext);
    const finalFilename = `${safeName}.${asset.ext}`;
    let voxtaPath = '';

    const tags = asset.tags || [];

    // Check if this is the main icon (used as thumbnail only, not in Assets folder)
    const isMainIcon = asset.type === 'icon' && (
      tags.includes('portrait-override') ||
      asset.name === 'main' ||
      asset.isMain
    );

    if (asset.type === 'sound' || tags.includes('voice')) {
      voxtaPath = `Characters/${characterId}/Assets/VoiceSamples/${finalFilename}`;
    } else if (asset.type === 'icon' || asset.type === 'emotion') {
      // Track main icon for thumbnail (but don't add to Assets folder)
      if (asset.type === 'icon') {
        if (tags.includes('portrait-override')) {
          mainThumbnail = asset;
        } else if (!mainThumbnail && (asset.name === 'main' || asset.isMain)) {
          mainThumbnail = asset;
        }
      }

      // Skip adding main icon to Assets folder - it will only be the thumbnail
      if (isMainIcon) {
        continue;
      }

      voxtaPath = `Characters/${characterId}/Assets/Avatars/Default/${finalFilename}`;
    } else {
      voxtaPath = `Characters/${characterId}/Assets/Misc/${finalFilename}`;
    }

    zipEntries[voxtaPath] = [asset.data, { level: compressionLevel as CompressionLevel }];
    assetCount++;
  }

  // 4. Add thumbnail
  if (!mainThumbnail && assets.length > 0) {
    mainThumbnail = assets.find((a) => a.type === 'icon');
  }

  if (mainThumbnail) {
    zipEntries[`Characters/${characterId}/thumbnail.png`] = [
      mainThumbnail.data,
      { level: compressionLevel as CompressionLevel },
    ];
  }

  // 5. Add scenario if provided (uses scenario.Id as key)
  let scenarioId: string | undefined;
  if (options.scenario) {
    const scenario = options.scenario;
    scenarioId = scenario.Id;

    // Ensure scenario has required fields
    const scenarioData: VoxtaScenario = {
      ...scenario,
      $type: 'scenario',
      PackageId: packageId,
      DateModified: dateNow,
    };

    // Write scenario.json
    zipEntries[`Scenarios/${scenarioId}/scenario.json`] = [
      fromString(JSON.stringify(scenarioData, null, 2)),
      { level: compressionLevel as CompressionLevel },
    ];

    // Add scenario thumbnail if provided
    if (options.scenarioThumbnail) {
      zipEntries[`Scenarios/${scenarioId}/thumbnail.png`] = [
        options.scenarioThumbnail,
        { level: compressionLevel as CompressionLevel },
      ];
    }

    // Update package.json EntryResource to point to scenario (Kind: 3)
    if (includePackageJson) {
      const packageMeta = {
        $type: 'package',
        Id: packageId,
        Name: scenario.Name || cardData.name,
        Version: scenario.Version || cardData.character_version || '1.0.0',
        Description: scenario.Description || cardData.description,
        Creator: scenario.Creator || cardData.creator,
        ExplicitContent: scenario.ExplicitContent ?? true,
        EntryResource: { Kind: 3, Id: scenarioId }, // Kind 3 = Scenario
        ThumbnailResource: { Kind: 3, Id: scenarioId },
        DateCreated: scenario.DateCreated || voxtaExt?.original?.DateCreated || dateNow,
        DateModified: dateNow,
      };
      zipEntries['package.json'] = [
        fromString(JSON.stringify(packageMeta, null, 2)),
        { level: compressionLevel as CompressionLevel },
      ];
    }
  }

  // Create ZIP
  const buffer = zipSync(zipEntries);

  return {
    buffer,
    assetCount,
    totalSize: buffer.length,
    characterId,
    scenarioId,
  };
}

/**
 * Async version of writeVoxta
 */
export async function writeVoxtaAsync(
  card: CCv3Data,
  assets: VoxtaWriteAsset[],
  options: VoxtaWriteOptions = {}
): Promise<VoxtaBuildResult> {
  return writeVoxta(card, assets, options);
}
