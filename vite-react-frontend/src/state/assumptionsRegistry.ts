import rawRegistry from './assumptionsRegistry.json';

export type AssumptionsTabId =
  | 'worldModel'
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

export const listRegistryByTab = (tab: AssumptionsTabId): AssumptionRegistryItem[] =>
  ASSUMPTIONS_REGISTRY.filter((x) => x.tab === tab);
