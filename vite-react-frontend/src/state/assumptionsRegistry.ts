import rawRegistry from './assumptionsRegistry.json';

export type AssumptionsTabId =
  | 'worldModel'
  | 'passiveStrategy'
  | 'execution'
  | 'simulatorTax'
  | 'salaryTaxator'
  | 'moneyPerspective'
  | 'incomeSetup'
  | 'depositStrategy'
  | 'withdrawalStrategy'
  | 'policyBuilder'
  | 'milestones'
  | 'goalPlanner';

export type AssumptionUnitId =
  | 'string'
  | 'boolean'
  | 'pct'
  | 'dkk'
  | 'dkkPerMonth'
  | 'dkkPerYear'
  | 'hoursPerMonth'
  | 'months'
  | 'years'
  | 'count'
  | 'enum';

export type AssumptionRegistryItem = {
  keyPath: string;
  tab: AssumptionsTabId;
  label: string;
  unit: AssumptionUnitId;
  default: unknown;
  usedBy: string[];
  overrideableByStrategy: boolean;
};

export const ASSUMPTIONS_REGISTRY: AssumptionRegistryItem[] = rawRegistry as AssumptionRegistryItem[];

const normalizeLabel = (label: string): string => String(label).replace(/\s+/g, '').toLowerCase();

export const normalizeUsedByLabels = (usedBy: string[]): string[] => {
  const cleaned = usedBy.map((x) => String(x).trim()).filter(Boolean);
  return Array.from(new Set(cleaned));
};

export const filterUsedByForAssumptionsHub = (usedBy: string[]): string[] => {
  const isHubInternal = (label: string): boolean => {
    const normalized = normalizeLabel(label);
    return normalized.includes('assumptionshub') || normalized.includes('assumptionssummarybar');
  };

  return normalizeUsedByLabels(usedBy).filter((x) => !isHubInternal(x));
};

export const listRegistryByTab = (tab: AssumptionsTabId): AssumptionRegistryItem[] =>
  ASSUMPTIONS_REGISTRY.filter((x) => x.tab === tab);
