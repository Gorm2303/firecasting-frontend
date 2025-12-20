// src/components/advanced/AdvancedInputForm.tsx

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
} from './formTypes';
import AdvancedPhaseForm from './AdvancedPhaseForm';
import AdvancedPhaseList from './AdvancedPhaseList';

interface InputFormProps {
  onSimulationComplete: (stats: YearlySummary[]) => void;
}

// --- shared styles (kept simple, theme-friendly) ---

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

// Extra styles for returner/distribution/regime UI

const sectionSubTitleStyle: React.CSSProperties = {
  margin: '0.25rem 0 0.5rem',
  fontSize: '0.85rem',
  opacity: 0.8,
};

const smallHeadingStyle: React.CSSProperties = {
  margin: '0.5rem 0 0.25rem',
  fontSize: '0.9rem',
  fontWeight: 600,
};

const regimeListStyle: React.CSSProperties = {
  marginTop: '0.25rem',
  marginBottom: '0.5rem',
};

const regimeRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  marginBottom: '0.25rem',
};

const matrixGridStyle: React.CSSProperties = {
  display: 'grid',
  gap: '0.25rem',
  marginTop: '0.5rem',
};

const matrixRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.25rem',
};

const matrixCellStyle: React.CSSProperties = {
  width: '3.5rem',
};

// --- helper functions for returner/distro heuristics ---

const isReturnerGroup = (field: FieldConfig): boolean =>
  field.type === 'group' &&
  (field.id.toLowerCase().includes('return') ||
    (field.label ?? '').toLowerCase().includes('return'));

const findReturnTypeField = (groupField: GroupFieldConfig): FieldConfig | undefined =>
  groupField.children.find(
    (c) =>
      c.type === 'select' &&
      (c.id.toLowerCase().includes('return') ||
        (c.label ?? '').toLowerCase().includes('return'))
  );

const isDistributionGroup = (field: FieldConfig): boolean =>
  field.type === 'group' &&
  (field.id.toLowerCase().includes('distribution') ||
    (field.label ?? '').toLowerCase().includes('distribution'));

const isRandomGroup = (field: FieldConfig): boolean =>
  field.type === 'group' &&
  (field.id.toLowerCase().includes('random') ||
    (field.label ?? '').toLowerCase().includes('random'));

const isSimpleReturnGroup = (field: FieldConfig): boolean =>
  field.type === 'group' &&
  (field.id.toLowerCase().includes('simple') ||
    (field.label ?? '').toLowerCase().includes('simple'));

const findDistributionTypeField = (distField: GroupFieldConfig): FieldConfig | undefined =>
  distField.children.find(
    (c) =>
      c.type === 'select' &&
      (c.id.toLowerCase().includes('type') ||
        (c.label ?? '').toLowerCase().includes('type'))
  );

const isNormalGroup = (field: FieldConfig): boolean =>
  field.type === 'group' &&
  (field.id.toLowerCase().includes('normal') ||
    (field.label ?? '').toLowerCase().includes('normal'));

const isBrownianGroup = (field: FieldConfig): boolean =>
  field.type === 'group' &&
  (field.id.toLowerCase().includes('brownian') ||
    (field.label ?? '').toLowerCase().includes('brownian'));

const isStudentTGroup = (field: FieldConfig): boolean =>
  field.type === 'group' &&
  (field.id.toLowerCase().includes('student') ||
    (field.label ?? '').toLowerCase().includes('student'));

const isRegimeGroup = (field: FieldConfig): boolean =>
  field.type === 'group' &&
  (field.id.toLowerCase().includes('regime') ||
    (field.label ?? '').toLowerCase().includes('regime'));

const normaliseReturnType = (value: any): string => {
  const s = String(value ?? '').toLowerCase();
  if (!s) return '';
  if (s.includes('distribution')) return 'distribution';
  if (s.includes('data')) return 'datadriven';
  if (s.includes('simple')) return 'simple';
  return s;
};

const normaliseDistributionType = (value: any): string => {
  const s = String(value ?? '').toLowerCase();
  if (!s) return '';
  if (s.includes('regime')) return 'regime';
  if (s.includes('brown')) return 'brownian';
  if (s.includes('student')) return 'studentt';
  if (s.includes('normal')) return 'normal';
  return s;
};

// Build a default n×n transition matrix like the example:
// all rows point to the "middle" regime: [0, 1, 0] generalized.
const buildDefaultTransitionMatrix = (n: number): number[][] => {
  if (n <= 0) return [];
  const center = Math.floor(n / 2);
  const rows: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) {
      row.push(j === center ? 1 : 0);
    }
    rows.push(row);
  }
  return rows;
};

// helper to build initial state for a group from its config
const buildInitialGroupState = (group: GroupFieldConfig): Record<string, any> => {
  const obj: Record<string, any> = {};
  group.children.forEach((child) => {
    // We'll reuse buildInitialFormState helper style via a minimal switch
    switch (child.type) {
      case 'text':
      case 'date':
      case 'select':
        obj[child.id] = child.defaultValue ?? '';
        break;
      case 'number':
        obj[child.id] = child.defaultValue ?? 0;
        break;
      case 'checkbox':
        obj[child.id] = child.defaultValue ?? false;
        break;
      case 'group':
        obj[child.id] = buildInitialGroupState(child as GroupFieldConfig);
        break;
      case 'array':
      default:
        obj[child.id] = child.defaultValue ?? null;
        break;
    }
  });
  return obj;
};

// --- component ---

const AdvancedInputForm: React.FC<InputFormProps> = ({ onSimulationComplete }) => {
  const [formConfig, setFormConfig] = useState<FormConfig | null>(null);
  const [formData, setFormData] = useState<Record<string, any> | null>(null);
  const [initialFormData, setInitialFormData] = useState<Record<string, any> | null>(
    null
  );
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      setLoadingConfig(true);
      setError(null);

      // Local JSON in public/ for now
      const res = await fetch('/forms/advanced-simulation.json');
      // Real backend:
      // const res = await fetch('/api/forms/advanced-simulation');

      if (!res.ok) {
        throw new Error(`Failed to fetch form config: ${res.status}`);
      }
      const json = (await res.json()) as FormConfig;

      const initial = buildInitialFormState(json);
      setFormConfig(json);
      setInitialFormData(initial);
      setFormData(JSON.parse(JSON.stringify(initial))); // deep clone
    } catch (e: any) {
      console.error(e);
      setError(e.message ?? 'Error fetching form config');
    } finally {
      setLoadingConfig(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formData) return;

    try {
      setSubmitting(true);
      const res = await fetch('/api/simulations/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        throw new Error(`Simulation failed: ${res.status}`);
      }

      const data = (await res.json()) as YearlySummary[];
      onSimulationComplete(data);
    } catch (e: any) {
      console.error(e);
      alert(e.message ?? 'Simulation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    if (!initialFormData) return;
    setFormData(JSON.parse(JSON.stringify(initialFormData)));
  };

  // Generic field renderer (non-special cases)
  const renderField = (
    field: FieldConfig,
    value: any,
    onChange: (value: any) => void
  ): React.ReactNode => {
    const valueForInput =
      value === undefined || value === null ? '' : value;

    const maybeHelp = field.helpText ? (
      <div style={helpTextStyle}>{field.helpText}</div>
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

      case 'select': {
        const selectField = field as SelectFieldConfig;
        return (
          <div style={fieldWrapperStyle} key={field.id}>
            <label>
              {field.label}
              <select
                value={String(valueForInput)}
                onChange={(e) => onChange(e.target.value)}
                style={{ marginLeft: '0.5rem' }}
              >
                {selectField.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            {maybeHelp}
          </div>
        );
      }

      case 'checkbox':
        return (
          <div style={fieldWrapperStyle} key={field.id}>
            <label>
              <input
                type="checkbox"
                checked={!!valueForInput}
                onChange={(e) => onChange(e.target.checked)}
                style={{ marginRight: '0.5rem' }}
              />
              {field.label}
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

      case 'group': {
        const groupField = field as GroupFieldConfig;
        const groupValue: Record<string, any> = value ?? {};
        // Generic group rendering: label + grid of children
        return (
          <div key={field.id} style={groupContainerStyle}>
            <h3 style={groupTitleStyle}>{field.label}</h3>
            <div style={formGridStyle}>
              {groupField.children.map((child) => {
                const childValue = groupValue[child.id];
                return (
                  <div key={child.id}>
                    {renderField(child, childValue, (newChildValue) => {
                      onChange({ ...groupValue, [child.id]: newChildValue });
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        );
      }

      case 'array':
      default:
        return null;
    }
  };

  // ---- specialised rendering for "returner" group ----

  const renderRandomGroup = (
    randomField: GroupFieldConfig,
    groupValue: Record<string, any>,
    onChangeGroup: (newGroupValue: Record<string, any>) => void
  ): React.ReactNode => {
    const randomValue: Record<string, any> = groupValue[randomField.id] ?? {};
    return (
      <div style={groupContainerStyle}>
        <h4 style={smallHeadingStyle}>{randomField.label}</h4>
        <div style={formGridStyle}>
          {randomField.children.map((child) => {
            const childValue = randomValue[child.id];
            return (
              <div key={child.id}>
                {renderField(child, childValue, (newChildVal) => {
                  onChangeGroup({
                    ...groupValue,
                    [randomField.id]: { ...randomValue, [child.id]: newChildVal },
                  });
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderRegimeSection = (
    distValue: Record<string, any>,
    onChangeDist: (newVal: Record<string, any>) => void,
    normalGroup?: GroupFieldConfig,
    brownianGroup?: GroupFieldConfig,
    studentGroup?: GroupFieldConfig
  ): React.ReactNode => {
    type RegimeEntry = {
      name: string;
      type: 'normal' | 'brownian' | 'studentt';
      normal?: Record<string, any>;
      brownian?: Record<string, any>;
      studentt?: Record<string, any>;
    };

    const regimeBased: RegimeEntry[] = Array.isArray(distValue.regimeBased)
      ? distValue.regimeBased
      : [];
    const regime: any = distValue.regime || {};
    const matrix: number[][] | undefined = Array.isArray(regime.transitionMatrix)
      ? regime.transitionMatrix
      : undefined;

    const ensureParams = (
      entry: RegimeEntry,
      targetType: RegimeEntry['type']
    ): RegimeEntry => {
      const clone: RegimeEntry = { ...entry, type: targetType };
      if (targetType === 'normal' && normalGroup) {
        clone.normal = clone.normal ?? buildInitialGroupState(normalGroup);
      }
      if (targetType === 'brownian' && brownianGroup) {
        clone.brownian = clone.brownian ?? buildInitialGroupState(brownianGroup);
      }
      if (targetType === 'studentt' && studentGroup) {
        clone.studentt = clone.studentt ?? buildInitialGroupState(studentGroup);
      }
      return clone;
    };

    const handleAddRegime = () => {
      const current = regimeBased;
      const newEntry: RegimeEntry = ensureParams(
        {
          name: `Regime ${current.length + 1}`,
          type: 'normal',
        },
        'normal'
      );
      const next = [...current, newEntry];
      const n = next.length;
      const newMatrix = buildDefaultTransitionMatrix(n);
      const newRegime = { ...regime, transitionMatrix: newMatrix };
      onChangeDist({ ...distValue, regimeBased: next, regime: newRegime });
    };

    const handleRemoveRegime = (index: number) => {
      const current = regimeBased;
      const next = current.filter((_, i) => i !== index);
      const n = next.length;
      const newMatrix = n > 0 ? buildDefaultTransitionMatrix(n) : [];
      const newRegime = { ...regime, transitionMatrix: newMatrix };
      onChangeDist({ ...distValue, regimeBased: next, regime: newRegime });
    };

    const handleRegimeNameChange = (index: number, name: string) => {
      const next = regimeBased.map((item, i) =>
        i === index ? { ...item, name } : item
      );
      onChangeDist({ ...distValue, regimeBased: next });
    };

    const handleRegimeTypeChange = (index: number, typeStr: string) => {
      let target: RegimeEntry['type'] = 'normal';
      const n = typeStr.toLowerCase();
      if (n.includes('brown')) target = 'brownian';
      else if (n.includes('student')) target = 'studentt';
      const updated = ensureParams(regimeBased[index], target);
      const next = regimeBased.map((item, i) => (i === index ? updated : item));
      onChangeDist({ ...distValue, regimeBased: next });
    };

    const handleRegimeParamChange = (
      index: number,
      type: RegimeEntry['type'],
      fieldId: string,
      newVal: any
    ) => {
      const current = regimeBased[index];
      const clone: RegimeEntry = { ...current };
      if (type === 'normal') {
        clone.normal = {
          ...(clone.normal ?? {}),
          [fieldId]: newVal,
        };
      } else if (type === 'brownian') {
        clone.brownian = {
          ...(clone.brownian ?? {}),
          [fieldId]: newVal,
        };
      } else if (type === 'studentt') {
        clone.studentt = {
          ...(clone.studentt ?? {}),
          [fieldId]: newVal,
        };
      }
      const next = regimeBased.map((item, i) => (i === index ? clone : item));
      onChangeDist({ ...distValue, regimeBased: next });
    };

    const handleMatrixCellChange = (rowIndex: number, colIndex: number, str: string) => {
      if (!matrix || regimeBased.length === 0) return;
      const rawRow = matrix[rowIndex] ?? [];
      const newRow = [...rawRow];
      const parsed = parseFloat(str);
      newRow[colIndex] = Number.isFinite(parsed) ? parsed : 0;

      const sum = newRow.reduce((acc, v) => acc + v, 0);
      const normalisedRow =
        sum > 0 ? newRow.map((v) => v / sum) : newRow;

      const newMatrix = matrix.map((row, i) =>
        i === rowIndex ? normalisedRow : row
      );

      const newRegime = { ...regime, transitionMatrix: newMatrix };
      onChangeDist({ ...distValue, regime: newRegime });
    };

    const renderRegimeParams = (entry: RegimeEntry, index: number) => {
      const type = entry.type;
      if (type === 'normal' && normalGroup) {
        const params = entry.normal ?? buildInitialGroupState(normalGroup);
        return (
          <div style={formGridStyle}>
            {normalGroup.children.map((child) => {
              const childVal = params[child.id];
              return (
                <div key={child.id}>
                  {renderField(child, childVal, (newVal) =>
                    handleRegimeParamChange(
                      index,
                      'normal',
                      child.id,
                      newVal
                    )
                  )}
                </div>
              );
            })}
          </div>
        );
      }
      if (type === 'brownian' && brownianGroup) {
        const params = entry.brownian ?? buildInitialGroupState(brownianGroup);
        return (
          <div style={formGridStyle}>
            {brownianGroup.children.map((child) => {
              const childVal = params[child.id];
              return (
                <div key={child.id}>
                  {renderField(child, childVal, (newVal) =>
                    handleRegimeParamChange(
                      index,
                      'brownian',
                      child.id,
                      newVal
                    )
                  )}
                </div>
              );
            })}
          </div>
        );
      }
      if (type === 'studentt' && studentGroup) {
        const params = entry.studentt ?? buildInitialGroupState(studentGroup);
        return (
          <div style={formGridStyle}>
            {studentGroup.children.map((child) => {
              const childVal = params[child.id];
              return (
                <div key={child.id}>
                  {renderField(child, childVal, (newVal) =>
                    handleRegimeParamChange(
                      index,
                      'studentt',
                      child.id,
                      newVal
                    )
                  )}
                </div>
              );
            })}
          </div>
        );
      }
      return null;
    };

    return (
      <div>
        <h4 style={smallHeadingStyle}>Regime-based distributions</h4>
        <p style={sectionSubTitleStyle}>
          Each regime has its own distribution (Normal, Brownian motion, Student-t).
          The transition matrix describes the probability of moving from one regime
          to another: each row is a regime you&apos;re currently in, and the values
          across that row are the probabilities of jumping to each regime next step.
          Each row is normalised so the probabilities sum to 1.
        </p>

        <div style={regimeListStyle}>
          {regimeBased.map((item, index) => (
            <div key={index} style={{ marginBottom: '0.5rem' }}>
              <div style={regimeRowStyle}>
                <span>Regime {index + 1}</span>
                <input
                  type="text"
                  value={item?.name ?? ''}
                  onChange={(e) => handleRegimeNameChange(index, e.target.value)}
                  placeholder="Name"
                />
                <select
                  value={item.type}
                  onChange={(e) => handleRegimeTypeChange(index, e.target.value)}
                >
                  <option value="normal">Normal</option>
                  <option value="brownian">Brownian motion</option>
                  <option value="studentt">Student t</option>
                </select>
                <button
                  type="button"
                  onClick={() => handleRemoveRegime(index)}
                >
                  Remove
                </button>
              </div>
              {renderRegimeParams(item, index)}
            </div>
          ))}
        </div>

        <button type="button" onClick={handleAddRegime}>
          Add regime
        </button>

        {regimeBased.length > 0 &&
          Array.isArray(matrix) &&
          matrix.length === regimeBased.length && (
            <div style={{ marginTop: '0.75rem' }}>
              <h4 style={smallHeadingStyle}>Transition matrix</h4>
              <p style={sectionSubTitleStyle}>
                Row i → probabilities of moving from regime i to each regime j.
                Editing a row automatically rescales it so it sums to 1.
              </p>
              <div style={matrixGridStyle}>
                {matrix.map((row, rIndex) => (
                  <div key={rIndex} style={matrixRowStyle}>
                    {row.map((cell, cIndex) => (
                      <input
                        key={cIndex}
                        type="number"
                        step={0.01}
                        style={matrixCellStyle}
                        value={
                          Number.isFinite(cell)
                            ? Number(cell.toFixed(3))
                            : ''
                        }
                        onChange={(e) =>
                          handleMatrixCellChange(
                            rIndex,
                            cIndex,
                            e.target.value
                          )
                        }
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
      </div>
    );
  };

  const renderDistributionGroup = (
    distField: GroupFieldConfig,
    groupValue: Record<string, any>,
    onChangeGroup: (newGroupValue: Record<string, any>) => void
  ): React.ReactNode => {
    const distValue: Record<string, any> = groupValue[distField.id] ?? {};
    const distTypeField = findDistributionTypeField(distField);

    const distTypeRaw =
      (distTypeField && distValue[distTypeField.id]) ??
      distValue['distributionType'] ??
      '';
    const distType = normaliseDistributionType(distTypeRaw);

    const children = distField.children;
    const normalGroup = children.find(isNormalGroup) as GroupFieldConfig | undefined;
    const brownianGroup = children.find(isBrownianGroup) as
      | GroupFieldConfig
      | undefined;
    const studentGroup = children.find(isStudentTGroup) as
      | GroupFieldConfig
      | undefined;
    const regimeGroupFromConfig = children.find(isRegimeGroup) as
      | GroupFieldConfig
      | undefined;

    const primitiveChildren = children.filter(
      (c) => c !== distTypeField && c.type !== 'group'
    );

    const renderChildGroupInline = (group: GroupFieldConfig | undefined) => {
      if (!group) return null;
      const childGroupValue: Record<string, any> = distValue[group.id] ?? {};
      return (
        <div style={groupContainerStyle}>
          <h4 style={smallHeadingStyle}>{group.label}</h4>
          <div style={formGridStyle}>
            {group.children.map((child) => {
              const childVal = childGroupValue[child.id];
              return (
                <div key={child.id}>
                  {renderField(child, childVal, (newChildVal) => {
                    const newGroupVal = {
                      ...distValue,
                      [group.id]: { ...childGroupValue, [child.id]: newChildVal },
                    };
                    onChangeGroup({
                      ...groupValue,
                      [distField.id]: newGroupVal,
                    });
                  })}
                </div>
              );
            })}
          </div>
        </div>
      );
    };

    const updateDistributionField = (fieldId: string, newVal: any) => {
      const newDistVal = { ...distValue, [fieldId]: newVal };
      onChangeGroup({
        ...groupValue,
        [distField.id]: newDistVal,
      });
    };

    return (
      <div style={groupContainerStyle}>
        <h3 style={groupTitleStyle}>{distField.label}</h3>
        <p style={sectionSubTitleStyle}>
          Choose distribution type and configure its parameters. For regime-based
          distributions, you can attach a separate distribution to each regime and
          control how the system switches between them.
        </p>

        <div style={formGridStyle}>
          {/* Distribution type select + primitive fields */}
          {distTypeField && (
            <div key={distTypeField.id}>
              {renderField(
                distTypeField,
                distValue[distTypeField.id],
                (newVal) => updateDistributionField(distTypeField.id, newVal)
              )}
            </div>
          )}
          {primitiveChildren.map((child) => (
            <div key={child.id}>
              {renderField(child, distValue[child.id], (newVal) =>
                updateDistributionField(child.id, newVal)
              )}
            </div>
          ))}
        </div>

        {distType === 'normal' && renderChildGroupInline(normalGroup)}
        {distType === 'brownian' && renderChildGroupInline(brownianGroup)}
        {distType === 'studentt' && renderChildGroupInline(studentGroup)}

        {distType === 'regime' && (
          <>
            {/* If backend already provides a regime group, we render it first */}
            {regimeGroupFromConfig &&
              renderChildGroupInline(regimeGroupFromConfig)}
            {/* Then our custom regime-distribution & matrix editor */}
            {renderRegimeSection(
              distValue,
              (newDistVal) => {
                onChangeGroup({
                  ...groupValue,
                  [distField.id]: newDistVal,
                });
              },
              normalGroup,
              brownianGroup,
              studentGroup
            )}
          </>
        )}
      </div>
    );
  };

  const renderReturnerGroup = (
    groupField: GroupFieldConfig,
    groupValue: Record<string, any>,
    onChangeGroup: (newGroupValue: Record<string, any>) => void
  ): React.ReactNode => {
    const returnTypeField = findReturnTypeField(groupField);
    const children = groupField.children;

    if (!returnTypeField) {
      // Fallback: if we can't detect a return model selector, just render generically
      return renderField(groupField, groupValue, onChangeGroup);
    }

    const returnTypeRaw =
      groupValue[returnTypeField.id] ?? groupValue['returnType'] ?? '';
    const normReturnType = normaliseReturnType(returnTypeRaw);
    const showDistributionSection = normReturnType === 'distribution';
    const showRandomSection =
      normReturnType === 'distribution' || normReturnType === 'datadriven';
    const showSimpleSection = normReturnType === 'simple';

    const distributionGroup = children.find(isDistributionGroup) as
      | GroupFieldConfig
      | undefined;
    const randomGroup = children.find(isRandomGroup) as GroupFieldConfig | undefined;
    const simpleGroup = children.find(isSimpleReturnGroup) as
      | GroupFieldConfig
      | undefined;

    const primitiveChildren = children.filter(
      (c) => c.type !== 'group' || c === returnTypeField
    );

    const handleChildChange = (childId: string, newVal: any) => {
      onChangeGroup({ ...groupValue, [childId]: newVal });
    };

    return (
      <div key={groupField.id} style={groupContainerStyle}>
        <h3 style={groupTitleStyle}>{groupField.label}</h3>
        <p style={sectionSubTitleStyle}>
          Return type controls whether you use a fixed simple return, a
          distribution-based model, or a data-driven model. Depending on this,
          the distribution and randomness settings below will appear.
        </p>

        <div style={formGridStyle}>
          {primitiveChildren.map((child) => {
            const childVal = groupValue[child.id];
            return (
              <div key={child.id}>
                {renderField(child, childVal, (newVal) =>
                  handleChildChange(child.id, newVal)
                )}
              </div>
            );
          })}
        </div>

        {simpleGroup && showSimpleSection && (
          <div>
            <h4 style={smallHeadingStyle}>{simpleGroup.label}</h4>
            <div style={formGridStyle}>
              {simpleGroup.children.map((child) => {
                const childVal =
                  (groupValue[simpleGroup.id] ?? {})[child.id];
                return (
                  <div key={child.id}>
                    {renderField(
                      child,
                      childVal,
                      (newVal) => {
                        const currentSimple: Record<string, any> =
                          groupValue[simpleGroup.id] ?? {};
                        onChangeGroup({
                          ...groupValue,
                          [simpleGroup.id]: {
                            ...currentSimple,
                            [child.id]: newVal,
                          },
                        });
                      }
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {distributionGroup && showDistributionSection &&
          renderDistributionGroup(
            distributionGroup,
            groupValue,
            (newGroupVal) => onChangeGroup(newGroupVal)
          )}

        {randomGroup && showRandomSection &&
          renderRandomGroup(randomGroup, groupValue, (newGroupVal) =>
            onChangeGroup(newGroupVal)
          )}
      </div>
    );
  };

  // --- states for loading / errors ---

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

  // --- phases plumbing ---

  const phasesField = formConfig.fields.find(
    (f) => f.id === 'phases' && f.type === 'array'
  ) as ArrayFieldConfig | undefined;

  const phases: any[] = (phasesField && (formData['phases'] as any[])) || [];

  const handleAddPhase = (phase: any) => {
    setFormData((prev) => {
      if (!prev) return prev;
      const current = (prev['phases'] as any[]) || [];
      return { ...prev, phases: [...current, { ...phase }] };
    });
  };

  const handleRemovePhase = (index: number) => {
    setFormData((prev) => {
      if (!prev) return prev;
      const current = (prev['phases'] as any[]) || [];
      const copy = [...current];
      copy.splice(index, 1);
      return { ...prev, phases: copy };
    });
  };

  const handleUpdatePhase = (index: number, updated: any) => {
    setFormData((prev) => {
      if (!prev) return prev;
      const current = (prev['phases'] as any[]) || [];
      const copy = [...current];
      copy[index] = updated;
      return { ...prev, phases: copy };
    });
  };

  // Separate non-phase fields into grid vs "group" sections
  const nonPhaseFields = formConfig.fields.filter(
    (f) => !(f.id === 'phases' && f.type === 'array')
  );
  const gridFields = nonPhaseFields.filter((f) => f.type !== 'group');
  const groupFields = nonPhaseFields.filter((f) => f.type === 'group');

  return (
    <div style={containerStyle}>
      <h2 style={titleStyle}>{formConfig.title}</h2>
      <p style={subtitleStyle}>
        Configure advanced options. These inputs map directly to the simulation engine.
      </p>

      {error && formConfig && (
        <div style={errorStyle}>Warning: {error}</div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Simple fields in a grid */}
        {gridFields.length > 0 && (
          <div style={formGridStyle}>
            {gridFields.map((field) => (
              <div key={field.id}>
                {renderField(field, formData[field.id], (newValue) => {
                  setFormData((prev) => ({
                    ...(prev ?? {}),
                    [field.id]: newValue,
                  }));
                })}
              </div>
            ))}
          </div>
        )}

        {/* Group sections (including special "returner") */}
        {groupFields.map((field) => {
          const groupValue = formData[field.id];

          if (isReturnerGroup(field)) {
            return (
              <div key={field.id}>
                {renderReturnerGroup(
                  field as GroupFieldConfig,
                  groupValue ?? {},
                  (newGroupValue) => {
                    setFormData((prev) => ({
                      ...(prev ?? {}),
                      [field.id]: newGroupValue,
                    }));
                  }
                )}
              </div>
            );
          }

          return (
            <div key={field.id}>
              {renderField(field, groupValue, (newGroupValue) => {
                setFormData((prev) => ({
                  ...(prev ?? {}),
                  [field.id]: newGroupValue,
                }));
              })}
            </div>
          );
        })}

        {/* Phases */}
        {phasesField && (
          <div style={phasesContainerStyle}>
            <div style={phasesTitleRowStyle}>
              <h3 style={phasesTitleStyle}>{phasesField.label}</h3>
              {phases.length > 0 && (
                <span style={phasesCountStyle}>
                  {phases.length} phase{phases.length === 1 ? '' : 's'}
                </span>
              )}
            </div>

            <AdvancedPhaseForm
              phaseConfig={phasesField.item as GroupFieldConfig}
              onAddPhase={handleAddPhase}
            />

            <AdvancedPhaseList
              phases={phases}
              phaseConfig={phasesField.item as GroupFieldConfig}
              onRemovePhase={handleRemovePhase}
              onUpdatePhase={handleUpdatePhase}
            />
          </div>
        )}

        <div style={actionsRowStyle}>
          <button type="button" onClick={handleReset}>
            Reset to defaults
          </button>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Running simulation…' : 'Run simulation'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdvancedInputForm;
