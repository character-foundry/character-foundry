/**
 * Feature derivation tests
 */

import { describe, it, expect } from 'vitest';
import { deriveFeatures } from './feature-deriver.js';
import type { CCv2Data } from './ccv2.js';
import type { CCv3DataInner } from './ccv3.js';

describe('deriveFeatures', () => {
  describe('V2 cards', () => {
    it('derives features from minimal V2 card', () => {
      const card: CCv2Data = {
        name: 'Test Character',
        description: 'A test character',
        personality: 'Friendly',
        scenario: 'A test scenario',
        first_mes: 'Hello!',
        mes_example: '<START>',
      };

      const features = deriveFeatures(card);

      expect(features.hasAlternateGreetings).toBe(false);
      expect(features.alternateGreetingsCount).toBe(0);
      expect(features.hasLorebook).toBe(false);
      expect(features.lorebookEntriesCount).toBe(0);
      expect(features.hasEmbeddedImages).toBe(false);
      expect(features.embeddedImagesCount).toBe(0);
      expect(features.hasGallery).toBe(false);
      expect(features.hasRisuExtensions).toBe(false);
      expect(features.hasRisuScripts).toBe(false);
      expect(features.hasDepthPrompt).toBe(false);
      expect(features.hasVoxtaAppearance).toBe(false);
    });

    it('detects alternate greetings in V2', () => {
      const card: CCv2Data = {
        name: 'Test',
        description: 'Test',
        personality: 'Test',
        scenario: 'Test',
        first_mes: 'Hi',
        mes_example: '',
        alternate_greetings: ['Greet 1', 'Greet 2', 'Greet 3'],
      };

      const features = deriveFeatures(card);

      expect(features.hasAlternateGreetings).toBe(true);
      expect(features.alternateGreetingsCount).toBe(3);
    });

    it('detects lorebook in V2', () => {
      const card: CCv2Data = {
        name: 'Test',
        description: 'Test',
        personality: 'Test',
        scenario: 'Test',
        first_mes: 'Hi',
        mes_example: '',
        character_book: {
          entries: [
            {
              keys: ['test'],
              content: 'Test entry',
              enabled: true,
              insertion_order: 0,
            },
            {
              keys: ['another'],
              content: 'Another entry',
              enabled: true,
              insertion_order: 1,
            },
          ],
        },
      };

      const features = deriveFeatures(card);

      expect(features.hasLorebook).toBe(true);
      expect(features.lorebookEntriesCount).toBe(2);
    });

    it('handles empty lorebook entries', () => {
      const card: CCv2Data = {
        name: 'Test',
        description: 'Test',
        personality: 'Test',
        scenario: 'Test',
        first_mes: 'Hi',
        mes_example: '',
        character_book: {
          entries: [],
        },
      };

      const features = deriveFeatures(card);

      expect(features.hasLorebook).toBe(false);
      expect(features.lorebookEntriesCount).toBe(0);
    });

    it('detects embedded images in V2 description', () => {
      const card: CCv2Data = {
        name: 'Test',
        description:
          'A character with an image: data:image/png;base64,iVBORw0KGgoAAAANS and another data:image/jpeg;base64,/9j/4AAQ',
        personality: 'Test',
        scenario: 'Test',
        first_mes: 'Hi',
        mes_example: '',
      };

      const features = deriveFeatures(card);

      expect(features.hasEmbeddedImages).toBe(true);
      expect(features.embeddedImagesCount).toBe(2);
    });

    it('detects Risu extensions in V2', () => {
      const card: CCv2Data = {
        name: 'Test',
        description: 'Test',
        personality: 'Test',
        scenario: 'Test',
        first_mes: 'Hi',
        mes_example: '',
        extensions: {
          risuai: {
            emotions: [['happy', 'data:image/png;base64,abc']],
          },
        },
      };

      const features = deriveFeatures(card);

      expect(features.hasRisuExtensions).toBe(true);
    });

    it('detects Risu scripts in V2', () => {
      const card: CCv2Data = {
        name: 'Test',
        description: 'Test',
        personality: 'Test',
        scenario: 'Test',
        first_mes: 'Hi',
        mes_example: '',
        extensions: {
          risuai: {
            triggerscript: ['some', 'script'],
          },
        },
      };

      const features = deriveFeatures(card);

      expect(features.hasRisuExtensions).toBe(true);
      expect(features.hasRisuScripts).toBe(true);
    });

    it('detects depth prompt in V2', () => {
      const card: CCv2Data = {
        name: 'Test',
        description: 'Test',
        personality: 'Test',
        scenario: 'Test',
        first_mes: 'Hi',
        mes_example: '',
        extensions: {
          depth_prompt: {
            depth: 4,
            prompt: 'Test prompt',
          },
        },
      };

      const features = deriveFeatures(card);

      expect(features.hasDepthPrompt).toBe(true);
    });
  });

  describe('V3 cards', () => {
    it('derives features from minimal V3 card', () => {
      const card: CCv3DataInner = {
        name: 'Test Character',
        description: 'A test character',
        personality: 'Friendly',
        scenario: 'A test scenario',
        first_mes: 'Hello!',
        mes_example: '<START>',
        creator: '',
        character_version: '',
        tags: [],
        group_only_greetings: [],
      };

      const features = deriveFeatures(card);

      expect(features.hasAlternateGreetings).toBe(false);
      expect(features.alternateGreetingsCount).toBe(0);
      expect(features.hasLorebook).toBe(false);
      expect(features.lorebookEntriesCount).toBe(0);
      expect(features.hasEmbeddedImages).toBe(false);
      expect(features.embeddedImagesCount).toBe(0);
      expect(features.hasGallery).toBe(false);
    });

    it('detects alternate greetings in V3', () => {
      const card: CCv3DataInner = {
        name: 'Test',
        description: 'Test',
        personality: 'Test',
        scenario: 'Test',
        first_mes: 'Hi',
        mes_example: '',
        creator: '',
        character_version: '',
        tags: [],
        group_only_greetings: [],
        alternate_greetings: ['Alt 1', 'Alt 2'],
      };

      const features = deriveFeatures(card);

      expect(features.hasAlternateGreetings).toBe(true);
      expect(features.alternateGreetingsCount).toBe(2);
    });

    it('detects assets in V3', () => {
      const card: CCv3DataInner = {
        name: 'Test',
        description: 'Test',
        personality: 'Test',
        scenario: 'Test',
        first_mes: 'Hi',
        mes_example: '',
        creator: '',
        character_version: '',
        tags: [],
        group_only_greetings: [],
        assets: [
          {
            type: 'image',
            uri: 'assets/portrait.png',
            name: 'Portrait',
            ext: 'png',
          },
          {
            type: 'image',
            uri: 'assets/emotion_happy.png',
            name: 'Happy',
            ext: 'png',
          },
          {
            type: 'audio',
            uri: 'assets/voice.mp3',
            name: 'Voice',
            ext: 'mp3',
          },
        ],
      };

      const features = deriveFeatures(card);

      expect(features.hasGallery).toBe(true);
    });

    it('detects embedded images in V3 group_only_greetings', () => {
      const card: CCv3DataInner = {
        name: 'Test',
        description: 'Test',
        personality: 'Test',
        scenario: 'Test',
        first_mes: 'Hi',
        mes_example: '',
        creator: '',
        character_version: '',
        tags: [],
        group_only_greetings: [
          'A greeting with data:image/png;base64,xyz123',
          'Another greeting',
        ],
      };

      const features = deriveFeatures(card);

      expect(features.hasEmbeddedImages).toBe(true);
      expect(features.embeddedImagesCount).toBe(1);
    });

    it('detects Voxta appearance in V3', () => {
      const card: CCv3DataInner = {
        name: 'Test',
        description: 'Test',
        personality: 'Test',
        scenario: 'Test',
        first_mes: 'Hi',
        mes_example: '',
        creator: '',
        character_version: '',
        tags: [],
        group_only_greetings: [],
        extensions: {
          voxta: {
            appearance: {
              height: 175,
              weight: 70,
            },
          },
        },
      };

      const features = deriveFeatures(card);

      expect(features.hasVoxtaAppearance).toBe(true);
    });

    it('handles V3 with no assets', () => {
      const card: CCv3DataInner = {
        name: 'Test',
        description: 'Test',
        personality: 'Test',
        scenario: 'Test',
        first_mes: 'Hi',
        mes_example: '',
        creator: '',
        character_version: '',
        tags: [],
        group_only_greetings: [],
        assets: [],
      };

      const features = deriveFeatures(card);

      expect(features.hasGallery).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('handles null personality and mes_example', () => {
      const card: CCv2Data = {
        name: 'Test',
        description: 'Test',
        personality: null,
        scenario: 'Test',
        first_mes: 'Hi',
        mes_example: null,
      };

      const features = deriveFeatures(card);

      expect(features.hasEmbeddedImages).toBe(false);
      expect(features.embeddedImagesCount).toBe(0);
    });

    it('handles undefined alternate_greetings', () => {
      const card: CCv2Data = {
        name: 'Test',
        description: 'Test',
        personality: 'Test',
        scenario: 'Test',
        first_mes: 'Hi',
        mes_example: '',
        alternate_greetings: undefined,
      };

      const features = deriveFeatures(card);

      expect(features.hasAlternateGreetings).toBe(false);
      expect(features.alternateGreetingsCount).toBe(0);
    });

    it('handles null character_book', () => {
      const card: CCv2Data = {
        name: 'Test',
        description: 'Test',
        personality: 'Test',
        scenario: 'Test',
        first_mes: 'Hi',
        mes_example: '',
        character_book: null,
      };

      const features = deriveFeatures(card);

      expect(features.hasLorebook).toBe(false);
      expect(features.lorebookEntriesCount).toBe(0);
    });

    it('detects multiple embedded images across fields', () => {
      const card: CCv2Data = {
        name: 'Test',
        description: 'Image 1: data:image/png;base64,abc',
        personality: 'Personality',
        scenario: 'Image 2: data:image/jpeg;base64,xyz',
        first_mes: 'Image 3: data:image/webp;base64,123',
        mes_example: 'Example',
        system_prompt: 'Image 4: data:image/gif;base64,456',
        alternate_greetings: ['Image 5: data:image/png;base64,789'],
      };

      const features = deriveFeatures(card);

      expect(features.hasEmbeddedImages).toBe(true);
      expect(features.embeddedImagesCount).toBe(5);
    });

    it('initializes token counts to zero', () => {
      const card: CCv2Data = {
        name: 'Test',
        description: 'Test',
        personality: 'Test',
        scenario: 'Test',
        first_mes: 'Hi',
        mes_example: '',
      };

      const features = deriveFeatures(card);

      expect(features.tokens.description).toBe(0);
      expect(features.tokens.personality).toBe(0);
      expect(features.tokens.scenario).toBe(0);
      expect(features.tokens.firstMes).toBe(0);
      expect(features.tokens.mesExample).toBe(0);
      expect(features.tokens.systemPrompt).toBe(0);
      expect(features.tokens.total).toBe(0);
    });

    it('handles missing extensions gracefully', () => {
      const card: CCv2Data = {
        name: 'Test',
        description: 'Test',
        personality: 'Test',
        scenario: 'Test',
        first_mes: 'Hi',
        mes_example: '',
        extensions: undefined,
      };

      const features = deriveFeatures(card);

      expect(features.hasRisuExtensions).toBe(false);
      expect(features.hasRisuScripts).toBe(false);
      expect(features.hasDepthPrompt).toBe(false);
      expect(features.hasVoxtaAppearance).toBe(false);
    });
  });
});
