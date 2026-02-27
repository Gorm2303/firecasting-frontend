import rawRegistry from './conventionsRegistry.json';

export type ConventionGroupId = 'timing';

export type ConventionRegistryItem = {
  id: string;
  group: ConventionGroupId;
  label: string;
  token: string;
  description: string;
  usedBy: string[];
};

export const CONVENTIONS_REGISTRY: ConventionRegistryItem[] = rawRegistry as ConventionRegistryItem[];

export const listConventionsByGroup = (group: ConventionGroupId): ConventionRegistryItem[] =>
  CONVENTIONS_REGISTRY.filter((x) => x.group === group);

export const requireConventionToken = (id: string): string => {
  const item = CONVENTIONS_REGISTRY.find((x) => x.id === id);
  if (!item) throw new Error(`Missing convention token: ${id}`);
  return item.token;
};
