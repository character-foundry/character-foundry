import { z } from 'zod';

/**
 * Analyzed field information extracted from a Zod schema.
 */
export interface FieldInfo {
  /** Field name in the schema */
  name: string;

  /** The Zod type (unwrapped from optional/nullable/default) */
  zodType: z.ZodTypeAny;

  /** Zod type constructor name (e.g., 'ZodString', 'ZodNumber', 'ZodObject') */
  typeName: string;

  /** Whether the field is optional */
  isOptional: boolean;

  /** Whether the field is nullable */
  isNullable: boolean;

  /** Default value if specified */
  defaultValue?: unknown;

  /** Description from .describe() */
  description?: string;

  /** Enum values for z.enum() or z.nativeEnum() */
  enumValues?: string[];

  /** Inner type info for arrays, optionals, etc. */
  innerType?: FieldInfo;

  /**
   * For nested objects: Map of child field names to their FieldInfo.
   * Only populated when typeName === 'ZodObject'.
   */
  nestedFields?: Map<string, FieldInfo>;

  /**
   * For nested objects: The inner ZodObject schema.
   * Useful for recursive AutoForm rendering.
   */
  innerSchema?: z.ZodObject<z.ZodRawShape>;

  /** Validation constraints extracted from the schema */
  constraints?: FieldConstraints;
}

/**
 * Validation constraints extracted from Zod checks.
 */
export interface FieldConstraints {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  regex?: RegExp;
  email?: boolean;
  url?: boolean;
  uuid?: boolean;
  int?: boolean;
  positive?: boolean;
  negative?: boolean;
  multipleOf?: number;
}

/**
 * Extract field information from a ZodObject schema.
 *
 * @param schema - Zod object schema to analyze
 * @param prefix - Optional prefix for nested field names (e.g., "parent.")
 * @returns Map of field names to their analyzed information
 */
export function analyzeSchema<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  prefix = ''
): Map<string, FieldInfo> {
  const shape = schema.shape;
  const fields = new Map<string, FieldInfo>();

  for (const [name, zodType] of Object.entries(shape)) {
    const fullName = prefix ? `${prefix}.${name}` : name;
    fields.set(fullName, analyzeField(fullName, zodType as z.ZodTypeAny));
  }

  return fields;
}

/**
 * Flatten a nested schema into a single Map with dot-notation keys.
 * Useful for forms that need flat access to all fields.
 *
 * @example
 * ```ts
 * const schema = z.object({
 *   name: z.string(),
 *   profile: z.object({
 *     bio: z.string(),
 *   }),
 * });
 *
 * const flat = flattenSchema(schema);
 * // Map { 'name' => ..., 'profile' => ..., 'profile.bio' => ... }
 * ```
 */
export function flattenSchema<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  prefix = ''
): Map<string, FieldInfo> {
  const fields = new Map<string, FieldInfo>();
  const shape = schema.shape;

  for (const [name, zodType] of Object.entries(shape)) {
    const fullName = prefix ? `${prefix}.${name}` : name;
    const fieldInfo = analyzeField(fullName, zodType as z.ZodTypeAny);
    fields.set(fullName, fieldInfo);

    // Recursively flatten nested objects
    if (fieldInfo.typeName === 'ZodObject' && fieldInfo.innerSchema) {
      const nestedFields = flattenSchema(fieldInfo.innerSchema, fullName);
      for (const [nestedName, nestedInfo] of nestedFields) {
        fields.set(nestedName, nestedInfo);
      }
    }
  }

  return fields;
}

/**
 * Analyze a single Zod field to extract its type information.
 *
 * @param name - Field name (can include dots for nested paths)
 * @param zodType - Zod type to analyze
 * @returns Analyzed field information
 */
export function analyzeField(name: string, zodType: z.ZodTypeAny): FieldInfo {
  let currentType = zodType;
  let isOptional = false;
  let isNullable = false;
  let defaultValue: unknown;

  // Store the original description before unwrapping
  const description = getDescription(zodType);

  // Unwrap all wrapper types (optional, nullable, default, effects) in any order
  let unwrapping = true;
  while (unwrapping) {
    unwrapping = false;

    if (currentType instanceof z.ZodOptional) {
      isOptional = true;
      currentType = currentType.unwrap();
      unwrapping = true;
    } else if (currentType instanceof z.ZodNullable) {
      isNullable = true;
      currentType = currentType.unwrap();
      unwrapping = true;
    } else if (currentType instanceof z.ZodDefault) {
      defaultValue = currentType._def.defaultValue();
      currentType = currentType._def.innerType;
      unwrapping = true;
    } else if (currentType instanceof z.ZodEffects) {
      currentType = currentType._def.schema;
      unwrapping = true;
    }
  }

  // Handle ZodUnion - pick the first option for rendering
  if (currentType instanceof z.ZodUnion) {
    const options = currentType._def.options as z.ZodTypeAny[];
    if (options.length > 0 && options[0]) {
      // Use first option as representative type
      currentType = options[0];
    }
  }

  // Handle ZodDiscriminatedUnion - analyze the discriminator
  if (currentType instanceof z.ZodDiscriminatedUnion) {
    // For discriminated unions, we can't easily pick a single type
    // Return as 'ZodDiscriminatedUnion' and let widgets handle it
    // Consumers can use the discriminator to conditionally render
  }

  // Handle ZodRecord - treat as a special case (key-value pairs)
  // Records are rendered as text by default, custom widgets can handle them
  if (currentType instanceof z.ZodRecord) {
    // Leave as ZodRecord - widgets can check typeName
  }

  // Handle ZodSet - treat like an array
  if (currentType instanceof z.ZodSet) {
    // Leave as ZodSet - similar to array handling
  }

  const typeName = currentType.constructor.name;

  // Extract nested fields for ZodObject
  let nestedFields: Map<string, FieldInfo> | undefined;
  let innerSchema: z.ZodObject<z.ZodRawShape> | undefined;

  if (currentType instanceof z.ZodObject) {
    innerSchema = currentType as z.ZodObject<z.ZodRawShape>;
    nestedFields = new Map();
    const shape = currentType.shape;
    for (const [childName, childType] of Object.entries(shape)) {
      nestedFields.set(
        childName,
        analyzeField(`${name}.${childName}`, childType as z.ZodTypeAny)
      );
    }
  }

  return {
    name,
    zodType: currentType,
    typeName,
    isOptional,
    isNullable,
    defaultValue,
    description,
    enumValues: extractEnumValues(currentType),
    innerType: extractInnerType(name, currentType),
    nestedFields,
    innerSchema,
    constraints: extractConstraints(currentType),
  };
}

/**
 * Dangerous property names that should never be accessed via path traversal.
 * These are JavaScript prototype chain keys that could enable prototype pollution attacks.
 */
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Check if a property key is safe to access.
 */
function isSafeKey(key: string): boolean {
  return !DANGEROUS_KEYS.has(key);
}

/**
 * Get the value at a dot-notation path from an object.
 * SECURITY: Rejects dangerous keys (__proto__, constructor, prototype) to prevent prototype pollution.
 *
 * @example
 * ```ts
 * getValueAtPath({ profile: { name: 'John' } }, 'profile.name') // 'John'
 * ```
 */
export function getValueAtPath(
  obj: Record<string, unknown>,
  path: string
): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    // SECURITY: Reject dangerous property names
    if (!isSafeKey(part)) {
      return undefined;
    }
    if (current == null || typeof current !== 'object') {
      return undefined;
    }
    // Use Object.hasOwn to avoid prototype chain lookup
    if (!Object.hasOwn(current as object, part)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Set a value at a dot-notation path in an object (immutably).
 * SECURITY: Rejects dangerous keys (__proto__, constructor, prototype) to prevent prototype pollution.
 *
 * @example
 * ```ts
 * setValueAtPath({ profile: { name: 'John' } }, 'profile.name', 'Jane')
 * // { profile: { name: 'Jane' } }
 * ```
 */
export function setValueAtPath(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): Record<string, unknown> {
  const parts = path.split('.');
  if (parts.length === 0 || parts[0] === undefined) {
    return obj;
  }

  const first = parts[0];

  // SECURITY: Reject dangerous property names
  if (!isSafeKey(first)) {
    console.warn(`Rejected dangerous property key in path: ${first}`);
    return obj;
  }

  if (parts.length === 1) {
    return { ...obj, [first]: value };
  }

  const rest = parts.slice(1);
  const nested = (Object.hasOwn(obj, first) ? obj[first] : {}) as Record<string, unknown> ?? {};

  return {
    ...obj,
    [first]: setValueAtPath(nested, rest.join('.'), value),
  };
}

/**
 * Extract description from a Zod type's definition.
 */
function getDescription(zodType: z.ZodTypeAny): string | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (zodType as any)._def?.description;
}

/**
 * Extract enum values from ZodEnum or ZodNativeEnum.
 */
function extractEnumValues(zodType: z.ZodTypeAny): string[] | undefined {
  if (zodType instanceof z.ZodEnum) {
    return zodType._def.values as string[];
  }

  if (zodType instanceof z.ZodNativeEnum) {
    const values = zodType._def.values;
    // Handle numeric enums (filter out reverse mappings)
    return Object.values(values).filter(
      (v) => typeof v === 'string'
    ) as string[];
  }

  return undefined;
}

/**
 * Extract inner type for compound types (arrays, sets, etc.).
 */
function extractInnerType(
  name: string,
  zodType: z.ZodTypeAny
): FieldInfo | undefined {
  if (zodType instanceof z.ZodArray) {
    return analyzeField(`${name}[]`, zodType._def.type);
  }

  if (zodType instanceof z.ZodSet) {
    return analyzeField(`${name}[]`, zodType._def.valueType);
  }

  return undefined;
}

/**
 * Extract validation constraints from Zod checks.
 */
function extractConstraints(zodType: z.ZodTypeAny): FieldConstraints | undefined {
  const constraints: FieldConstraints = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const checks = (zodType as any)._def?.checks as Array<{ kind: string; value?: unknown }> | undefined;

  if (!Array.isArray(checks)) {
    return undefined;
  }

  for (const check of checks) {
    switch (check.kind) {
      case 'min':
        if (zodType instanceof z.ZodString) {
          constraints.minLength = check.value as number;
        } else {
          constraints.min = check.value as number;
        }
        break;
      case 'max':
        if (zodType instanceof z.ZodString) {
          constraints.maxLength = check.value as number;
        } else {
          constraints.max = check.value as number;
        }
        break;
      case 'length':
        constraints.minLength = check.value as number;
        constraints.maxLength = check.value as number;
        break;
      case 'email':
        constraints.email = true;
        break;
      case 'url':
        constraints.url = true;
        break;
      case 'uuid':
        constraints.uuid = true;
        break;
      case 'regex':
        constraints.regex = check.value as RegExp;
        break;
      case 'int':
        constraints.int = true;
        break;
      case 'multipleOf':
        constraints.multipleOf = check.value as number;
        break;
    }
  }

  // Check for positive/negative via refinements on number
  if (zodType instanceof z.ZodNumber) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const minCheck = checks.find((c) => c.kind === 'min');
    if (minCheck && (minCheck as any).inclusive === false && minCheck.value === 0) {
      constraints.positive = true;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const maxCheck = checks.find((c) => c.kind === 'max');
    if (maxCheck && (maxCheck as any).inclusive === false && maxCheck.value === 0) {
      constraints.negative = true;
    }
  }

  return Object.keys(constraints).length > 0 ? constraints : undefined;
}

/**
 * Determine the default widget type for a Zod field.
 */
export function getDefaultWidgetType(fieldInfo: FieldInfo): string {
  const { typeName, description, enumValues, innerType, constraints } =
    fieldInfo;

  // Check for secret/password patterns in description
  if (description) {
    const lowerDesc = description.toLowerCase();
    if (
      lowerDesc.includes('password') ||
      lowerDesc.includes('secret') ||
      lowerDesc.includes('api key') ||
      lowerDesc.includes('apikey') ||
      lowerDesc.includes('token')
    ) {
      return 'password';
    }
  }

  // Check for email/url constraints
  if (constraints?.email) return 'text'; // Could be 'email' widget
  if (constraints?.url) return 'text'; // Could be 'url' widget

  // Map Zod types to widgets
  switch (typeName) {
    case 'ZodString':
      return 'text';
    case 'ZodNumber':
      return 'number';
    case 'ZodBoolean':
      return 'switch';
    case 'ZodEnum':
    case 'ZodNativeEnum':
      // Use radio for small enums, searchable-select for large
      if (enumValues) {
        if (enumValues.length <= 4) return 'radio';
        if (enumValues.length > 10) return 'searchable-select';
      }
      return 'select';
    case 'ZodArray':
      // String arrays become tag inputs
      if (innerType?.typeName === 'ZodString') {
        return 'tag-input';
      }
      return 'text'; // Fallback
    case 'ZodSet':
      // Sets are similar to arrays - string sets become tag inputs
      if (innerType?.typeName === 'ZodString') {
        return 'tag-input';
      }
      return 'text'; // Fallback
    case 'ZodObject':
      return 'nested'; // Special marker for nested objects
    case 'ZodRecord':
      return 'text'; // Records need custom widgets or JSON editor
    case 'ZodDiscriminatedUnion':
      return 'select'; // Use discriminator field to select variant
    case 'ZodDate':
      return 'text'; // Could be 'date' widget
    default:
      return 'text';
  }
}

/**
 * Check if a field should be treated as a secret/password field.
 */
export function isSecretField(fieldInfo: FieldInfo): boolean {
  if (!fieldInfo.description) return false;

  const lowerDesc = fieldInfo.description.toLowerCase();
  return (
    lowerDesc.includes('password') ||
    lowerDesc.includes('secret') ||
    lowerDesc.includes('api key') ||
    lowerDesc.includes('apikey') ||
    lowerDesc.includes('token') ||
    lowerDesc.includes('credential')
  );
}

/**
 * Check if a field is a nested object type.
 */
export function isNestedObject(fieldInfo: FieldInfo): boolean {
  return fieldInfo.typeName === 'ZodObject' && fieldInfo.nestedFields != null;
}
