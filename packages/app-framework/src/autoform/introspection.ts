import { z } from 'zod';

/**
 * Analyzed field information extracted from a Zod schema.
 */
export interface FieldInfo {
  /** Field name in the schema */
  name: string;

  /** The Zod type (unwrapped from optional/nullable/default) */
  zodType: z.ZodTypeAny;

  /** Zod type constructor name (e.g., 'ZodString', 'ZodNumber') */
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
 * @returns Map of field names to their analyzed information
 */
export function analyzeSchema<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>
): Map<keyof T, FieldInfo> {
  const shape = schema.shape;
  const fields = new Map<keyof T, FieldInfo>();

  for (const [name, zodType] of Object.entries(shape)) {
    fields.set(name as keyof T, analyzeField(name, zodType as z.ZodTypeAny));
  }

  return fields;
}

/**
 * Analyze a single Zod field to extract its type information.
 *
 * @param name - Field name
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

  // Unwrap optional wrapper
  if (currentType instanceof z.ZodOptional) {
    isOptional = true;
    currentType = currentType.unwrap();
  }

  // Unwrap nullable wrapper
  if (currentType instanceof z.ZodNullable) {
    isNullable = true;
    currentType = currentType.unwrap();
  }

  // Unwrap default wrapper and extract default value
  if (currentType instanceof z.ZodDefault) {
    defaultValue = currentType._def.defaultValue();
    currentType = currentType._def.innerType;
  }

  // Handle ZodEffects (refinements, transforms)
  if (currentType instanceof z.ZodEffects) {
    currentType = currentType._def.schema;
  }

  const typeName = currentType.constructor.name;

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
    constraints: extractConstraints(currentType),
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
 * Extract inner type for compound types (arrays, etc.).
 */
function extractInnerType(
  name: string,
  zodType: z.ZodTypeAny
): FieldInfo | undefined {
  if (zodType instanceof z.ZodArray) {
    return analyzeField(`${name}[]`, zodType._def.type);
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
      // Use radio for small enums, select for larger
      return enumValues && enumValues.length <= 4 ? 'radio' : 'select';
    case 'ZodArray':
      // String arrays become tag inputs
      if (innerType?.typeName === 'ZodString') {
        return 'tag-input';
      }
      return 'text'; // Fallback
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
