// src/pages/ExplorePage.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../components/PageLayout';
import type { YearlySummary } from '../models/YearlySummary';
import type { SimulationTimelineContext } from '../models/types';
import type { AdvancedSimulationRequest } from '../models/advancedSimulation';
import { advancedToNormalRequest } from '../models/advancedSimulation';
import { encodeScenarioToShareParam } from '../utils/shareScenarioLink';
import { saveScenario } from '../config/savedScenarios';
import MultiPhaseOverview from '../MultiPhaseOverview';
import { METRIC_COLORS, moneyStoryStepColor } from '../utils/metricColors';
import { toIsoDateString } from '../utils/backendDate';
import {
  exportSimulationCsv,
  getRunInput,
  getRunSummaries,
  getStandardResultsV3,
  listRuns,
  type MetricSummary,
  type RunListItem,
} from '../api/simulation';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';
type SortMode = 'newest' | 'oldest' | 'seed' | 'medianDesc' | 'failureDesc' | 'depositDesc';

type TagTone = 'capital' | 'deposit' | 'return' | 'withdraw' | 'tax' | 'fee' | 'inflation' | 'neutral';

const hexToRgba = (hex: string, alpha: number): string => {
  const h = String(hex || '').replace('#', '').trim();
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (![r, g, b].every(Number.isFinite)) return `rgba(255,255,255,${alpha})`;
  return `rgba(${r},${g},${b},${alpha})`;
};

const toneColor = (tone: TagTone): string => {
  if (tone === 'neutral') return '#777';
  if (tone === 'inflation') return METRIC_COLORS.inflation;
  return moneyStoryStepColor(tone as any);
};

const Tag: React.FC<{ children: React.ReactNode; tone?: TagTone; title?: string }> = ({
  children,
  tone = 'neutral',
  title,
}) => {
  const c = toneColor(tone);
  return (
    <span
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 10px',
        borderRadius: 999,
        border: `1px solid ${hexToRgba(c, 0.45)}`,
        fontSize: 12,
        background: hexToRgba(c, 0.12),
        color: '#e6e6e6',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
};

const FilterChip: React.FC<{ children: React.ReactNode; onRemove?: () => void; tone?: TagTone }> = ({
  children,
  onRemove,
  tone = 'neutral',
}) => {
  const c = toneColor(tone);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 10px',
        borderRadius: 999,
        border: `1px solid ${hexToRgba(c, 0.45)}`,
        fontSize: 12,
        marginRight: 8,
        marginBottom: 6,
        background: hexToRgba(c, 0.12),
        color: '#e6e6e6',
      }}
    >
      <span>{children}</span>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove filter"
          style={{
            border: `1px solid ${hexToRgba(c, 0.55)}`,
            background: 'transparent',
            color: '#ddd',
            borderRadius: 999,
            padding: '0 6px',
            cursor: 'pointer',
            lineHeight: '18px',
            height: 18,
            fontSize: 12,
          }}
        >
          ×
        </button>
      ) : null}
    </span>
  );
};

const money = (v?: number | null) =>
  typeof v === 'number'
    ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(v)
    : '—';

const moneyCompact = (v?: number | null) => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
  try {
    const s = new Intl.NumberFormat(undefined, {
      notation: 'compact',
      compactDisplay: 'short',
      maximumFractionDigits: 1,
    }).format(v);
    return s.replace('K', 'k');
  } catch {
    return money(v);
  }
};

const pctVal = (v?: number | null) =>
  typeof v === 'number'
    ? `${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`
    : '—';

const pct2 = (v?: number | null) => {
  if (v === null || v === undefined) return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
};

const fmtDate = (iso: string) => {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = String(d.getFullYear());
    return `${dd}-${mm}-${yyyy}`;
  } catch {
    return iso;
  }
};

const fmtDateTime = (iso?: string | null) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
};

// NOTE: `toIsoDateString` is imported from ../utils/backendDate to ensure we
// interpret backend epochDay correctly (days since 1900-01-01).

const sumMonths = (phases: any[]) =>
  phases.reduce((s, p) => s + (Number(p?.durationInMonths) || 0), 0);

const buildTimelineFromAdvancedRequest = (req: any): SimulationTimelineContext | null => {
  try {
    const startDate = toIsoDateString(req?.startDate);
    const phases: any[] = Array.isArray(req?.phases) ? req.phases : [];
    if (!startDate || phases.length === 0) return null;

    const phaseTypes = phases
      .map((p) => p?.phaseType ?? p?.type)
      .filter(Boolean);
    const phaseDurationsInMonths = phases.map((p) => Number(p?.durationInMonths) || 0);

    return {
      startDate: String(startDate),
      phaseTypes,
      phaseDurationsInMonths,
      phaseInitialDeposits: phases.map((p) => (p?.initialDeposit !== undefined ? Number(p.initialDeposit) : undefined)),
      firstPhaseInitialDeposit:
        phases[0]?.initialDeposit !== undefined ? Number(phases[0]?.initialDeposit) : undefined,
      inflationFactorPerYear:
        req?.inflationFactor !== undefined ? Number(req?.inflationFactor) : undefined,
    };
  } catch {
    return null;
  }
};

type RunComputed = {
  totalYears?: number;
  shape?: Array<{ phaseType: string; years: number }>;
  overallTaxRule?: string;
  taxPercentage?: number | null;
  returnType?: string | null;
  yearlyFeePercentage?: number | null;
  inflationFactor?: number | null;
  usedTaxRules?: Set<string>;
  cardExemption?: { limit?: number | null; yearlyIncrease?: number | null } | null;
  stockExemption?: { taxRate?: number | null; limit?: number | null; yearlyIncrease?: number | null } | null;
  depositInitial?: number | null;
  depositMonthly?: number | null;
  depositYearlyIncreasePct?: number | null;
  lastYear?: YearlySummary | null;
};

const computeFromInputAndSummaries = (
  input: AdvancedSimulationRequest | null,
  summaries: YearlySummary[] | null
): RunComputed => {
  const phases = Array.isArray((input as any)?.phases) ? (input as any).phases : [];
  const shape = phases
    .map((p: any) => {
      const phaseType = String(p?.phaseType ?? p?.type ?? '').toUpperCase();
      const months = Number(p?.durationInMonths) || 0;
      const years = Math.floor(months / 12);
      return phaseType ? { phaseType, years } : null;
    })
    .filter(Boolean) as Array<{ phaseType: string; years: number }>;

  const lastYear = Array.isArray(summaries) && summaries.length
    ? summaries.reduce((best, s) => (s.year > best.year ? s : best), summaries[0])
    : null;

  const taxPercentageRaw = Number((input as any)?.taxPercentage);
  const taxPercentage = Number.isFinite(taxPercentageRaw) ? taxPercentageRaw : null;

  const returnTypeRaw = (input as any)?.returnType;
  const returnType = returnTypeRaw === null || returnTypeRaw === undefined ? null : String(returnTypeRaw);

  const feeRaw = (input as any)?.yearlyFeePercentage;
  const feeNum = feeRaw === null || feeRaw === undefined ? null : Number(feeRaw);
  const yearlyFeePercentage = Number.isFinite(feeNum as number) ? (feeNum as number) : null;

  const inflRaw = (input as any)?.inflationFactor;
  const inflNum = inflRaw === null || inflRaw === undefined ? null : Number(inflRaw);
  const inflationFactor = Number.isFinite(inflNum as number) ? (inflNum as number) : null;

  const usedTaxRules: Set<string> = new Set(
    phases
      .flatMap((p: any) => (Array.isArray(p?.taxRules) ? p.taxRules : []))
      .map((r: any) => String(r ?? '').toUpperCase())
      .filter(Boolean)
  );

  const defaultExemptionCard = { limit: 51600, yearlyIncrease: 1000 };
  const defaultStockExemption = { taxRate: 27, limit: 67500, yearlyIncrease: 1000 };
  const cardCfgRaw = (input as any)?.taxExemptionConfig?.exemptionCard ?? {};
  const stockCfgRaw = (input as any)?.taxExemptionConfig?.stockExemption ?? {};

  const cardLimitNum = Number(cardCfgRaw?.limit ?? defaultExemptionCard.limit);
  const cardIncNum = Number(cardCfgRaw?.yearlyIncrease ?? defaultExemptionCard.yearlyIncrease);

  const stockTaxNum = Number(stockCfgRaw?.taxRate ?? defaultStockExemption.taxRate);
  const stockLimitNum = Number(stockCfgRaw?.limit ?? defaultStockExemption.limit);
  const stockIncNum = Number(stockCfgRaw?.yearlyIncrease ?? defaultStockExemption.yearlyIncrease);

  const firstDeposit = phases.find((p: any) => String(p?.phaseType ?? p?.type ?? '').toUpperCase() === 'DEPOSIT') ?? null;
  const depInitRaw = firstDeposit?.initialDeposit;
  const depMonthlyRaw = firstDeposit?.monthlyDeposit;
  const depIncRaw = firstDeposit?.yearlyIncreaseInPercentage;

  const depInit = depInitRaw === null || depInitRaw === undefined ? null : Number(depInitRaw);
  const depMonthly = depMonthlyRaw === null || depMonthlyRaw === undefined ? null : Number(depMonthlyRaw);
  const depInc = depIncRaw === null || depIncRaw === undefined ? null : Number(depIncRaw);

  const totalMonths = phases.length ? sumMonths(phases) : 0;
  const totalYears = phases.length ? Math.floor(totalMonths / 12) : undefined;

  return {
    totalYears,
    shape,
    overallTaxRule: (input as any)?.overallTaxRule ? String((input as any).overallTaxRule) : undefined,
    taxPercentage,
    returnType,
    yearlyFeePercentage,
    inflationFactor,
    usedTaxRules,
    cardExemption: {
      limit: Number.isFinite(cardLimitNum) ? cardLimitNum : null,
      yearlyIncrease: Number.isFinite(cardIncNum) ? cardIncNum : null,
    },
    stockExemption: {
      taxRate: Number.isFinite(stockTaxNum) ? stockTaxNum : null,
      limit: Number.isFinite(stockLimitNum) ? stockLimitNum : null,
      yearlyIncrease: Number.isFinite(stockIncNum) ? stockIncNum : null,
    },
    depositInitial: Number.isFinite(depInit as number) ? (depInit as number) : null,
    depositMonthly: Number.isFinite(depMonthly as number) ? (depMonthly as number) : null,
    depositYearlyIncreasePct: Number.isFinite(depInc as number) ? (depInc as number) : null,
    lastYear,
  };
};

const PillButton: React.FC<{
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}> = ({ children, onClick, active, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    style={{
      padding: '7px 11px',
      borderRadius: 999,
      border: '1px solid #444',
      background: active ? '#2e2e2e' : 'transparent',
      color: '#ddd',
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontSize: 13,
      fontWeight: 650,
      opacity: disabled ? 0.55 : 1,
    }}
    aria-pressed={active}
  >
    {children}
  </button>
);

const compactId = (id: string) => {
  if (!id) return '—';
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
};

const PhaseShapeRow: React.FC<{ shape?: Array<{ phaseType: string; years: number }> }> = ({ shape }) => {
  const parts = shape?.length
    ? shape.map((s) => ({
        ...s,
        label: `${s.phaseType} ${s.years}y`,
        title: `${s.phaseType} phase (${s.years} years)`,
        tone:
          s.phaseType === 'DEPOSIT'
            ? ('deposit' as const)
            : s.phaseType === 'WITHDRAW'
              ? ('withdraw' as const)
              : s.phaseType === 'PASSIVE'
                ? ('neutral' as const)
                : ('neutral' as const),
      }))
    : [];

  return (
    <div style={{ fontSize: 12, opacity: 0.92, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      {parts.length ? (
        parts.map((p, idx) => (
          <React.Fragment key={`${p.label}-${idx}`}>
            <Tag tone={p.tone} title={p.title}>
              {p.label}
            </Tag>
            {idx < parts.length - 1 ? <span style={{ opacity: 0.45 }}>→</span> : null}
          </React.Fragment>
        ))
      ) : (
        <span style={{ opacity: 0.7 }}>—</span>
      )}
    </div>
  );
};

const RunChipsRow: React.FC<{ computed: RunComputed }> = ({ computed }) => {
  const taxLabel = computed.overallTaxRule
    ? computed.overallTaxRule === 'CAPITAL'
      ? 'Capital'
      : computed.overallTaxRule === 'NOTIONAL'
        ? 'Notional'
        : computed.overallTaxRule
    : '—';

  const returnModelLabel = (() => {
    const t = String(computed.returnType ?? '').trim();
    if (!t) return '—';
    if (t === 'dataDrivenReturn') return 'Data-driven';
    return t;
  })();

  const inflationLabel = (() => {
    if (typeof computed.inflationFactor !== 'number') return null;
    const pct = (computed.inflationFactor - 1) * 100;
    if (!Number.isFinite(pct)) return null;
    return `+${pct2(pct)}/y`;
  })();

  const cardExLabel = (() => {
    if (!computed.usedTaxRules?.has('EXEMPTIONCARD')) return null;
    const limit = computed.cardExemption?.limit ?? null;
    const inc = computed.cardExemption?.yearlyIncrease ?? null;
    return `${moneyCompact(limit)}${typeof inc === 'number' ? ` @ 0% +${moneyCompact(inc)}/y` : ''}`;
  })();

  const stockExLabel = (() => {
    if (!computed.usedTaxRules?.has('STOCKEXEMPTION')) return null;
    const tax = computed.stockExemption?.taxRate ?? null;
    const limit = computed.stockExemption?.limit ?? null;
    const inc = computed.stockExemption?.yearlyIncrease ?? null;
    return `${moneyCompact(limit)}${typeof inc === 'number' ? `@ ${typeof tax === 'number' ? pct2(tax) : '—'} +${moneyCompact(inc)}/y` : ''}`;
  })();

  const depositParts = (() => {
    const init = typeof computed.depositInitial === 'number' ? computed.depositInitial : null;
    const monthly = typeof computed.depositMonthly === 'number' ? computed.depositMonthly : null;
    const inc = typeof computed.depositYearlyIncreasePct === 'number' ? computed.depositYearlyIncreasePct : null;

    const showInit = typeof init === 'number' && Number.isFinite(init) && init !== 0;
    const showMonthly = typeof monthly === 'number' && Number.isFinite(monthly) && monthly !== 0;
    const showInc = showMonthly && typeof inc === 'number' && Number.isFinite(inc) && inc !== 0;

    if (!showInit && !showMonthly && !showInc) return null;

    return {
      init: showInit ? moneyCompact(init) : null,
      monthly: showMonthly ? `+${moneyCompact(monthly)}/m` : null,
      inc: showInc ? `+${pct2(inc)}/y` : null,
    };
  })();

  const chips = (() => {
    const out: Array<{ key: string; node: React.ReactNode }> = [];

    if (computed.totalYears !== undefined) {
      out.push({
        key: 'duration',
        node: (
          <Tag tone="neutral" title="Total simulation duration">
            {computed.totalYears} years
          </Tag>
        ),
      });
    }

    if (depositParts?.init) {
      out.push({
        key: 'deposit-init',
        node: (
          <Tag tone="deposit" title="Initial deposit (one-time)">
            {depositParts.init}
          </Tag>
        ),
      });
    }
    if (depositParts?.monthly) {
      out.push({
        key: 'deposit-monthly',
        node: (
          <Tag tone="deposit" title="Monthly deposit amount">
            {depositParts.monthly}
          </Tag>
        ),
      });
    }
    if (depositParts?.inc) {
      out.push({
        key: 'deposit-inc',
        node: (
          <Tag tone="deposit" title="Yearly increase of monthly deposits">
            {depositParts.inc}
          </Tag>
        ),
      });
    }

    out.push({
      key: 'return-model',
      node: (
        <Tag tone="return" title="Return model used in the simulation">
          {returnModelLabel}
        </Tag>
      ),
    });

    if (inflationLabel) {
      out.push({
        key: 'inflation',
        node: (
          <Tag tone="inflation" title="Inflation adjustment per year">
            {inflationLabel}
          </Tag>
        ),
      });
    }

    if (computed.overallTaxRule) {
      out.push({
        key: 'tax',
        node: (
          <Tag tone="tax" title="Overall tax rule and rate">
            {taxLabel}{typeof computed.taxPercentage === 'number' ? ` ${pct2(computed.taxPercentage)}` : ''}
          </Tag>
        ),
      });
    }
    if (cardExLabel) out.push({ key: 'tax-card', node: <Tag tone="tax" title="Card exemption (limit and yearly increase)">{cardExLabel}</Tag> });
    if (stockExLabel) out.push({ key: 'tax-stock', node: <Tag tone="tax" title="Stock exemption (limit, tax, and yearly increase)">{stockExLabel}</Tag> });

    if (typeof computed.yearlyFeePercentage === 'number') {
      out.push({
        key: 'fee',
        node: (
          <Tag tone="fee" title="Yearly fee percentage">
            {pct2(computed.yearlyFeePercentage)}/y
          </Tag>
        ),
      });
    }

    return out;
  })();

  return (
    <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {chips.map((c) => (
        <React.Fragment key={c.key}>{c.node}</React.Fragment>
      ))}
    </div>
  );
};

const RunListRow: React.FC<{
  run: RunListItem;
  computed: RunComputed;
  metricSummaries?: MetricSummary[] | null;
  isSelected: boolean;
  isLoadingDetails: boolean;
  onSelect: () => void;
}> = ({ run, computed, metricSummaries, isSelected, isLoadingDetails, onSelect }) => {
  const last = computed.lastYear;
  const title = run.createdAt ? fmtDate(run.createdAt) : compactId(run.id);

  const withdrawMedian = (() => {
    const ms = Array.isArray(metricSummaries) ? metricSummaries : [];
    const overall = ms.find((m) => String(m.metric ?? '').toLowerCase() === 'withdraw' && m.scope === 'OVERALL_TOTAL');
    if (overall && typeof overall.p50 === 'number') return overall.p50;
    return null;
  })();

  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        textAlign: 'left',
        border: `1px solid ${isSelected ? '#777' : '#2f2f2f'}`,
        background: isSelected ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
        borderRadius: 12,
        padding: 10,
        cursor: 'pointer',
        color: '#ddd',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '140px 1fr 140px 120px',
          gap: 10,
          alignItems: 'start',
        }}
      >
        <div>
          <div style={{ fontWeight: 800, fontSize: 13 }}>{title}</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{compactId(run.id)}</div>
          {isLoadingDetails ? <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>Loading…</div> : null}
        </div>

        <div>
          <RunChipsRow computed={computed} />
        </div>

        <div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>End (median)</div>
          <div style={{ fontSize: 14, fontWeight: 850, color: moneyStoryStepColor('capital' as any) }}>
            {last ? money(last.medianCapital) : '—'}
          </div>
          {typeof withdrawMedian === 'number' ? (
            <div style={{ marginTop: 4, fontSize: 12, opacity: 0.85, color: moneyStoryStepColor('withdraw' as any) }}>
              {money(withdrawMedian)}
            </div>
          ) : null}
        </div>

        <div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>Fail</div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              color:
                last && typeof last.negativeCapitalPercentage === 'number' && last.negativeCapitalPercentage > 0
                  ? '#ff4d4f'
                  : moneyStoryStepColor('return'),
            }}
          >
            {last ? pctVal(last.negativeCapitalPercentage) : '—'}
          </div>
        </div>
      </div>
    </button>
  );
};

const RunCard: React.FC<{
  run: RunListItem;
  computed: RunComputed;
  metricSummaries?: MetricSummary[] | null;
  isSelected: boolean;
  isLoadingDetails: boolean;
  onSelect: () => void;
}> = ({ run, computed, metricSummaries, isSelected, isLoadingDetails, onSelect }) => {
  const last = computed.lastYear;
  const title = run.createdAt ? fmtDate(run.createdAt) : compactId(run.id);

  const withdrawMedian = (() => {
    const ms = Array.isArray(metricSummaries) ? metricSummaries : [];
    const overall = ms.find((m) => String(m.metric ?? '').toLowerCase() === 'withdraw' && m.scope === 'OVERALL_TOTAL');
    if (overall && typeof overall.p50 === 'number') return overall.p50;

    const yearly = ms.find(
      (m) =>
        String(m.metric ?? '').toLowerCase() === 'withdraw' &&
        m.scope === 'YEARLY' &&
        typeof m.year === 'number' &&
        last &&
        m.year === last.year
    );
    if (yearly && typeof yearly.p50 === 'number') return yearly.p50;
    return null;
  })();

  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        textAlign: 'left',
        border: `1px solid ${isSelected ? '#777' : '#3a3a3a'}`,
        background: isSelected ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
        borderRadius: 14,
        padding: 12,
        cursor: 'pointer',
        color: '#ddd',
        transition: 'border-color 120ms ease, background 120ms ease',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
        <div style={{ fontWeight: 800, fontSize: 14 }}>{title}</div>
        <div style={{ fontSize: 12, opacity: 0.75 }}>{compactId(run.id)}</div>
      </div>

      <RunChipsRow computed={computed} />

      <div
        style={{
          marginTop: 10,
          borderTop: '1px solid #2d2d2d',
          paddingTop: 10,
        }}
      >
        <PhaseShapeRow shape={computed.shape} />
      </div>

      <div
        style={{
          marginTop: 10,
          borderTop: '1px solid #2d2d2d',
          paddingTop: 10,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 2,
        }}
      >
        <div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>End (median)</div>
          {typeof withdrawMedian === 'number' ? (
            <span style={{ color: moneyStoryStepColor('withdraw' as any), fontWeight: 850 }}>{money(withdrawMedian)}</span>
          ) : null}
          <div style={{ fontSize: 16, fontWeight: 850, color: moneyStoryStepColor('capital' as any) }}>
            {last ? money(last.medianCapital) : '—'}
          </div>
          
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            band:{' '}
            {last ? (
              <span style={{ color: moneyStoryStepColor('capital' as any) }}>
                {money(last.quantile25)}–{money(last.quantile75)}
              </span>
            ) : (
              '—'
            )}
          </div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            tail:{' '}
            {last ? (
              <span style={{ color: moneyStoryStepColor('capital' as any) }}>
                {money(last.quantile5)}–{money(last.quantile95)}
              </span>
            ) : (
              '—'
            )}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>Risk</div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 750,
              color:
                last && typeof last.negativeCapitalPercentage === 'number' && last.negativeCapitalPercentage > 0
                  ? '#ff4d4f'
                  : moneyStoryStepColor('return'),
            }}
          >
            fail: {last ? pctVal(last.negativeCapitalPercentage) : '—'}
          </div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            VaR: {last ? money(last.var) : '—'} · CVaR: {last ? money(last.cvar) : '—'}
          </div>
        </div>
      </div>

      {isLoadingDetails ? (
        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>Loading details…</div>
      ) : null}
    </button>
  );
};

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontWeight: 850, margin: '14px 0 8px' }}>{children}</div>
);

const InputsSummary: React.FC<{ input: AdvancedSimulationRequest; showShape?: boolean }> = ({
  input,
  showShape = true,
}) => {
  const computed = useMemo(() => computeFromInputAndSummaries(input, null), [input]);

  return (
    <div>
      <RunChipsRow computed={computed} />

      {showShape ? (
        <div
          style={{
            marginTop: 10,
            borderTop: '1px solid #2d2d2d',
            paddingTop: 10,
          }}
        >
          <PhaseShapeRow shape={computed.shape} />
        </div>
      ) : null}
    </div>
  );
};

const OutputsHero: React.FC<{ summaries: YearlySummary[]; metricSummaries?: MetricSummary[] | null }> = ({
  summaries,
  metricSummaries,
}) => {
  const last = summaries.length
    ? summaries.reduce((best, s) => (s.year > best.year ? s : best), summaries[0])
    : null;

  if (!last) return <div style={{ opacity: 0.75 }}>No summaries.</div>;

  const withdrawMedian = (() => {
    const ms = Array.isArray(metricSummaries) ? metricSummaries : [];
    const overall = ms.find((m) => String(m.metric ?? '').toLowerCase() === 'withdraw' && m.scope === 'OVERALL_TOTAL');
    if (overall && typeof overall.p50 === 'number') return overall.p50;

    const yearly = ms.find(
      (m) =>
        String(m.metric ?? '').toLowerCase() === 'withdraw' &&
        m.scope === 'YEARLY' &&
        typeof m.year === 'number' &&
        m.year === last.year
    );
    if (yearly && typeof yearly.p50 === 'number') return yearly.p50;
    return null;
  })();

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ border: '1px solid #3a3a3a', borderRadius: 12, padding: '10px 12px' }}>
          <div style={{ fontSize: 12, opacity: 0.75 }}>End year</div>
          {typeof withdrawMedian === 'number' ? (
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
              withdraw (median):{' '}
              <span style={{ color: moneyStoryStepColor('withdraw' as any), fontWeight: 850 }}>{money(withdrawMedian)}</span>
            </div>
          ) : null}
          <div
            style={{
              fontSize: 18,
              fontWeight: 900,
              marginTop: withdrawMedian !== null ? 6 : 4,
              color: moneyStoryStepColor('capital' as any),
            }}
          >
            {money(last.medianCapital)}
          </div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
            band:{' '}
            <span style={{ color: moneyStoryStepColor('capital' as any) }}>{money(last.quantile25)}–{money(last.quantile75)}</span>
          </div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
            tail:{' '}
            <span style={{ color: moneyStoryStepColor('capital' as any) }}>{money(last.quantile5)}–{money(last.quantile95)}</span>
          </div>
        </div>
        <div style={{ border: '1px solid #3a3a3a', borderRadius: 12, padding: '10px 12px' }}>
          <div style={{ fontSize: 12, opacity: 0.75 }}>Risk</div>
          <div style={{ marginTop: 4, fontSize: 14, fontWeight: 850 }}>
            fail rate: {pctVal(last.negativeCapitalPercentage)}
          </div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>VaR(5%): {money(last.var)}</div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>CVaR: {money(last.cvar)}</div>
        </div>
      </div>
    </div>
  );
};

const ExplorePage: React.FC = () => {
  const navigate = useNavigate();

  const PAGE_SIZE = 20;

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showLegend, setShowLegend] = useState(false);

  const [runs, setRuns] = useState<RunListItem[]>([]);
  const [runsState, setRunsState] = useState<LoadState>('idle');
  const [runsError, setRunsError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [failedOnly, setFailedOnly] = useState(false);
  const [taxRule, setTaxRule] = useState<'ANY' | 'CAPITAL' | 'NOTIONAL'>('ANY');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [minYears, setMinYears] = useState<number | ''>('');

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<'simple' | 'inDepth'>('simple');

  const [inputByRunId, setInputByRunId] = useState<Record<string, AdvancedSimulationRequest | null>>({});
  const [summariesByRunId, setSummariesByRunId] = useState<Record<string, YearlySummary[] | null>>({});
  const [metricSummariesByRunId, setMetricSummariesByRunId] = useState<Record<string, MetricSummary[] | null>>({});
  const [rowStateByRunId, setRowStateByRunId] = useState<Record<string, LoadState>>({});
  const [rowErrorByRunId, setRowErrorByRunId] = useState<Record<string, string | null>>({});

  const inflightRef = useRef<Record<string, Promise<void> | undefined>>({});

  const refreshRuns = useCallback(async () => {
    setRunsState('loading');
    setRunsError(null);
    try {
      const data = await listRuns();
      // Prefer most recent when createdAt exists.
      const sorted = [...data].sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
      setRuns(sorted);
      setRunsState('ready');
    } catch (e: any) {
      setRunsState('error');
      setRunsError(String(e?.message ?? e ?? 'Failed to load runs'));
    }
  }, []);

  useEffect(() => {
    refreshRuns();
  }, [refreshRuns]);

  const ensureRunLoaded = useCallback(
    async (runId: string) => {
      if (inputByRunId[runId] && summariesByRunId[runId] && metricSummariesByRunId[runId]) return;
      const inflight = inflightRef.current[runId];
      if (inflight) return inflight;

      const p = (async () => {
        setRowStateByRunId((prev) => ({ ...prev, [runId]: 'loading' }));
        setRowErrorByRunId((prev) => ({ ...prev, [runId]: null }));
        try {
          const [inputRaw, resultsMaybe] = await Promise.all([
            inputByRunId[runId] ? Promise.resolve(inputByRunId[runId]) : getRunInput(runId),
            summariesByRunId[runId] && metricSummariesByRunId[runId]
              ? Promise.resolve({ yearlySummaries: summariesByRunId[runId], metricSummaries: metricSummariesByRunId[runId] })
              : getStandardResultsV3(runId),
          ]);
          const input = inputRaw as AdvancedSimulationRequest;

          const yearlySummaries = Array.isArray((resultsMaybe as any)?.yearlySummaries)
            ? (((resultsMaybe as any).yearlySummaries ?? []) as YearlySummary[])
            : await getRunSummaries(runId);

          const metricSummaries = Array.isArray((resultsMaybe as any)?.metricSummaries)
            ? (((resultsMaybe as any).metricSummaries ?? []) as MetricSummary[])
            : [];

          setInputByRunId((prev) => ({ ...prev, [runId]: input }));
          setSummariesByRunId((prev) => ({ ...prev, [runId]: yearlySummaries }));
          setMetricSummariesByRunId((prev) => ({ ...prev, [runId]: metricSummaries }));
          setRowStateByRunId((prev) => ({ ...prev, [runId]: 'ready' }));
        } catch (e: any) {
          setRowStateByRunId((prev) => ({ ...prev, [runId]: 'error' }));
          setRowErrorByRunId((prev) => ({
            ...prev,
            [runId]: String(e?.message ?? e ?? 'Failed to load run details'),
          }));
        } finally {
          delete inflightRef.current[runId];
        }
      })();

      inflightRef.current[runId] = p;
      return p;
    },
    [inputByRunId, metricSummariesByRunId, summariesByRunId]
  );

  // Reset paging when the query/sort/filter changes.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [PAGE_SIZE, failedOnly, minYears, query, sortMode, taxRule]);

  // When filters require run details, load them in the background.
  useEffect(() => {
    const needsDetails = failedOnly || taxRule !== 'ANY' || minYears !== '' || sortMode === 'medianDesc' || sortMode === 'failureDesc';
    if (!needsDetails) return;
    runs.forEach((r) => {
      void ensureRunLoaded(r.id);
    });
  }, [ensureRunLoaded, failedOnly, minYears, runs, sortMode, taxRule]);

  const computedByRunId = useMemo(() => {
    const out: Record<string, RunComputed> = {};
    runs.forEach((r) => {
      out[r.id] = computeFromInputAndSummaries(inputByRunId[r.id] ?? null, summariesByRunId[r.id] ?? null);
    });
    return out;
  }, [inputByRunId, runs, summariesByRunId]);

  const filteredAndSorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const passesQuery = (r: RunListItem): boolean => {
      if (!q) return true;
      const c = computedByRunId[r.id];
      const blob = [
        r.id,
        r.createdAt ?? '',
        r.inputHash ?? '',
        (c?.shape ?? []).map((s) => `${s.phaseType} ${s.years}y`).join(' '),
        c?.overallTaxRule ?? '',
        c?.returnType ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    };

    const passesFailed = (r: RunListItem): boolean => {
      if (!failedOnly) return true;
      const last = computedByRunId[r.id]?.lastYear;
      return typeof last?.negativeCapitalPercentage === 'number' ? last.negativeCapitalPercentage > 0 : false;
    };

    const passesTaxRule = (r: RunListItem): boolean => {
      if (taxRule === 'ANY') return true;
      const rule = computedByRunId[r.id]?.overallTaxRule;
      return String(rule ?? '').toUpperCase() === taxRule;
    };

    const passesMinYears = (r: RunListItem): boolean => {
      if (minYears === '') return true;
      const v = computedByRunId[r.id]?.totalYears;
      return typeof v === 'number' ? v >= minYears : false;
    };

    const filtered = runs.filter((r) => passesQuery(r) && passesFailed(r) && passesTaxRule(r) && passesMinYears(r));

    const sortKey = (r: RunListItem): string => String(r.createdAt ?? '');
    const sorted = [...filtered].sort((a, b) => {
      if (sortMode === 'newest') return sortKey(b).localeCompare(sortKey(a));
      if (sortMode === 'oldest') return sortKey(a).localeCompare(sortKey(b));
      if (sortMode === 'seed') return String(a.rngSeedText ?? a.rngSeed ?? '').localeCompare(String(b.rngSeedText ?? b.rngSeed ?? ''));
      if (sortMode === 'medianDesc') {
        const am = computedByRunId[a.id]?.lastYear?.medianCapital;
        const bm = computedByRunId[b.id]?.lastYear?.medianCapital;
        const an = typeof am === 'number' ? am : -Infinity;
        const bn = typeof bm === 'number' ? bm : -Infinity;
        return bn - an;
      }
      if (sortMode === 'failureDesc') {
        const af = computedByRunId[a.id]?.lastYear?.negativeCapitalPercentage;
        const bf = computedByRunId[b.id]?.lastYear?.negativeCapitalPercentage;
        const an = typeof af === 'number' ? af : -Infinity;
        const bn = typeof bf === 'number' ? bf : -Infinity;
        return bn - an;
      }
      if (sortMode === 'depositDesc') {
        const ad = computedByRunId[a.id];
        const bd = computedByRunId[b.id];
        const aMonthly = typeof ad?.depositMonthly === 'number' ? ad.depositMonthly : 0;
        const bMonthly = typeof bd?.depositMonthly === 'number' ? bd.depositMonthly : 0;
        const aInit = typeof ad?.depositInitial === 'number' ? ad.depositInitial : 0;
        const bInit = typeof bd?.depositInitial === 'number' ? bd.depositInitial : 0;
        const aScore = aMonthly * 12 + aInit;
        const bScore = bMonthly * 12 + bInit;
        return bScore - aScore;
      }
      return 0;
    });

    return sorted;
  }, [computedByRunId, failedOnly, minYears, query, runs, sortMode, taxRule]);

  const visibleRuns = useMemo(
    () => filteredAndSorted.slice(0, Math.max(PAGE_SIZE, visibleCount)),
    [PAGE_SIZE, filteredAndSorted, visibleCount]
  );

  // Prefetch details for the visible batch so the gallery shows simple details
  // without needing a click for every card.
  useEffect(() => {
    visibleRuns.forEach((r) => {
      void ensureRunLoaded(r.id);
    });
  }, [ensureRunLoaded, visibleRuns]);

  const selectedRun = useMemo(() => {
    if (!selectedRunId) return null;
    return runs.find((r) => r.id === selectedRunId) ?? null;
  }, [runs, selectedRunId]);

  const selectedInput = selectedRunId ? (inputByRunId[selectedRunId] ?? null) : null;
  const selectedSummaries = selectedRunId ? (summariesByRunId[selectedRunId] ?? null) : null;
  const selectedMetricSummaries = selectedRunId ? (metricSummariesByRunId[selectedRunId] ?? null) : null;
  const selectedState = selectedRunId ? (rowStateByRunId[selectedRunId] ?? 'idle') : 'idle';
  const selectedErr = selectedRunId ? (rowErrorByRunId[selectedRunId] ?? null) : null;

  const openInspector = useCallback(
    async (runId: string) => {
      setSelectedRunId(runId);
      setInspectorTab('simple');
      await ensureRunLoaded(runId);
    },
    [ensureRunLoaded]
  );

  const closeInspector = useCallback(() => {
    setSelectedRunId(null);
  }, []);

  useEffect(() => {
    if (!selectedRunId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeInspector();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeInspector, selectedRunId]);

  const handleClone = useCallback(
    async (run: RunListItem) => {
      await ensureRunLoaded(run.id);
      const input = inputByRunId[run.id];
      if (!input) throw new Error('Missing run input');
      const normalReq = advancedToNormalRequest(input);
      const param = encodeScenarioToShareParam(normalReq);
      const search = new URLSearchParams({ scenario: param, scenarioAuto: '1' }).toString();
      navigate(`/simulation?${search}`);
    },
    [ensureRunLoaded, inputByRunId, navigate]
  );

  const handleSaveScenario = useCallback(
    async (run: RunListItem) => {
      await ensureRunLoaded(run.id);
      const input = inputByRunId[run.id];
      if (!input) throw new Error('Missing run input');

      const defaultName = `Run ${run.id}${run.createdAt ? ` (${fmtDateTime(run.createdAt)})` : ''}`;
      const name = window.prompt('Save scenario as…', defaultName) ?? '';
      if (!name.trim()) return;

      saveScenario(
        name,
        input,
        undefined,
        run.id,
        {
          id: run.id,
          createdAt: run.createdAt,
          rngSeed: run.rngSeed ?? undefined,
          rngSeedText: run.rngSeedText ?? undefined,
          modelAppVersion: run.modelAppVersion ?? undefined,
          modelBuildTime: run.modelBuildTime ?? undefined,
          modelSpringBootVersion: run.modelSpringBootVersion ?? undefined,
          modelJavaVersion: run.modelJavaVersion ?? undefined,
        }
      );
      window.alert('Saved to Scenarios.');
    },
    [ensureRunLoaded, inputByRunId]
  );

  const handleCsv = useCallback(async (runId: string) => {
    await exportSimulationCsv(runId);
  }, []);

  const activeChips = useMemo(() => {
    const chips: React.ReactNode[] = [];
    if (query.trim()) chips.push(<FilterChip tone="neutral" key="q" onRemove={() => setQuery('')}>“{query.trim()}”</FilterChip>);
    if (failedOnly) chips.push(<FilterChip tone="tax" key="f" onRemove={() => setFailedOnly(false)}>Failed</FilterChip>);
    if (taxRule !== 'ANY') chips.push(<FilterChip tone="tax" key="t" onRemove={() => setTaxRule('ANY')}>{taxRule}</FilterChip>);
    if (minYears !== '') chips.push(<FilterChip tone="neutral" key="m" onRemove={() => setMinYears('')}>≥ {minYears}y</FilterChip>);
    return chips;
  }, [failedOnly, minYears, query, taxRule]);

  return (
    <PageLayout variant="wide">
    <div style={{ maxWidth: 1500, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: '8px 0 6px' }}>Explorer</h2>
          <div style={{ fontSize: 13, opacity: 0.75 }}>
            Scenario gallery + run inspector
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            onClick={refreshRuns}
            style={{
              padding: '8px 10px',
              borderRadius: 10,
              border: '1px solid #444',
              background: '#2e2e2e',
              color: '#ddd',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      <div style={{ marginTop: 14, border: '1px solid #3a3a3a', borderRadius: 14, padding: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center' }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search runs (id, time, seed, version, hash, shape…)"
            style={{
              padding: '10px 12px',
              borderRadius: 12,
              border: '1px solid #444',
              background: '#141414',
              color: '#ddd',
            }}
          />
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <PillButton onClick={() => setViewMode('grid')} active={viewMode === 'grid'}>
              Grid
            </PillButton>
            <PillButton onClick={() => setViewMode('list')} active={viewMode === 'list'}>
              List
            </PillButton>

            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              style={{
                padding: '9px 10px',
                borderRadius: 12,
                border: '1px solid #444',
                background: '#141414',
                color: '#ddd',
                fontWeight: 650,
              }}
              aria-label="Sort"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="seed">Seed</option>
              <option value="medianDesc">End median (desc)</option>
              <option value="failureDesc">Failure rate (desc)</option>
              <option value="depositDesc">Deposit (desc)</option>
            </select>

            <PillButton onClick={() => setFailedOnly((v) => !v)} active={failedOnly}>
              Failed
            </PillButton>

            <PillButton onClick={() => setShowAdvanced(true)}>
              Advanced
            </PillButton>
          </div>
        </div>

        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, opacity: 0.75 }}>Tax rule</span>
            <select
              value={taxRule}
              onChange={(e) => setTaxRule(e.target.value as any)}
              style={{
                padding: '6px 10px',
                borderRadius: 999,
                border: '1px solid #444',
                background: '#141414',
                color: '#ddd',
                fontSize: 13,
                fontWeight: 650,
              }}
              aria-label="Tax rule filter"
            >
              <option value="ANY">Any</option>
              <option value="CAPITAL">Capital</option>
              <option value="NOTIONAL">Notional</option>
            </select>
          </div>

          {activeChips.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>{activeChips}</div>
          ) : (
            <div style={{ fontSize: 12, opacity: 0.6 }}>No active filters</div>
          )}
        </div>
      </div>

      {runsState === 'loading' && <div style={{ marginTop: 12, opacity: 0.8 }}>Loading runs…</div>}
      {runsState === 'error' && (
        <div style={{ marginTop: 12, color: '#ff6b6b' }}>Failed to load runs: {runsError}</div>
      )}

      <div style={{ marginTop: 12, opacity: 0.85, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span>
          Showing <strong>{visibleRuns.length}</strong> / <strong>{filteredAndSorted.length}</strong> runs
        </span>
        <div style={{ display: 'inline-flex', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setShowLegend((v) => !v)}
            style={{
              border: '1px solid #444',
              background: 'transparent',
              color: '#ddd',
              borderRadius: 999,
              padding: '2px 10px',
              fontSize: 12,
              cursor: 'pointer',
            }}
            title="Show/hide legend"
          >
            Color coding
          </button>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              flexWrap: 'nowrap',
              gap: 8,
              overflow: 'hidden',
              maxWidth: showLegend ? 1000 : 0,
              opacity: showLegend ? 1 : 0,
              marginLeft: showLegend ? 10 : 0,
              transition: 'max-width 180ms ease, opacity 140ms ease, margin-left 180ms ease',
            }}
            aria-hidden={!showLegend}
          >
            <Tag tone="neutral" title="Simulation duration / total years">Duration</Tag>
            <Tag tone="deposit" title="Deposit chips">Deposit</Tag>
            <Tag tone="return" title="Return model chip">Return model</Tag>
            <Tag tone="inflation" title="Inflation chip">Inflation</Tag>
            <Tag tone="tax" title="Tax inputs">Tax</Tag>
            <Tag tone="fee" title="Fee chip">Fee</Tag>
            <Tag tone="withdraw" title="Withdraw metric">Withdraw</Tag>
            <Tag tone="capital" title="Capital metric">Capital</Tag>
          </div>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div
          style={{
            marginTop: 12,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 12,
          }}
        >
          {visibleRuns.map((r) => {
            const st = rowStateByRunId[r.id] ?? 'idle';
            const computed = computedByRunId[r.id];
            const metricSummaries = metricSummariesByRunId[r.id] ?? null;
            return (
              <RunCard
                key={r.id}
                run={r}
                computed={computed}
                metricSummaries={metricSummaries}
                isSelected={selectedRunId === r.id}
                isLoadingDetails={st === 'loading'}
                onSelect={() => void openInspector(r.id)}
              />
            );
          })}

          {filteredAndSorted.length === 0 && runsState !== 'loading' ? (
            <div style={{ opacity: 0.8 }}>No runs match your filters.</div>
          ) : null}
        </div>
      ) : (
        <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
          {visibleRuns.map((r) => {
            const st = rowStateByRunId[r.id] ?? 'idle';
            const computed = computedByRunId[r.id];
            const metricSummaries = metricSummariesByRunId[r.id] ?? null;
            return (
              <RunListRow
                key={r.id}
                run={r}
                computed={computed}
                metricSummaries={metricSummaries}
                isSelected={selectedRunId === r.id}
                isLoadingDetails={st === 'loading'}
                onSelect={() => void openInspector(r.id)}
              />
            );
          })}

          {filteredAndSorted.length === 0 && runsState !== 'loading' ? (
            <div style={{ opacity: 0.8 }}>No runs match your filters.</div>
          ) : null}
        </div>
      )}

      {visibleRuns.length < filteredAndSorted.length ? (
        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
            style={{
              padding: '10px 14px',
              borderRadius: 12,
              border: '1px solid #444',
              background: '#2e2e2e',
              color: '#ddd',
              cursor: 'pointer',
              fontWeight: 750,
            }}
          >
            Load more (+{PAGE_SIZE})
          </button>
        </div>
      ) : null}

      {/* Advanced filters drawer */}
      {showAdvanced ? (
        <div
          onClick={() => setShowAdvanced(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            zIndex: 50,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
          role="dialog"
          aria-label="Advanced filters"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(520px, 96vw)',
              height: '100%',
              overflow: 'auto',
              background: '#111',
              borderLeft: '1px solid #333',
              padding: 16,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>Advanced filters</div>
              <button
                type="button"
                onClick={() => setShowAdvanced(false)}
                style={{
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: '1px solid #444',
                  background: 'transparent',
                  color: '#ddd',
                  cursor: 'pointer',
                  fontWeight: 750,
                }}
              >
                Close
              </button>
            </div>

            <SectionTitle>Duration</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.75 }}>Min years</span>
                <input
                  value={minYears}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v.trim() === '') return setMinYears('');
                    const n = Number(v);
                    if (Number.isFinite(n) && n >= 0) setMinYears(Math.floor(n));
                  }}
                  inputMode="numeric"
                  placeholder="e.g. 30"
                  style={{
                    padding: '10px 12px',
                    borderRadius: 12,
                    border: '1px solid #444',
                    background: '#141414',
                    color: '#ddd',
                  }}
                />
              </label>
              <div style={{ display: 'grid', alignContent: 'end' }}>
                <button
                  type="button"
                  onClick={() => setMinYears('')}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 12,
                    border: '1px solid #444',
                    background: 'transparent',
                    color: '#ddd',
                    cursor: 'pointer',
                    fontWeight: 750,
                  }}
                >
                  Reset
                </button>
              </div>
            </div>

            <div style={{ marginTop: 16, fontSize: 12, opacity: 0.75 }}>
              Some filters need run details (input + summaries). Those load in the background.
            </div>
          </div>
        </div>
      ) : null}

      {/* Run inspector drawer */}
      {selectedRunId ? (
        <div
          onClick={closeInspector}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            zIndex: 60,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
          role="dialog"
          aria-label="Run inspector"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(820px, 96vw)',
              height: '100%',
              overflow: 'auto',
              background: '#0f0f0f',
              borderLeft: '1px solid #333',
              padding: 16,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 950, fontSize: 16 }}>Run inspector</div>
                <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>
                  {selectedRun ? `${compactId(selectedRun.id)} · ${fmtDateTime(selectedRun.createdAt)}` : compactId(selectedRunId)}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={closeInspector}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 10,
                    border: '1px solid #444',
                    background: 'transparent',
                    color: '#ddd',
                    cursor: 'pointer',
                    fontWeight: 750,
                  }}
                >
                  Close
                </button>
              </div>
            </div>

            {selectedState === 'loading' || selectedState === 'idle' ? (
              <div style={{ marginTop: 14, opacity: 0.8 }}>Loading…</div>
            ) : null}
            {selectedState === 'error' ? (
              <div style={{ marginTop: 14, color: '#ff6b6b' }}>{selectedErr}</div>
            ) : null}

            {selectedRun && selectedInput && selectedSummaries && selectedState === 'ready' ? (
              <>
                <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <PillButton onClick={() => setInspectorTab('simple')} active={inspectorTab === 'simple'}>
                    Simple
                  </PillButton>
                  <PillButton onClick={() => setInspectorTab('inDepth')} active={inspectorTab === 'inDepth'}>
                    In-depth
                  </PillButton>

                  <div style={{ flex: 1 }} />

                  <button
                    type="button"
                    onClick={() => void handleClone(selectedRun)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: '1px solid #444',
                      background: '#2e2e2e',
                      color: '#ddd',
                      cursor: 'pointer',
                      fontWeight: 800,
                    }}
                  >
                    Clone to form
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleSaveScenario(selectedRun)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: '1px solid #444',
                      background: 'transparent',
                      color: '#ddd',
                      cursor: 'pointer',
                      fontWeight: 750,
                    }}
                  >
                    Save
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleCsv(selectedRun.id)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: '1px solid #444',
                      background: 'transparent',
                      color: '#ddd',
                      cursor: 'pointer',
                      fontWeight: 750,
                    }}
                  >
                    CSV
                  </button>
                </div>

                <div style={{ marginTop: 12 }}>
                  {inspectorTab === 'simple' ? (
                    <>
                      <SectionTitle>Inputs</SectionTitle>
                      <InputsSummary input={selectedInput} showShape={false} />

                      <SectionTitle>Phase shape</SectionTitle>
                      <div
                        style={{
                          border: '1px solid #2d2d2d',
                          borderRadius: 12,
                          padding: 10,
                          background: 'rgba(255,255,255,0.02)',
                        }}
                      >
                        <PhaseShapeRow shape={computeFromInputAndSummaries(selectedInput, null).shape} />
                      </div>

                      <SectionTitle>Outputs</SectionTitle>
                      <OutputsHero summaries={selectedSummaries} metricSummaries={selectedMetricSummaries} />
                    </>
                  ) : (
                    <>
                      <SectionTitle>Timeline overview</SectionTitle>
                      <MultiPhaseOverview
                        data={selectedSummaries}
                        timeline={buildTimelineFromAdvancedRequest(selectedInput)}
                      />

                      <SectionTitle>Inputs</SectionTitle>
                      <InputsSummary input={selectedInput} />

                      <details style={{ marginTop: 12 }}>
                        <summary style={{ cursor: 'pointer' }}>Raw yearly summaries (JSON)</summary>
                        <pre
                          style={{
                            marginTop: 8,
                            maxHeight: 260,
                            overflow: 'auto',
                            border: '1px solid #3a3a3a',
                            borderRadius: 10,
                            padding: 8,
                          }}
                        >
{JSON.stringify(selectedSummaries, null, 2)}
                        </pre>
                      </details>
                    </>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
    </PageLayout>
  );
};

export default ExplorePage;
