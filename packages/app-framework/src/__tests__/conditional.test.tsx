import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { z } from 'zod';
import { AutoForm } from '../autoform/AutoForm';

describe('Conditional Fields', () => {
  describe('equals condition', () => {
    it('shows field when condition is met', async () => {
      const schema = z.object({
        showAdvanced: z.boolean().default(false),
        advancedOption: z.string().optional(),
      });

      render(
        <AutoForm
          schema={schema}
          defaultValues={{ showAdvanced: true }}
          uiHints={{
            advancedOption: {
              condition: { field: 'showAdvanced', equals: true },
            },
          }}
        />
      );

      // Should be visible when showAdvanced is true
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('hides field when condition is not met', () => {
      const schema = z.object({
        showAdvanced: z.boolean().default(false),
        advancedOption: z.string().optional(),
      });

      render(
        <AutoForm
          schema={schema}
          defaultValues={{ showAdvanced: false }}
          uiHints={{
            advancedOption: {
              condition: { field: 'showAdvanced', equals: true },
            },
          }}
        />
      );

      // advancedOption should be hidden
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('toggles field visibility on value change', async () => {
      const schema = z.object({
        showAdvanced: z.boolean().default(false),
        advancedOption: z.string().optional(),
      });

      render(
        <AutoForm
          schema={schema}
          uiHints={{
            advancedOption: {
              condition: { field: 'showAdvanced', equals: true },
            },
          }}
        />
      );

      // Initially hidden
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

      // Toggle the switch
      const toggle = screen.getByRole('switch');
      fireEvent.click(toggle);

      // Should now be visible
      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });
    });
  });

  describe('notEquals condition', () => {
    it('shows field when value is not equal', () => {
      const schema = z.object({
        status: z.enum(['active', 'disabled']).default('active'),
        activeOption: z.string().optional(),
      });

      render(
        <AutoForm
          schema={schema}
          defaultValues={{ status: 'active' }}
          uiHints={{
            activeOption: {
              condition: { field: 'status', notEquals: 'disabled' },
            },
          }}
        />
      );

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('hides field when value equals notEquals', () => {
      const schema = z.object({
        status: z.enum(['active', 'disabled']).default('disabled'),
        activeOption: z.string().optional(),
      });

      render(
        <AutoForm
          schema={schema}
          defaultValues={{ status: 'disabled' }}
          uiHints={{
            activeOption: {
              condition: { field: 'status', notEquals: 'disabled' },
            },
          }}
        />
      );

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });
  });

  describe('oneOf condition', () => {
    it('shows field when value is one of the options', () => {
      const schema = z.object({
        kind: z.enum(['openai', 'anthropic', 'local']).default('openai'),
        apiKey: z.string().optional(),
      });

      render(
        <AutoForm
          schema={schema}
          defaultValues={{ kind: 'openai' }}
          uiHints={{
            apiKey: {
              condition: { field: 'kind', oneOf: ['openai', 'anthropic'] },
            },
          }}
        />
      );

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('hides field when value is not in oneOf', () => {
      const schema = z.object({
        kind: z.enum(['openai', 'anthropic', 'local']).default('local'),
        apiKey: z.string().optional(),
      });

      render(
        <AutoForm
          schema={schema}
          defaultValues={{ kind: 'local' }}
          uiHints={{
            apiKey: {
              condition: { field: 'kind', oneOf: ['openai', 'anthropic'] },
            },
          }}
        />
      );

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });
  });

  describe('custom when predicate', () => {
    it('uses custom predicate for complex conditions', () => {
      const schema = z.object({
        count: z.number().default(5),
        premium: z.string().optional(),
      });

      render(
        <AutoForm
          schema={schema}
          defaultValues={{ count: 10 }}
          uiHints={{
            premium: {
              condition: {
                field: 'count',
                when: (value) => typeof value === 'number' && value > 5,
              },
            },
          }}
        />
      );

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('hides field when custom predicate returns false', () => {
      const schema = z.object({
        count: z.number().default(3),
        premium: z.string().optional(),
      });

      render(
        <AutoForm
          schema={schema}
          defaultValues={{ count: 3 }}
          uiHints={{
            premium: {
              condition: {
                field: 'count',
                when: (value) => typeof value === 'number' && value > 5,
              },
            },
          }}
        />
      );

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });
  });
});
