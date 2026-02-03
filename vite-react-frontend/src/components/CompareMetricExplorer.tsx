import React, { useMemo, useState } from 'react';
import type { MetricSummary, MetricSummaryScope } from '../api/simulation';
import { metricColor } from '../utils/metricColors';

type Band = { p5: number | null; p50: number | null; p95: number | null };

type PercentileKey = 'p5' | 'p10' | 'p25' | 'p50' | 'p75' | 'p90' | 'p95';
const percentileKeys: PercentileKey[] = ['p5', 'p10', 'p25', 'p50', 'p75', 'p90', 'p95'];

type MetricExplorerRow = {
	key: string;
	scope: MetricSummaryScope;
	phaseName: string | null;
	year: number | null;
	metric: string;
	aSummary: MetricSummary | null;
	bSummary: MetricSummary | null;
	aBand: Band;
	bBand: Band;
	aWidth: number | null;
	bWidth: number | null;
	searchText: string;
};

type Props = {
	a: MetricSummary[];
	b?: MetricSummary[] | null;
	mode?: 'diff' | 'single';
	aLabel?: string;
	bLabel?: string;
	onOpenGroup?: (groupId: string) => void;
};

type GroupMode = 'none' | 'year' | 'phase' | 'metric';

type TabMode = 'overview' | 'explorer';
type OverviewSort = 'p50Desc' | 'p50Asc' | 'spreadDesc' | 'spreadAsc' | 'skewDesc' | 'skewAsc';
type OverviewSeries = 'a' | 'b' | 'delta';

const formatMoney0 = (v: number | null | undefined): string => {
	if (v === null || v === undefined) return '—';
	const n = Number(v);
	if (!Number.isFinite(n)) return '—';
	return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);
};

const formatInflation = (v: number | null | undefined): string => {
	if (v === null || v === undefined) return '—';
	const n = Number(v);
	if (!Number.isFinite(n)) return '—';
	return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(n);
};

const formatPercent2 = (v: number | null | undefined): string => {
	if (v === null || v === undefined) return '—';
	const n = Number(v);
	if (!Number.isFinite(n)) return '—';
	return `${n.toFixed(2)}%`;
};

const formatMetricValue = (metricName: string, v: number | null | undefined): string => {
	const m = String(metricName || '').toLowerCase();
	if (m === 'inflation') return formatInflation(v);
	if (m.includes('percentage') || m.includes('percent') || m.endsWith('pct')) return formatPercent2(v);
	return formatMoney0(v);
};

const fmtSigned = (metricName: string, v: number | null): string => {
	if (v === null || v === undefined) return '—';
	const n = Number(v);
	if (!Number.isFinite(n)) return '—';
	const prefix = n >= 0 ? '+' : '';
	return `${prefix}${formatMetricValue(metricName, n)}`;
};

const coloredValue = (metricName: string, value: React.ReactNode, opts: { bold?: boolean } = {}): React.ReactNode => {
	const c = metricColor(metricName);
	if (!c) return value;
	return (
		<span style={{ color: c, fontWeight: opts.bold ? 900 : 700 }}>
			{value}
		</span>
	);
};

const heatmapChip = (metricName: string, value: React.ReactNode, opts: { bold?: boolean } = {}): React.ReactNode => {
	const c = metricColor(metricName);
	return (
		<span
			style={{
				display: 'inline-block',
				padding: '1px 7px',
				borderRadius: 999,
				background: 'rgba(0,0,0,0.45)',
				color: c ?? '#fff',
				fontWeight: opts.bold ? 900 : 700,
				lineHeight: 1.2,
			}}
		>
			{value}
		</span>
	);
};

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

const normPhaseName = (v: any): string | null => {
	const s = v === null || v === undefined ? '' : String(v);
	const t = s.trim();
	return t ? t.toLowerCase() : null;
};

const getPercentileValue = (m: MetricSummary | null, p: PercentileKey): number | null => {
	if (!m) return null;
	const v: any = (m as any)[p];
	const n = v === null || v === undefined ? null : Number(v);
	return n !== null && Number.isFinite(n) ? n : null;
};

const getBand = (m: MetricSummary | null | undefined): Band => {
	const p5 = m?.p5 === null || m?.p5 === undefined ? null : Number(m.p5);
	const p50 = m?.p50 === null || m?.p50 === undefined ? null : Number(m.p50);
	const p95 = m?.p95 === null || m?.p95 === undefined ? null : Number(m.p95);
	return {
		p5: Number.isFinite(p5 as any) ? (p5 as number) : null,
		p50: Number.isFinite(p50 as any) ? (p50 as number) : null,
		p95: Number.isFinite(p95 as any) ? (p95 as number) : null,
	};
};

const buildKey = (m: Pick<MetricSummary, 'scope' | 'phaseName' | 'year' | 'metric'>): string => {
	const scope = String(m.scope ?? '');
	const phase = normPhaseName(m.phaseName) ?? '';
	const year = m.year === null || m.year === undefined ? '' : String(m.year);
	const metric = String(m.metric ?? '').toLowerCase();
	return `${scope}|${phase}|${year}|${metric}`;
};

const groupIdFor = (row: Pick<MetricExplorerRow, 'scope' | 'phaseName' | 'year'>): string => {
	const phase = row.phaseName ?? '';
	if (row.scope === 'OVERALL_TOTAL') return 'OVERALL_TOTAL';
	if (row.scope === 'PHASE_TOTAL') return `PHASE_TOTAL|${phase}`;
	if (row.scope === 'YEARLY') return `YEARLY|${phase}|${row.year ?? ''}`;
	return `${String(row.scope)}|${phase}|${row.year ?? ''}`;
};

const groupLabelFor = (row: Pick<MetricExplorerRow, 'scope' | 'phaseName' | 'year'>): string => {
	const phase = row.phaseName ? String(row.phaseName) : '';
	if (row.scope === 'OVERALL_TOTAL') return 'OVERALL_TOTAL';
	if (row.scope === 'PHASE_TOTAL') return phase ? `PHASE_TOTAL / ${phase}` : 'PHASE_TOTAL';
	if (row.scope === 'YEARLY') {
		const y = row.year ?? null;
		if (phase) return `YEARLY / ${phase} / year ${y ?? '—'}`;
		return `YEARLY / year ${y ?? '—'}`;
	}
	return `${String(row.scope)}${phase ? ` / ${phase}` : ''}${row.year !== null ? ` / year ${row.year}` : ''}`;
};

const groupLabelForMode = (mode: GroupMode, row: Pick<MetricExplorerRow, 'scope' | 'phaseName' | 'year' | 'metric'>): string => {
	if (mode === 'none') return '';
	if (mode === 'metric') return String(row.metric || 'metric');
	if (mode === 'phase') return row.phaseName ? String(row.phaseName) : '— phase';
	if (mode === 'year') return row.year !== null ? `year ${row.year}` : '— year';
	// default
	return groupLabelFor(row);
};

const groupKeyForMode = (mode: GroupMode, row: Pick<MetricExplorerRow, 'scope' | 'phaseName' | 'year' | 'metric'>): string => {
	if (mode === 'none') return '';
	if (mode === 'metric') return `metric|${String(row.metric ?? '')}`;
	if (mode === 'phase') return `phase|${String(row.phaseName ?? '')}`;
	if (mode === 'year') return `year|${String(row.year ?? '')}`;
	return `spy|${groupIdFor(row)}`;
};

type VirtualizedProps<T> = {
	items: T[];
	height: number;
	rowHeight: number;
	overscan?: number;
	renderRow: (item: T, index: number) => React.ReactNode;
};

const VirtualizedList = <T,>({ items, height, rowHeight, overscan = 8, renderRow }: VirtualizedProps<T>) => {
	const [scrollTop, setScrollTop] = useState(0);

	const totalHeight = items.length * rowHeight;
	const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
	const endIndex = Math.min(items.length, Math.ceil((scrollTop + height) / rowHeight) + overscan);
	const visible = items.slice(startIndex, endIndex);

	return (
		<div
			style={{ height, overflowY: 'auto', border: '1px solid #333', borderRadius: 12, background: 'rgba(0,0,0,0.12)' }}
			onScroll={(e) => {
				const el = e.currentTarget;
				setScrollTop(el.scrollTop);
			}}
		>
			<div style={{ height: totalHeight, position: 'relative' }}>
				{visible.map((item, i) => {
					const idx = startIndex + i;
					return (
						<div key={idx} style={{ position: 'absolute', left: 0, right: 0, top: idx * rowHeight, height: rowHeight }}>
							{renderRow(item, idx)}
						</div>
					);
				})}
			</div>
		</div>
	);
};

type SortBy = 'absDeltaP50' | 'deltaP50' | 'deltaPct' | 'uncertaintyDelta' | 'yearAsc' | 'yearDesc';

const CompareMetricExplorer: React.FC<Props> = (props) => {
	const { a, b, mode, aLabel, bLabel } = props;
	const isDiffMode = (mode ?? ((b?.length ?? 0) > 0 ? 'diff' : 'single')) === 'diff';
	const runALabel = aLabel ?? (isDiffMode ? 'Run A' : 'Run');
	const runBLabel = bLabel ?? 'Run B';
	const bList = isDiffMode ? (b ?? []) : [];

	const [tab, setTab] = useState<TabMode>('overview');
	const [overviewSort, setOverviewSort] = useState<OverviewSort>('p50Desc');
	const [normalizePerMetric, setNormalizePerMetric] = useState(true);
	const [showBandLabels, setShowBandLabels] = useState(false);
	const [overviewSeries, setOverviewSeries] = useState<OverviewSeries>('delta');

	const [scopeView, setScopeView] = useState<MetricSummaryScope>('OVERALL_TOTAL');
	const [overviewPhase, setOverviewPhase] = useState<string>('');
	const [overviewYear, setOverviewYear] = useState<string>('');

	const [query, setQuery] = useState('');
	const [hideZeros, setHideZeros] = useState(true);
	const [groupMode, setGroupMode] = useState<GroupMode>('none');
	const [phaseFilter, setPhaseFilter] = useState<string>('');
	const [minYear, setMinYear] = useState<string>('');
	const [maxYear, setMaxYear] = useState<string>('');
	const [percentile, setPercentile] = useState<PercentileKey>('p50');
	const [sortBy, setSortBy] = useState<SortBy>('yearAsc');
	const [drawerPercentile, setDrawerPercentile] = useState<PercentileKey>('p50');

	const [selected, setSelected] = useState<MetricExplorerRow | null>(null);

	const activeOverviewSeries: OverviewSeries = isDiffMode ? overviewSeries : 'a';

	const rows = useMemo((): MetricExplorerRow[] => {
		const mapA = new Map<string, MetricSummary>();
		const mapB = new Map<string, MetricSummary>();
		for (const m of a ?? []) mapA.set(buildKey(m), m);
		for (const m of bList ?? []) mapB.set(buildKey(m), m);

		const keys = new Set<string>([...mapA.keys(), ...mapB.keys()]);
		const out: MetricExplorerRow[] = [];

		for (const key of keys) {
			const ma = mapA.get(key) ?? null;
			const mb = mapB.get(key) ?? null;
			const probe = (ma ?? mb) as MetricSummary | null;
			if (!probe) continue;

			const scope = probe.scope as MetricSummaryScope;
			const phase = normPhaseName(probe.phaseName);
			const year = probe.year === null || probe.year === undefined ? null : Number(probe.year);
			const metric = String(probe.metric ?? '').toLowerCase();

			const ba = getBand(ma);
			const bb = getBand(mb);

			const aWidth = ba.p5 !== null && ba.p95 !== null ? ba.p95 - ba.p5 : null;
			const bWidth = bb.p5 !== null && bb.p95 !== null ? bb.p95 - bb.p5 : null;

			const labelParts: string[] = [];
			labelParts.push(String(scope));
			if (phase) labelParts.push(phase);
			if (year !== null && Number.isFinite(year)) labelParts.push(`year ${year}`);
			labelParts.push(metric);

			out.push({
				key,
				scope,
				phaseName: phase,
				year: year !== null && Number.isFinite(year) ? year : null,
				metric,
				aSummary: ma,
				bSummary: mb,
				aBand: ba,
				bBand: bb,
				aWidth,
				bWidth,
				searchText: labelParts.join(' '),
			});
		}

		return out;
	}, [a, bList]);

	const deltas = useMemo(() => {
		const map = new Map<string, { aV: number | null; bV: number | null; delta: number | null; absDelta: number | null; deltaPct: number | null }>();
		for (const r of rows) {
			const aV = getPercentileValue(r.aSummary, percentile);
			const bV = isDiffMode ? getPercentileValue(r.bSummary, percentile) : null;
			const delta = isDiffMode && aV !== null && bV !== null ? bV - aV : null;
			const absDelta = isDiffMode ? (delta !== null ? Math.abs(delta) : null) : (aV !== null ? Math.abs(aV) : null);
			const deltaPct = isDiffMode && delta !== null && aV !== null && Math.abs(aV) > 1e-9 ? (delta / aV) * 100 : null;
			map.set(r.key, { aV, bV, delta, absDelta, deltaPct });
		}
		return map;
	}, [rows, percentile, isDiffMode]);

	const phases = useMemo(() => {
		const s = new Set<string>();
		for (const r of rows) {
			if (r.scope !== scopeView) continue;
			if (r.phaseName) s.add(r.phaseName);
		}
		return Array.from(s).sort((x, y) => x.localeCompare(y));
	}, [rows, scopeView]);

	const yearlyYearsByPhase = useMemo(() => {
		if (scopeView !== 'YEARLY') return new Map<string, number[]>();
		const m = new Map<string, Set<number>>();
		const all = new Set<number>();
		for (const r of rows) {
			if (r.scope !== 'YEARLY') continue;
			const ph = r.phaseName ?? '';
			const yr = r.year;
			if (yr === null) continue;
			const set = m.get(ph) ?? new Set<number>();
			set.add(yr);
			m.set(ph, set);
			all.add(yr);
		}
		const out = new Map<string, number[]>();
		for (const [ph, set] of m.entries()) {
			out.set(ph, Array.from(set.values()).sort((a, b) => a - b));
		}
		out.set('', Array.from(all.values()).sort((a, b) => a - b));
		return out;
	}, [rows, scopeView]);

	const effectiveOverviewPhase = useMemo(() => {
		if (scopeView === 'OVERALL_TOTAL') return '';
		const list = phases;
		if (scopeView === 'PHASE_TOTAL') {
			if (overviewPhase && list.includes(overviewPhase)) return overviewPhase;
			return list[0] ?? '';
		}
		if (!overviewPhase) return '';
		if (list.includes(overviewPhase)) return overviewPhase;
		return '';
	}, [overviewPhase, phases, scopeView]);

	const effectiveOverviewYear = useMemo(() => {
		if (scopeView !== 'YEARLY') return null;
		const years = yearlyYearsByPhase.get(effectiveOverviewPhase) ?? yearlyYearsByPhase.get('') ?? [];
		const n = overviewYear.trim() ? Number(overviewYear) : null;
		if (n !== null && Number.isFinite(n) && years.includes(n)) return n;
		return years.length ? years[0] : null;
	}, [overviewYear, yearlyYearsByPhase, effectiveOverviewPhase, scopeView]);

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		const minY = minYear.trim() ? Number(minYear) : null;
		const maxY = maxYear.trim() ? Number(maxYear) : null;

		const list = rows.filter((r) => {
			if (r.scope !== scopeView) return false;

			if (scopeView !== 'OVERALL_TOTAL') {
				if (phaseFilter && (r.phaseName ?? '') !== phaseFilter) return false;
			}

			if (scopeView === 'YEARLY') {
				if (minY !== null && r.year !== null && r.year < minY) return false;
				if (maxY !== null && r.year !== null && r.year > maxY) return false;
			}

			if (q && !r.searchText.includes(q)) return false;

			if (hideZeros) {
				const d = deltas.get(r.key)?.absDelta ?? null;
				if (d === null || d < 1e-9) return false;
			}

			return true;
		});

		const scopeOrder = (s: MetricSummaryScope): number => {
			if (s === 'OVERALL_TOTAL') return 0;
			if (s === 'PHASE_TOTAL') return 1;
			if (s === 'YEARLY') return 2;
			return 9;
		};

		const compareYears = (x: MetricExplorerRow, y: MetricExplorerRow, dir: 1 | -1): number => {
			const ax = x.year;
			const ay = y.year;
			if (ax === null && ay === null) return 0;
			if (ax === null) return 1;
			if (ay === null) return -1;
			if (ax !== ay) return (ax - ay) * dir;
			return 0;
		};

		const pick = (r: MetricExplorerRow): number => {
			const d = deltas.get(r.key);
			const abs = d?.absDelta ?? null;
			const signed = d?.delta ?? null;
			const pct = d?.deltaPct ?? null;
			const ud = r.aWidth !== null && r.bWidth !== null ? r.bWidth - r.aWidth : null;

			if (sortBy === 'absDeltaP50') return abs ?? -Infinity;
			if (sortBy === 'deltaP50') return signed ?? -Infinity;
			if (sortBy === 'deltaPct') return Math.abs(pct ?? -Infinity);
			if (sortBy === 'uncertaintyDelta') return Math.abs(ud ?? -Infinity);
			return abs ?? -Infinity;
		};

		const groupScore = (() => {
			if (groupMode === 'none') return null;
			if (sortBy === 'yearAsc' || sortBy === 'yearDesc') return null;
			const m = new Map<string, number>();
			for (const r of list) {
				const gk = groupKeyForMode(groupMode, r);
				const s = pick(r);
				const prev = m.get(gk);
				if (prev === undefined || s > prev) m.set(gk, s);
			}
			return m;
		})();

		const groupYearOrder = (() => {
			if (groupMode === 'none') return null;
			if (sortBy !== 'yearAsc' && sortBy !== 'yearDesc') return null;
			const dir: 1 | -1 = sortBy === 'yearAsc' ? 1 : -1;
			const m = new Map<string, number>();
			for (const r of list) {
				const gk = groupKeyForMode(groupMode, r);
				const yr = r.year;
				if (yr === null) continue;
				const prev = m.get(gk);
				if (prev === undefined) {
					m.set(gk, yr);
				} else {
					if (dir === 1) m.set(gk, Math.min(prev, yr));
					else m.set(gk, Math.max(prev, yr));
				}
			}
			return m;
		})();

		const sorted = [...list].sort((x, y) => {
			if (groupMode !== 'none') {
				const gx = groupKeyForMode(groupMode, x);
				const gy = groupKeyForMode(groupMode, y);
				if (gx !== gy) {
					if (sortBy === 'yearAsc' || sortBy === 'yearDesc') {
						const dir: 1 | -1 = sortBy === 'yearAsc' ? 1 : -1;
						const sx = groupYearOrder?.get(gx);
						const sy = groupYearOrder?.get(gy);
						if (sx !== undefined || sy !== undefined) {
							if (sx === undefined) return 1;
							if (sy === undefined) return -1;
							if (sx !== sy) return (sx - sy) * dir;
						}
					} else {
						const sx = groupScore?.get(gx) ?? -Infinity;
						const sy = groupScore?.get(gy) ?? -Infinity;
						if (sy !== sx) return sy - sx;
					}
					return gx.localeCompare(gy);
				}

				// within-group sort by chosen ranking
				if (sortBy === 'yearAsc' || sortBy === 'yearDesc') {
					const dir: 1 | -1 = sortBy === 'yearAsc' ? 1 : -1;
					const c = compareYears(x, y, dir);
					if (c !== 0) return c;
				} else {
					const dx = pick(x);
					const dy = pick(y);
					if (dy !== dx) return dy - dx;
				}
				if (x.metric !== y.metric) return x.metric.localeCompare(y.metric);
				const sx = scopeOrder(x.scope);
				const sy = scopeOrder(y.scope);
				if (sx !== sy) return sx - sy;
				if ((x.phaseName ?? '') !== (y.phaseName ?? '')) return String(x.phaseName ?? '').localeCompare(String(y.phaseName ?? ''));
				return (x.year ?? 0) - (y.year ?? 0);
			}

			// ungrouped: global ranking
			if (sortBy === 'yearAsc' || sortBy === 'yearDesc') {
				const dir: 1 | -1 = sortBy === 'yearAsc' ? 1 : -1;
				const c = compareYears(x, y, dir);
				if (c !== 0) return c;
			} else {
				const dx = pick(x);
				const dy = pick(y);
				if (dy !== dx) return dy - dx;
			}
			if (x.metric !== y.metric) return x.metric.localeCompare(y.metric);
			if (x.scope !== y.scope) return String(x.scope).localeCompare(String(y.scope));
			if ((x.phaseName ?? '') !== (y.phaseName ?? '')) return String(x.phaseName ?? '').localeCompare(String(y.phaseName ?? ''));
			return (x.year ?? 0) - (y.year ?? 0);
		});

		return sorted;
	}, [rows, deltas, query, hideZeros, groupMode, phaseFilter, minYear, maxYear, sortBy, scopeView]);

	const overviewSliceRows = useMemo(() => {
		const q = query.trim().toLowerCase();
		const scope = scopeView;
		const ph = effectiveOverviewPhase;
		const yr = effectiveOverviewYear;

		let slice = rows.filter((r) => r.scope === scope);
		if (scope === 'PHASE_TOTAL' && ph) slice = slice.filter((r) => (r.phaseName ?? '') === ph);
		if (scope === 'YEARLY') {
			if (ph) slice = slice.filter((r) => (r.phaseName ?? '') === ph);
			slice = slice.filter((r) => (yr === null ? true : r.year === yr));
		}
		// OVERALL_TOTAL: no phase/year filter

		if (q) slice = slice.filter((r) => String(r.metric ?? '').toLowerCase().includes(q));
		return slice;
	}, [rows, scopeView, effectiveOverviewPhase, effectiveOverviewYear, query]);

	type OverviewMetricRow = {
		metric: string;
		row: MetricExplorerRow | null;
		a: Record<PercentileKey, number | null>;
		b: Record<PercentileKey, number | null>;
		delta: Record<PercentileKey, number | null>;
		p50: { a: number | null; b: number | null; delta: number | null };
		spread: { a: number | null; b: number | null; delta: number | null };
		skew: { a: number | null; b: number | null; delta: number | null };
	};

	const overviewMetrics = useMemo((): OverviewMetricRow[] => {
		const byMetric = new Map<string, MetricExplorerRow>();
		for (const r of overviewSliceRows) {
			if (!byMetric.has(r.metric)) byMetric.set(r.metric, r);
		}

		const allMetrics = Array.from(byMetric.keys());
		const pinned = ['capital', 'deposit', 'return', 'withdraw', 'tax', 'fee', 'inflation'];
		allMetrics.sort((x, y) => {
			const ix = pinned.indexOf(x);
			const iy = pinned.indexOf(y);
			if (ix !== -1 || iy !== -1) {
				if (ix === -1) return 1;
				if (iy === -1) return -1;
				return ix - iy;
			}
			return x.localeCompare(y);
		});

		const toRecord = (m: MetricSummary | null): Record<PercentileKey, number | null> => {
			const out: any = {};
			for (const p of percentileKeys) out[p] = getPercentileValue(m, p);
			return out as Record<PercentileKey, number | null>;
		};

		const spread = (v: Record<PercentileKey, number | null>): number | null => {
			const lo = v.p5;
			const hi = v.p95;
			if (lo === null || hi === null) return null;
			return hi - lo;
		};
		const skew = (v: Record<PercentileKey, number | null>): number | null => {
			const p25 = v.p25;
			const p50 = v.p50;
			const p75 = v.p75;
			if (p25 === null || p50 === null || p75 === null) return null;
			return (p50 - p25) - (p75 - p50);
		};

		return allMetrics.map((metric) => {
			const r = byMetric.get(metric) ?? null;
			const aR = toRecord(r?.aSummary ?? null);
			const bR = toRecord(r?.bSummary ?? null);
			const dR: any = {};
			for (const p of percentileKeys) {
				const av = aR[p];
				const bv = bR[p];
				dR[p] = isDiffMode && av !== null && bv !== null ? bv - av : null;
			}

			const p50A = aR.p50;
			const p50B = bR.p50;
			const p50D = dR.p50 as number | null;

			const spA = spread(aR);
			const spB = spread(bR);
			const spD = isDiffMode && spA !== null && spB !== null ? spB - spA : null;

			const skA = skew(aR);
			const skB = skew(bR);
			const skD = isDiffMode && skA !== null && skB !== null ? skB - skA : null;

			return {
				metric,
				row: r,
				a: aR,
				b: bR,
				delta: dR as Record<PercentileKey, number | null>,
				p50: { a: p50A, b: p50B, delta: p50D },
				spread: { a: spA, b: spB, delta: spD },
				skew: { a: skA, b: skB, delta: skD },
			};
		});
	}, [overviewSliceRows, isDiffMode]);

	const overviewMetricsSorted = useMemo(() => {
		const dir = (overviewSort.endsWith('Asc') ? 1 : -1) as 1 | -1;
		const what: 'p50' | 'spread' | 'skew' = overviewSort.startsWith('p50') ? 'p50' : overviewSort.startsWith('spread') ? 'spread' : 'skew';

		const pick = (r: OverviewMetricRow): number | null => {
			const v = (r as any)[what]?.[activeOverviewSeries] as number | null;
			if (v === null || v === undefined) return null;
			return v;
		};

		return [...overviewMetrics].sort((x, y) => {
			const ax = pick(x);
			const ay = pick(y);
			if (ax === null && ay === null) return x.metric.localeCompare(y.metric);
			if (ax === null) return 1;
			if (ay === null) return -1;
			if (ax !== ay) return (ay - ax) * dir;
			return x.metric.localeCompare(y.metric);
		});
	}, [overviewMetrics, overviewSort, activeOverviewSeries]);

	const overviewIntensity = useMemo(() => {
		const seriesKey = activeOverviewSeries;
		const valuesByMetric = new Map<string, number>();
		let globalMax = 0;
		for (const r of overviewMetricsSorted) {
			let max = 0;
			for (const p of percentileKeys) {
				const v = (r as any)[seriesKey]?.[p] as number | null;
				if (v === null || v === undefined) continue;
				max = Math.max(max, Math.abs(v));
			}
			valuesByMetric.set(r.metric, max);
			globalMax = Math.max(globalMax, max);
		}
		return { perMetricMax: valuesByMetric, globalMax };
	}, [overviewMetricsSorted, activeOverviewSeries]);

	type ListItem =
		| { kind: 'header'; key: string; label: string }
		| { kind: 'row'; key: string; row: MetricExplorerRow };

	const listItems = useMemo((): ListItem[] => {
		if (groupMode === 'none') return filtered.map((r) => ({ kind: 'row', key: r.key, row: r }));

		const out: ListItem[] = [];
		let lastGroup = '';
		for (const r of filtered) {
			const gk = groupKeyForMode(groupMode, r);
			if (gk !== lastGroup) {
				out.push({ kind: 'header', key: `h|${gk}`, label: groupLabelForMode(groupMode, r) });
				lastGroup = gk;
			}
			out.push({ kind: 'row', key: r.key, row: r });
		}
		return out;
	}, [filtered, groupMode]);

	const drawerRow = selected;

	const rowHeight = 46;
	const listHeight = 520;

	return (
		<div>
			<div style={{ fontWeight: 800, marginBottom: 8 }}>{isDiffMode ? 'Where do runs differ?' : 'Search metrics'}</div>
			<div style={{ opacity: 0.85, fontSize: 13, marginBottom: 10 }}>
				{isDiffMode ? 'Search and sort by percentile deltas. Click a row for details.' : 'Search and sort metrics for this run. Click a row for details.'}
			</div>

			<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
				<button
					type="button"
					onClick={() => setTab('overview')}
					style={{
						padding: '6px 10px',
						borderRadius: 10,
						border: '1px solid #444',
						background: tab === 'overview' ? 'rgba(255,255,255,0.08)' : '#111',
						color: '#fff',
						cursor: 'pointer',
						fontWeight: tab === 'overview' ? 900 : 700,
					}}
				>
					Overview
				</button>
				<button
					type="button"
					onClick={() => setTab('explorer')}
					style={{
						padding: '6px 10px',
						borderRadius: 10,
						border: '1px solid #444',
						background: tab === 'explorer' ? 'rgba(255,255,255,0.08)' : '#111',
						color: '#fff',
						cursor: 'pointer',
						fontWeight: tab === 'explorer' ? 900 : 700,
					}}
				>
					Explorer
				</button>
			</div>

			<div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 10 }}>
				<input
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder={tab === 'overview' ? 'Filter metrics (fee, tax, capital…)…' : 'Search (phase/year/metric)…'}
					style={{ flex: '1 1 260px', padding: '8px 10px', borderRadius: 10, border: '1px solid #444', background: '#111', color: '#fff' }}
				/>

				<select
					value={scopeView}
					onChange={(e) => {
						setScopeView(e.target.value as MetricSummaryScope);
						setPhaseFilter('');
						setOverviewPhase('');
						setOverviewYear('');
					}}
					style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #444', background: '#111', color: '#fff' }}
				>
					<option value="YEARLY">Show: yearly</option>
					<option value="PHASE_TOTAL">Show: phase totals</option>
					<option value="OVERALL_TOTAL">Show: overall total</option>
				</select>

				{tab === 'overview' && scopeView !== 'OVERALL_TOTAL' ? (
					<select
						value={scopeView === 'PHASE_TOTAL' ? effectiveOverviewPhase : overviewPhase}
						onChange={(e) => {
							setOverviewPhase(String(e.target.value));
							setOverviewYear('');
						}}
						style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #444', background: '#111', color: '#fff' }}
					>
						{scopeView !== 'PHASE_TOTAL' ? <option value="">Phase: All</option> : null}
						{phases.map((p) => (
							<option key={p} value={p}>
								Phase: {p}
							</option>
						))}
					</select>
				) : null}

				{tab === 'overview' && scopeView === 'YEARLY' ? (
					<select
						value={overviewYear}
						onChange={(e) => setOverviewYear(String(e.target.value))}
						style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #444', background: '#111', color: '#fff' }}
					>
						{(yearlyYearsByPhase.get(effectiveOverviewPhase) ?? yearlyYearsByPhase.get('') ?? []).map((y) => (
							<option key={y} value={String(y)}>
								Year: {y}
							</option>
						))}
					</select>
				) : null}

				{tab === 'overview' && isDiffMode ? (
					<select
						value={overviewSeries}
						onChange={(e) => setOverviewSeries(e.target.value as OverviewSeries)}
						style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #444', background: '#111', color: '#fff' }}
					>
						<option value="delta">Display: Δ</option>
						<option value="a">Display: A</option>
						<option value="b">Display: B</option>
					</select>
				) : null}

				{tab === 'explorer' ? (
					<label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, opacity: 0.9 }}>
						<input type="checkbox" checked={hideZeros} onChange={(e) => setHideZeros(e.target.checked)} /> Hide zeros
					</label>
				) : null}

				{tab === 'explorer' ? (
					<select
						value={groupMode}
						onChange={(e) => setGroupMode(e.target.value as GroupMode)}
						style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #444', background: '#111', color: '#fff' }}
					>
						{scopeView === 'YEARLY' ? <option value="year">Group: year</option> : null}
						{scopeView !== 'OVERALL_TOTAL' ? <option value="phase">Group: phase</option> : null}
						<option value="metric">Group: metric</option>
						<option value="none">Group: none</option>
					</select>
				) : null}

				{tab === 'explorer' ? (
					<select
						value={percentile}
						onChange={(e) => setPercentile(e.target.value as PercentileKey)}
						style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #444', background: '#111', color: '#fff' }}
					>
						{percentileKeys.map((p) => (
							<option key={p} value={p}>
								Percentile: {p}
							</option>
						))}
					</select>
				) : null}

				{tab === 'explorer' ? (
					<select
						value={sortBy}
						onChange={(e) => setSortBy(e.target.value as any)}
						style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #444', background: '#111', color: '#fff' }}
					>
						{isDiffMode ? (
							<>
								<option value="absDeltaP50">Sort: |Δ|</option>
								<option value="deltaP50">Sort: Δ (signed)</option>
								<option value="deltaPct">Sort: |Δ%|</option>
								<option value="uncertaintyDelta">Sort: |Δ uncertainty|</option>
							</>
						) : null}
						<option value="yearAsc">Sort: year ↑</option>
						<option value="yearDesc">Sort: year ↓</option>
					</select>
				) : (
					<select
						value={overviewSort}
						onChange={(e) => setOverviewSort(e.target.value as OverviewSort)}
						style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #444', background: '#111', color: '#fff' }}
					>
						<option value="p50Desc">Sort: p50 ↓</option>
						<option value="p50Asc">Sort: p50 ↑</option>
						<option value="spreadDesc">Sort: spread (p95–p5) ↓</option>
						<option value="spreadAsc">Sort: spread (p95–p5) ↑</option>
						<option value="skewDesc">Sort: skew ↓</option>
						<option value="skewAsc">Sort: skew ↑</option>
					</select>
				)}

				{tab === 'explorer' ? (
					<select
						value={phaseFilter}
						onChange={(e) => setPhaseFilter(String(e.target.value))}
						disabled={scopeView === 'OVERALL_TOTAL'}
						style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #444', background: '#111', color: '#fff' }}
					>
						<option value="">All phases</option>
						{phases.map((p) => (
							<option key={p} value={p}>
								{p}
							</option>
						))}
					</select>
				) : null}

				{tab === 'explorer' ? (
					<>
						<input
							value={minYear}
							onChange={(e) => setMinYear(e.target.value)}
							placeholder="Min year"
							inputMode="numeric"
							disabled={scopeView !== 'YEARLY'}
							style={{ width: 110, padding: '8px 10px', borderRadius: 10, border: '1px solid #444', background: '#111', color: '#fff' }}
						/>
						<input
							value={maxYear}
							onChange={(e) => setMaxYear(e.target.value)}
							placeholder="Max year"
							inputMode="numeric"
							disabled={scopeView !== 'YEARLY'}
							style={{ width: 110, padding: '8px 10px', borderRadius: 10, border: '1px solid #444', background: '#111', color: '#fff' }}
						/>
					</>
				) : null}

				{tab === 'overview' ? (
					<>
						<label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, opacity: 0.9 }}>
							<input type="checkbox" checked={normalizePerMetric} onChange={(e) => setNormalizePerMetric(e.target.checked)} /> Normalize per metric
						</label>
						<label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, opacity: 0.9 }}>
							<input type="checkbox" checked={showBandLabels} onChange={(e) => setShowBandLabels(e.target.checked)} /> Show band labels
						</label>
					</>
				) : null}

				<div style={{ fontSize: 12, opacity: 0.8, marginLeft: 'auto' }}>
					{tab === 'overview' ? `${overviewSliceRows.length} rows` : `${filtered.length} / ${rows.length}`}
				</div>
			</div>

			{tab === 'overview' ? (
				<div style={{ border: '1px solid #333', borderRadius: 12, overflow: 'hidden', background: 'rgba(0,0,0,0.10)' }}>
					<div style={{ padding: '8px 10px', background: '#1a1a1a', borderBottom: '1px solid #222', display: 'flex', gap: 10, alignItems: 'baseline', justifyContent: 'space-between' }}>
						<div style={{ fontWeight: 850, fontSize: 12, opacity: 0.9 }}>
							Percentile Grid Overview
							<span style={{ marginLeft: 8, opacity: 0.7 }}>
								({scopeView}{scopeView === 'PHASE_TOTAL' ? ` / ${effectiveOverviewPhase || 'All'}` : ''}{scopeView === 'YEARLY' ? ` / ${effectiveOverviewPhase || 'All'} / year ${effectiveOverviewYear ?? '—'}` : ''})
							</span>
						</div>
						<div style={{ fontSize: 12, opacity: 0.75 }}>
							{isDiffMode ? `Mode: ${activeOverviewSeries === 'delta' ? 'Δ' : activeOverviewSeries === 'a' ? 'A' : 'B'}` : 'Mode: single run'}
						</div>
					</div>

					{overviewMetricsSorted.length === 0 ? (
						<div style={{ padding: '10px 12px', fontSize: 13, opacity: 0.8 }}>No metrics found for this slice.</div>
					) : (
						<div style={{ overflowX: 'auto' }}>
							<div style={{ minWidth: 680 }}>
								<div style={{ display: 'grid', gridTemplateColumns: `220px repeat(${percentileKeys.length}, 1fr)`, gap: 0, borderTop: '1px solid #222' }}>
									<div style={{ padding: '8px 10px', fontWeight: 800, fontSize: 12, background: 'rgba(255,255,255,0.04)' }}>Metric</div>
									{percentileKeys.map((p) => (
										<div key={p} style={{ padding: '8px 10px', fontWeight: 800, fontSize: 12, background: 'rgba(255,255,255,0.04)', borderLeft: '1px solid #222' }}>
											{p}
										</div>
									))}

									{overviewMetricsSorted.map((r) => {
										const max = normalizePerMetric ? (overviewIntensity.perMetricMax.get(r.metric) ?? 0) : overviewIntensity.globalMax;
										const series = activeOverviewSeries;
										const hoveredBand = showBandLabels
											? (() => {
												const rec = (r as any)[series] as Record<PercentileKey, number | null>;
												const lo = rec.p5;
												const mid = rec.p50;
												const hi = rec.p95;
												if (lo === null || mid === null || hi === null) return null;
												return `p50 ${formatMetricValue(r.metric, mid)}  [${formatMetricValue(r.metric, lo)}..${formatMetricValue(r.metric, hi)}]`;
											})()
											: null;

										return (
											<React.Fragment key={r.metric}>
												<div style={{ padding: '8px 10px', borderTop: '1px solid #222' }}>
														<div style={{ fontWeight: 850 }}>{coloredValue(r.metric, r.metric, { bold: true })}</div>
													{hoveredBand ? <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>{hoveredBand}</div> : null}
												</div>
												{percentileKeys.map((p) => {
													const rec = (r as any)[series] as Record<PercentileKey, number | null>;
													const v = rec[p];
													const intensity = max > 1e-12 && v !== null ? clamp01(Math.abs(v) / max) : 0;
													const alpha = 0.10 + intensity * 0.45;
													const bg =
														v === null
															? 'transparent'
															: v >= 0
																? `rgba(34, 197, 94, ${alpha})`
																: `rgba(239, 68, 68, ${alpha})`;
													const text = v === null ? '—' : (series === 'delta' ? fmtSigned(r.metric, v) : formatMetricValue(r.metric, v));
													return (
														<div
															key={p}
															role="button"
															tabIndex={0}
															onClick={() => {
																if (!r.row) return;
																setSelected(r.row);
																setDrawerPercentile(p);
															}}
															onKeyDown={(e) => {
																if (e.key === 'Enter' || e.key === ' ') {
																	e.preventDefault();
																	if (!r.row) return;
																	setSelected(r.row);
																	setDrawerPercentile(p);
																}
															}}
															style={{
																padding: '8px 10px',
																borderLeft: '1px solid #222',
																borderTop: '1px solid #222',
																background: bg,
																cursor: r.row ? 'pointer' : 'default',
																fontSize: 12,
																fontWeight: p === 'p50' ? 900 : 650,
																opacity: v === null ? 0.7 : 1,
																whiteSpace: 'nowrap',
															}}
														>
															{heatmapChip(r.metric, text, { bold: p === 'p50' })}
														</div>
													);
												})}
											</React.Fragment>
										);
									})}
								</div>
							</div>
						</div>
					)}
				</div>
			) : null}

			{tab === 'explorer' ? (
				<>
					<div
				style={{
					display: 'grid',
					gridTemplateColumns: isDiffMode ? '1.4fr 1fr 1fr 0.9fr' : '1.8fr 1fr',
					gap: 10,
					padding: '8px 10px',
					background: '#1a1a1a',
					fontWeight: 750,
					fontSize: 12,
					border: '1px solid #333',
					borderRadius: 12,
					marginBottom: 8,
				}}
					>
				<div>Metric</div>
				<div>{runALabel}</div>
				{isDiffMode ? (
					<>
						<div>{runBLabel}</div>
						<div>Δ ({percentile})</div>
					</>
				) : null}
					</div>

					<VirtualizedList
						items={listItems}
						height={listHeight}
						rowHeight={rowHeight}
						renderRow={(item) => {
					if (item.kind === 'header') {
						return (
							<div
								style={{
									display: 'flex',
									alignItems: 'center',
									padding: '8px 10px',
									borderBottom: '1px solid #222',
									background: 'rgba(255,255,255,0.04)',
									fontWeight: 850,
									opacity: 0.92,
								}}
							>
								{item.label}
							</div>
						);
					}

					const r = item.row;
					const meta: string[] = [];
					meta.push(String(r.scope));
					if (r.phaseName) meta.push(r.phaseName);
					if (r.year !== null) meta.push(`year ${r.year}`);

					const d = deltas.get(r.key);
					const aV = d?.aV ?? null;
					const bV = d?.bV ?? null;
					const delta = d?.delta ?? null;

					const isSelected = selected?.key === r.key;

					return (
						<div
							role="button"
							tabIndex={0}
							onClick={() => {
								setSelected(r);
								setDrawerPercentile(percentile);
							}}
							onKeyDown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									setSelected(r);
									setDrawerPercentile(percentile);
								}
							}}
							style={{
								display: 'grid',
								gridTemplateColumns: isDiffMode ? '1.4fr 1fr 1fr 0.9fr' : '1.8fr 1fr',
								gap: 10,
								padding: '8px 10px',
								borderBottom: '1px solid #222',
								cursor: 'pointer',
								background: isSelected ? 'rgba(64, 196, 255, 0.10)' : 'transparent',
							}}
						>
							<div style={{ minWidth: 0 }}>
								<div style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.metric}</div>
								<div style={{ fontSize: 12, opacity: 0.75, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta.join(' / ')}</div>
							</div>
							<div style={{ fontSize: 13, opacity: 0.92 }}>{coloredValue(r.metric, formatMetricValue(r.metric, aV))}</div>
							{isDiffMode ? (
								<>
									<div style={{ fontSize: 13, opacity: 0.92 }}>{coloredValue(r.metric, formatMetricValue(r.metric, bV))}</div>
									<div style={{ fontSize: 13, fontWeight: 900, opacity: 0.95 }}>{coloredValue(r.metric, fmtSigned(r.metric, delta), { bold: true })}</div>
								</>
							) : null}
						</div>
					);
						}}
					/>
				</>
			) : null}

			{selected && drawerRow && (
				<div
					role="presentation"
					onMouseDown={() => setSelected(null)}
					style={{
						position: 'fixed',
						inset: 0,
						zIndex: 1000,
					}}
				>
					<div
						onMouseDown={(e) => e.stopPropagation()}
						style={{
							position: 'absolute',
							top: 72,
							right: 18,
							width: 720,
							maxWidth: 'calc(100vw - 36px)',
							maxHeight: 'calc(100vh - 90px)',
							overflow: 'auto',
							border: '1px solid #444',
							borderRadius: 14,
							background: '#0b0b0b',
							padding: 12,
							boxShadow: '0 18px 60px rgba(0,0,0,0.55)',
						}}
					>
					<div style={{ position: 'sticky', top: 0, background: '#0b0b0b', paddingBottom: 10, zIndex: 5 }}>
						<div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
						<div style={{ minWidth: 0 }}>
								<div style={{ fontWeight: 950, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{drawerRow.metric}</div>
							<div style={{ fontSize: 12, opacity: 0.75 }}>
									{String(drawerRow.scope)}
									{drawerRow.phaseName ? ` / ${drawerRow.phaseName}` : ''}
									{drawerRow.year !== null ? ` / year ${drawerRow.year}` : ''}
							</div>
						</div>
						<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
							<button
								type="button"
								onClick={() => setSelected(null)}
								style={{ padding: '6px 10px', borderRadius: 10, border: '1px solid #444', background: '#111', color: '#fff', cursor: 'pointer' }}
							>
								Close
							</button>
						</div>
						</div>
					</div>

					<div style={{ marginTop: 12 }}>
						<div style={{ fontWeight: 900, marginBottom: 8 }}>Percentiles</div>
						<div style={{ border: '1px solid #333', borderRadius: 12, overflow: 'hidden' }}>
							<div style={{ display: 'grid', gridTemplateColumns: isDiffMode ? '0.7fr 1fr 1fr 0.9fr' : '0.7fr 1fr', gap: 10, padding: '8px 10px', background: '#1a1a1a', fontWeight: 750, fontSize: 12 }}>
								<div>Percentile</div>
								<div>{runALabel}</div>
								{isDiffMode ? (
									<>
										<div>{runBLabel}</div>
										<div>Δ</div>
									</>
								) : null}
							</div>
							{percentileKeys.map((p) => {
								const aV = getPercentileValue(drawerRow.aSummary, p);
								const bV = isDiffMode ? getPercentileValue(drawerRow.bSummary, p) : null;
								const d = isDiffMode && aV !== null && bV !== null ? bV - aV : null;
								const isActive = p === drawerPercentile;
								return (
									<div
										key={p}
										role="button"
										tabIndex={0}
										onClick={() => setDrawerPercentile(p)}
										onKeyDown={(e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												e.preventDefault();
												setDrawerPercentile(p);
											}
										}}
										style={{
											display: 'grid',
											gridTemplateColumns: isDiffMode ? '0.7fr 1fr 1fr 0.9fr' : '0.7fr 1fr',
											gap: 10,
											padding: '8px 10px',
											borderTop: '1px solid #222',
											cursor: 'pointer',
											background: isActive ? 'rgba(64, 196, 255, 0.10)' : 'transparent',
											fontSize: 12,
										}}
									>
										<div style={{ fontWeight: isActive ? 900 : 750, opacity: 0.9 }}>{p}</div>
										<div>{coloredValue(drawerRow.metric, formatMetricValue(drawerRow.metric, aV), { bold: isActive })}</div>
										{isDiffMode ? (
											<>
												<div>{coloredValue(drawerRow.metric, formatMetricValue(drawerRow.metric, bV), { bold: isActive })}</div>
												<div style={{ fontWeight: isActive ? 900 : 800 }}>{coloredValue(drawerRow.metric, fmtSigned(drawerRow.metric, d), { bold: isActive })}</div>
											</>
										) : null}
									</div>
								);
							})}
						</div>
					</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default CompareMetricExplorer;