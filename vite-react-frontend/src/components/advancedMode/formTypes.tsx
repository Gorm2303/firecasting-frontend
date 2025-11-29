// src/components/advanced/formTypes.ts

/**
 * All supported field kinds for the dynamic form engine.
 */
export type FieldType =
  | 'text'
  | 'number'
  | 'select'
  | 'checkbox'
  | 'date'
  | 'group'
  | 'array';

/**
 * A default value as it realistically comes from JSON.
 * We keep this reasonably broad because the backend is the source of truth.
 */
export type JsonDefault =
  | string
  | number
  | boolean
  | null
  | JsonDefault[]
  | { [key: string]: JsonDefault };

/**
 * Shared properties for all fields.
 */
export interface BaseFieldConfig {
  /** Unique identifier within the form (used as key in form state). */
  id: string;
  /** Human-readable label shown to the user. */
  label: string;
  /** Discriminator for the concrete field type. */
  type: FieldType;
  /** Optional helper text / description shown below or next to the field. */
  helpText?: string;
  /** Default value as delivered by backend config. */
  defaultValue?: JsonDefault;
  /** Whether this field should be considered required (for validation layer). */
  required?: boolean;
}

/**
 * A simple <option> for select fields.
 */
export interface OptionConfig {
  value: string;
  label: string;
}

export interface TextFieldConfig extends BaseFieldConfig {
  type: 'text';
  defaultValue?: string | null;
}

export interface NumberFieldConfig extends BaseFieldConfig {
  type: 'number';
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number | null;
}

export interface SelectFieldConfig extends BaseFieldConfig {
  type: 'select';
  options: OptionConfig[];
  defaultValue?: string | null;
}

export interface CheckboxFieldConfig extends BaseFieldConfig {
  type: 'checkbox';
  defaultValue?: boolean | null;
}

export interface DateFieldConfig extends BaseFieldConfig {
  type: 'date';
  defaultValue?: string | null; // ISO date string (YYYY-MM-DD)
}

/**
 * A nested object of fields.
 * Example in state: { [id]: { childId1: ..., childId2: ... } }
 */
export interface GroupFieldConfig extends BaseFieldConfig {
  type: 'group';
  children: FieldConfig[];
  defaultValue?: { [key: string]: JsonDefault } | null;
}

/**
 * An array of homogeneous group items.
 * Example in state: { [id]: [ { ...groupFields }, { ...groupFields }, ... ] }
 */
export interface ArrayFieldConfig extends BaseFieldConfig {
  type: 'array';
  /** Schema for a single item in the array (e.g. a Phase). */
  item: GroupFieldConfig;
  /** Minimum number of items to initialise with, if no defaultValue is provided. */
  minItems?: number;
  /** Maximum number of items the UI should allow. */
  maxItems?: number;
  defaultValue?: JsonDefault[] | null;
}

/**
 * Union of all supported field configurations.
 * Discriminated via the `type` property.
 */
export type FieldConfig =
  | TextFieldConfig
  | NumberFieldConfig
  | SelectFieldConfig
  | CheckboxFieldConfig
  | DateFieldConfig
  | GroupFieldConfig
  | ArrayFieldConfig;

/**
 * Top-level form descriptor delivered by backend.
 */
export interface FormConfig {
  /** Identifier for this form configuration. */
  id: string;
  /** Title displayed above the form. */
  title: string;
  /** Top-level fields in the form (groups/arrays can nest more). */
  fields: FieldConfig[];
}

// ---------------------------------------------------------------------------
// helpers to build initial state from config
// ---------------------------------------------------------------------------

/**
 * Build an initial value for a single field.
 * - Respects `defaultValue` when provided
 * - Falls back to type-appropriate defaults otherwise
 */
export function buildInitialValueForField(field: FieldConfig): any {
  switch (field.type) {
    case 'text':
    case 'date':
    case 'select': {
      if (field.defaultValue !== undefined && field.defaultValue !== null) {
        return field.defaultValue;
      }
      return '';
    }

    case 'number': {
      if (field.defaultValue !== undefined && field.defaultValue !== null) {
        return field.defaultValue;
      }
      return 0;
    }

    case 'checkbox': {
      if (field.defaultValue !== undefined && field.defaultValue !== null) {
        return field.defaultValue;
      }
      return false;
    }

    case 'group': {
      // If backend provides an explicit default object, trust it.
      if (field.defaultValue && typeof field.defaultValue === 'object') {
        return field.defaultValue;
      }
      const obj: Record<string, any> = {};
      field.children.forEach((child) => {
        obj[child.id] = buildInitialValueForField(child);
      });
      return obj;
    }

    case 'array': {
      // If backend provides a default array, use that directly.
      if (Array.isArray(field.defaultValue)) {
        return field.defaultValue;
      }

      const minItems = field.minItems ?? 0;
      const arr: any[] = [];
      for (let i = 0; i < minItems; i++) {
        arr.push(buildInitialValueForField(field.item));
      }
      return arr;
    }

    default:
      // Fallback for future types we might add.
      return null;
  }
}

/**
 * Build the full initial form state object from a FormConfig.
 * Result shape:
 *   {
 *     [field.id]: initialValueFromField,
 *     ...
 *   }
 */
export function buildInitialFormState(config: FormConfig): Record<string, any> {
  const state: Record<string, any> = {};

  config.fields.forEach((field) => {
    state[field.id] = buildInitialValueForField(field);
  });

  return state;
}
