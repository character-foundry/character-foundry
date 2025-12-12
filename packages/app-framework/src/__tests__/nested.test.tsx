import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { z } from 'zod';
import { AutoForm } from '../autoform/AutoForm';
import { analyzeField, flattenSchema, isNestedObject, getValueAtPath, setValueAtPath } from '../autoform/introspection';

describe('Nested Object Support', () => {
  describe('introspection', () => {
    it('detects nested objects', () => {
      const schema = z.object({
        name: z.string(),
        profile: z.object({
          bio: z.string(),
          age: z.number(),
        }),
      });

      const fields = flattenSchema(schema);

      expect(fields.has('name')).toBe(true);
      expect(fields.has('profile')).toBe(true);
      expect(fields.has('profile.bio')).toBe(true);
      expect(fields.has('profile.age')).toBe(true);
    });

    it('analyzeField returns nested info for ZodObject', () => {
      const nestedSchema = z.object({
        bio: z.string(),
      });
      const info = analyzeField('profile', nestedSchema);

      expect(info.typeName).toBe('ZodObject');
      expect(info.nestedFields).toBeDefined();
      expect(info.nestedFields?.has('bio')).toBe(true);
      expect(info.innerSchema).toBeDefined();
    });

    it('isNestedObject returns true for nested objects', () => {
      const nestedSchema = z.object({
        bio: z.string(),
      });
      const info = analyzeField('profile', nestedSchema);

      expect(isNestedObject(info)).toBe(true);
    });

    it('isNestedObject returns false for primitives', () => {
      const info = analyzeField('name', z.string());

      expect(isNestedObject(info)).toBe(false);
    });
  });

  describe('getValueAtPath / setValueAtPath', () => {
    it('getValueAtPath retrieves nested values', () => {
      const obj = { profile: { name: 'John', age: 30 } };

      expect(getValueAtPath(obj, 'profile.name')).toBe('John');
      expect(getValueAtPath(obj, 'profile.age')).toBe(30);
    });

    it('getValueAtPath returns undefined for missing paths', () => {
      const obj = { profile: { name: 'John' } };

      expect(getValueAtPath(obj, 'profile.missing')).toBeUndefined();
      expect(getValueAtPath(obj, 'missing.deeply')).toBeUndefined();
    });

    it('setValueAtPath sets nested values immutably', () => {
      const obj = { profile: { name: 'John' } };
      const result = setValueAtPath(obj, 'profile.name', 'Jane');

      expect(result.profile).toEqual({ name: 'Jane' });
      expect(obj.profile.name).toBe('John'); // Original unchanged
    });

    it('setValueAtPath creates nested objects if needed', () => {
      const obj: Record<string, unknown> = {};
      const result = setValueAtPath(obj, 'profile.settings.theme', 'dark');

      expect(result).toEqual({ profile: { settings: { theme: 'dark' } } });
    });
  });

  describe('AutoForm with nested objects', () => {
    it('renders nested object fields', () => {
      const schema = z.object({
        name: z.string(),
        profile: z.object({
          bio: z.string().describe('Biography'),
        }),
      });

      render(<AutoForm schema={schema} />);

      // Should have both top-level and nested fields
      expect(screen.getByRole('textbox', { name: /name/i })).toBeInTheDocument();
      expect(screen.getByText('Profile')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /biography/i })).toBeInTheDocument();
    });

    it('uses nested default values', () => {
      const schema = z.object({
        profile: z.object({
          name: z.string().default('Default Name'),
        }),
      });

      render(<AutoForm schema={schema} />);

      expect(screen.getByDisplayValue('Default Name')).toBeInTheDocument();
    });

    it('calls onChange with nested data structure', async () => {
      const schema = z.object({
        profile: z.object({
          name: z.string(),
        }),
      });
      const onChange = vi.fn();

      render(<AutoForm schema={schema} onChange={onChange} />);

      // Find the nested input and type in it
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Test Name' } });

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(
          expect.objectContaining({
            profile: expect.objectContaining({
              name: 'Test Name',
            }),
          })
        );
      });
    });

    it('validates nested fields on submit', async () => {
      const schema = z.object({
        profile: z.object({
          name: z.string().min(3, 'Name must be at least 3 characters'),
        }),
      });
      const onSubmit = vi.fn();

      render(<AutoForm schema={schema} onSubmit={onSubmit} withSubmit />);

      // Type a short name
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'ab' } });

      // Try to submit
      fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          'Name must be at least 3 characters'
        );
      });

      expect(onSubmit).not.toHaveBeenCalled();
    });
  });
});
