import { describe, expect, it } from 'vitest';

import { loadAssumptionsGovernance, saveAssumptionsGovernance } from './assumptionsGovernance';

const key = 'firecasting:assumptionsGovernance:v1';

describe('assumptionsGovernance', () => {
  it('defaults when storage empty', () => {
    window.localStorage.removeItem(key);
    expect(loadAssumptionsGovernance()).toEqual({ sourceNote: '', lockBaseline: false, updatedAt: '' });
  });

  it('can save and reload', () => {
    window.localStorage.removeItem(key);

    const now = new Date().toISOString();
    saveAssumptionsGovernance({ sourceNote: 'From X', lockBaseline: true, updatedAt: now });

    expect(loadAssumptionsGovernance()).toEqual({ sourceNote: 'From X', lockBaseline: true, updatedAt: now });
  });
});
