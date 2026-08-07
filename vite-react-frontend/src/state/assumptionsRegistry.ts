import rawRegistry from './assumptionsRegistry.json';

export type AssumptionsTabId =
  | 'worldModel'
  | 'passiveStrategy'
  | 'execution'
  | 'fireSimulator'
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
  | 'decimal'
  | 'pct'
  | 'dkk'
  | 'dkkPerMonth'
  | 'dkkPerYear'
  | 'hoursPerMonth'
  | 'months'
  | 'years'
  | 'count'
  | 'enum'
  | 'json';

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

export const ASSUMPTIONS_TAB_LABELS: Record<AssumptionsTabId, string> = {
  worldModel: 'World Model',
  passiveStrategy: 'Passive Strategy',
  execution: 'Execution',
  fireSimulator: 'FIRE Simulator',
  simulatorTax: 'Simulator Tax',
  salaryTaxator: 'Salary Taxator',
  moneyPerspective: 'Money Perspective',
  incomeSetup: 'Income Setup',
  depositStrategy: 'Deposit Strategy',
  withdrawalStrategy: 'Withdrawal Strategy',
  policyBuilder: 'Policy Builder',
  milestones: 'FIRE Milestones',
  goalPlanner: 'Goal Planner',
};

const REGISTRY_ENUM_OPTIONS: Record<string, string[]> = {
  'incomeSetupDefaults.incomeModelType': ['grossFirst', 'netFirst'],
  'incomeSetupDefaults.referenceSalaryPeriod': ['hourly', 'daily', 'weekly', 'biweekly', 'monthly', 'yearly'],
  'incomeSetupDefaults.bonusFrequency': ['none', 'yearly', 'monthly'],
  'incomeSetupDefaults.taxRegime': ['DK', 'none'],

  'fireSimulatorDefaults.overallTaxRule': ['CAPITAL', 'NOTIONAL'],
  'fireSimulatorDefaults.templateId': ['custom', 'starter', 'aktiesparekonto', 'aktiedepot', 'pension', 'childSavings'],
  'fireSimulatorDefaults.returnEngine.returnType': ['dataDrivenReturn', 'distributionReturn', 'simpleReturn'],
  'fireSimulatorDefaults.returnEngine.distributionType': ['normal', 'brownianMotion', 'studentT', 'regimeBased'],

  'depositStrategyDefaults.depositTiming': ['startOfMonth', 'endOfMonth'],
  'depositStrategyDefaults.contributionCadence': ['monthly', 'yearly'],
  'depositStrategyDefaults.escalationMode': ['none', 'pctYearly', 'fixedDkkYearly'],
  'depositStrategyDefaults.routingPriority': ['buffer>debt>wrappers>taxable', 'buffer>goals>debt>wrappers>taxable'],

  'passiveStrategyDefaults.returnModel': ['fixed', 'normal', 'historical'],
  'passiveStrategyDefaults.rebalancing': ['none', 'annual', 'threshold'],

  'withdrawalStrategyDefaults.withdrawalRule': ['fixedPct', 'fixedReal', 'guardrails'],

  'policyBuilderDefaults.evaluationFrequency': ['monthly', 'quarterly', 'yearly'],
  'policyBuilderDefaults.conflictResolution': ['priority', 'mostConservative', 'firstMatch'],

  'fireMilestonesDefaults.confidenceTarget': ['P50', 'P90', 'P95'],
  'fireMilestonesDefaults.milestoneStability': ['instant', 'sustained'],

  'goalPlannerDefaults.fundingOrder': ['buffer>debt>goals>fi', 'buffer>goals>debt>fi'],
  'goalPlannerDefaults.goalInflationHandling': ['nominal', 'real'],
  'goalPlannerDefaults.goalRiskHandling': ['default', 'highCertainty'],
};

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

export const getRegistryEnumOptions = (keyPath: string): string[] | null => {
  const options = REGISTRY_ENUM_OPTIONS[keyPath];
  return options ? [...options] : null;
};

export const isNumericRegistryUnit = (unit: AssumptionUnitId): boolean => {
  return (
    unit === 'decimal' ||
    unit === 'pct' ||
    unit === 'dkk' ||
    unit === 'dkkPerMonth' ||
    unit === 'dkkPerYear' ||
    unit === 'hoursPerMonth' ||
    unit === 'months' ||
    unit === 'years' ||
    unit === 'count'
  );
};

export const listScenarioOverrideRegistryItems = (): AssumptionRegistryItem[] => {
  return ASSUMPTIONS_REGISTRY.filter((item) => item.tab !== 'execution');
};

export const listStrategyRegistryItems = (tab: AssumptionsTabId): AssumptionRegistryItem[] => {
  return listRegistryByTab(tab).filter((item) => item.keyPath !== 'currency');
};

export const listRegistryItemsByUsedBy = (
  usedByLabel: string,
  options?: { tabs?: AssumptionsTabId[]; excludeCurrency?: boolean }
): AssumptionRegistryItem[] => {
  const target = normalizeLabel(usedByLabel);
  const tabs = options?.tabs;

  return ASSUMPTIONS_REGISTRY.filter((item) => {
    if (options?.excludeCurrency && item.keyPath === 'currency') return false;
    if (tabs && tabs.length > 0 && !tabs.includes(item.tab)) return false;
    return item.usedBy.some((label) => normalizeLabel(label) === target);
  });
};
