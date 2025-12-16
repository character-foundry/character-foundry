import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { z } from 'zod';
import { AutoForm } from '../autoform/AutoForm';

describe('AutoForm', () => {
  it('renders fields based on schema', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });

    render(<AutoForm schema={schema} />);

    // Check inputs by their name attribute
    expect(screen.getByRole('textbox', { name: /name/i })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /age/i })).toBeInTheDocument();
  });

  it('renders boolean as switch', () => {
    const schema = z.object({
      enabled: z.boolean(),
    });

    render(<AutoForm schema={schema} />);

    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('renders small enum as radio group', () => {
    const schema = z.object({
      role: z.enum(['admin', 'user']),
    });

    render(<AutoForm schema={schema} />);

    // Enum with ≤4 options renders as radio group
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  it('renders large enum as select', () => {
    const schema = z.object({
      color: z.enum(['red', 'green', 'blue', 'yellow', 'orange', 'purple']),
    });

    render(<AutoForm schema={schema} />);

    // Enum with >4 options renders as select
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('shows submit button when withSubmit is true', () => {
    const schema = z.object({ name: z.string() });

    render(<AutoForm schema={schema} withSubmit submitText="Save" />);

    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('hides submit button when withSubmit is false', () => {
    const schema = z.object({ name: z.string() });

    render(<AutoForm schema={schema} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('uses default values from schema', () => {
    const schema = z.object({
      name: z.string().default('Default Name'),
    });

    render(<AutoForm schema={schema} />);

    expect(screen.getByDisplayValue('Default Name')).toBeInTheDocument();
  });

  it('uses provided defaultValues', () => {
    const schema = z.object({
      name: z.string(),
    });

    render(<AutoForm schema={schema} defaultValues={{ name: 'John' }} />);

    expect(screen.getByDisplayValue('John')).toBeInTheDocument();
  });

  it('respects field order', () => {
    const schema = z.object({
      a: z.string(),
      b: z.string(),
      c: z.string(),
    });

    const { container } = render(
      <AutoForm schema={schema} fieldOrder={['c', 'a', 'b']} />
    );

    const inputs = container.querySelectorAll('input');
    expect(inputs[0]).toHaveAttribute('name', 'c');
    expect(inputs[1]).toHaveAttribute('name', 'a');
    expect(inputs[2]).toHaveAttribute('name', 'b');
  });

  it('hides fields with hidden hint', () => {
    const schema = z.object({
      visible: z.string(),
      hidden: z.string(),
    });

    const { container } = render(
      <AutoForm
        schema={schema}
        uiHints={{ hidden: { hidden: true } }}
      />
    );

    const inputs = container.querySelectorAll('input');
    expect(inputs.length).toBe(1);
    expect(inputs[0]).toHaveAttribute('name', 'visible');
  });

  it('disables all fields when disabled prop is true', () => {
    const schema = z.object({
      name: z.string(),
    });

    render(<AutoForm schema={schema} disabled />);

    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('calls onChange with validated data', async () => {
    const schema = z.object({
      name: z.string(),
    });
    const onChange = vi.fn();

    render(<AutoForm schema={schema} onChange={onChange} />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Test' },
    });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Test' })
      );
    });
  });

  it('calls onSubmit with validated data', async () => {
    const schema = z.object({
      name: z.string().min(1),
    });
    const onSubmit = vi.fn();

    render(
      <AutoForm
        schema={schema}
        defaultValues={{ name: 'Test' }}
        onSubmit={onSubmit}
        withSubmit
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ name: 'Test' });
    });
  });

  it('shows validation errors', async () => {
    const schema = z.object({
      name: z.string().min(3, 'Name must be at least 3 characters'),
    });

    render(<AutoForm schema={schema} withSubmit />);

    // Type a short name
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'ab' },
    });

    // Try to submit
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Name must be at least 3 characters'
      );
    });
  });

  it('renders password input for secret fields', () => {
    const schema = z.object({
      apiKey: z.string().describe('Your API Key'),
    });

    const { container } = render(<AutoForm schema={schema} />);

    // SecretInput renders with type="password"
    const input = container.querySelector('input[type="password"]');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('name', 'apiKey');
  });

  it('renders children with fields and submit', () => {
    const schema = z.object({
      name: z.string(),
    });

    render(
      <AutoForm schema={schema} withSubmit>
        {({ fields, submit }) => (
          <div>
            <div data-testid="fields">{fields}</div>
            <div data-testid="submit">{submit}</div>
          </div>
        )}
      </AutoForm>
    );

    expect(screen.getByTestId('fields').querySelector('input')).toBeInTheDocument();
    expect(screen.getByTestId('submit').querySelector('button')).toBeInTheDocument();
  });
});
