# CHARX vs VOXPKG Format Comparison

This document provides a detailed bidirectional comparison between the CHARX (Character Card V3 Archive) and VOXPKG (Voxta Package) formats to facilitate interoperability between the formats.

---

## Executive Summary

| Aspect | CHARX | VOXPKG |
|--------|-------|--------|
| **Purpose** | Single character card with assets | Multi-resource package (characters, scenarios, lorebooks) |
| **Container** | ZIP | ZIP |
| **Required Files** | `card.json` at root | Varies by content type |
| **Multi-Character** | No (single character) | Yes (multiple characters per package) |
| **Scenarios** | No | Yes |
| **Scripting** | No (uses lorebook decorators) | Yes (JavaScript/TypeScript) |
| **TTS Config** | No | Yes |
| **Complexity** | Low-Medium | High |

---

## Directory Structure Comparison

### CHARX Structure
```
character.charx/
├── card.json                    # REQUIRED: Character Card V3 JSON
├── assets/
│   ├── icon/
│   │   └── images/
│   │       └── *.png|*.webp     # Character portraits/icons
│   ├── background/
│   │   └── images/
│   │       └── *.png|*.webp     # Background images
│   ├── emotion/
│   │   └── images/
│   │       └── *.png|*.webp     # Emotion sprites
│   ├── user_icon/
│   │   └── images/
│   │       └── *.png|*.webp     # User avatar suggestions
│   └── other/
│       └── {type}/
│           └── *.*              # Other assets (audio, video, etc.)
├── x_meta/                      # (RisuAI-specific) Asset metadata
│   └── {n}.json
└── module.risum                 # (RisuAI-specific) Module data
```

### VOXPKG Structure
```
PackageName.Version.voxpkg/
├── package.json                 # OPTIONAL: Package metadata (multi-resource only)
├── Characters/
│   └── {uuid}/
│       ├── character.json       # Character definition
│       ├── thumbnail.png        # Character thumbnail
│       └── Assets/
│           └── Avatars/
│               └── Default/
│                   └── {Emotion}_{State}_{Variant}.webp
├── Scenarios/
│   └── {uuid}/
│       └── scenario.json        # Scenario definition
└── Books/
    └── {uuid}/
        └── book.json            # Lorebook definition
```

---

## JSON Schema Mapping: CHARX → Voxta Character

### Direct Field Mappings

| CHARX `card.json` Path | Voxta `character.json` Path | Notes |
|------------------------|----------------------------|-------|
| `data.name` | `Name` | Direct |
| `data.description` | `Description` | Direct |
| `data.personality` | `Personality` | Direct |
| `data.scenario` | `Scenario` | Direct |
| `data.first_mes` | `FirstMessage` | Direct |
| `data.mes_example` | `MessageExamples` | Direct |
| `data.creator_notes` | `CreatorNotes` | Direct |
| `data.creator` | (use for display) | Voxta has `Creator` in package.json |
| `data.tags[]` | `Tags[]` | Direct |
| `data.character_version` | `Version` | Direct |
| `data.creation_date` | `DateCreated` | Unix timestamp → ISO 8601 |
| `data.modification_date` | `DateModified` | Unix timestamp → ISO 8601 |

### Fields Requiring Transformation

| CHARX Field | Transformation | Voxta Target |
|-------------|---------------|--------------|
| `data.character_book` | Transform to Voxta Book format | `Books/` |
| `data.assets[]` | Parse URIs, reorganize files | `Characters/{id}/Assets/` |

### CHARX-Only Fields (No Voxta Equivalent)

| Field | Description | Suggested Handling |
|-------|-------------|-------------------|
| `data.nickname` | Alternative name for {{char}} | Store in extensions or prepend to name |
| `data.group_only_greetings[]` | Greetings for group chats | Discard or create separate scenario |
| `data.creator_notes_multilingual` | Localized creator notes | Use primary language only |
| `data.source[]` | Provenance tracking | Store in extensions |
| `data.extensions.risuai.*` | RisuAI-specific features | Discard |
| `data.extensions.depth_prompt` | Depth-based prompt injection | Handle via Voxta contexts |

### Voxta-Only Fields (Must Default)

| Field | Type | Suggested Default | Description |
|-------|------|-------------------|-------------|
| `$type` | string | `"character"` | Resource type identifier |
| `Id` | UUID | Generate new UUID | Unique identifier |
| `Label` | string | (optional) | Display label, can differ from Name |
| `PackageId` | UUID | (optional) | Parent package reference |
| `Culture` | string | `"en-US"` | Locale code |
| `ChatStyle` | int | `0` | Chat style mode (0-3+) |
| `ExplicitContent` | bool | `false` | NSFW flag (parse from tags) |
| `EnableThinkingSpeech` | bool | `false` | Enable thinking verbalization |
| `NotifyUserAwayReturn` | bool | `false` | Notify when user returns |
| `TimeAware` | bool | `false` | Enable time awareness |
| `UseMemory` | bool | `false` | Enable memory system |
| `MaxTokens` | int | `0` | Token limit (0=unlimited) |
| `MaxSentences` | int | `0` | Sentence limit (0=unlimited) |
| `SystemPromptOverrideType` | int | `0` | System prompt override mode |
| `TextToSpeech` | array | `[]` | TTS voice configurations |
| `Scripts` | array | `[]` | JavaScript/TypeScript scripts |
| `Augmentations` | array | `[]` | Feature augmentations (see below) |
| `MemoryBooks` | array | `[]` | Referenced lorebook UUIDs |
| `DefaultScenarios` | array | `[]` | Default scenario UUIDs |
| `UserNameOverride` | string | (optional) | Override user's display name |
| `UserDescriptionOverride` | string | (optional) | Override user's description |
| `Instructions` | string | (optional) | User-provided instructions |
| `Context` | string | (optional) | Additional context |
| `ImportedFrom` | string | (optional) | Import source tracking |
| `Profile` | string | `""` | Extended character profile |
| `SystemPrompt` | string | `""` | System prompt (maps from CHARX) |
| `PostHistoryInstructions` | string | `""` | Post-history instructions (maps from CHARX) |
| `Creator` | string | `""` | Creator name |

### Voxta Augmentations

The `Augmentations` array enables special character features:

| Augmentation | Description |
|--------------|-------------|
| `"bing"` | Web search capability |
| `"vision"` | Image recognition |
| `"vision.prompted"` | Prompted image analysis |
| `"windows_sdk"` | Windows SDK integration |
| `"continuations_idle_followup"` | Idle follow-up messages |
| `"think_pass_before_reply"` | Thinking phase before responding |
| `"mcp"` | Model Context Protocol |
| `"folderwatcher"` | File system monitoring |

### Voxta ChatStyle Values

| Value | Style |
|-------|-------|
| `0` | Default |
| `1` | Unknown |
| `2` | Unknown |
| `3` | Extended/Detailed |

---

## Lorebook/Character Book Mapping

### Structure Comparison

**CHARX Lorebook Entry:**
```json
{
  "keys": ["keyword1", "keyword2"],
  "content": "Entry content with @@decorators",
  "enabled": true,
  "insertion_order": 100,
  "constant": false,
  "selective": false,
  "secondary_keys": [],
  "name": "Entry Name",
  "comment": "Internal note",
  "case_sensitive": false,
  "use_regex": false,
  "priority": 10,
  "position": "before_char"
}
```

**Voxta Book Item:**
```json
{
  "Id": "uuid",
  "Keywords": ["keyword1", "keyword2"],
  "Text": "Entry content",
  "Weight": 100,
  "Deleted": false,
  "CreatedAt": "ISO8601",
  "LastUpdated": "ISO8601"
}
```

### Field Mapping

| CHARX Entry | Voxta Item | Notes |
|-------------|-----------|-------|
| `keys[]` | `Keywords[]` | Direct |
| `content` | `Text` | **Strip decorators first** |
| `insertion_order` | `Weight` | May need inversion (lower order = higher priority in CHARX) |
| `enabled` | `Deleted` | Invert: `!enabled` = `Deleted` |
| `name` | (not stored) | Discard or prepend to Text |

### Decorator Handling

CHARX lorebook entries use decorators (e.g., `@@depth 3`, `@@role assistant`) that modify behavior. Voxta doesn't support these directly.

**Recommended approach:**
1. Strip all decorators from content
2. Log which entries had decorators for manual review
3. Consider these mappings for advanced scenarios:

| Decorator | Potential Voxta Handling |
|-----------|-------------------------|
| `@@depth N` | Use Voxta `Contexts[].ApplyTo` |
| `@@role assistant/user/system` | Map to `Contexts[].ApplyTo` |
| `@@constant` | Set Weight very high |
| `@@position before_char/after_char` | Handle via insertion order |

---

## Asset Mapping

### CHARX Asset Entry
```json
{
  "type": "icon|background|emotion|user_icon|x_*",
  "uri": "embeded://path/to/asset.png",
  "name": "main|happy|sad|...",
  "ext": "png|webp|jpg"
}
```

### Voxta Avatar Convention
```
{Emotion}_{State}_{Variant}.webp

Emotions: Neutral, Smile, Laugh, Love, Horny, Angry, Unhappy, Cry, Fear, Question, Surprise
States: Idle, Talking, Thinking
Variants: 01, 02, 03...
```

### Asset Type Mapping

| CHARX Type | CHARX Name | Voxta Equivalent |
|------------|------------|------------------|
| `icon` | `main` | `thumbnail.png` |
| `icon` | other | Additional portrait (not standard) |
| `emotion` | `neutral` | `Neutral_Idle_01.webp` |
| `emotion` | `happy` | `Smile_Idle_01.webp` |
| `emotion` | `sad` | `Unhappy_Idle_01.webp` |
| `emotion` | `angry` | `Angry_Idle_01.webp` |
| `emotion` | `surprised` | `Surprise_Idle_01.webp` |
| `emotion` | `crying` | `Cry_Idle_01.webp` |
| `emotion` | `fearful` | `Fear_Idle_01.webp` |
| `emotion` | `love` | `Love_Idle_01.webp` |
| `emotion` | `laughing` | `Laugh_Idle_01.webp` |
| `background` | * | (No direct equivalent) |
| `user_icon` | * | (No direct equivalent) |

### Import Strategy

1. **Icon → Thumbnail**: Copy main icon to `thumbnail.png`
2. **Emotions → Avatars**:
   - Map emotion names to Voxta emotion names
   - Generate all three states (Idle, Talking, Thinking) from single emotion image, or use same image for all
   - Use `01` as variant
3. **Backgrounds**: Store in package or discard
4. **User Icons**: Discard (Voxta doesn't use per-character user icons)

---

## JSON Schema Mapping: Voxta → CHARX

### Direct Field Mappings

| Voxta `character.json` Path | CHARX `card.json` Path | Notes |
|----------------------------|------------------------|-------|
| `Name` | `data.name` | Direct |
| `Description` | `data.description` | Direct |
| `Personality` | `data.personality` | Direct |
| `Scenario` | `data.scenario` | Direct |
| `FirstMessage` | `data.first_mes` | Direct |
| `MessageExamples` | `data.mes_example` | Direct |
| `CreatorNotes` | `data.creator_notes` | Direct |
| `Creator` | `data.creator` | Direct |
| `Tags[]` | `data.tags[]` | Direct |
| `Version` | `data.character_version` | Direct |
| `SystemPrompt` | `data.system_prompt` | Direct |
| `PostHistoryInstructions` | `data.post_history_instructions` | Direct |
| `DateCreated` | `data.creation_date` | ISO 8601 → Unix timestamp |
| `DateModified` | `data.modification_date` | ISO 8601 → Unix timestamp |

### Fields Requiring Transformation

| Voxta Field | Transformation | CHARX Target |
|-------------|---------------|--------------|
| `Profile` | Merge with description or store in extensions | `data.description` or `data.extensions` |
| `Label` | **Not equivalent to nickname** - see note below | Store in `data.extensions.voxta.label` |
| `MemoryBooks[]` | Export referenced books, convert to lorebook | `data.character_book` |
| Avatar files | Convert to asset entries | `data.assets[]` |
| `thumbnail.png` | Convert to main icon asset | `data.assets[]` with type="icon", name="main" |

> **Note on `Label` vs `nickname`:**
>
> These fields serve different purposes and are **not interchangeable**:
>
> | Field | Format | Purpose | Example |
> |-------|--------|---------|---------|
> | `Label` | Voxta | Sorting/display name in UI (e.g., version suffix) | `"Purrsephone Alpha 0.8"` |
> | `nickname` | CHARX | Alternative name used in chat via `{{char}}` macro | `"Purrs"` |
>
> - **Voxta `Label`**: Used for organizing/sorting cards in the UI. The character's `Name` is still used in conversations.
> - **CHARX `nickname`**: Actually substitutes for `{{char}}` in prompts and messages during roleplay.
>
> When converting, preserve both separately in extensions rather than mapping one to the other.

### Voxta-Only Fields (No CHARX Equivalent)

| Field | Description | Suggested Handling |
|-------|-------------|-------------------|
| `TextToSpeech[]` | TTS voice configuration | Store in `data.extensions.voxta.tts` |
| `Scripts[]` | JavaScript/TypeScript code | Store in `data.extensions.voxta.scripts` |
| `Augmentations[]` | Feature flags | Store in `data.extensions.voxta.augmentations` |
| `ChatStyle` | Chat style mode | Store in `data.extensions.voxta.chat_style` |
| `EnableThinkingSpeech` | Thinking speech toggle | Store in `data.extensions.voxta` |
| `NotifyUserAwayReturn` | Away notification | Store in `data.extensions.voxta` |
| `TimeAware` | Time awareness | Store in `data.extensions.voxta` |
| `UseMemory` | Memory system | Store in `data.extensions.voxta` |
| `MaxTokens` / `MaxSentences` | Response limits | Store in `data.extensions.voxta` |
| `UserNameOverride` | User name override | Store in `data.extensions.voxta` |
| `UserDescriptionOverride` | User description override | Store in `data.extensions.voxta` |
| `Instructions` | User instructions | Store in `data.extensions.voxta` |
| `Context` | Additional context | Store in `data.extensions.voxta` |
| `Culture` | Locale code | Store in `data.extensions.voxta` |
| `ImportedFrom` | Import source | Append to `data.source[]` |

### CHARX-Only Fields (Must Generate)

| Field | Type | Suggested Value |
|-------|------|-----------------|
| `spec` | string | `"chara_card_v3"` |
| `spec_version` | string | `"3.0"` |
| `data.alternate_greetings` | array | `[]` (Voxta uses Scenarios instead) |
| `data.group_only_greetings` | array | `[]` |
| `data.nickname` | string | `""` (Voxta `Label` is NOT equivalent - different purpose) |
| `data.source` | array | `["voxta:{Id}"]` or `[ImportedFrom]` |
| `data.extensions` | object | Store Voxta-specific data here (including `Label`) |

### Asset Mapping: Voxta → CHARX

| Voxta Asset | CHARX Asset |
|-------------|-------------|
| `thumbnail.png` | `{"type": "icon", "uri": "embeded://assets/icon/images/main.png", "name": "main", "ext": "png"}` |
| `{Emotion}_Idle_01.webp` | `{"type": "emotion", "uri": "embeded://assets/emotion/images/{emotion}.webp", "name": "{emotion}", "ext": "webp"}` |

> **Note on Voxta Asset Storage:**
>
> Voxta's `Assets/` folder structure is **flexible and script-driven** - there's no strict metadata file like CHARX's `assets[]` array. The `Default/` subfolder is conventionally used for the default avatar set, but asset organization can be customized via scripts.
>
> **For conversion purposes:** When converting between formats, use the CHARX directory structure convention (`assets/{type}/images/`) as the canonical organization, since it has explicit metadata tracking via the `assets[]` array in `card.json`.

**Emotion Name Mapping (Voxta → CHARX):**

| Voxta Emotion | CHARX Name |
|---------------|------------|
| `Neutral` | `neutral` |
| `Smile` | `happy` or `smile` |
| `Laugh` | `laughing` |
| `Love` | `love` |
| `Horny` | `horny` or `aroused` |
| `Angry` | `angry` |
| `Unhappy` | `sad` |
| `Cry` | `crying` |
| `Fear` | `fearful` |
| `Question` | `confused` or `questioning` |
| `Surprise` | `surprised` |

---

## Bidirectional Feature Comparison

### Features Unique to Each Format

| Feature | CHARX | Voxta | Notes |
|---------|-------|-------|-------|
| **Alternate Greetings** | `alternate_greetings[]` | - | Voxta uses Scenarios instead |
| **Group Greetings** | `group_only_greetings[]` | - | No equivalent |
| **Secondary Name** | `nickname` (used in chat as `{{char}}`) | `Label` (sorting/display only) | Different purposes - not equivalent |
| **Multilingual Notes** | `creator_notes_multilingual` | - | No equivalent |
| **Background Images** | `assets[type=background]` | - | No equivalent |
| **User Icons** | `assets[type=user_icon]` | - | No equivalent |
| **Lorebook Decorators** | `@@decorator` syntax | - | Voxta uses Contexts |
| **TTS Configuration** | - | `TextToSpeech[]` | No CHARX equivalent |
| **Scripting** | - | `Scripts[]` | No CHARX equivalent |
| **Augmentations** | - | `Augmentations[]` | Feature flags |
| **Multi-Character** | - | Multiple in package | CHARX is single-character |
| **Scenarios** | - | `Scenarios/` | CHARX uses lorebook/greetings |
| **User Overrides** | - | `UserNameOverride`, etc. | No CHARX equivalent |
| **Time/Memory Awareness** | - | `TimeAware`, `UseMemory` | No CHARX equivalent |
| **Response Limits** | - | `MaxTokens`, `MaxSentences` | No CHARX equivalent |

### Round-Trip Considerations

For lossless round-trip conversion, store format-specific data in extensions:

**CHARX → Voxta → CHARX:**
- Store `alternate_greetings` in Voxta extensions
- Store `nickname` in Voxta `Label` field
- Store `group_only_greetings` in extensions

**Voxta → CHARX → Voxta:**
- Store Voxta config in `data.extensions.voxta`
- Preserve `Scripts`, `Augmentations`, `TextToSpeech` in extensions
- Store `Culture`, `ChatStyle`, feature flags in extensions

---

## Conversion Algorithms

### Pseudocode: CHARX → VOXPKG

```python
def convert_charx_to_voxpkg(charx_path: str) -> bytes:
    # 1. Extract CHARX
    charx_zip = ZipFile(charx_path)
    card = json.load(charx_zip.open('card.json'))
    data = card['data']

    # 2. Generate IDs
    char_id = str(uuid4())
    book_id = str(uuid4()) if data.get('character_book') else None

    # 3. Create Voxta character.json
    character = {
        "$type": "character",
        "Id": char_id,
        "Name": data['name'],
        "Version": data.get('character_version', '1.0.0'),
        "Description": data.get('description', ''),
        "Personality": data.get('personality', ''),
        "Scenario": data.get('scenario', ''),
        "FirstMessage": data.get('first_mes', ''),
        "MessageExamples": data.get('mes_example', ''),
        "CreatorNotes": data.get('creator_notes', ''),
        "Tags": data.get('tags', []),
        "Culture": "en-US",
        "ExplicitContent": 'nsfw' in [t.lower() for t in data.get('tags', [])],
        "ChatStyle": 0,
        "EnableThinkingSpeech": False,
        "NotifyUserAwayReturn": False,
        "TimeAware": False,
        "UseMemory": False,
        "MaxTokens": 0,
        "MaxSentences": 0,
        "SystemPromptOverrideType": 0,
        "TextToSpeech": [],
        "Scripts": [],
        "Augmentations": [],
        "MemoryBooks": [book_id] if book_id else [],
        "DefaultScenarios": [],
        "DateCreated": unix_to_iso(data.get('creation_date', time.time())),
        "DateModified": unix_to_iso(data.get('modification_date', time.time())),
        "Thumbnail": {"RandomizedETag": "", "ContentType": "image/png"}
    }

    # 4. Convert lorebook if present
    book = None
    if data.get('character_book'):
        book = convert_lorebook(data['character_book'], book_id, char_id)

    # 5. Process assets
    assets = process_assets(data.get('assets', []), charx_zip)

    # 6. Build VOXPKG
    voxpkg = BytesIO()
    with ZipFile(voxpkg, 'w') as zf:
        # Character JSON
        zf.writestr(
            f'Characters/{char_id}/character.json',
            json.dumps(character, indent=2)
        )

        # Thumbnail
        if assets.get('thumbnail'):
            zf.writestr(
                f'Characters/{char_id}/thumbnail.png',
                assets['thumbnail']
            )

        # Avatars
        for avatar_path, avatar_data in assets.get('avatars', {}).items():
            zf.writestr(
                f'Characters/{char_id}/Assets/Avatars/Default/{avatar_path}',
                avatar_data
            )

        # Book
        if book:
            zf.writestr(
                f'Books/{book_id}/book.json',
                json.dumps(book, indent=2)
            )

    return voxpkg.getvalue()


def convert_lorebook(charx_book: dict, book_id: str, package_id: str) -> dict:
    items = []
    for entry in charx_book.get('entries', []):
        if not entry.get('enabled', True):
            continue

        # Strip decorators from content
        content = strip_decorators(entry.get('content', ''))

        items.append({
            "Id": str(uuid4()),
            "Keywords": entry.get('keys', []),
            "Text": content,
            "Weight": entry.get('insertion_order', 100),
            "CreatedAt": datetime.utcnow().isoformat() + 'Z',
            "LastUpdated": datetime.utcnow().isoformat() + 'Z'
        })

    return {
        "$type": "book",
        "Id": book_id,
        "PackageId": package_id,
        "Name": charx_book.get('name', 'Imported Lorebook'),
        "Description": charx_book.get('description', ''),
        "Version": "1.0.0",
        "ExplicitContent": False,
        "Creator": "",
        "Items": items,
        "DateCreated": datetime.utcnow().isoformat() + 'Z',
        "DateModified": datetime.utcnow().isoformat() + 'Z'
    }


def strip_decorators(content: str) -> str:
    """Remove @@decorator lines from content."""
    lines = content.split('\n')
    result = []
    for line in lines:
        if not line.strip().startswith('@@'):
            result.append(line)
    return '\n'.join(result).strip()
```

### Pseudocode: VOXPKG → CHARX

```python
def convert_voxpkg_to_charx(voxpkg_path: str, character_id: str = None) -> bytes:
    """
    Convert a Voxta package to CHARX format.
    If package has multiple characters, character_id specifies which one.
    """
    voxpkg_zip = ZipFile(voxpkg_path)

    # 1. Find character(s)
    char_files = [f for f in voxpkg_zip.namelist() if '/character.json' in f]

    if not char_files:
        raise ValueError("No characters found in package")

    # Select character
    if character_id:
        char_file = f'Characters/{character_id}/character.json'
    else:
        char_file = char_files[0]  # First character

    character = json.load(voxpkg_zip.open(char_file))
    char_dir = char_file.rsplit('/', 1)[0]

    # 2. Build CHARX card.json
    card = {
        "spec": "chara_card_v3",
        "spec_version": "3.0",
        "data": {
            # Core fields
            "name": character.get('Name', ''),
            "description": character.get('Description', ''),
            "personality": character.get('Personality', ''),
            "scenario": character.get('Scenario', ''),
            "first_mes": character.get('FirstMessage', ''),
            "mes_example": character.get('MessageExamples', ''),

            # Prompting
            "system_prompt": character.get('SystemPrompt', ''),
            "post_history_instructions": character.get('PostHistoryInstructions', ''),

            # Metadata
            "creator_notes": character.get('CreatorNotes', ''),
            "creator": character.get('Creator', ''),
            "tags": character.get('Tags', []),
            "character_version": character.get('Version', '1.0.0'),

            # Timestamps
            "creation_date": iso_to_unix(character.get('DateCreated')),
            "modification_date": iso_to_unix(character.get('DateModified')),

            # CHARX-required fields (Voxta has no equivalent)
            "alternate_greetings": [],
            "group_only_greetings": [],
            "nickname": "",  # Voxta Label is NOT equivalent - different purpose

            # Source tracking
            "source": [f"voxta:{character.get('Id', '')}"],

            # Store Voxta-specific data in extensions
            "extensions": {
                "voxta": {
                    "id": character.get('Id'),
                    "culture": character.get('Culture'),
                    "chat_style": character.get('ChatStyle'),
                    "explicit_content": character.get('ExplicitContent'),
                    "enable_thinking_speech": character.get('EnableThinkingSpeech'),
                    "time_aware": character.get('TimeAware'),
                    "use_memory": character.get('UseMemory'),
                    "max_tokens": character.get('MaxTokens'),
                    "max_sentences": character.get('MaxSentences'),
                    "augmentations": character.get('Augmentations', []),
                    "scripts": character.get('Scripts', []),
                    "tts": character.get('TextToSpeech', []),
                    "profile": character.get('Profile', ''),
                    "user_name_override": character.get('UserNameOverride'),
                    "user_description_override": character.get('UserDescriptionOverride'),
                    "instructions": character.get('Instructions'),
                    "context": character.get('Context'),
                    "label": character.get('Label'),  # Preserve for round-trip
                }
            },

            # Assets (populated below)
            "assets": []
        }
    }

    # 3. Convert lorebook if referenced
    if character.get('MemoryBooks'):
        card['data']['character_book'] = convert_voxta_books(
            voxpkg_zip, character['MemoryBooks']
        )

    # 4. Build CHARX ZIP
    charx = BytesIO()
    with ZipFile(charx, 'w') as zf:
        # card.json
        zf.writestr('card.json', json.dumps(card, indent=2))

        # Thumbnail → main icon
        thumb_path = f'{char_dir}/thumbnail.png'
        if thumb_path in voxpkg_zip.namelist():
            zf.writestr('assets/icon/images/main.png', voxpkg_zip.read(thumb_path))
            card['data']['assets'].append({
                "type": "icon",
                "uri": "embeded://assets/icon/images/main.png",
                "name": "main",
                "ext": "png"
            })

        # Avatars → emotions
        avatar_dir = f'{char_dir}/Assets/Avatars/Default/'
        for avatar_file in voxpkg_zip.namelist():
            if avatar_file.startswith(avatar_dir) and avatar_file.endswith('.webp'):
                filename = avatar_file.split('/')[-1]
                # Parse {Emotion}_{State}_{Variant}.webp
                parts = filename.replace('.webp', '').split('_')
                if len(parts) >= 2:
                    emotion = parts[0].lower()
                    # Only use Idle variants for CHARX
                    if parts[1] == 'Idle':
                        charx_name = map_voxta_emotion_to_charx(emotion)
                        out_path = f'assets/emotion/images/{charx_name}.webp'
                        zf.writestr(out_path, voxpkg_zip.read(avatar_file))
                        card['data']['assets'].append({
                            "type": "emotion",
                            "uri": f"embeded://{out_path}",
                            "name": charx_name,
                            "ext": "webp"
                        })

        # Re-write card.json with updated assets
        zf.writestr('card.json', json.dumps(card, indent=2))

    return charx.getvalue()


def convert_voxta_books(zf: ZipFile, book_ids: list) -> dict:
    """Convert Voxta books to CHARX character_book format."""
    entries = []

    for book_id in book_ids:
        book_path = f'Books/{book_id}/book.json'
        if book_path not in zf.namelist():
            continue

        book = json.load(zf.open(book_path))

        for item in book.get('Items', []):
            if item.get('Deleted'):
                continue

            entries.append({
                "keys": item.get('Keywords', []),
                "content": item.get('Text', ''),
                "enabled": True,
                "insertion_order": item.get('Weight', 100),
                "constant": False,
                "selective": False,
                "secondary_keys": [],
                "name": "",
                "comment": "",
                "case_sensitive": False,
                "use_regex": False,
                "extensions": {}
            })

    return {
        "name": "Imported from Voxta",
        "entries": entries,
        "extensions": {}
    }


def map_voxta_emotion_to_charx(voxta_emotion: str) -> str:
    """Map Voxta emotion names to CHARX convention."""
    mapping = {
        'neutral': 'neutral',
        'smile': 'happy',
        'laugh': 'laughing',
        'love': 'love',
        'horny': 'horny',
        'angry': 'angry',
        'unhappy': 'sad',
        'cry': 'crying',
        'fear': 'fearful',
        'question': 'confused',
        'surprise': 'surprised'
    }
    return mapping.get(voxta_emotion.lower(), voxta_emotion.lower())


def iso_to_unix(iso_str: str) -> int:
    """Convert ISO 8601 timestamp to Unix timestamp."""
    if not iso_str:
        return int(time.time())
    try:
        dt = datetime.fromisoformat(iso_str.replace('Z', '+00:00'))
        return int(dt.timestamp())
    except:
        return int(time.time())
```

---

## Implementation Recommendations

### For Voxta (CHARX Import)

### Minimum Viable Import

1. Parse `card.json` from CHARX ZIP
2. Map core fields (name, description, personality, scenario, first_mes)
3. Copy main icon as thumbnail
4. Generate a single character VOXPKG

### Enhanced Import

1. All minimum viable features
2. Convert `character_book` to Voxta `book.json`
3. Map emotion assets to avatar naming convention
4. Parse `alternate_greetings` into multiple scenarios
5. Handle `system_prompt` and `post_history_instructions`

### Full Import

1. All enhanced features
2. Parse and warn about unsupported decorators
3. Attempt intelligent emotion name mapping
4. Store CHARX-specific data in extensions for round-trip support
5. Support importing V3 PNG files (extract `ccv3` chunk)

---

## Data Loss Summary

### CHARX → VOXPKG Data Loss

| Feature | Severity | Reason | Mitigation |
|---------|----------|--------|------------|
| Lorebook decorators | Medium | Voxta uses Contexts differently | Strip and warn user |
| `alternate_greetings` | Low | Voxta uses Scenarios | Store in extensions for round-trip |
| `group_only_greetings` | Low | No equivalent | Store in extensions |
| Background images | Low | Not used in Voxta | Discard or store externally |
| User icons | Low | Not used in Voxta | Discard |
| `nickname` | Low | No equivalent (Label is different - see note) | Store in Voxta extensions |
| Multilingual notes | Low | No equivalent | Use primary language |
| RisuAI extensions | None | App-specific | Safe to discard |

### VOXPKG → CHARX Data Loss

| Feature | Severity | Reason | Mitigation |
|---------|----------|--------|------------|
| `Scripts[]` | High | No CHARX scripting | Store in `extensions.voxta.scripts` |
| `TextToSpeech[]` | Medium | No CHARX TTS | Store in `extensions.voxta.tts` |
| `Augmentations[]` | Medium | No equivalent | Store in `extensions.voxta.augmentations` |
| `Scenarios/` | Medium | CHARX is single-greeting | Could populate `alternate_greetings` |
| Multiple characters | Medium | CHARX is single-character | Export each separately |
| `Profile` | Low | No direct field | Append to `description` or store in extensions |
| `TimeAware`, `UseMemory` | Low | No equivalent | Store in extensions |
| `MaxTokens`, `MaxSentences` | Low | No equivalent | Store in extensions |
| `UserNameOverride` | Low | No equivalent | Store in extensions |
| `Instructions`, `Context` | Low | No equivalent | Store in extensions |
| Avatar states (Talking, Thinking) | Low | CHARX has single emotion images | Use Idle variant only |
| `ChatStyle` | Low | No equivalent | Store in extensions |
| `Label` | Low | Not equivalent to `nickname` (different purpose) | Store in extensions |

### Fields That Map Directly (No Loss)

| CHARX Field | Voxta Field | Direction |
|-------------|-------------|-----------|
| `name` | `Name` | ↔ |
| `description` | `Description` | ↔ |
| `personality` | `Personality` | ↔ |
| `scenario` | `Scenario` | ↔ |
| `first_mes` | `FirstMessage` | ↔ |
| `mes_example` | `MessageExamples` | ↔ |
| `system_prompt` | `SystemPrompt` | ↔ |
| `post_history_instructions` | `PostHistoryInstructions` | ↔ |
| `creator_notes` | `CreatorNotes` | ↔ |
| `creator` | `Creator` | ↔ |
| `tags` | `Tags` | ↔ |
| `character_version` | `Version` | ↔ |
| Main icon | `thumbnail.png` | ↔ |
| Emotion assets | Avatar Idle variants | ↔ (with name mapping) |
| `character_book` | `Books/` | ↔ (simplified) |

---

## Appendix: Full Schema Reference

### CHARX card.json (CCv3)
```typescript
interface CharacterCardV3 {
  spec: 'chara_card_v3'
  spec_version: '3.0'
  data: {
    // Core
    name: string
    description: string
    personality: string
    scenario: string
    first_mes: string
    mes_example: string

    // Prompting
    system_prompt: string
    post_history_instructions: string

    // Greetings
    alternate_greetings: string[]
    group_only_greetings: string[]

    // Lorebook
    character_book?: {
      name?: string
      description?: string
      scan_depth?: number
      token_budget?: number
      recursive_scanning?: boolean
      extensions: Record<string, any>
      entries: Array<{
        keys: string[]
        content: string
        enabled: boolean
        insertion_order: number
        case_sensitive?: boolean
        constant?: boolean
        selective?: boolean
        secondary_keys?: string[]
        position?: 'before_char' | 'after_char'
        name?: string
        priority?: number
        id?: number | string
        comment?: string
        use_regex: boolean
        extensions: Record<string, any>
      }>
    }

    // Assets
    assets?: Array<{
      type: string
      uri: string
      name: string
      ext: string
    }>

    // Metadata
    tags: string[]
    creator: string
    character_version: string
    creator_notes: string
    creator_notes_multilingual?: Record<string, string>
    nickname?: string
    source?: string[]
    creation_date?: number
    modification_date?: number

    // Extensions
    extensions: Record<string, any>
  }
}
```

### Voxta character.json
```typescript
interface VoxtaCharacter {
  $type: 'character'
  Id: string  // UUID
  Name: string
  Version: string  // semver

  // Core Content
  Description: string
  Personality: string
  Scenario: string
  FirstMessage: string
  MessageExamples: string
  CreatorNotes: string
  Profile: string  // Extended backstory/profile

  // Prompting (maps directly from CHARX)
  SystemPrompt?: string
  PostHistoryInstructions?: string

  // Configuration
  Culture: string  // e.g., "en-US"
  ChatStyle: number  // 0=default, 3=extended
  ExplicitContent: boolean
  EnableThinkingSpeech: boolean
  NotifyUserAwayReturn: boolean
  TimeAware: boolean
  UseMemory: boolean
  MaxTokens: number  // 0 = unlimited
  MaxSentences: number  // 0 = unlimited
  SystemPromptOverrideType: number

  // References
  MemoryBooks: string[]  // UUIDs
  DefaultScenarios: string[]  // UUIDs
  Tags: string[]

  // Optional Metadata
  Label?: string  // Display label (can differ from Name)
  PackageId?: string  // Parent package UUID
  Creator?: string
  ImportedFrom?: string  // Source tracking

  // User Overrides (Voxta-specific)
  UserNameOverride?: string
  UserDescriptionOverride?: string
  Instructions?: string  // User instructions
  Context?: string  // Additional context

  // TTS Configuration
  TextToSpeech: Array<{
    Voice: {
      parameters: {
        VoiceBackend?: string  // e.g., "elevenlabs"
        VoiceId?: string
        Filename?: string  // For local voice files
        Gender?: string  // Fallback voice selection
        FinetuneVoice?: string
      }
      label: string
    }
    Service?: {
      ServiceName: string  // e.g., "ElevenLabs", "Coqui", "VoxtaCloud"
      ServiceId: string
    }
  }>

  // Scripting
  Scripts: Array<{
    Name: string  // e.g., "index", "lib"
    Content: string  // JavaScript/TypeScript code
  }>

  // Feature Augmentations
  Augmentations: string[]  // e.g., ["bing", "vision", "mcp"]

  // Metadata
  Thumbnail?: {
    RandomizedETag: string
    ContentType: string
  }
  DateCreated: string  // ISO 8601
  DateModified: string  // ISO 8601
}
```

### Voxta Augmentation Values
```typescript
type VoxtaAugmentation =
  | "bing"                        // Web search
  | "vision"                      // Image recognition
  | "vision.prompted"             // Prompted image analysis
  | "windows_sdk"                 // Windows integration
  | "continuations_idle_followup" // Idle follow-ups
  | "think_pass_before_reply"     // Thinking phase
  | "mcp"                         // Model Context Protocol
  | "folderwatcher"               // File monitoring
  // ... more may exist
```

### Voxta book.json
```typescript
interface VoxtaBook {
  $type: 'book'
  Id: string
  PackageId: string
  Name: string
  Version: string
  Description: string
  ExplicitContent: boolean
  Creator: string

  Items: Array<{
    Id: string
    Keywords: string[]
    Text: string
    Weight: number
    Deleted?: boolean
    CreatedAt: string
    LastUpdated: string
    DeletedAt?: string
  }>

  DateCreated: string
  DateModified: string
}
```
