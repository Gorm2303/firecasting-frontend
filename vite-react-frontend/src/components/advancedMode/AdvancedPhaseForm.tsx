// src/components/advanced/AdvancedPhaseForm.tsx

import React, { useEffect, useState } from 'react';
import {
  FieldConfig,
  GroupFieldConfig,
  NumberFieldConfig,
  SelectFieldConfig,
  buildInitialValueForField,
} from './formTypes';

interface AdvancedPhaseFormProps {
  /** Schema describing a single phase (the array item from the phases config). */
  phaseConfig: GroupFieldConfig;
  /** Callback fired when the user clicks "Add phase". */
  onAddPhase: (phase: Record<string, any>) => void;
}

/**
 * Build the initial state object for a phase from its configuration.
 * Result example:
 *   {
 *     phaseType: 'DEPOSIT',
 *     durationMonths: 240,
 *     ...
 *   }
 */
const buildInitialPhaseState = (
  phaseConfig: GroupFieldConfig
): Record<string, any> => {
  const initial: Record<string, any> = {};
  phaseConfig.children.forEach((child) => {
    initial[child.id] = buildInitialValueForField(child);
  });
  return initial;
};

const fieldWrapperStyle: React.CSSProperties = {
  marginBottom: '0.5rem',
};

const helpTextStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  opacity: 0.8,
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  gap: '0.75rem 1rem',
};

const titleRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '0.5rem',
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '0.95rem',
  fontWeight: 600,
};

// ---- helpers to classify fields by id (heuristic, but backend-friendly) ----

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
 */
const isFieldVisibleForPhase = (
  field: FieldConfig,
  phaseType: string,
  withdrawType: string
): boolean => {
  const typeUpper = phaseType?.toUpperCase?.() ?? '';

  // Always show phase type selector itself
  if (isPhaseTypeField(field)) return true;

  // Heuristics for the different modes
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
    // Other unknown fields: visible by default so you don't lose config fields
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
    // Hide obviously deposit/withdraw-only scalars
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

    // Withdraw rate vs amount based on withdrawType
    const withdrawTypeUpper = withdrawType?.toUpperCase?.() ?? '';
    if (withdrawTypeUpper === 'RATE' || withdrawTypeUpper === 'PERCENT') {
      if (isWithdrawRateField(field)) return true;
      if (isWithdrawAmountField(field)) return false;
    } else if (withdrawTypeUpper === 'AMOUNT') {
      if (isWithdrawAmountField(field)) return true;
      if (isWithdrawRateField(field)) return false;
    } else {
      // If withdrawType is unknown/empty, show both
      if (isWithdrawRateField(field) || isWithdrawAmountField(field)) {
        return true;
      }
    }

    // Hide deposit-only stuff by default
    return !(
      isInitialDepositField(field) ||
      isMonthlyDepositField(field) ||
      isYearlyIncreaseField(field)
    );
  }

  // If phaseType is unknown, show everything
  return true;
};

/**
 * Form that lets the user configure a single phase and add it to the list.
 */
const AdvancedPhaseForm: React.FC<AdvancedPhaseFormProps> = ({
  phaseConfig,
  onAddPhase,
}) => {
  const [phaseData, setPhaseData] = useState<Record<string, any>>(
    () => buildInitialPhaseState(phaseConfig)
  );

  // Rebuild initial state whenever the phaseConfig changes
  useEffect(() => {
    setPhaseData(buildInitialPhaseState(phaseConfig));
  }, [phaseConfig]);

  const updateField = (fieldId: string, value: any) => {
    setPhaseData((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
  };

  const renderField = (field: FieldConfig): React.ReactNode => {
    const rawValue = phaseData[field.id];

    // Normalise "empty" to something inputs are happy with
    const valueForInput =
      rawValue === undefined || rawValue === null ? '' : rawValue;

    const maybeHelp =
      field.helpText ? (
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
                onChange={(e) => updateField(field.id, e.target.value)}
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
                  // Keep '' as-is so user can clear the field without getting NaN
                  updateField(field.id, v === '' ? '' : Number(v));
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
                onChange={(e) => updateField(field.id, e.target.value)}
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
                onChange={(e) => updateField(field.id, e.target.checked)}
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
                onChange={(e) => updateField(field.id, e.target.value)}
                style={{ marginLeft: '0.5rem' }}
              />
            </label>
            {maybeHelp}
          </div>
        );

      case 'group':
        // You probably won't have nested groups in a phase; if you do,
        // we at least show a label so it doesn't disappear silently.
        return (
          <div key={field.id} style={fieldWrapperStyle}>
            <strong>{field.label}</strong>
            {maybeHelp}
          </div>
        );

      case 'array':
      default:
        // Arrays inside a single phase aren't currently supported by this form.
        return null;
    }
  };

  const handleAdd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Clone so later edits in this form don't mutate phases in the list
    const phaseClone = { ...phaseData };
    onAddPhase(phaseClone);

    // Reset form back to initial defaults
    setPhaseData(buildInitialPhaseState(phaseConfig));
  };

  const phaseTypeValue: string = phaseData['phaseType'] ?? '';
  const withdrawTypeValue: string = phaseData['withdrawType'] ?? '';

  return (
    <form onSubmit={handleAdd}>
      <div style={titleRowStyle}>
        <h4 style={titleStyle}>Add new phase</h4>
      </div>

      <div style={gridStyle}>
        {phaseConfig.children.map((field) => {
          if (!isFieldVisibleForPhase(field, phaseTypeValue, withdrawTypeValue)) {
            return null;
          }
          return <div key={field.id}>{renderField(field)}</div>;
        })}
      </div>

      <div style={{ marginTop: '0.75rem' }}>
        <button type="submit">Add phase</button>
      </div>
    </form>
  );
};

export default AdvancedPhaseForm;
