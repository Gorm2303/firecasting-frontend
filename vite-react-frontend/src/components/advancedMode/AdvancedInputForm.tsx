// src/components/advancedMode/AdvancedInputForm.tsx

import React, { useCallback, useEffect, useState } from 'react';
import { YearlySummary } from '../../models/YearlySummary';
import { getApiBaseUrl } from '../../config/runtimeEnv';
import {
  ArrayFieldConfig,
  FieldConfig,
  FormConfig,
  GroupFieldConfig,
  NumberFieldConfig,
  SelectFieldConfig,
  buildInitialFormState,
  buildInitialValueForField,
  evaluateVisibleWhen,
} from './formTypes';
import SimulationProgress from '../SimulationProgress';

interface InputFormProps {
  onSimulationComplete: (stats: YearlySummary[]) => void;
}

const containerStyle: React.CSSProperties = {
  maxWidth: '960px',
  margin: '0 auto',
  padding: '1rem',
};

const titleStyle: React.CSSProperties = {
  margin: '0 0 0.25rem',
};

const subtitleStyle: React.CSSProperties = {
  margin: '0 0 1rem',
  fontSize: '0.9rem',
  opacity: 0.8,
};

const errorStyle: React.CSSProperties = {
  marginBottom: '0.75rem',
  fontSize: '0.9rem',
};

const inlineErrorStyle: React.CSSProperties = {
  marginTop: '0.25rem',
  fontSize: '0.8rem',
  color: 'crimson',
  whiteSpace: 'pre-wrap',
};

const fieldWrapperStyle: React.CSSProperties = {
  marginBottom: '0.5rem',
};

const helpTextStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  opacity: 0.8,
};

const formGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
  gap: '0.75rem 1rem',
  marginBottom: '1rem',
};

const groupContainerStyle: React.CSSProperties = {
  marginBottom: '1rem',
};

const groupTitleStyle: React.CSSProperties = {
  margin: '0 0 0.5rem',
  fontSize: '1rem',
  fontWeight: 600,
};

const phasesContainerStyle: React.CSSProperties = {
  marginTop: '1rem',
  width: '100%',
  boxSizing: 'border-box',
};

const phasesTitleRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  marginBottom: '0.5rem',
};

const phasesTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '1rem',
  fontWeight: 600,
};

const phasesCountStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  opacity: 0.8,
};

const actionsRowStyle: React.CSSProperties = {
  marginTop: '0.75rem',
  display: 'flex',
  gap: '0.5rem',
  flexWrap: 'wrap',
};

const tabRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
  marginBottom: '1.5rem',
  borderBottom: '1px solid #333',
  paddingBottom: '0.5rem',
};

const tabButtonStyle = (active: boolean): React.CSSProperties => ({
  padding: '8px 16px',
  borderRadius: '8px 8px 0 0',
  border: '1px solid #333',
  borderBottom: active ? '2px solid #007bff' : '1px solid #333',
  background: active ? 'rgba(0, 123, 255, 0.1)' : 'transparent',
  cursor: 'pointer',
  fontSize: '0.9rem',
  fontWeight: active ? 600 : 400,
  color: active ? '#007bff' : 'inherit',
  transition: 'all 0.2s ease',
});

const btnStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid #444',
  cursor: 'pointer',
  fontSize: 14,
  background: 'transparent',
};

const MAX_DURATION_YEARS = 100;

const splitMonths = (totalMonths: number): { years: number; months: number } => {
  const safe = Math.max(0, Math.floor(Number(totalMonths) || 0));
  return { years: Math.floor(safe / 12), months: safe % 12 };
};

const normaliseDuration = (years: number, months: number) => {
  let y = Math.max(0, Math.floor(Number(years) || 0));
  let m = Math.max(0, Math.floor(Number(months) || 0));

  if (m >= 12) {
    y += Math.floor(m / 12);
    m = m % 12;
  }

  if (y > MAX_DURATION_YEARS) {
    y = MAX_DURATION_YEARS;
    m = 0;
  }

  return { years: y, months: m, totalMonths: y * 12 + m };
};

const normaliseDurationWithMinTotal = (years: number, months: number, minTotalMonths: number) => {
  const base = normaliseDuration(years, months);
  if (base.totalMonths >= minTotalMonths) return base;
  const total = Math.max(minTotalMonths, 0);
  const y = Math.min(MAX_DURATION_YEARS, Math.floor(total / 12));
  const m = total % 12;
  return { years: y, months: m, totalMonths: y * 12 + m };
};

type AdvancedPhaseRequest = {
  phaseType: 'DEPOSIT' | 'PASSIVE' | 'WITHDRAW';
  durationInMonths: number;
  initialDeposit?: number;
  monthlyDeposit?: number;
  yearlyIncreaseInPercentage?: number;
  withdrawRate?: number;
  withdrawAmount?: number;
  lowerVariationPercentage?: number;
  upperVariationPercentage?: number;
  taxRules?: ('EXEMPTIONCARD' | 'STOCKEXEMPTION')[];
};

type AdvancedSimulationRequest = {
  startDate: { date: string };
  phases: AdvancedPhaseRequest[];
  overallTaxRule: string;
  taxPercentage: number;
  returnType: string;
  returnerConfig?: {
    seed?: number;
    simpleAveragePercentage?: number;
    distribution?: {
      type?: string;
      normal?: { mean?: number; standardDeviation?: number };
      brownianMotion?: { drift?: number; volatility?: number };
      studentT?: { mu?: number; sigma?: number; nu?: number };
      regimeBased?: {
        tickMonths?: number;
        regimes?: Array<{
          distributionType?: string;
          expectedDurationMonths?: number;
          switchWeights?: { toRegime0?: number; toRegime1?: number; toRegime2?: number };
          normal?: { mean?: number; standardDeviation?: number };
          studentT?: { mu?: number; sigma?: number; nu?: number };
        }>;
      };
    };
  };
  taxExemptionConfig?: {
    exemptionCard?: { limit?: number; yearlyIncrease?: number };
    stockExemption?: { taxRate?: number; limit?: number; yearlyIncrease?: number };
  };
  inflationFactor: number;
};

const toNumberOrUndefined = (v: any): number | undefined => {
  if (v === '' || v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const mapOverallTaxRule = (v: any): string => {
  const s = String(v ?? '').trim();
  const l = s.toLowerCase();
  if (l === 'capital' || l === 'notional') return l;
  if (l.includes('capital')) return 'capital';
  if (l.includes('notional')) return 'notional';
  return s || 'capital';
};

const mapTaxExemptionsToRules = (v: any): ('EXEMPTIONCARD' | 'STOCKEXEMPTION')[] => {
  const s = String(v ?? '').toUpperCase();
  if (s === 'EXEMPTIONCARD') return ['EXEMPTIONCARD'];
  if (s === 'STOCKEXEMPTION') return ['STOCKEXEMPTION'];
  if (s === 'BOTH') return ['EXEMPTIONCARD', 'STOCKEXEMPTION'];
  return [];
};

const buildAdvancedRequest = (data: Record<string, any>): AdvancedSimulationRequest => {
  const phasesInput: any[] = Array.isArray(data.phases) ? data.phases : [];
  const phases: AdvancedPhaseRequest[] = phasesInput.map((p) => ({
    phaseType: (String(p?.phaseType ?? 'DEPOSIT').toUpperCase() as any) ?? 'DEPOSIT',
    durationInMonths: Number(p?.durationInMonths ?? 0),
    initialDeposit: toNumberOrUndefined(p?.initialDeposit),
    monthlyDeposit: toNumberOrUndefined(p?.monthlyDeposit),
    yearlyIncreaseInPercentage: toNumberOrUndefined(p?.yearlyIncreaseInPercentage),
    withdrawRate: toNumberOrUndefined(p?.withdrawRate),
    withdrawAmount: toNumberOrUndefined(p?.withdrawAmount),
    lowerVariationPercentage: toNumberOrUndefined(p?.lowerVariationPercentage),
    upperVariationPercentage: toNumberOrUndefined(p?.upperVariationPercentage),
    taxRules: mapTaxExemptionsToRules(p?.taxExemptions),
  }));

  const avgInflationPct = toNumberOrUndefined(data?.inflation?.averagePercentage) ?? 2;
  const inflationFactor = 1 + avgInflationPct / 100;

  const taxExemptionConfig = {
    exemptionCard: {
      limit: toNumberOrUndefined(data?.tax?.exemptionCard?.limit),
      yearlyIncrease: toNumberOrUndefined(data?.tax?.exemptionCard?.increase),
    },
    stockExemption: {
      taxRate: toNumberOrUndefined(data?.tax?.stockExemption?.taxRate),
      limit: toNumberOrUndefined(data?.tax?.stockExemption?.limit),
      yearlyIncrease: toNumberOrUndefined(data?.tax?.stockExemption?.increase),
    },
  };

  const hasTaxExemptionConfig =
    taxExemptionConfig.exemptionCard.limit !== undefined ||
    taxExemptionConfig.exemptionCard.yearlyIncrease !== undefined ||
    taxExemptionConfig.stockExemption.taxRate !== undefined ||
    taxExemptionConfig.stockExemption.limit !== undefined ||
    taxExemptionConfig.stockExemption.yearlyIncrease !== undefined;

  const regimeBasedInput = data?.returner?.distribution?.regimeBased;
  const regimesInput: any[] = Array.isArray(regimeBasedInput?.regimes) ? regimeBasedInput.regimes : [];
  const mappedRegimes = regimesInput.map((r) => ({
    distributionType: r?.distributionType,
    expectedDurationMonths: toNumberOrUndefined(r?.expectedDurationMonths),
    switchWeights: {
      toRegime0: toNumberOrUndefined(r?.switchWeights?.toRegime0),
      toRegime1: toNumberOrUndefined(r?.switchWeights?.toRegime1),
      toRegime2: toNumberOrUndefined(r?.switchWeights?.toRegime2),
    },
    normal: {
      mean: toNumberOrUndefined(r?.normal?.mean),
      standardDeviation: toNumberOrUndefined(r?.normal?.standardDeviation),
    },
    studentT: {
      mu: toNumberOrUndefined(r?.studentT?.mu),
      sigma: toNumberOrUndefined(r?.studentT?.sigma),
      nu: toNumberOrUndefined(r?.studentT?.nu),
    },
  }));

  const returnerConfig = {
    seed: toNumberOrUndefined(data?.returner?.random?.seed),
    simpleAveragePercentage: toNumberOrUndefined(data?.returner?.simpleReturn?.averagePercentage),
    distribution: {
      type: data?.returner?.distribution?.type,
      normal: {
        mean: toNumberOrUndefined(data?.returner?.distribution?.normal?.mean),
        standardDeviation: toNumberOrUndefined(
          data?.returner?.distribution?.normal?.standardDeviation
        ),
      },
      brownianMotion: {
        drift: toNumberOrUndefined(data?.returner?.distribution?.brownianMotion?.drift),
        volatility: toNumberOrUndefined(
          data?.returner?.distribution?.brownianMotion?.volatility
        ),
      },
      studentT: {
        mu: toNumberOrUndefined(data?.returner?.distribution?.studentT?.mu),
        sigma: toNumberOrUndefined(data?.returner?.distribution?.studentT?.sigma),
        nu: toNumberOrUndefined(data?.returner?.distribution?.studentT?.nu),
      },
      regimeBased: {
        tickMonths: toNumberOrUndefined(regimeBasedInput?.tickMonths),
        regimes: mappedRegimes,
      },
    },
  };

  const hasReturnerConfig =
    returnerConfig.seed !== undefined ||
    returnerConfig.simpleAveragePercentage !== undefined ||
    returnerConfig.distribution?.type !== undefined;

  return {
    startDate: { date: String(data.startDate ?? '') },
    phases,
    overallTaxRule: mapOverallTaxRule(data.taxRule),
    taxPercentage: Number(data?.tax?.percentage ?? 0),
    returnType: String(data?.returner?.type ?? 'dataDrivenReturn'),
    returnerConfig: hasReturnerConfig ? returnerConfig : undefined,
    taxExemptionConfig: hasTaxExemptionConfig ? taxExemptionConfig : undefined,
    inflationFactor,
  };
};

const AdvancedInputForm: React.FC<InputFormProps> = ({ onSimulationComplete }) => {
  const [formConfig, setFormConfig] = useState<FormConfig | null>(null);
  const [formData, setFormData] = useState<Record<string, any> | null>(null);
  const [initialFormData, setInitialFormData] = useState<Record<string, any> | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitErrorDetails, setSubmitErrorDetails] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [simulationId, setSimulationId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'taxation' | 'returns' | 'phases'>('general');

  const TAB_MAPPING: Record<string, string> = {
    startDate: 'general',
    inflation: 'general',
    taxRule: 'general',
    tax: 'taxation',
    returner: 'returns',
    phases: 'phases',
  };

  const hasTabErrors = (tabId: string): boolean => {
    return Object.keys(fieldErrors).some((path) => {
      const fieldId = path.split(/[.\[]/)[0];
      return (TAB_MAPPING[fieldId] || 'general') === tabId;
    });
  };

  const SIM_API_BASE = getApiBaseUrl();
  const formsUrl = new URL('../forms/advanced-simulation', SIM_API_BASE + '/').toString();
  const startAdvancedUrl = new URL('start-advanced', SIM_API_BASE + '/').toString();

  const fetchConfig = useCallback(async () => {
    try {
      setLoadingConfig(true);
      setError(null);

      const fetchFormConfigFrom = async (url: string): Promise<FormConfig> => {
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(`Failed to fetch form config: ${res.status}`);
        return (await res.json()) as FormConfig;
      };

      const json = await fetchFormConfigFrom(formsUrl);
      const initial = buildInitialFormState(json);

      setFormConfig(json);
      setInitialFormData(initial);
      setFormData(JSON.parse(JSON.stringify(initial)));
    } catch (e: any) {
      console.error(e);
      setError(e.message ?? 'Error fetching form config');
    } finally {
      setLoadingConfig(false);
    }
  }, [formsUrl]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  type ApiError = { message?: string; details?: string[] };

  const parseApiError = async (res: Response): Promise<ApiError> => {
    const text = await res.text();
    if (!text) return { message: `Request failed (${res.status})`, details: [] };
    try {
      const json = JSON.parse(text);
      if (json && typeof json === 'object') return json as ApiError;
    } catch {
      // ignore
    }
    return { message: text, details: [] };
  };

  const extractPathAndMessage = (detailLine: string): { path?: string; message: string } => {
    const s = String(detailLine ?? '').trim();
    const idx = s.indexOf(':');
    if (idx < 0) return { message: s };
    const left = s.slice(0, idx).trim();
    const right = s.slice(idx + 1).trim();
    return { path: left || undefined, message: right || s };
  };

  const stripToKnownRoot = (p: string): string => {
    const known = [
      'startDate',
      'phases',
      'overallTaxRule',
      'taxPercentage',
      'returnType',
      'returnerConfig',
      'taxExemptionConfig',
      'inflationFactor',
    ];
    for (const k of known) {
      const i = p.indexOf(k);
      if (i >= 0) return p.slice(i);
    }
    return p;
  };

  // Best-effort mapping from backend DTO paths to form-state paths.
  const mapRequestPathToFormPath = (rawPath: string): string => {
    let p = stripToKnownRoot(String(rawPath ?? '').trim());

    // Convert `startDate.date` to the single date field
    if (p === 'startDate.date') return 'startDate';

    // overallTaxRule is driven by `taxRule` in the form
    if (p === 'overallTaxRule') return 'taxRule';

    // taxPercentage comes from `tax.percentage`
    if (p === 'taxPercentage') return 'tax.percentage';

    // returnerConfig.* originates from returner group
    if (p.startsWith('returnerConfig.seed')) return p.replace('returnerConfig.seed', 'returner.random.seed');
    if (p.startsWith('returnerConfig.simpleAveragePercentage')) {
      return p.replace('returnerConfig.simpleAveragePercentage', 'returner.simpleReturn.averagePercentage');
    }
    if (p.startsWith('returnerConfig.distribution.')) {
      return p.replace('returnerConfig.distribution.', 'returner.distribution.');
    }
    if (p.startsWith('returnerConfig.')) {
      return p.replace('returnerConfig.', 'returner.');
    }

    // taxExemptionConfig.* originates from tax group
    if (p.startsWith('taxExemptionConfig.')) {
      return p.replace('taxExemptionConfig.', 'tax.');
    }

    return p;
  };

  const renderField = (
    field: FieldConfig,
    value: any,
    onChange: (v: any) => void,
    ctxCurrent: any,
    root: any,
    path: string
  ): React.ReactNode => {
    const visible = evaluateVisibleWhen(field.visibleWhen, {
      root,
      current: ctxCurrent,
    });
    if (!visible) return null;

    const valueForInput = value === undefined || value === null ? '' : value;
    const maybeHelp = field.helpText ? <div style={helpTextStyle}>{field.helpText}</div> : null;

    const errs = fieldErrors[path];
    const maybeError = errs && errs.length > 0 ? (
      <div style={inlineErrorStyle}>{errs.join('\n')}</div>
    ) : null;

    switch (field.type) {
      case 'text':
        return (
          <div style={fieldWrapperStyle} key={field.id}>
            <label>
              {field.label}
              <input
                type="text"
                value={String(valueForInput)}
                onChange={(e) => onChange(e.target.value)}
                style={{ marginLeft: '0.5rem' }}
              />
            </label>
            {maybeHelp}
            {maybeError}
          </div>
        );

      case 'date':
        return (
          <div style={fieldWrapperStyle} key={field.id}>
            <label>
              {field.label}
              <input
                type="date"
                value={String(valueForInput)}
                onChange={(e) => onChange(e.target.value)}
                style={{ marginLeft: '0.5rem' }}
              />
            </label>
            {maybeHelp}
            {maybeError}
          </div>
        );

      case 'number':
        // Special-case: split durationInMonths into years + months like normal mode UI.
        if (field.id === 'durationInMonths') {
          const { years, months } = splitMonths(Number(valueForInput) || 0);
          return (
            <div style={fieldWrapperStyle} key={field.id}>
              <div style={{ marginBottom: '0.25rem' }}>{field.label}</div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <input
                    type="number"
                    min={0}
                    max={MAX_DURATION_YEARS}
                    value={years}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const nextYears = raw === '' ? 0 : Number(raw);
                      const next = normaliseDuration(nextYears, months);
                      onChange(next.totalMonths);
                    }}
                  />
                  <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                    Years (0–{MAX_DURATION_YEARS})
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <input
                    type="number"
                    min={0}
                    max={11}
                    value={months}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const nextMonths = raw === '' ? 0 : Number(raw);
                      const next = normaliseDuration(years, nextMonths);
                      onChange(next.totalMonths);
                    }}
                  />
                  <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>Months (0–11)</span>
                </div>
              </div>
              {maybeHelp}
              {maybeError}
            </div>
          );
        }

        // Special-case: split expectedDurationMonths into years + months.
        // This field has a backend min of 1 month.
        if (field.id === 'expectedDurationMonths') {
          const { years, months } = splitMonths(Number(valueForInput) || 0);
          return (
            <div style={fieldWrapperStyle} key={field.id}>
              <div style={{ marginBottom: '0.25rem' }}>{field.label}</div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <input
                    type="number"
                    min={0}
                    max={MAX_DURATION_YEARS}
                    value={years}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const nextYears = raw === '' ? 0 : Number(raw);
                      const next = normaliseDurationWithMinTotal(nextYears, months, 1);
                      onChange(next.totalMonths);
                    }}
                  />
                  <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                    Years (0–{MAX_DURATION_YEARS})
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <input
                    type="number"
                    min={0}
                    max={11}
                    value={months}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const nextMonths = raw === '' ? 0 : Number(raw);
                      const next = normaliseDurationWithMinTotal(years, nextMonths, 1);
                      onChange(next.totalMonths);
                    }}
                  />
                  <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>Months (0–11)</span>
                </div>
              </div>
              {maybeHelp}
              {maybeError}
            </div>
          );
        }

        return (
          <div style={fieldWrapperStyle} key={field.id}>
            <label>
              {field.label}
              <input
                type="number"
                value={valueForInput}
                onChange={(e) => {
                  const v = e.target.value;
                  onChange(v === '' ? '' : Number(v));
                }}
                min={(field as NumberFieldConfig).min}
                max={(field as NumberFieldConfig).max}
                step={(field as NumberFieldConfig).step ?? 0.1}
                style={{ marginLeft: '0.5rem' }}
              />
            </label>
            {maybeHelp}
            {maybeError}
          </div>
        );

      case 'checkbox':
        return (
          <div style={fieldWrapperStyle} key={field.id}>
            <label>
              <input
                type="checkbox"
                checked={Boolean(value)}
                onChange={(e) => onChange(e.target.checked)}
                style={{ marginRight: '0.5rem' }}
              />
              {field.label}
            </label>
            {maybeHelp}
            {maybeError}
          </div>
        );

      case 'select':
        return (
          <div style={fieldWrapperStyle} key={field.id}>
            <label>
              {field.label}
              <select
                value={String(valueForInput)}
                onChange={(e) => onChange(e.target.value)}
                style={{ marginLeft: '0.5rem' }}
              >
                {(field as SelectFieldConfig).options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            {maybeHelp}
            {maybeError}
          </div>
        );

      case 'group': {
        const groupField = field as GroupFieldConfig;
        const groupValue = value && typeof value === 'object' ? value : {};
        
        // Check if this is the distribution group with regime-based type selected
        const isDistributionGroup = field.id === 'distribution';
        const isRegimeBasedSelected = isDistributionGroup && groupValue?.type === 'regimeBased';
        
        // If regime-based distribution is selected, use full-width layout for better readability
        const childrenGridStyle: React.CSSProperties | undefined = isRegimeBasedSelected 
          ? ({ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem', width: '100%', boxSizing: 'border-box' } as React.CSSProperties)
          : formGridStyle;
        
        return (
          <div
            style={{
              ...groupContainerStyle,
              border: '1px solid #333',
              borderRadius: 8,
              padding: '1rem',
              background: 'rgba(255,255,255,0.02)',
              gridColumn: isRegimeBasedSelected ? '1 / -1' : undefined,
            }}
            key={field.id}
          >
            <div style={{ ...groupTitleStyle, borderBottom: '1px solid #333', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              {field.label}
            </div>
            <div style={childrenGridStyle}>
              {groupField.children.map((child) =>
                renderField(
                  child,
                  groupValue[child.id],
                  (v) => onChange({ ...groupValue, [child.id]: v }),
                  groupValue,
                  root,
                  path ? `${path}.${child.id}` : child.id
                )
              )}
            </div>
            {maybeError}
          </div>
        );
      }

      case 'array': {
        const arrField = field as ArrayFieldConfig;
        const arr: any[] = Array.isArray(value) ? value : [];
        const canAdd = arrField.maxItems == null || arr.length < arrField.maxItems;
        const canRemove = arrField.minItems == null ? true : arr.length > arrField.minItems;

        // Check if this is the regimes array within distribution group
        const isRegimesArray = field.id === 'regimes';
        const containerStyle: React.CSSProperties | undefined = isRegimesArray
          ? ({ ...phasesContainerStyle, display: 'flex', flexDirection: 'column', gap: '1rem' } as React.CSSProperties)
          : phasesContainerStyle;

        return (
          <div style={containerStyle} key={field.id}>
            <div style={phasesTitleRowStyle}>
              <h3 style={phasesTitleStyle}>{field.label}</h3>
              <span style={phasesCountStyle}>
                {arr.length} item{arr.length === 1 ? '' : 's'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {arr.map((item, idx) => {
                const itemValue = item && typeof item === 'object' ? item : {};
                const phaseType = String(itemValue.phaseType || 'DEPOSIT').toUpperCase();
                
                let cardBorder = '1px solid #333';
                let cardBg = 'transparent';
                if (phaseType === 'DEPOSIT') cardBorder = '1px solid #28a745';
                if (phaseType === 'WITHDRAW') cardBorder = '1px solid #dc3545';
                if (phaseType === 'PASSIVE') cardBorder = '1px solid #ffc107';

                return (
                  <div
                    key={`${field.id}-${idx}`}
                    style={{
                      border: cardBorder,
                      borderRadius: 12,
                      padding: '1rem',
                      background: cardBg,
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      width: isRegimesArray ? '100%' : undefined,
                      boxSizing: 'border-box',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '1rem',
                        borderBottom: '1px solid #333',
                        paddingBottom: '0.5rem',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ opacity: 0.6 }}>#{idx + 1}</span>
                        {itemValue.phaseType || arrField.item.label}
                      </div>
                      <button
                        type="button"
                        style={{ ...btnStyle, color: '#dc3545', borderColor: '#dc3545' }}
                        disabled={!canRemove}
                        onClick={() => {
                          const next = arr.filter((_, i) => i !== idx);
                          onChange(next);
                        }}
                      >
                        Remove
                      </button>
                    </div>

                    <div style={isRegimesArray ? { display: 'flex', flexDirection: 'column', gap: '0.75rem' } : formGridStyle}>
                      {arrField.item.children.map((child) =>
                        renderField(
                          child,
                          itemValue[child.id],
                          (v) => {
                            const nextItem = { ...itemValue, [child.id]: v };
                            const nextArr = arr.map((x, i) => (i === idx ? nextItem : x));
                            onChange(nextArr);
                          },
                          itemValue,
                          root,
                          `${path}[${idx}].${child.id}`
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: '1rem' }}>
              <button
                type="button"
                style={{ ...btnStyle, width: '100%', padding: '12px', borderStyle: 'dashed', fontWeight: 600 }}
                disabled={!canAdd}
                onClick={() => onChange([...arr, buildInitialValueForField(arrField.item)])}
              >
                + Add {arrField.item.label}
              </button>
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formData) return;

    try {
      setSubmitting(true);
      setError(null);
      setSubmitErrorDetails([]);
      setFieldErrors({});

      const req = buildAdvancedRequest(formData);
      const totalMonths = req.phases.reduce(
        (sum, p) => sum + (Number(p.durationInMonths) || 0),
        0
      );
      if (totalMonths > 1200) throw new Error('Total duration across phases must be ≤ 1200 months');

      const res = await fetch(startAdvancedUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });
      if (!res.ok) {
        const apiErr = await parseApiError(res);
        const details = Array.isArray(apiErr.details) ? apiErr.details : [];
        setError(apiErr.message ?? `Validation failed (${res.status})`);
        setSubmitErrorDetails(details);

        const nextFieldErrors: Record<string, string[]> = {};
        for (const line of details) {
          const { path: rawPath, message } = extractPathAndMessage(line);
          if (!rawPath) continue;
          const mapped = mapRequestPathToFormPath(rawPath);
          nextFieldErrors[mapped] = [...(nextFieldErrors[mapped] ?? []), message];
        }
        setFieldErrors(nextFieldErrors);
        setSubmitting(false);
        return;
      }

      const data = (await res.json()) as { id?: string };
      if (!data?.id) throw new Error('No simulation id returned');

      setSimulationId(data.id);
    } catch (e: any) {
      console.error(e);
      setError(e.message ?? 'Simulation failed');
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    if (!initialFormData) return;
    setFormData(JSON.parse(JSON.stringify(initialFormData)));
  };

  if (loadingConfig && !formConfig) {
    return (
      <div style={containerStyle}>
        <div>Loading advanced form…</div>
      </div>
    );
  }

  if (error && !formConfig) {
    return (
      <div style={containerStyle}>
        <div style={errorStyle}>Failed to load form: {error}</div>
        <button type="button" onClick={fetchConfig}>
          Retry
        </button>
      </div>
    );
  }

  if (!formConfig || !formData) {
    return (
      <div style={containerStyle}>
        <div>Form configuration is not available.</div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <h2 style={titleStyle}>{formConfig.title}</h2>
      <p style={subtitleStyle}>
        Configure advanced options. These inputs map directly to the simulation engine.
      </p>

      {error && (
        <div style={errorStyle}>
          <div>{error}</div>
          {submitErrorDetails.length > 0 && (
            <div style={{ marginTop: '0.5rem' }}>
              {submitErrorDetails.map((d, i) => (
                <div key={i}>{d}</div>
              ))}
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={tabRowStyle}>
          <button
            type="button"
            style={tabButtonStyle(activeTab === 'general')}
            onClick={() => setActiveTab('general')}
          >
            General {hasTabErrors('general') && <span style={{ color: '#dc3545', marginLeft: '4px' }}>●</span>}
          </button>
          <button
            type="button"
            style={tabButtonStyle(activeTab === 'taxation')}
            onClick={() => setActiveTab('taxation')}
          >
            Taxation {hasTabErrors('taxation') && <span style={{ color: '#dc3545', marginLeft: '4px' }}>●</span>}
          </button>
          <button
            type="button"
            style={tabButtonStyle(activeTab === 'returns')}
            onClick={() => setActiveTab('returns')}
          >
            Returns {hasTabErrors('returns') && <span style={{ color: '#dc3545', marginLeft: '4px' }}>●</span>}
          </button>
          <button
            type="button"
            style={tabButtonStyle(activeTab === 'phases')}
            onClick={() => setActiveTab('phases')}
          >
            Phases {hasTabErrors('phases') && <span style={{ color: '#dc3545', marginLeft: '4px' }}>●</span>}
          </button>
        </div>

        {formConfig.fields
          .filter((f) => (TAB_MAPPING[f.id] || 'general') === activeTab)
          .map((field) => (
            <div key={field.id}>
              {renderField(
                field,
                formData[field.id],
                (newValue) => setFormData((prev) => ({ ...(prev ?? {}), [field.id]: newValue })),
                formData,
                formData,
                field.id
              )}
            </div>
          ))}

        <div style={actionsRowStyle}>
          <button type="button" onClick={handleReset}>
            Reset to defaults
          </button>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Running simulation…' : 'Run simulation'}
          </button>
        </div>

        {simulationId && (
          <SimulationProgress
            simulationId={simulationId}
            onComplete={(result) => {
              setSubmitting(false);
              setSimulationId(null);
              onSimulationComplete(result);
            }}
          />
        )}
      </form>
    </div>
  );
};

export default AdvancedInputForm;
