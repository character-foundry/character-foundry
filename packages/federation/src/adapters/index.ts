/**
 * Platform Adapters
 */

// Base adapter
export {
  BasePlatformAdapter,
  MemoryPlatformAdapter,
  type AdapterCard,
  type AdapterAsset,
} from './base.js';

// HTTP adapter
export {
  HttpPlatformAdapter,
  createArchiveAdapter,
  createHubAdapter,
  type HttpAdapterConfig,
  type FetchFn,
} from './http.js';

// SillyTavern adapter
export {
  SillyTavernAdapter,
  stCharacterToCCv3,
  ccv3ToSTCharacter,
  createMockSTBridge,
  type SillyTavernBridge,
  type STCharacter,
} from './sillytavern.js';
