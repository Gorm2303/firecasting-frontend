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

// ---------------------------------------------------------------------------
// visibility rules (dependency-free)
// ---------------------------------------------------------------------------

export type VisibleWhen =
  | { all: VisibleWhen[] }
  | { any: VisibleWhen[] }
  | { not: VisibleWhen }
  | { path: string; equals: JsonDefault }
  | { path: string; notEquals: JsonDefault }
  | { path: string; in: JsonDefault[] }
  | { path: string; notIn: JsonDefault[] }
  | { path: string; truthy: true }
  | { path: string; falsy: true }
  | { path: string; gt: number }
  | { path: string; gte: number }
  | { path: string; lt: number }
  | { path: string; lte: number };

export type VisibilityContext = {
  /** Root form state (for absolute paths starting with `$.`). */
  root: any;
  /** Current object scope (group object / array item). */
  current: any;
};

const getByPath = (obj: any, path: string): any => {
  if (!path) return undefined;
  const parts = path.split('.').filter(Boolean);
  let cur: any = obj;
  for (const part of parts) {
    if (cur == null) return undefined;
    cur = cur[part];
  }
  return cur;
};

const resolvePathValue = (ctx: VisibilityContext, path: string): any => {
  const p = String(path ?? '').trim();
  if (!p) return undefined;

  // `$.foo.bar` means absolute path from root
  if (p.startsWith('$.')) {
    return getByPath(ctx.root, p.slice(2));
  }

  // default: from current scope (group / item)
  return getByPath(ctx.current, p);
};

export function evaluateVisibleWhen(rule: VisibleWhen | undefined, ctx: VisibilityContext): boolean {
  if (!rule) return true;

  if ('all' in rule) {
    return (rule.all ?? []).every((r) => evaluateVisibleWhen(r, ctx));
  }
  if ('any' in rule) {
    return (rule.any ?? []).some((r) => evaluateVisibleWhen(r, ctx));
  }
  if ('not' in rule) {
    return !evaluateVisibleWhen(rule.not, ctx);
  }

  const actual = resolvePathValue(ctx, (rule as any).path);

  if ('equals' in rule) return actual === rule.equals;
  if ('notEquals' in rule) return actual !== rule.notEquals;
  if ('in' in rule) return Array.isArray(rule.in) ? rule.in.includes(actual as any) : false;
  if ('notIn' in rule) return Array.isArray(rule.notIn) ? !rule.notIn.includes(actual as any) : true;
  if ('truthy' in rule) return Boolean(actual);
  if ('falsy' in rule) return !Boolean(actual);

  const n = Number(actual);
  if ('gt' in rule) return Number.isFinite(n) && n > rule.gt;
  if ('gte' in rule) return Number.isFinite(n) && n >= rule.gte;
  if ('lt' in rule) return Number.isFinite(n) && n < rule.lt;
  if ('lte' in rule) return Number.isFinite(n) && n <= rule.lte;

  return true;
}

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
  /** Optional rule that determines if the field is visible. */
  visibleWhen?: VisibleWhen;
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
      const obj: Record<string, any> = {};
      field.children.forEach((child) => {
        obj[child.id] = buildInitialValueForField(child);
      });

      // If backend provides an explicit default object, merge it on top so missing
      // keys still get proper defaults.
      if (field.defaultValue && typeof field.defaultValue === 'object' && !Array.isArray(field.defaultValue)) {
        return { ...obj, ...(field.defaultValue as any) };
      }
      return obj;
    }

    case 'array': {
      // If backend provides a default array, use that directly.
      if (Array.isArray(field.defaultValue)) {
        return field.defaultValue.map((item) => {
          const base = buildInitialValueForField(field.item);
          if (item && typeof item === 'object' && !Array.isArray(item)) {
            return { ...base, ...(item as any) };
          }
          return item;
        });
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
