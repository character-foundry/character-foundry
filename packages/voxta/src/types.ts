/**
 * Voxta Types
 *
 * Type definitions for Voxta package format.
 */

import type { BinaryData } from '@character-foundry/core';

/**
 * Valid compression levels
 */
export type CompressionLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/**
 * Voxta package metadata
 */
export interface VoxtaPackage {
  $type: 'package';
  Id: string;
  Name: string;
  Version: string;
  Description?: string;
  Creator?: string;
  ExplicitContent?: boolean;
  EntryResource?: {
    Kind: number; // 1=Character, 3=Scenario
    Id: string;
  };
  ThumbnailResource?: {
    Kind: number;
    Id: string;
  };
  DateCreated?: string;
  DateModified?: string;
}

/**
 * Voxta TTS configuration
 */
export interface VoxtaTtsConfig {
  Voice: {
    parameters: {
      VoiceBackend?: string;
      VoiceId?: string;
      Gender?: string;
      Filename?: string;
      FinetuneVoice?: string;
      [key: string]: unknown;
    };
    label: string;
  };
  Service: {
    ServiceName: string;
    ServiceId: string;
  };
}

/**
 * Voxta script
 */
export interface VoxtaScript {
  Name: string;
  Content: string;
}

/**
 * Voxta character
 */
export interface VoxtaCharacter {
  $type: 'character';
  Id: string;
  Name: string;
  Version?: string;
  PackageId?: string;

  // Core Info
  Description?: string;  // Physical description
  Personality?: string;
  Profile?: string;      // Profile/Backstory
  Scenario?: string;
  FirstMessage?: string;
  MessageExamples?: string;

  // Metadata
  Creator?: string;
  CreatorNotes?: string;
  Tags?: string[];
  ExplicitContent?: boolean;
  Culture?: string;

  // References
  MemoryBooks?: string[];
  DefaultScenarios?: string[];

  // TTS
  TextToSpeech?: VoxtaTtsConfig[];

  // AI Settings
  ChatStyle?: number;
  EnableThinkingSpeech?: boolean;
  NotifyUserAwayReturn?: boolean;
  TimeAware?: boolean;
  UseMemory?: boolean;
  MaxTokens?: number;
  MaxSentences?: number;
  SystemPromptOverrideType?: number;

  // Advanced
  Scripts?: VoxtaScript[];
  Augmentations?: unknown[];

  Thumbnail?: {
    RandomizedETag?: string;
    ContentType?: string;
  };

  DateCreated?: string;
  DateModified?: string;
}

/**
 * Voxta book item
 */
export interface VoxtaBookItem {
  Id: string;
  Keywords: string[];
  Text: string;
  Weight?: number;
  Deleted?: boolean;
  CreatedAt?: string;
  LastUpdated?: string;
  DeletedAt?: string;
}

/**
 * Voxta book (lorebook)
 */
export interface VoxtaBook {
  $type: 'book';
  Id: string;
  Name: string;
  Version?: string;
  PackageId?: string;
  Description?: string;
  ExplicitContent?: boolean;
  Creator?: string;
  Items: VoxtaBookItem[];
  DateCreated?: string;
  DateModified?: string;
}

/**
 * Voxta scenario action
 */
export interface VoxtaAction {
  Name: string;
  Layer?: string;
  Arguments?: unknown[];
  FinalLayer?: boolean;
  Timing?: number;
  Description?: string;
  Disabled?: boolean;
  Once?: boolean;
  FlagsFilter?: string;
  Effect?: {
    SetFlags?: string[];
    MaxSentences?: number;
    MaxTokens?: number;
    [key: string]: unknown;
  };
}

/**
 * Voxta scenario
 */
export interface VoxtaScenario {
  $type: 'scenario';
  Id: string;
  Name: string;
  Version?: string;
  ParentId?: string;
  PackageId?: string;
  Client?: string;
  Creator?: string;
  Description?: string;
  SharedScripts?: VoxtaScript[];
  Actions?: VoxtaAction[];
}

/**
 * Extracted Voxta asset
 */
export interface ExtractedVoxtaAsset {
  path: string;
  buffer: BinaryData;
  characterId?: string;
}

/**
 * Extracted Voxta character with assets
 */
export interface ExtractedVoxtaCharacter {
  id: string;
  data: VoxtaCharacter;
  thumbnail?: BinaryData;
  assets: ExtractedVoxtaAsset[];
}

/**
 * Extracted Voxta scenario
 */
export interface ExtractedVoxtaScenario {
  id: string;
  data: VoxtaScenario;
  thumbnail?: BinaryData;
}

/**
 * Extracted Voxta book
 */
export interface ExtractedVoxtaBook {
  id: string;
  data: VoxtaBook;
}

/**
 * Complete extracted Voxta data
 */
export interface VoxtaData {
  package?: VoxtaPackage;
  characters: ExtractedVoxtaCharacter[];
  scenarios: ExtractedVoxtaScenario[];
  books: ExtractedVoxtaBook[];
}

/**
 * Options for Voxta extraction
 */
export interface VoxtaReadOptions {
  maxFileSize?: number;
  maxAssetSize?: number;
  maxTotalSize?: number;
}

/**
 * Asset to include in Voxta export
 */
export interface VoxtaWriteAsset {
  type: string;
  name: string;
  ext: string;
  data: BinaryData;
  tags?: string[];
  isMain?: boolean;
}

/**
 * Options for building Voxta package
 */
export interface VoxtaWriteOptions {
  compressionLevel?: CompressionLevel;
  includePackageJson?: boolean;
  characterId?: string;
  packageId?: string;
}

/**
 * Result of building a Voxta package
 */
export interface VoxtaBuildResult {
  buffer: BinaryData;
  assetCount: number;
  totalSize: number;
  characterId: string;
}

/**
 * Voxta extension data stored in CCv3 extensions
 */
export interface VoxtaExtensionData {
  id: string;
  version?: string;
  packageId?: string;
  textToSpeech?: VoxtaTtsConfig[];
  appearance?: string;
  chatSettings?: {
    chatStyle?: number;
    enableThinkingSpeech?: boolean;
    notifyUserAwayReturn?: boolean;
    timeAware?: boolean;
    useMemory?: boolean;
    maxTokens?: number;
    maxSentences?: number;
  };
  scripts?: VoxtaScript[];
  scenario?: {
    actions?: VoxtaAction[];
    sharedScripts?: VoxtaScript[];
  };
  original?: Partial<VoxtaCharacter>;
}

/**
 * Loss report for Voxta export
 */
export interface VoxtaLossReport {
  lostFields: string[];
  lostAssets: string[];
  warnings: string[];
  reason: string;
}
