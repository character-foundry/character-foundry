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
  Label?: string;           // Optional nickname/display name
  Version?: string;
  PackageId?: string;

  // Core Info
  Description?: string;     // Physical/visual appearance
  Personality?: string;
  Profile?: string;         // Profile/Backstory
  Scenario?: string;
  FirstMessage?: string;
  AlternateGreetings?: string[]; // Alternate greetings (Voxta next version)
  MessageExamples?: string;

  // System prompts
  SystemPrompt?: string;           // System prompt (additive)
  PostHistoryInstructions?: string; // UJB - added at end of messages
  Context?: string;                // Context field
  Instructions?: string;           // User instructions (not read by LLM)

  // Persona overrides
  UserNameOverride?: string;
  UserDescriptionOverride?: string;

  // Metadata
  Creator?: string;
  CreatorNotes?: string;
  Tags?: string[];
  ExplicitContent?: boolean;
  Culture?: string;
  ImportedFrom?: string;    // Source tracking

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

  // Simulation Settings
  ClimaxSensitivity?: number;
  PleasureDecay?: number;

  // Advanced
  Scripts?: VoxtaScript[];
  Augmentations?: unknown[];

  Thumbnail?: {
    RandomizedETag?: string;
    ContentType?: string;
  };

  DateCreated?: string;   // ISO timestamp
  DateModified?: string;  // ISO timestamp
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
  EvaluateNextEvent?: boolean;
  Effect?: {
    SetFlags?: string[];
    Script?: string;
    Event?: string;
    Story?: string;
    Secret?: string;
    Instructions?: string;
    MaxSentences?: number;
    MaxTokens?: number;
    [key: string]: unknown;
  };
}

/**
 * Voxta scenario event (similar to action but for event triggers)
 */
export interface VoxtaEvent {
  Id?: string;
  Name: string;
  Layer?: string;
  Timing?: number;
  Description?: string;
  Arguments?: unknown[];
  Disabled?: boolean;
  FinalLayer?: boolean;
  Once?: boolean;
  FlagsFilter?: string;
  EvaluateNextEvent?: boolean;
  Effect?: {
    SetFlags?: string[];
    Script?: string;
    Event?: string;
    Story?: string;
    Secret?: string;
    Instructions?: string;
    MaxSentences?: number;
    MaxTokens?: number;
    [key: string]: unknown;
  };
}

/**
 * Voxta scenario context (conditional context blocks)
 */
export interface VoxtaContext {
  Name: string;
  Text: string;
  FlagsFilter?: string;
  Disabled?: boolean;
}

/**
 * Voxta scenario role - maps characters to scenario slots
 */
export interface VoxtaRole {
  Name: string;
  Description?: string;
  DefaultCharacterId: string;
  EnabledOnStart?: boolean;
}

/**
 * Voxta impersonation (user persona override)
 */
export interface VoxtaImpersonation {
  Name: string;
  Description?: string;
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

  // Core content
  Template?: string;
  Messages?: string;
  SystemPrompt?: string;
  SystemPromptOverrideType?: number;

  // Character mappings
  Roles?: VoxtaRole[];
  NarratorCharacterId?: string;
  Impersonation?: VoxtaImpersonation;

  // Scripting/automation
  SharedScripts?: VoxtaScript[];
  Actions?: VoxtaAction[];
  Events?: VoxtaEvent[];
  Contexts?: VoxtaContext[];

  // Settings
  ExplicitContent?: boolean;
  ChatFlow?: number;
  ChatStyle?: number;
  MemoryBooks?: string[];

  // Metadata
  Thumbnail?: {
    ETag?: number;
    RandomizedETag?: string;
    ContentType?: string;
  };
  DateCreated?: string;
  DateModified?: string;

  // App control (optional)
  UserId?: string;
  AppControlled?: boolean;
  Locked?: boolean;
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
 * Voxta export type
 * - 'package': Has package.json with full metadata
 * - 'scenario': Has Scenarios/ folder but no package.json (scenario export)
 * - 'character': Only has Characters/ folder (single/multi character export)
 */
export type VoxtaExportType = 'package' | 'scenario' | 'character';

/**
 * Complete extracted Voxta data
 */
export interface VoxtaData {
  package?: VoxtaPackage;
  characters: ExtractedVoxtaCharacter[];
  scenarios: ExtractedVoxtaScenario[];
  books: ExtractedVoxtaBook[];

  /**
   * Type of export detected:
   * - 'package': Has package.json
   * - 'scenario': Has Scenarios/ but no package.json
   * - 'character': Only Characters/ (no package.json or Scenarios/)
   */
  exportType: VoxtaExportType;
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
  /** Scenario to include - uses scenario.Id as the key */
  scenario?: VoxtaScenario;
  /** Scenario thumbnail */
  scenarioThumbnail?: BinaryData;
}

/**
 * Result of building a Voxta package
 */
export interface VoxtaBuildResult {
  buffer: BinaryData;
  assetCount: number;
  totalSize: number;
  characterId: string;
  /** Scenario ID if a scenario was included */
  scenarioId?: string;
}

/**
 * Voxta extension data stored in CCv3 extensions
 */
export interface VoxtaExtensionData {
  id: string;
  version?: string;
  packageId?: string;
  label?: string;
  textToSpeech?: VoxtaTtsConfig[];
  appearance?: string;
  context?: string;
  instructions?: string;
  userNameOverride?: string;
  userDescriptionOverride?: string;
  culture?: string;
  importedFrom?: string;
  chatSettings?: {
    chatStyle?: number;
    enableThinkingSpeech?: boolean;
    notifyUserAwayReturn?: boolean;
    timeAware?: boolean;
    useMemory?: boolean;
    maxTokens?: number;
    maxSentences?: number;
    systemPromptOverrideType?: number;
  };
  simulationSettings?: {
    climaxSensitivity?: number;
    pleasureDecay?: number;
  };
  scripts?: VoxtaScript[];
  augmentations?: unknown[];
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
