# Voxta .voxpkg File Structure Report

## Overview
`.voxpkg` files are ZIP archives containing Voxta assets. There are **three main package types** distinguished by the presence of `package.json` and folder structure.

---

## Analyzed Files Summary (15 Total)

| File Name | Type | package.json | Characters | Scenarios | Books |
|-----------|------|--------------|------------|-----------|-------|
| 2B.1.0.0 | Character | No | 1 | 0 | 0 |
| Agent Nyx.1.0.0 | Character | No | 1 | 0 | 0 |
| Ani.1.0.0 | Character | No | 1 | 0 | 0 |
| Scarlett Virelaine.1.0.1 | Character | No | 1 | 0 | 0 |
| Velzara Thorne.1.0.0 | Character | No | 1 | 0 | 0 |
| Vexa.1.0.0 | Character | No | 1 | 0 | 0 |
| Zaria Velour.1.0.0 | Character | No | 1 | 0 | 0 |
| Princess Elaria Scenario.1.0.0 | Scenario | No | 1 | 1 | 0 |
| Arcane Alley University.1.4.0 | Package | Yes | 15 | 1 | 2 |
| Guess the word | Package | Yes | 1 | 1 | 0 |
| Katsumi Test Name.1.0.0 | Package | Yes | 1 | 1 | 1 |
| Russian roulette.1.0.7 | Package | Yes | 2 | 1 | 0 |
| The Shop of Suspicious Brews | Package | Yes | 4 | 1 | 0 |
| Tinas Free Nsfw.1.0.0 | Package | Yes | 1 | 1 | 0 |
| Voxta UI 11.2.1.3 | Package | Yes | 8 | 15 | 0 |

---

## Type Identification Algorithm

```
1. Extract ZIP to temp location
2. IF exists(package.json) at root:
   - Type = "package"
   - Read package.json for metadata
3. ELSE IF exists(Characters/) AND NOT exists(Scenarios/):
   - Type = "character"
   - Single character export
4. ELSE IF exists(Scenarios/) AND exists(Characters/):
   - Type = "scenario"
   - Scenario with bundled character(s)
```

### JSON `$type` Field Values:
| Value | Type | Found In |
|-------|------|----------|
| `"$type": "package"` | Package | `package.json` |
| `"$type": "character"` | Character | `Characters/{uuid}/character.json` |
| `"$type": "scenario"` | Scenario | `Scenarios/{uuid}/scenario.json` |
| `"$type": "book"` | Lorebook/Memory Book | `Books/{uuid}/book.json` |

---

## Package Type Structures

### 1. Character Package (Single Character)
No `package.json` in root. Only `Characters/` folder.

```
/Characters/
    {uuid}/
        character.json      ← Contains $type: "character"
        thumbnail.png       ← Character portrait (PNG or WebP)
        Assets/             ← Optional
            Avatars/
                Default/
                    {Emotion}_{State}.png/webm/mp4
            VoiceSamples/
                *.wav
```

**Examples:** 2B, Agent Nyx, Ani, Scarlett Virelaine, Velzara Thorne, Vexa, Zaria Velour

---

### 2. Scenario Package (Scenario + Characters)
No `package.json` in root. Has both `Characters/` and `Scenarios/` folders.

```
/Characters/
    {uuid}/
        character.json
        thumbnail.png
        Assets/ (optional)
/Scenarios/
    {uuid}/
        scenario.json       ← Contains $type: "scenario"
        thumbnail.png
        Assets/ (optional)
            Audio/
                *.mp3, *.wav
```

**Example:** Princess Elaria Scenario

---

### 3. Package (Multi-Asset Bundle)
Has `package.json` in root.

```
package.json                ← Contains $type: "package"
/Characters/
    {uuid}/
        character.json
        thumbnail.png
        Assets/
/Scenarios/
    {uuid}/
        scenario.json
        thumbnail.png
        Assets/
/Books/                     ← Optional
    {uuid}/
        book.json           ← Contains $type: "book"
```

**Examples:** Arcane Alley University, Guess the word, Katsumi Test Name, Russian roulette, The Shop of Suspicious Brews, Tinas Free Nsfw, Voxta UI

---

## JSON Schema Details

### package.json (Root Metadata)

```json
{
  "$type": "package",
  "Id": "uuid",
  "Name": "Package Name",
  "Version": "1.0.0",
  "Description": "optional description",
  "Creator": "author name",
  "ExplicitContent": true,
  "EntryResource": { "Kind": 3, "Id": "scenario-uuid" },
  "ThumbnailResource": { "Kind": 3, "Id": "scenario-uuid" },
  "Thumbnail": { "RandomizedETag": "...", "ContentType": "image/png" },
  "DateCreated": "2024-09-10T18:00:12.837+00:00",
  "DateModified": "2024-09-10T18:04:13.703+00:00",
  "UserId": "uuid",
  "AppControlled": false,
  "Locked": false
}
```

**Field Variations Observed:**
- `Description` - optional, not always present
- `Thumbnail` - optional, some use `ThumbnailResource` pointing to a scenario instead
- `UserId` - optional, user ownership ID
- `AppControlled` / `Locked` - optional boolean flags

**EntryResource.Kind Values:**
- `3` = Scenario reference

---

### character.json

```json
{
  "$type": "character",
  "Id": "uuid",
  "Name": "Character Name",
  "Version": "1.0.0",
  "PackageId": "parent-package-uuid",
  "Culture": "en-US",

  "Description": "physical appearance description",
  "Personality": "trait1 + trait2 + trait3",
  "Profile": "detailed backstory and character information",
  "Scenario": "default scenario context when used standalone",
  "FirstMessage": "greeting/opening message",
  "MessageExamples": "example dialogue exchanges",
  "SystemPrompt": "optional custom system prompt override",
  "CreatorNotes": "notes for other creators",
  "Creator": "author name",
  "Tags": ["female", "fantasy", "anime", ...],

  "ExplicitContent": true,
  "ChatStyle": 0,
  "EnableThinkingSpeech": false,
  "NotifyUserAwayReturn": true,
  "TimeAware": false,
  "UseMemory": false,
  "MaxTokens": 0,
  "MaxSentences": 0,
  "SystemPromptOverrideType": 0,

  "TextToSpeech": [{
    "Voice": {
      "parameters": {
        "VoiceBackend": "elevenlabs",
        "VoiceId": "voice-id-string"
      },
      "label": "ElevenLabs: Voice Name ($$$, High Quality)"
    },
    "Service": {
      "ServiceName": "VoxtaCloud",
      "ServiceId": "uuid"
    }
  }],

  "MemoryBooks": ["book-uuid-1", "book-uuid-2"],
  "DefaultScenarios": [{
    "ClientId": "Voxta.Talk",
    "ScenarioId": "uuid"
  }],
  "Scripts": [],
  "Augmentations": [],

  "AppConfiguration": {
    "Voxta.Talk": {
      "view": "stage",
      "avatar": "",
      "background": "urn:voxta:resources:characters:{uuid}:assets:Background.png",
      "bgm": ""
    }
  },

  "Thumbnail": {
    "RandomizedETag": "base64-string",
    "ContentType": "image/png"
  },
  "DateCreated": "0001-01-01T00:00:00+00:00",
  "DateModified": "2025-10-19T06:59:21.1150191+00:00"
}
```

**Field Variations Observed:**
- `PackageId` - only present when character is part of a package
- `SystemPrompt` - optional custom system prompt
- `AppConfiguration` - optional client-specific settings (backgrounds, views)
- `Creator` - sometimes at character level, sometimes only at package level
- `DateCreated` may be `0001-01-01T00:00:00+00:00` for imported characters

**ChatStyle Values:**
- `0` = Default
- `1` = Roleplay
- `2` = Chat
- `3` = Story
- `4` = Custom

**TextToSpeech Backend Options:**
- `elevenlabs` - ElevenLabs voices
- `cartesia` - Cartesia voices
- Orpheus with `FinetuneVoice` parameter
- Kokoro with `Name` and `Speed` parameters
- Generic with `Gender` parameter ("Female", "Male")

---

### scenario.json

```json
{
  "$type": "scenario",
  "Id": "uuid",
  "Name": "Scenario Name",
  "Version": "1.0.0",
  "PackageId": "parent-package-uuid",
  "ParentId": "parent-scenario-uuid",
  "Client": "Voxta.Talk",
  "Creator": "author name",
  "Description": "scenario description",
  "ExplicitContent": true,

  "Template": "scenario context with {{ user }} and {{ scenario_chars.main }} placeholders",
  "Messages": "initial message exchange template",
  "ChatFlow": 0,
  "ChatStyle": 1,
  "SystemPromptOverrideType": 0,

  "Roles": [{
    "Name": "main",
    "Description": "The main character",
    "DefaultCharacterId": "uuid",
    "EnabledOnStart": true
  }, {
    "Name": "role2",
    "DefaultCharacterId": "uuid",
    "EnabledOnStart": false
  }],

  "NarratorCharacterId": "uuid",

  "SharedScripts": [{
    "Name": "index",
    "Content": "import { chat } from \"@voxta\";\n\nchat.addEventListener(\"start\", (e) => {\n  // initialization code\n});"
  }],

  "Actions": [{
    "Id": "uuid",
    "Name": "action_name",
    "Description": "when {{ char }} does something",
    "Timing": 2,
    "Layer": "emotes",
    "Arguments": [],
    "Disabled": false,
    "FinalLayer": false,
    "Once": false,
    "FlagsFilter": "flag_condition",
    "CancelReply": false,
    "Effect": {
      "SetFlags": ["flag1", "!remove_flag"],
      "Script": "import { chat } from \"@voxta\";\nexport function trigger(e) { ... }",
      "Story": "narrative text",
      "Event": "event description",
      "MaxSentences": 6,
      "MaxTokens": 150
    }
  }],

  "Events": [{
    "Id": "uuid",
    "Name": "event_name",
    "Description": "Button Label",
    "Timing": 4,
    "Arguments": [],
    "Disabled": false,
    "FinalLayer": false,
    "Once": false,
    "EvaluateNextEvent": false,
    "FlagsFilter": "condition && turn.user",
    "Effect": {
      "SetFlags": ["new_flag"],
      "Script": "javascript code",
      "MaxSentences": 0,
      "MaxTokens": 0
    }
  }],

  "Contexts": [{
    "Name": "context_name",
    "Text": "Contextual information injected when flags match",
    "FlagsFilter": "flag_condition",
    "Disabled": false
  }],

  "MemoryBooks": [],

  "AppConfiguration": {
    "Voxta.Talk": {
      "background": "path/to/background"
    }
  },

  "Thumbnail": {
    "ETag": 1,
    "ContentType": "image/png"
  },
  "DateCreated": "2024-10-31T05:44:59.144+00:00",
  "DateModified": "2024-11-11T11:02:35.267+00:00",
  "UserId": "uuid",
  "AppControlled": false,
  "Locked": false
}
```

**Timing Values (Actions/Events):**
- `0` = Immediate/Auto
- `2` = After speech/When condition met
- `4` = User button/Manual trigger

**Flag Syntax:**
- `flagname` - flag must be set
- `!flagname` - flag must NOT be set (in SetFlags: removes flag)
- `flag1 && flag2` - AND condition
- `flag1 || flag2` - OR condition

**Template Placeholders:**
- `{{ user }}` - User name
- `{{ char }}` - Current character name
- `{{ scenario_chars.main }}` - Main role character
- `{{ scenario_chars.role2 }}` - Named role character
- `{{ variables.varname }}` - Script variables

---

### book.json (Lorebook/Memory Book)

```json
{
  "$type": "book",
  "Id": "uuid",
  "Name": "Book Name",
  "Version": "1.0.0",
  "PackageId": "parent-package-uuid",
  "Description": "book description",
  "Creator": "author name",
  "ExplicitContent": false,

  "Items": [{
    "Id": "uuid",
    "Keywords": ["keyword1", "keyword2", "phrase"],
    "Text": "Lore content that gets injected when keywords are matched",
    "Weight": 10,
    "CreatedAt": "2025-07-04T06:50:09.824+00:00",
    "LastUpdated": "2025-07-27T23:28:58.139+00:00",
    "Deleted": false,
    "DeletedAt": "timestamp"
  }],

  "DateCreated": "2025-07-04T06:49:01.656+00:00",
  "DateModified": "2025-07-28T19:52:23.565+00:00"
}
```

**Item Fields:**
- `Keywords` - Array of trigger words/phrases
- `Text` - Content injected into context when triggered
- `Weight` - Priority weight (higher = more important)
- `Deleted` / `DeletedAt` - Soft delete mechanism

---

## Asset Types and Locations

| Asset Type | Location | File Types | Notes |
|-----------|----------|------------|-------|
| Character Thumbnails | `Characters/{uuid}/thumbnail.png` | PNG, WebP | Required |
| Scenario Thumbnails | `Scenarios/{uuid}/thumbnail.png` | PNG | Optional |
| Character Avatars | `Characters/{uuid}/Assets/Avatars/` | PNG, WebP, WebM, MP4, AVIF | Organized by state |
| Voice Samples | `Characters/{uuid}/Assets/VoiceSamples/` | WAV | For voice cloning |
| Scenario Audio | `Scenarios/{uuid}/Assets/Audio/` | MP3, WAV | Background music, SFX |
| Character Backgrounds | `Characters/{uuid}/Assets/` | PNG | Referenced via AppConfiguration |
| VRM Models | `Characters/{uuid}/Assets/` | VRM | 3D avatar models |
| FBX Animations | `Characters/{uuid}/Assets/` | FBX | Animation files |

### Avatar Naming Convention
```
{Emotion}_{State}[_{Variant}][_suffix].{ext}

Examples:
- Neutral_Idle.png
- Happy_Talking.webm
- Angry_Idle_2.png
- Smile_Talking_long.mp4
```

**States:** Idle, Talking, Thinking
**Emotions:** Neutral, Happy, Sad, Angry, Surprised, Fear, Love, Crying, Laughing, etc.
**Suffixes:** `_long` (extended animation), `_Fixed` (no switching while talking)

---

## Script API Overview

Scenarios can contain JavaScript code using the Voxta API:

```javascript
import { chat } from "@voxta";

// Event handlers
chat.addEventListener("start", (e) => { });
chat.addEventListener("speechComplete", (e) => { });
chat.on("init", (e) => { });
chat.on("generating", (e) => { });
chat.on("speechStart", (e) => { });

// Actions
chat.setFlag("flagname");
chat.setFlags("flag1", "flag2");
chat.setFlag("flagname", { messages: 5 }); // Expires after 5 messages

// Messages
chat.instructions("System instruction text");
chat.secret("Hidden message for AI only");
chat.userMessage("User message injection");
chat.customMessage({ role: 'Event', text: '...', useStoryWriter: true });
chat.Event("Event narration text");

// App triggers
chat.appTrigger('PlayScenarioAudio', 'path/to/audio.mp3', 'music');
chat.appTrigger('SetBackground', 'path/to/bg.png');
chat.appTrigger('SetAvatar', avatarPath, characterId);
chat.appTrigger('SelectView', 'portrait');
chat.appTrigger('Emote', emoji, color);

// Role management
chat.setRoleEnabled("role_name", true/false);

// Variables
chat.variables.customVar = "value";
```

---

## Key Identifiers Summary

| Field | Purpose | Found In |
|-------|---------|----------|
| `$type` | Asset type identifier | All JSON files |
| `Id` | Unique UUID of the asset | All JSON files |
| `PackageId` | Parent package reference | Characters/Scenarios/Books in packages |
| `ParentId` | Inheritance from another scenario | Scenarios |
| `EntryResource` | Main entry point scenario | package.json |
| `ThumbnailResource` | Package thumbnail source | package.json |
| `DefaultCharacterId` | Character linked to scenario role | Scenario roles |
| `NarratorCharacterId` | Narrator character for events | Scenarios |
| `MemoryBooks` | Array of book UUIDs | Characters/Scenarios |

---

## Version Format
Standard semver: `Major.Minor.Patch` (e.g., "1.4.0", "11.2.1.3")

---

## Detection Code Example

```python
import zipfile
import json
import os

def detect_voxpkg_type(filepath):
    with zipfile.ZipFile(filepath, 'r') as z:
        names = z.namelist()

        # Check for package.json
        if 'package.json' in names:
            with z.open('package.json') as f:
                pkg = json.load(f)
                return {
                    'type': 'package',
                    'name': pkg.get('Name'),
                    'version': pkg.get('Version'),
                    'creator': pkg.get('Creator'),
                    'explicit': pkg.get('ExplicitContent'),
                    'entry_scenario': pkg.get('EntryResource', {}).get('Id')
                }

        # Count folders
        has_characters = any(n.startswith('Characters/') for n in names)
        has_scenarios = any(n.startswith('Scenarios/') for n in names)
        has_books = any(n.startswith('Books/') for n in names)

        if has_scenarios:
            return {'type': 'scenario'}
        elif has_characters:
            return {'type': 'character'}

        return {'type': 'unknown'}
```
