import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());

const registryPath = path.join(repoRoot, 'src', 'state', 'assumptionsRegistry.json');
const outPath = path.join(repoRoot, 'docs', 'assumptions-registry.md');

const raw = fs.readFileSync(registryPath, 'utf8');
const items = JSON.parse(raw);

const byTab = new Map();
for (const item of items) {
  const tab = String(item.tab ?? 'unknown');
  if (!byTab.has(tab)) byTab.set(tab, []);
  byTab.get(tab).push(item);
}

const tabOrder = [
  'worldModel',
  'incomeSetup',
  'depositStrategy',
  'simulatorTax',
  'withdrawalStrategy',
  'policyBuilder',
  'milestones',
  'goalPlanner',
  'salaryTaxator',
  'moneyPerspective',
];

const title = '# Assumptions Registry\n\n';
const intro =
  'This file is generated from `src/state/assumptionsRegistry.json`.\n' +
  'It documents the “authority layer” assumptions: keys, defaults, and consumers.\n\n';

let md = title + intro;

const renderItem = (x) => {
  const key = String(x.keyPath ?? '');
  const label = String(x.label ?? '');
  const unit = String(x.unit ?? '');
  const def = JSON.stringify(x.default);
  const usedBy = Array.isArray(x.usedBy) ? x.usedBy.map(String).join(', ') : '';
  const overr = x.overrideableByStrategy ? 'yes' : 'no';
  return `- **${key}** — ${label}\n  - Default: ${def} (${unit})\n  - Used by: ${usedBy || '—'}\n  - Overrideable by strategy: ${overr}\n`;
};

const tabs = Array.from(byTab.keys());
const orderedTabs = [...tabOrder.filter((t) => tabs.includes(t)), ...tabs.filter((t) => !tabOrder.includes(t))];

for (const tab of orderedTabs) {
  const list = byTab.get(tab) ?? [];
  if (list.length === 0) continue;
  md += `\n## ${tab}\n\n`;
  for (const item of list) md += renderItem(item) + '\n';
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, md, 'utf8');

console.log(`Wrote ${path.relative(repoRoot, outPath)} (${items.length} items)`);
