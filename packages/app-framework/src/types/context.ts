/**
 * Restricted context object passed to extensions during activation.
 * Provides access to configuration and core services.
 */
export interface ExtensionContext<TConfig> {
  /** Current configuration (validated) */
  readonly config: TConfig;

  /** Update configuration (triggers re-validation) */
  setConfig: (update: Partial<TConfig>) => void;

  /** Core services available to extensions */
  services: ExtensionServices;
}

/**
 * Core services available to all extensions
 */
export interface ExtensionServices {
  /** Toast notification service */
  toast: ToastService;

  /** Modal dialog service */
  dialog: DialogService;

  /** Event bus for cross-extension communication */
  events: EventBus;
}

/**
 * Toast notification service interface
 */
export interface ToastService {
  /** Show success message */
  success(message: string): void;

  /** Show error message */
  error(message: string): void;

  /** Show info message */
  info(message: string): void;

  /** Show warning message */
  warning(message: string): void;
}

/**
 * Modal dialog service interface
 */
export interface DialogService {
  /** Show confirmation dialog, returns true if confirmed */
  confirm(message: string, title?: string): Promise<boolean>;

  /** Show alert dialog */
  alert(message: string, title?: string): Promise<void>;

  /** Show prompt dialog, returns input value or null if cancelled */
  prompt(message: string, defaultValue?: string): Promise<string | null>;
}

/**
 * Event bus for cross-extension communication
 */
export interface EventBus {
  /** Emit an event with optional payload */
  emit(event: string, payload?: unknown): void;

  /** Subscribe to an event, returns unsubscribe function */
  on(event: string, handler: (payload: unknown) => void): () => void;

  /** Subscribe to an event once */
  once(event: string, handler: (payload: unknown) => void): () => void;
}

/**
 * No-op implementations of services for testing or standalone usage
 */
export const noopServices: ExtensionServices = {
  toast: {
    success: () => {},
    error: () => {},
    info: () => {},
    warning: () => {},
  },
  dialog: {
    confirm: async () => false,
    alert: async () => {},
    prompt: async () => null,
  },
  events: {
    emit: () => {},
    on: () => () => {},
    once: () => () => {},
  },
};
