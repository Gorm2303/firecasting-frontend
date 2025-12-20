// src/components/advancedMode/AdvancedInputForm.tsx

import React, { useCallback, useEffect, useState } from 'react';
import { YearlySummary } from '../../models/YearlySummary';
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

const btnStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid #444',
  cursor: 'pointer',
  fontSize: 14,
  background: 'transparent',
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
  const [submitting, setSubmitting] = useState(false);
  const [simulationId, setSimulationId] = useState<string | null>(null);

  const SIM_API_BASE = `${import.meta.env.VITE_API_BASE_URL}`.replace(/\/+$/, '');
  const formsUrl = new URL('../forms/advanced-simulation', SIM_API_BASE + '/').toString();
  const startAdvancedUrl = new URL('start-advanced', SIM_API_BASE + '/').toString();

  const fetchConfig = useCallback(async () => {
    try {
      setLoadingConfig(true);
      setError(null);

      const res = await fetch(formsUrl);
      if (!res.ok) throw new Error(`Failed to fetch form config: ${res.status}`);

      const json = (await res.json()) as FormConfig;
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

  const renderField = (
    field: FieldConfig,
    value: any,
    onChange: (v: any) => void,
    ctxCurrent: any,
    root: any
  ): React.ReactNode => {
    const visible = evaluateVisibleWhen(field.visibleWhen, {
      root,
      current: ctxCurrent,
    });
    if (!visible) return null;

    const valueForInput = value === undefined || value === null ? '' : value;
    const maybeHelp = field.helpText ? <div style={helpTextStyle}>{field.helpText}</div> : null;

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
          </div>
        );

      case 'number':
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
          </div>
        );

      case 'group': {
        const groupField = field as GroupFieldConfig;
        const groupValue = value && typeof value === 'object' ? value : {};
        return (
          <div style={groupContainerStyle} key={field.id}>
            <div style={groupTitleStyle}>{field.label}</div>
            <div style={formGridStyle}>
              {groupField.children.map((child) =>
                renderField(
                  child,
                  groupValue[child.id],
                  (v) => onChange({ ...groupValue, [child.id]: v }),
                  groupValue,
                  root
                )
              )}
            </div>
          </div>
        );
      }

      case 'array': {
        const arrField = field as ArrayFieldConfig;
        const arr: any[] = Array.isArray(value) ? value : [];
        const canAdd = arrField.maxItems == null || arr.length < arrField.maxItems;
        const canRemove = arrField.minItems == null ? true : arr.length > arrField.minItems;

        return (
          <div style={phasesContainerStyle} key={field.id}>
            <div style={phasesTitleRowStyle}>
              <h3 style={phasesTitleStyle}>{field.label}</h3>
              <span style={phasesCountStyle}>
                {arr.length} item{arr.length === 1 ? '' : 's'}
              </span>
            </div>

            {arr.map((item, idx) => {
              const itemValue = item && typeof item === 'object' ? item : {};
              return (
                <div
                  key={`${field.id}-${idx}`}
                  style={{
                    border: '1px solid #333',
                    borderRadius: 8,
                    padding: '0.75rem',
                    marginBottom: '0.75rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      marginBottom: '0.5rem',
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>
                      {arrField.item.label} {idx + 1}
                    </div>
                    <button
                      type="button"
                      style={btnStyle}
                      disabled={!canRemove}
                      onClick={() => {
                        const next = arr.filter((_, i) => i !== idx);
                        onChange(next);
                      }}
                    >
                      Remove
                    </button>
                  </div>

                  <div style={formGridStyle}>
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
                        root
                      )
                    )}
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              style={btnStyle}
              disabled={!canAdd}
              onClick={() => onChange([...arr, buildInitialValueForField(arrField.item)])}
            >
              Add {arrField.item.label}
            </button>
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
      if (!res.ok) throw new Error(await res.text());

      const data = (await res.json()) as { id?: string };
      if (!data?.id) throw new Error('No simulation id returned');

      setSimulationId(data.id);
    } catch (e: any) {
      console.error(e);
      alert(e.message ?? 'Simulation failed');
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

      {error && <div style={errorStyle}>Warning: {error}</div>}

      <form onSubmit={handleSubmit}>
        {formConfig.fields.map((field) => (
          <div key={field.id}>
            {renderField(
              field,
              formData[field.id],
              (newValue) => setFormData((prev) => ({ ...(prev ?? {}), [field.id]: newValue })),
              formData,
              formData
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
