import { describe, expect, it } from 'vitest';

import type { AssumptionRegistryItem, AssumptionUnitId } from './assumptionsRegistry';
import { ASSUMPTIONS_REGISTRY, normalizeUsedByLabels } from './assumptionsRegistry';
import { getDefaultAssumptions } from './assumptions';
import { getDefaultExecutionDefaults } from './executionDefaults';

const getByPath = (obj: unknown, segments: string[]): unknown => {
  let cur: any = obj;
  for (const s of segments) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = (cur as any)[s];
  }
  return cur;
};

const listLeafPaths = (obj: unknown, prefix = ''): string[] => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return prefix ? [prefix] : [];

  const out: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const next = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out.push(...listLeafPaths(v, next));
    } else {
      out.push(next);
    }
  }
  return out;
};

const normalizeUsedBy = (usedBy: unknown): string[] => {
  if (!Array.isArray(usedBy)) return [];
  return normalizeUsedByLabels(usedBy.map((x) => String(x)));
};

const assertUnitMatchesDefaultType = (unit: AssumptionUnitId, def: unknown) => {
  const numericUnits: ReadonlySet<AssumptionUnitId> = new Set([
    'pct',
    'dkk',
    'dkkPerMonth',
    'dkkPerYear',
    'hoursPerMonth',
    'months',
    'years',
    'count',
  ]);

  const integerUnits: ReadonlySet<AssumptionUnitId> = new Set(['hoursPerMonth', 'months', 'years', 'count']);

  if (unit === 'boolean') {
    expect(typeof def).toBe('boolean');
    return;
  }

  if (unit === 'string' || unit === 'enum') {
    expect(typeof def).toBe('string');
    expect(String(def).trim().length).toBeGreaterThan(0);
    return;
  }

  if (numericUnits.has(unit)) {
    expect(typeof def).toBe('number');
    expect(Number.isFinite(def as number)).toBe(true);
    if (integerUnits.has(unit)) expect(Number.isInteger(def as number)).toBe(true);
    return;
  }

  // Exhaustiveness check (keeps this test honest if units expand)
  const _exhaustive: never = unit;
  expect(_exhaustive).toBe(unit);
};

const resolveDefaultFromAppState = (item: AssumptionRegistryItem): unknown => {
  const keyPath = String(item.keyPath);

  if (keyPath.startsWith('executionDefaults.')) {
    expect(item.tab).toBe('execution');
    const segs = keyPath.replace(/^executionDefaults\./, '').split('.').filter(Boolean);
    return getByPath(getDefaultExecutionDefaults(), segs);
  }

  expect(item.tab).not.toBe('execution');
  const segs = keyPath.split('.').filter(Boolean);
  return getByPath(getDefaultAssumptions(), segs);
};

describe('assumptionsRegistry completeness', () => {
  it('has unique keyPaths and well-formed items', () => {
    const keyPaths = ASSUMPTIONS_REGISTRY.map((x) => x.keyPath);
    expect(keyPaths.length).toBeGreaterThan(0);

    const trimmed = keyPaths.map((k) => String(k).trim());
    expect(trimmed).toEqual(keyPaths);

    const unique = new Set(keyPaths);
    expect(unique.size).toBe(keyPaths.length);

    for (const item of ASSUMPTIONS_REGISTRY) {
      expect(String(item.keyPath).trim().length).toBeGreaterThan(0);
      expect(String(item.label).trim().length).toBeGreaterThan(0);
      expect(item.overrideableByStrategy === true || item.overrideableByStrategy === false).toBe(true);

      const usedByNormalized = normalizeUsedBy(item.usedBy);
      expect(usedByNormalized).toEqual(item.usedBy);

      const appDefault = resolveDefaultFromAppState(item);
      expect(appDefault).not.toBeUndefined();
      expect(appDefault).toEqual(item.default);

      assertUnitMatchesDefaultType(item.unit, item.default);
    }
  });

  it('covers every default leaf path for assumptions and execution defaults', () => {
    const registryKeyPaths = new Set(ASSUMPTIONS_REGISTRY.map((x) => x.keyPath));

    const expectedAssumptions = listLeafPaths(getDefaultAssumptions());
    const expectedExecution = listLeafPaths(getDefaultExecutionDefaults()).map((p) => `executionDefaults.${p}`);

    const expectedAll = new Set([...expectedAssumptions, ...expectedExecution]);

    // Missing from registry
    const missing = [...expectedAll].filter((p) => !registryKeyPaths.has(p));
    expect(missing).toEqual([]);

    // Extra in registry (not present in default state)
    const extra = [...registryKeyPaths].filter((p) => !expectedAll.has(p));
    expect(extra).toEqual([]);
  });
});
