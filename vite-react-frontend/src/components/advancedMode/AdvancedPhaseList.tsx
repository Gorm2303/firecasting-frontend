// src/components/advanced/AdvancedPhaseList.tsx

import React from 'react';
import { GroupFieldConfig, FieldConfig, NumberFieldConfig, SelectFieldConfig } from './formTypes';

interface AdvancedPhaseListProps {
  /** Array of phase objects as stored in the form state. */
  phases: any[];
  /** Config describing the structure of a single phase item. */
  phaseConfig: GroupFieldConfig;
  /** Remove phase at specific index. */
  onRemovePhase: (index: number) => void;
  /** Inline edit callback for a given phase. */
  onUpdatePhase?: (index: number, updated: any) => void;
}

const emptyStateStyle: React.CSSProperties = {
  marginTop: '0.75rem',
  fontSize: '0.9rem',
  opacity: 0.8,
};

const listContainerStyle: React.CSSProperties = {
  marginTop: '0.75rem',
};

const phaseRowStyle: React.CSSProperties = {
  marginBottom: '0.75rem',
};

const phaseHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  marginBottom: '0.25rem',
};

const phaseTitleStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: '0.95rem',
};

const phaseGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
  gap: '0.25rem 0.75rem',
  fontSize: '0.9rem',
};

const fieldWrapperStyle: React.CSSProperties = {
  marginBottom: '0.25rem',
};

const helpTextStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  opacity: 0.8,
};

// ---- same classification helpers as in AdvancedPhaseForm ----

const isPhaseTypeField = (field: FieldConfig) =>
  field.id.toLowerCase() === 'phasetype';

const isDurationField = (field: FieldConfig) =>
  field.id.toLowerCase().includes('duration');

const isInitialDepositField = (field: FieldConfig) =>
  field.id.toLowerCase().includes('initial') &&
  field.id.toLowerCase().includes('deposit');

const isMonthlyDepositField = (field: FieldConfig) =>
  field.id.toLowerCase().includes('monthly') &&
  field.id.toLowerCase().includes('deposit');

const isYearlyIncreaseField = (field: FieldConfig) => {
  const id = field.id.toLowerCase();
  return (
    id.includes('yearly') &&
    (id.includes('increase') || id.includes('increment'))
  );
};

const isWithdrawTypeField = (field: FieldConfig) =>
  field.id.toLowerCase().includes('withdraw') &&
  field.id.toLowerCase().includes('type');

const isWithdrawRateField = (field: FieldConfig) =>
  field.id.toLowerCase().includes('withdraw') &&
  (field.id.toLowerCase().includes('rate') ||
    field.id.toLowerCase().includes('percent'));

const isWithdrawAmountField = (field: FieldConfig) =>
  field.id.toLowerCase().includes('withdraw') &&
  field.id.toLowerCase().includes('amount');

const isLowerVariationField = (field: FieldConfig) =>
  field.id.toLowerCase().includes('lower') &&
  field.id.toLowerCase().includes('variation');

const isUpperVariationField = (field: FieldConfig) =>
  field.id.toLowerCase().includes('upper') &&
  field.id.toLowerCase().includes('variation');

const isTaxExemptionField = (field: FieldConfig) =>
  field.type === 'checkbox' && field.id.toLowerCase().includes('exemption');

/**
 * Decide if a given field should be visible for the current phaseType.
 * Same rules as in AdvancedPhaseForm:
 *  - DEPOSIT: duration, initial deposit, monthly deposit, yearly increase, tax exemptions
 *  - PASSIVE: duration, tax exemptions
 *  - WITHDRAW: duration, withdraw type, withdraw rate OR amount (by withdrawType),
 *              lower/upper variation, tax exemptions
 */
const isFieldVisibleForPhase = (
  field: FieldConfig,
  phaseType: string,
  withdrawType: string
): boolean => {
  const typeUpper = phaseType?.toUpperCase?.() ?? '';

  // Always show phase type selector itself
  if (isPhaseTypeField(field)) return true;

  if (typeUpper === 'DEPOSIT') {
    if (
      isDurationField(field) ||
      isInitialDepositField(field) ||
      isMonthlyDepositField(field) ||
      isYearlyIncreaseField(field) ||
      isTaxExemptionField(field)
    ) {
      return true;
    }
    // Hide withdraw-specific stuff, everything else stays visible by default
    return !(
      isWithdrawTypeField(field) ||
      isWithdrawRateField(field) ||
      isWithdrawAmountField(field) ||
      isLowerVariationField(field) ||
      isUpperVariationField(field)
    );
  }

  if (typeUpper === 'PASSIVE') {
    if (isDurationField(field) || isTaxExemptionField(field)) {
      return true;
    }
    // Hide deposit/withdraw-only fields
    return !(
      isInitialDepositField(field) ||
      isMonthlyDepositField(field) ||
      isYearlyIncreaseField(field) ||
      isWithdrawTypeField(field) ||
      isWithdrawRateField(field) ||
      isWithdrawAmountField(field) ||
      isLowerVariationField(field) ||
      isUpperVariationField(field)
    );
  }

  if (typeUpper === 'WITHDRAW') {
    if (
      isDurationField(field) ||
      isTaxExemptionField(field) ||
      isWithdrawTypeField(field) ||
      isLowerVariationField(field) ||
      isUpperVariationField(field)
    ) {
      return true;
    }

    const withdrawTypeUpper = withdrawType?.toUpperCase?.() ?? '';
    if (withdrawTypeUpper === 'RATE' || withdrawTypeUpper === 'PERCENT') {
      if (isWithdrawRateField(field)) return true;
      if (isWithdrawAmountField(field)) return false;
    } else if (withdrawTypeUpper === 'AMOUNT') {
      if (isWithdrawAmountField(field)) return true;
      if (isWithdrawRateField(field)) return false;
    } else {
      // Unknown / empty withdraw type: show both
      if (isWithdrawRateField(field) || isWithdrawAmountField(field)) {
        return true;
      }
    }

    // Hide deposit-only fields
    return !(
      isInitialDepositField(field) ||
      isMonthlyDepositField(field) ||
      isYearlyIncreaseField(field)
    );
  }

  // Unknown phase type → show everything
  return true;
};

/**
 * Compute a nicer label for a phase row.
 * If the phase object has a `phaseType` field, we use that; otherwise we fall back to the generic label.
 */
const getPhaseTitle = (
  phase: any,
  phaseConfig: GroupFieldConfig,
  index: number
): string => {
  const rawType = phase?.phaseType ?? phase?.phase_type;
  if (typeof rawType === 'string' && rawType.trim().length > 0) {
    return `${rawType} phase ${index + 1}`;
  }
  return `${phaseConfig.label} ${index + 1}`;
};

const AdvancedPhaseList: React.FC<AdvancedPhaseListProps> = ({
  phases,
  phaseConfig,
  onRemovePhase,
  onUpdatePhase,
}) => {
  if (!phases || phases.length === 0) {
    return <div style={emptyStateStyle}>No phases added yet.</div>;
  }

  const updatePhaseField = (phaseIndex: number, fieldId: string, value: any) => {
    if (!onUpdatePhase) return;
    const phase = phases[phaseIndex];
    const updated = {
      ...phase,
      [fieldId]: value,
    };
    onUpdatePhase(phaseIndex, updated);
  };

  const renderFieldInput = (
    phase: any,
    phaseIndex: number,
    field: FieldConfig
  ): React.ReactNode => {
    const rawValue = phase[field.id];
    const valueForInput =
      rawValue === undefined || rawValue === null ? '' : rawValue;

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
                onChange={(e) =>
                  updatePhaseField(phaseIndex, field.id, e.target.value)
                }
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
                  updatePhaseField(
                    phaseIndex,
                    field.id,
                    v === '' ? '' : Number(v)
                  );
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
                onChange={(e) =>
                  updatePhaseField(phaseIndex, field.id, e.target.value)
                }
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
                checked={!!rawValue}
                onChange={(e) =>
                  updatePhaseField(phaseIndex, field.id, e.target.checked)
                }
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
                onChange={(e) =>
                  updatePhaseField(phaseIndex, field.id, e.target.value)
                }
                style={{ marginLeft: '0.5rem' }}
              />
            </label>
            {maybeHelp}
          </div>
        );

      case 'group':
        // Not expected inside a single phase; if it appears, show label only.
        return (
          <div style={fieldWrapperStyle} key={field.id}>
            <strong>{field.label}</strong>
            {maybeHelp}
          </div>
        );

      case 'array':
      default:
        // Arrays not supported inside a single phase item for now
        return null;
    }
  };

  return (
    <div style={listContainerStyle}>
      {phases.map((phase, index) => {
        const phaseTypeValue: string = phase['phaseType'] ?? '';
        const withdrawTypeValue: string = phase['withdrawType'] ?? '';

        return (
          <div key={index} style={phaseRowStyle}>
            <div style={phaseHeaderStyle}>
              <span style={phaseTitleStyle}>
                {getPhaseTitle(phase, phaseConfig, index)}
              </span>
              <button type="button" onClick={() => onRemovePhase(index)}>
                Remove
              </button>
            </div>

            <div style={phaseGridStyle}>
              {phaseConfig.children.map((field) => {
                if (
                  !isFieldVisibleForPhase(
                    field,
                    phaseTypeValue,
                    withdrawTypeValue
                  )
                ) {
                  return null;
                }

                return (
                  <div key={field.id}>
                    {renderFieldInput(phase, index, field)}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AdvancedPhaseList;
