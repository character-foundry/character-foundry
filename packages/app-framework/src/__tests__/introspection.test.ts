import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  analyzeSchema,
  analyzeField,
  getDefaultWidgetType,
  isSecretField,
} from '../autoform/introspection';

describe('analyzeSchema', () => {
  it('analyzes a simple schema', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
      enabled: z.boolean(),
    });

    const fields = analyzeSchema(schema);

    expect(fields.size).toBe(3);
    expect(fields.get('name')?.typeName).toBe('ZodString');
    expect(fields.get('age')?.typeName).toBe('ZodNumber');
    expect(fields.get('enabled')?.typeName).toBe('ZodBoolean');
  });

  it('detects optional fields', () => {
    const schema = z.object({
      required: z.string(),
      optional: z.string().optional(),
    });

    const fields = analyzeSchema(schema);

    expect(fields.get('required')?.isOptional).toBe(false);
    expect(fields.get('optional')?.isOptional).toBe(true);
  });

  it('detects nullable fields', () => {
    const schema = z.object({
      normal: z.string(),
      nullable: z.string().nullable(),
    });

    const fields = analyzeSchema(schema);

    expect(fields.get('normal')?.isNullable).toBe(false);
    expect(fields.get('nullable')?.isNullable).toBe(true);
  });

  it('extracts default values', () => {
    const schema = z.object({
      noDefault: z.string(),
      withDefault: z.string().default('hello'),
      numDefault: z.number().default(42),
    });

    const fields = analyzeSchema(schema);

    expect(fields.get('noDefault')?.defaultValue).toBeUndefined();
    expect(fields.get('withDefault')?.defaultValue).toBe('hello');
    expect(fields.get('numDefault')?.defaultValue).toBe(42);
  });

  it('extracts descriptions', () => {
    const schema = z.object({
      noDesc: z.string(),
      withDesc: z.string().describe('A description'),
    });

    const fields = analyzeSchema(schema);

    expect(fields.get('noDesc')?.description).toBeUndefined();
    expect(fields.get('withDesc')?.description).toBe('A description');
  });

  it('extracts enum values', () => {
    const schema = z.object({
      role: z.enum(['admin', 'user', 'guest']),
    });

    const fields = analyzeSchema(schema);

    expect(fields.get('role')?.enumValues).toEqual(['admin', 'user', 'guest']);
  });

  it('extracts constraints from string', () => {
    const schema = z.object({
      limited: z.string().min(2).max(100),
    });

    const fields = analyzeSchema(schema);

    expect(fields.get('limited')?.constraints?.minLength).toBe(2);
    expect(fields.get('limited')?.constraints?.maxLength).toBe(100);
  });

  it('extracts constraints from number', () => {
    const schema = z.object({
      value: z.number().min(0).max(100),
    });

    const fields = analyzeSchema(schema);

    expect(fields.get('value')?.constraints?.min).toBe(0);
    expect(fields.get('value')?.constraints?.max).toBe(100);
  });

  it('analyzes array fields', () => {
    const schema = z.object({
      tags: z.array(z.string()),
    });

    const fields = analyzeSchema(schema);

    expect(fields.get('tags')?.typeName).toBe('ZodArray');
    expect(fields.get('tags')?.innerType?.typeName).toBe('ZodString');
  });
});

describe('analyzeField', () => {
  it('handles default wrapper', () => {
    const field = z.string().default('test');
    const info = analyzeField('test', field);

    expect(info.defaultValue).toBe('test');
    expect(info.typeName).toBe('ZodString');
  });

  it('handles optional wrapper', () => {
    const field = z.string().optional();
    const info = analyzeField('test', field);

    expect(info.isOptional).toBe(true);
    expect(info.typeName).toBe('ZodString');
  });

  it('handles nullable wrapper', () => {
    const field = z.string().nullable();
    const info = analyzeField('test', field);

    expect(info.isNullable).toBe(true);
    expect(info.typeName).toBe('ZodString');
  });

  it('preserves description through wrappers', () => {
    const field = z.string().describe('My field').optional();
    const info = analyzeField('test', field);

    expect(info.description).toBe('My field');
  });
});

describe('getDefaultWidgetType', () => {
  it('returns text for string', () => {
    const info = analyzeField('test', z.string());
    expect(getDefaultWidgetType(info)).toBe('text');
  });

  it('returns number for number', () => {
    const info = analyzeField('test', z.number());
    expect(getDefaultWidgetType(info)).toBe('number');
  });

  it('returns switch for boolean', () => {
    const info = analyzeField('test', z.boolean());
    expect(getDefaultWidgetType(info)).toBe('switch');
  });

  it('returns radio for small enum', () => {
    const info = analyzeField('test', z.enum(['a', 'b', 'c']));
    expect(getDefaultWidgetType(info)).toBe('radio');
  });

  it('returns select for large enum', () => {
    const info = analyzeField('test', z.enum(['a', 'b', 'c', 'd', 'e']));
    expect(getDefaultWidgetType(info)).toBe('select');
  });

  it('returns password for api key description', () => {
    const info = analyzeField('test', z.string().describe('Your API Key'));
    expect(getDefaultWidgetType(info)).toBe('password');
  });

  it('returns tag-input for string array', () => {
    const info = analyzeField('test', z.array(z.string()));
    expect(getDefaultWidgetType(info)).toBe('tag-input');
  });
});

describe('isSecretField', () => {
  it('detects password fields', () => {
    const info = analyzeField('test', z.string().describe('User password'));
    expect(isSecretField(info)).toBe(true);
  });

  it('detects API key fields', () => {
    const info = analyzeField('test', z.string().describe('OpenAI API Key'));
    expect(isSecretField(info)).toBe(true);
  });

  it('detects token fields', () => {
    const info = analyzeField('test', z.string().describe('Access token'));
    expect(isSecretField(info)).toBe(true);
  });

  it('does not flag normal fields', () => {
    const info = analyzeField('test', z.string().describe('User name'));
    expect(isSecretField(info)).toBe(false);
  });

  it('returns false for no description', () => {
    const info = analyzeField('test', z.string());
    expect(isSecretField(info)).toBe(false);
  });
});
