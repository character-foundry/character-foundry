import { useState, useCallback, type ReactNode } from 'react';
import type { FieldGroupProps } from '../types/ui-hints';

/**
 * Headless field group component for organizing form sections.
 * Can be used standalone or with AutoForm's render prop.
 *
 * @example
 * ```tsx
 * // Standalone usage
 * <FieldGroup title="Basic Settings">
 *   <TextInput ... />
 *   <NumberInput ... />
 * </FieldGroup>
 *
 * // Collapsible group
 * <FieldGroup title="Advanced" collapsible defaultCollapsed>
 *   <Switch ... />
 * </FieldGroup>
 *
 * // With AutoForm render prop
 * <AutoForm schema={schema}>
 *   {({ getField }) => (
 *     <>
 *       <FieldGroup title="Profile">
 *         {getField('name')}
 *         {getField('email')}
 *       </FieldGroup>
 *       <FieldGroup title="Preferences" collapsible>
 *         {getField('theme')}
 *         {getField('notifications')}
 *       </FieldGroup>
 *     </>
 *   )}
 * </AutoForm>
 * ```
 */
export function FieldGroup({
  title,
  description,
  collapsible = false,
  defaultCollapsed = false,
  className,
  children,
}: FieldGroupProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const toggleCollapsed = useCallback(() => {
    if (collapsible) {
      setIsCollapsed((prev) => !prev);
    }
  }, [collapsible]);

  const headerId = `fieldgroup-${title.toLowerCase().replace(/\s+/g, '-')}`;
  const contentId = `${headerId}-content`;

  return (
    <fieldset
      className={className}
      data-fieldgroup
      data-collapsible={collapsible}
      data-collapsed={isCollapsed}
    >
      {collapsible ? (
        <legend>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-expanded={!isCollapsed}
            aria-controls={contentId}
            data-fieldgroup-toggle
          >
            <span data-fieldgroup-arrow aria-hidden="true">
              {isCollapsed ? '\u25B6' : '\u25BC'}
            </span>
            <span id={headerId} data-fieldgroup-title>
              {title}
            </span>
          </button>
        </legend>
      ) : (
        <legend id={headerId} data-fieldgroup-title>
          {title}
        </legend>
      )}

      {description && (
        <p data-fieldgroup-description>{description}</p>
      )}

      <div
        id={contentId}
        role="group"
        aria-labelledby={headerId}
        data-fieldgroup-content
        hidden={collapsible && isCollapsed}
      >
        {children}
      </div>
    </fieldset>
  );
}

/**
 * Props for the FieldSection component (alias for FieldGroup).
 */
export type FieldSectionProps = FieldGroupProps;

/**
 * Alias for FieldGroup with semantic naming.
 * Use when you prefer "section" terminology over "group".
 */
export const FieldSection = FieldGroup;
