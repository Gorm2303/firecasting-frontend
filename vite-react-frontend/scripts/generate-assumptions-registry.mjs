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
  'execution',
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

const filterUsedBy = (usedBy) => {
  const isHubInternal = (label) => {
    const normalized = String(label).replace(/\s+/g, '').toLowerCase();
    return normalized.includes('assumptionshub') || normalized.includes('assumptionssummarybar');
  };

  const cleaned = Array.isArray(usedBy)
    ? usedBy
        .map((x) => String(x).trim())
        .filter(Boolean)
        .filter((x) => !isHubInternal(x))
    : [];

  return Array.from(new Set(cleaned)).sort((a, b) => a.localeCompare(b));
};

const renderItem = (x) => {
  const key = String(x.keyPath ?? '');
  const label = String(x.label ?? '');
  const unit = String(x.unit ?? '');
  const def = JSON.stringify(x.default);
  const usedBy = filterUsedBy(x.usedBy).join(', ');
  const overr = x.overrideableByStrategy ? 'yes' : 'no';
  return `- **${key}** — ${label}\n  - Default: ${def} (${unit})\n  - Used by: ${usedBy || '—'}\n  - Overrideable by strategy: ${overr}\n`;
};

const tabs = Array.from(byTab.keys());
const orderedTabs = [...tabOrder.filter((t) => tabs.includes(t)), ...tabs.filter((t) => !tabOrder.includes(t))];

for (const tab of orderedTabs) {
  const list = byTab.get(tab) ?? [];
  if (list.length === 0) continue;
  md += `\n## ${tab}\n\n`;
  const sorted = [...list].sort((a, b) => String(a.keyPath ?? '').localeCompare(String(b.keyPath ?? '')));
  for (const item of sorted) md += renderItem(item) + '\n';
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, md, 'utf8');

console.log(`Wrote ${path.relative(repoRoot, outPath)} (${items.length} items)`);
