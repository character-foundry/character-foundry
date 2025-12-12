// Types
export type {
  Extension,
  ExtensionState,
  ExtensionContext,
  ExtensionServices,
  ToastService,
  DialogService,
  EventBus,
  BuiltinWidget,
  FieldWidgetProps,
  FieldUIHint,
  FieldCondition,
  FieldGroupProps,
  UIHints,
  RegistryListener,
  RegistryItemBase,
} from './types';
export { noopServices } from './types';

// Registry
export {
  Registry,
  SettingsRegistry,
  settingsRegistry,
  ProviderRegistry,
  createProviderRegistry,
  WidgetRegistry,
  widgetRegistry,
  type SettingsPanel,
  type Provider,
  type WidgetComponent,
  type WidgetDefinition,
} from './registry';

// AutoForm
export {
  AutoForm,
  type AutoFormProps,
  analyzeSchema,
  analyzeField,
  flattenSchema,
  getDefaultWidgetType,
  isSecretField,
  isNestedObject,
  getValueAtPath,
  setValueAtPath,
  type FieldInfo,
  type FieldConstraints,
  FieldRenderer,
  type FieldRendererProps,
  FieldGroup,
  FieldSection,
  type FieldSectionProps,
  useWidgetRegistry,
  WidgetRegistryContext,
  // Widgets
  TextInput,
  Textarea,
  NumberInput,
  Switch,
  Select,
  SearchableSelect,
  TagInput,
  SecretInput,
  FileUpload,
  type FileUploadValue,
} from './autoform';
