import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Textarea } from '../autoform/widgets/Textarea';
import { SearchableSelect } from '../autoform/widgets/SearchableSelect';
import { FileUpload } from '../autoform/widgets/FileUpload';
import { FieldGroup } from '../autoform/FieldGroup';

describe('Textarea Widget', () => {
  it('renders a textarea element', () => {
    render(
      <Textarea
        value=""
        onChange={() => {}}
        name="bio"
        label="Biography"
      />
    );

    expect(screen.getByRole('textbox', { name: /biography/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveAttribute('name', 'bio');
  });

  it('respects rows hint', () => {
    const { container } = render(
      <Textarea
        value=""
        onChange={() => {}}
        name="bio"
        hint={{ rows: 8 }}
      />
    );

    const textarea = container.querySelector('textarea');
    expect(textarea).toHaveAttribute('rows', '8');
  });

  it('calls onChange when text is entered', () => {
    const onChange = vi.fn();
    render(
      <Textarea
        value=""
        onChange={onChange}
        name="bio"
      />
    );

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'New bio' } });

    expect(onChange).toHaveBeenCalledWith('New bio');
  });

  it('shows error message', () => {
    render(
      <Textarea
        value=""
        onChange={() => {}}
        name="bio"
        error="Bio is required"
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Bio is required');
  });
});

describe('SearchableSelect Widget', () => {
  const options = [
    { value: 'us', label: 'United States' },
    { value: 'uk', label: 'United Kingdom' },
    { value: 'ca', label: 'Canada' },
    { value: 'au', label: 'Australia' },
  ];

  it('renders with placeholder', () => {
    render(
      <SearchableSelect
        value=""
        onChange={() => {}}
        name="country"
        label="Country"
        hint={{ options, placeholder: 'Select a country' }}
      />
    );

    expect(screen.getByText('Select a country')).toBeInTheDocument();
  });

  it('opens dropdown on click', () => {
    render(
      <SearchableSelect
        value=""
        onChange={() => {}}
        name="country"
        hint={{ options }}
      />
    );

    // Click trigger button
    fireEvent.click(screen.getByRole('button'));

    // Options should be visible
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByText('United States')).toBeInTheDocument();
    expect(screen.getByText('United Kingdom')).toBeInTheDocument();
  });

  it('filters options on search', () => {
    render(
      <SearchableSelect
        value=""
        onChange={() => {}}
        name="country"
        hint={{ options }}
      />
    );

    // Open dropdown
    fireEvent.click(screen.getByRole('button'));

    // Type in search
    const searchInput = screen.getByRole('textbox');
    fireEvent.change(searchInput, { target: { value: 'united' } });

    // Should show filtered results
    expect(screen.getByText('United States')).toBeInTheDocument();
    expect(screen.getByText('United Kingdom')).toBeInTheDocument();
    expect(screen.queryByText('Canada')).not.toBeInTheDocument();
  });

  it('calls onChange when option selected', () => {
    const onChange = vi.fn();
    render(
      <SearchableSelect
        value=""
        onChange={onChange}
        name="country"
        hint={{ options }}
      />
    );

    // Open dropdown
    fireEvent.click(screen.getByRole('button'));

    // Click an option
    fireEvent.click(screen.getByText('Canada'));

    expect(onChange).toHaveBeenCalledWith('ca');
  });

  it('shows no results message', () => {
    render(
      <SearchableSelect
        value=""
        onChange={() => {}}
        name="country"
        hint={{ options, noResultsText: 'No countries found' }}
      />
    );

    // Open dropdown
    fireEvent.click(screen.getByRole('button'));

    // Search for non-existent option
    const searchInput = screen.getByRole('textbox');
    fireEvent.change(searchInput, { target: { value: 'xyz' } });

    expect(screen.getByText('No countries found')).toBeInTheDocument();
  });
});

describe('FileUpload Widget', () => {
  it('renders upload zone', () => {
    render(
      <FileUpload
        value={null}
        onChange={() => {}}
        name="avatar"
        label="Avatar"
      />
    );

    expect(screen.getByText(/click or drag files/i)).toBeInTheDocument();
  });

  it('shows selected file name', () => {
    const file = new File(['content'], 'test.png', { type: 'image/png' });
    render(
      <FileUpload
        value={file}
        onChange={() => {}}
        name="avatar"
      />
    );

    expect(screen.getByText('test.png')).toBeInTheDocument();
  });

  it('shows multiple files', () => {
    const files = [
      new File(['content1'], 'file1.png', { type: 'image/png' }),
      new File(['content2'], 'file2.jpg', { type: 'image/jpeg' }),
    ];
    render(
      <FileUpload
        value={files}
        onChange={() => {}}
        name="images"
        hint={{ multiple: true }}
      />
    );

    expect(screen.getByText('file1.png')).toBeInTheDocument();
    expect(screen.getByText('file2.jpg')).toBeInTheDocument();
  });

  it('has remove button for files', () => {
    const file = new File(['content'], 'test.png', { type: 'image/png' });
    const onChange = vi.fn();
    render(
      <FileUpload
        value={file}
        onChange={onChange}
        name="avatar"
      />
    );

    const removeButton = screen.getByRole('button', { name: /remove/i });
    fireEvent.click(removeButton);

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('shows custom placeholder', () => {
    render(
      <FileUpload
        value={null}
        onChange={() => {}}
        name="avatar"
        hint={{ placeholder: 'Drop your avatar here' }}
      />
    );

    expect(screen.getByText('Drop your avatar here')).toBeInTheDocument();
  });
});

describe('FieldGroup Component', () => {
  it('renders title and children', () => {
    render(
      <FieldGroup title="Basic Settings">
        <input type="text" placeholder="Name" />
        <input type="email" placeholder="Email" />
      </FieldGroup>
    );

    expect(screen.getByText('Basic Settings')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(
      <FieldGroup title="Advanced" description="Configure advanced options">
        <input type="text" />
      </FieldGroup>
    );

    expect(screen.getByText('Configure advanced options')).toBeInTheDocument();
  });

  it('supports collapsible mode', () => {
    render(
      <FieldGroup title="Collapsible Section" collapsible>
        <input type="text" placeholder="Content" />
      </FieldGroup>
    );

    // Should have toggle button
    const toggle = screen.getByRole('button');
    expect(toggle).toBeInTheDocument();

    // Content should be visible
    expect(screen.getByPlaceholderText('Content')).toBeInTheDocument();
  });

  it('starts collapsed when defaultCollapsed is true', () => {
    const { container } = render(
      <FieldGroup title="Collapsed" collapsible defaultCollapsed>
        <input type="text" placeholder="Hidden Content" />
      </FieldGroup>
    );

    // Content should be hidden (content container has hidden attribute)
    const content = container.querySelector('[data-fieldgroup-content]');
    expect(content).toHaveAttribute('hidden');
  });

  it('toggles collapsed state on click', () => {
    const { container } = render(
      <FieldGroup title="Toggle Test" collapsible defaultCollapsed>
        <input type="text" placeholder="Toggle Content" />
      </FieldGroup>
    );

    const content = container.querySelector('[data-fieldgroup-content]');

    // Click to expand
    const toggle = screen.getByRole('button');
    fireEvent.click(toggle);

    // Content should now be visible
    expect(content).not.toHaveAttribute('hidden');

    // Click to collapse
    fireEvent.click(toggle);

    // Content should be hidden again
    expect(content).toHaveAttribute('hidden');
  });
});
