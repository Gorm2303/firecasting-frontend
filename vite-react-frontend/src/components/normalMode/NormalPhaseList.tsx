import React from 'react';
import { PhaseRequest } from '../../models/types';
import { createDefaultPhase } from '../../config/simulationDefaults';
import InfoTooltip from '../InfoTooltip';
import { isValidDecimalDraft, isValidIntegerDraft } from '../../utils/numberInput';

type ExemptionRule = 'EXEMPTIONCARD' | 'STOCKEXEMPTION';

interface PhaseListProps {
  phases: PhaseRequest[];
  onPhaseChange: (
    index: number,
    field: keyof PhaseRequest,
    value: number | string | undefined
  ) => void;
  onPhaseReplace: (index: number, phase: PhaseRequest) => void;
  onPhaseRemove: (index: number) => void;
  onToggleTaxRule: (index: number, rule: ExemptionRule) => void;
}

const MAX_YEARS = 100;
const MAX_TOTAL_MONTHS = MAX_YEARS * 12;

const splitMonths = (totalMonths: number | undefined | null) => {
  const safe = Math.max(0, Number(totalMonths) || 0);
  const years = Math.floor(safe / 12);
  const months = safe % 12;
  return { years, months };
};

const normaliseDuration = (years: number, months: number) => {
  let y = Math.max(0, years);
  let m = Math.max(0, months);

  if (m >= 12) {
    y += Math.floor(m / 12);
    m = m % 12;
  }

  let total = y * 12 + m;
  if (total > MAX_TOTAL_MONTHS) {
    y = MAX_YEARS;
    m = 0;
    total = MAX_TOTAL_MONTHS;
  }

  return { years: y, months: m, totalMonths: total };
};

const PhaseList: React.FC<PhaseListProps> = ({
  phases,
  onPhaseChange,
  onPhaseReplace,
  onPhaseRemove,
  onToggleTaxRule,
}) => {
  const decimalFields = new Set<keyof PhaseRequest>([
    'yearlyIncreaseInPercentage',
    'withdrawRate',
    'lowerVariationPercentage',
    'upperVariationPercentage',
  ]);

  const integerFields = new Set<keyof PhaseRequest>([
    'initialDeposit',
    'monthlyDeposit',
    'withdrawAmount',
  ]);

  const handleChange =
    (idx: number, field: keyof PhaseRequest) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;

      if (raw === '') {
        onPhaseChange(idx, field, '');
        return;
      }

      if (decimalFields.has(field)) {
        if (!isValidDecimalDraft(raw)) return;
        onPhaseChange(idx, field, raw);
        return;
      }

      if (integerFields.has(field)) {
        if (!isValidIntegerDraft(raw)) return;
        onPhaseChange(idx, field, raw);
        return;
      }

      // Fallback: store raw
      onPhaseChange(idx, field, raw);
    };

  const handleDurationYearsChange =
    (idx: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      if (!isValidIntegerDraft(raw)) return;
      const val = raw === '' ? 0 : Number(raw);
      const { months } = splitMonths(phases[idx]?.durationInMonths);
      const { totalMonths } = normaliseDuration(
        Number.isNaN(val) ? 0 : val,
        months
      );
      onPhaseChange(idx, 'durationInMonths', totalMonths);
    };

  const handleDurationMonthsChange =
    (idx: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      if (!isValidIntegerDraft(raw)) return;
      const val = raw === '' ? 0 : Number(raw);
      const { years } = splitMonths(phases[idx]?.durationInMonths);
      const { totalMonths } = normaliseDuration(
        years,
        Number.isNaN(val) ? 0 : val
      );
      onPhaseChange(idx, 'durationInMonths', totalMonths);
    };

  const handlePhaseTypeChange =
    (idx: number) => (e: React.ChangeEvent<HTMLSelectElement>) => {
      const nextType = e.target.value as PhaseRequest['phaseType'];
      const current = phases[idx];
      const base = createDefaultPhase(nextType);
      onPhaseReplace(idx, {
        ...base,
        durationInMonths: current?.durationInMonths ?? base.durationInMonths,
        taxRules: current?.taxRules ?? [],
      });
    };

  const getWithdrawMode = (p: PhaseRequest): 'RATE' | 'AMOUNT' => {
    const rate = Number(p.withdrawRate ?? 0);
    const amount = Number(p.withdrawAmount ?? 0);
    return rate > 0 && amount === 0 ? 'RATE' : 'AMOUNT';
  };

  const handleWithdrawModeChange =
    (idx: number) => (e: React.ChangeEvent<HTMLSelectElement>) => {
      const mode = e.target.value as 'RATE' | 'AMOUNT';
      const current = phases[idx];
      if (!current || current.phaseType !== 'WITHDRAW') return;

      if (mode === 'RATE') {
        onPhaseReplace(idx, {
          ...current,
          withdrawRate: Number(current.withdrawRate ?? 4) || 4,
          withdrawAmount: 0,
          lowerVariationPercentage: Number(current.lowerVariationPercentage ?? 0),
          upperVariationPercentage: Number(current.upperVariationPercentage ?? 0),
        });
      } else {
        onPhaseReplace(idx, {
          ...current,
          withdrawAmount: Number(current.withdrawAmount ?? 10000) || 10000,
          withdrawRate: 0,
          lowerVariationPercentage: Number(current.lowerVariationPercentage ?? 0),
          upperVariationPercentage: Number(current.upperVariationPercentage ?? 0),
        });
      }
    };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem 0' }}>
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          display: 'flex',
          flexDirection: 'column',
          fontSize: '0.95rem',
          gap: '0.75rem',
        }}
      >

        {phases.length === 0 ? (
          <p style={{ textAlign: 'center', margin: '1rem 0' }}>
            No phases added yet.
          </p>
        ) : (
          phases.map((p, idx) => {
            const { years, months } = splitMonths(p.durationInMonths);
            const withdrawMode = p.phaseType === 'WITHDRAW' ? getWithdrawMode(p) : 'AMOUNT';

            return (
              <div
                key={idx}
                style={{
                  border: '1px solid var(--fc-phase-border)',
                  borderRadius: '4px',
                  padding: '0.5rem 1rem',
                  position: 'relative',
                }}
              >
                <strong
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    marginBottom: '0.7rem',
                    fontSize: '1.1rem',
                  }}
                >
                  {p.phaseType} Phase
                  <button
                    type="button"
                    onClick={() => onPhaseRemove(idx)}
                    style={{
                      position: 'absolute',
                      right: '0.3rem',
                      top: '0.3rem',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0.4rem 0.8rem',
                      fontSize: '1rem',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.backgroundColor =
                        'rgba(255, 0, 0, 0.2)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.backgroundColor = '';
                    }}
                  >
                    ✖
                  </button>
                </strong>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '160px minmax(0, 1fr)',
                    columnGap: '0.3rem',
                    rowGap: '0.3rem',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: '0.95rem' }}>Type</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <select
                      data-tour={`phase-${idx}-type`}
                      value={p.phaseType}
                      onChange={handlePhaseTypeChange(idx)}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        padding: '0.15rem 0.3rem',
                        boxSizing: 'border-box',
                        fontSize: '0.95rem',
                      }}
                    >
                      <option value="DEPOSIT">DEPOSIT</option>
                      <option value="PASSIVE">PASSIVE</option>
                      <option value="WITHDRAW">WITHDRAW</option>
                    </select>
                    <InfoTooltip label="Info: Phase type">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div>
                          <strong>DEPOSIT</strong>: Adds money to the portfolio (one-time + monthly, optional yearly increase).
                        </div>
                        <div>
                          <strong>PASSIVE</strong>: No deposits/withdrawals; the portfolio just grows/shrinks with returns.
                        </div>
                        <div>
                          <strong>WITHDRAW</strong>: Takes money out (fixed amount or percentage rate) with optional variation rules.
                        </div>
                      </div>
                    </InfoTooltip>
                  </div>

                  <span style={{ fontSize: '0.95rem' }}>Duration</span>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.25rem',
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          gap: '0.4rem',
                          alignItems: 'center',
                        }}
                      >
                        <div style={{ flex: 1 }}>
                        <input
                          type="text"
                          inputMode="numeric"
                          data-tour={`phase-${idx}-duration-years`}
                          value={years === 0 ? '' : String(years)}
                          onChange={handleDurationYearsChange(idx)}
                          style={{
                            width: '100%',
                            padding: '0.15rem 0.3rem',
                            boxSizing: 'border-box',
                            fontSize: '0.95rem',
                          }}
                        />
                        <span
                          style={{
                            fontSize: '0.8rem',
                            opacity: 0.8,
                          }}
                        >
                          Years (0–100)
                        </span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <input
                          type="text"
                          inputMode="numeric"
                          data-tour={`phase-${idx}-duration-months`}
                          value={months === 0 ? '' : String(months)}
                          onChange={handleDurationMonthsChange(idx)}
                          style={{
                            width: '100%',
                            padding: '0.15rem 0.3rem',
                            boxSizing: 'border-box',
                            fontSize: '0.95rem',
                          }}
                        />
                        <span
                          style={{
                            fontSize: '0.8rem',
                            opacity: 0.8,
                          }}
                        >
                          Months (0–12)
                        </span>
                      </div>
                    </div>
                  </div>
                    <InfoTooltip label="Info: Phase duration">
                      How long this phase lasts. The simulation advances month-by-month.
                    </InfoTooltip>
                  </div>

                  {p.phaseType === 'DEPOSIT' && (
                    <>
                      <span style={{ fontSize: '0.95rem' }}>Initial Deposit</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <input
                          type="text"
                          inputMode="numeric"
                          data-tour={`phase-${idx}-initial-deposit`}
                          value={p.initialDeposit ?? ''}
                          onChange={handleChange(idx, 'initialDeposit')}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            padding: '0.15rem 0.3rem',
                            boxSizing: 'border-box',
                            fontSize: '0.95rem',
                          }}
                        />
                        <InfoTooltip label="Info: Initial deposit">
                          A one-time deposit at the beginning of this phase.
                        </InfoTooltip>
                      </div>

                      <span style={{ fontSize: '0.95rem' }}>Monthly Deposit</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <input
                          type="text"
                          inputMode="numeric"
                          data-tour={`phase-${idx}-monthly-deposit`}
                          value={p.monthlyDeposit ?? ''}
                          onChange={handleChange(idx, 'monthlyDeposit')}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            padding: '0.15rem 0.3rem',
                            boxSizing: 'border-box',
                            fontSize: '0.95rem',
                          }}
                        />
                        <InfoTooltip label="Info: Monthly deposit">
                          Added at each month-end during this phase.
                        </InfoTooltip>
                      </div>

                      <span style={{ fontSize: '0.95rem' }}>Yearly Increase %</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <input
                          type="text"
                          inputMode="decimal"
                          data-tour={`phase-${idx}-yearly-increase`}
                          value={p.yearlyIncreaseInPercentage ?? ''}
                          onChange={handleChange(idx, 'yearlyIncreaseInPercentage')}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            padding: '0.15rem 0.3rem',
                            boxSizing: 'border-box',
                            fontSize: '0.95rem',
                          }}
                        />
                        <InfoTooltip label="Info: Yearly deposit increase">
                          Increases the monthly deposit once per year by this percentage.
                        </InfoTooltip>
                      </div>
                    </>
                  )}

                  {p.phaseType === 'WITHDRAW' && (
                    <>
                      <span style={{ fontSize: '0.95rem' }}>Withdraw Type</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <select
                          data-tour={`phase-${idx}-withdraw-mode`}
                          value={withdrawMode}
                          onChange={handleWithdrawModeChange(idx)}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            padding: '0.15rem 0.3rem',
                            boxSizing: 'border-box',
                            fontSize: '0.95rem',
                          }}
                        >
                          <option value="RATE">Withdraw Rate</option>
                          <option value="AMOUNT">Withdraw Amount</option>
                        </select>
                        <InfoTooltip label="Info: Withdraw type">
                          Choose whether you specify a fixed monthly amount, or a yearly withdrawal rate (as % of current portfolio).
                        </InfoTooltip>
                      </div>

                      {withdrawMode === 'RATE' ? (
                        <>
                          <span style={{ fontSize: '0.95rem' }}>Withdraw Rate %</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <input
                              type="text"
                              inputMode="decimal"
                              data-tour={`phase-${idx}-withdraw-rate`}
                              value={p.withdrawRate ?? ''}
                              onChange={handleChange(idx, 'withdrawRate')}
                              style={{
                                flex: 1,
                                minWidth: 0,
                                padding: '0.15rem 0.3rem',
                                boxSizing: 'border-box',
                                fontSize: '0.95rem',
                              }}
                            />
                            <InfoTooltip label="Info: Withdraw rate">
                              A yearly % of the current portfolio, converted to a monthly withdrawal.
                            </InfoTooltip>
                          </div>
                        </>
                      ) : (
                        <>
                          <span style={{ fontSize: '0.95rem' }}>Withdraw Amount</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <input
                              type="text"
                              inputMode="numeric"
                              data-tour={`phase-${idx}-withdraw-amount`}
                              value={p.withdrawAmount ?? ''}
                              onChange={handleChange(idx, 'withdrawAmount')}
                              style={{
                                flex: 1,
                                minWidth: 0,
                                padding: '0.15rem 0.3rem',
                                boxSizing: 'border-box',
                                fontSize: '0.95rem',
                              }}
                            />
                            <InfoTooltip label="Info: Withdraw amount">
                              A fixed monthly withdrawal amount. The engine inflation-adjusts this over time.
                            </InfoTooltip>
                          </div>
                        </>
                      )}

                      <span style={{ fontSize: '0.95rem' }}>Lower Variation %</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <input
                          type="text"
                          inputMode="decimal"
                          data-tour={`phase-${idx}-lower-variation`}
                          value={p.lowerVariationPercentage ?? ''}
                          onChange={handleChange(idx, 'lowerVariationPercentage')}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            padding: '0.15rem 0.3rem',
                            boxSizing: 'border-box',
                            fontSize: '0.95rem',
                          }}
                        />
                        <InfoTooltip label="Info: Lower variation">
                          If the last month return is negative, withdrawals can be reduced by up to this %.
                        </InfoTooltip>
                      </div>

                      <span style={{ fontSize: '0.95rem' }}>Upper Variation %</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <input
                          type="text"
                          inputMode="decimal"
                          data-tour={`phase-${idx}-upper-variation`}
                          value={p.upperVariationPercentage ?? ''}
                          onChange={handleChange(idx, 'upperVariationPercentage')}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            padding: '0.15rem 0.3rem',
                            boxSizing: 'border-box',
                            fontSize: '0.95rem',
                          }}
                        />
                        <InfoTooltip label="Info: Upper variation">
                          If the last month return is positive, withdrawals can be increased by up to this %.
                        </InfoTooltip>
                      </div>
                    </>
                  )}
                </div>

                <fieldset
                  data-tour={`phase-${idx}-tax-exemptions`}
                  style={{
                    border: '1px solid var(--fc-phase-border)',
                    padding: '0.2rem',
                    marginTop: '0.3rem',
                  }}
                >
                  <legend style={{ fontSize: '0.95rem' }}>
                    Tax Exemptions
                    <InfoTooltip label="Info: Tax exemptions">
                      These reduce the taxable amount within this phase (before applying the overall tax rate).
                    </InfoTooltip>
                  </legend>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.95rem',
                      marginBottom: '0.3rem',
                    }}
                  >
                    <input
                      type="checkbox"
                      data-tour={`phase-${idx}-tax-exemptioncard`}
                      checked={p.taxRules?.includes('EXEMPTIONCARD') ?? false}
                      onChange={() => onToggleTaxRule(idx, 'EXEMPTIONCARD')}
                      style={{ marginRight: '0.3rem' }}
                    />
                    Exemption Card
                  </label>
                  <label style={{ display: 'block', fontSize: '0.95rem' }}>
                    <input
                      type="checkbox"
                      data-tour={`phase-${idx}-tax-stockexemption`}
                      checked={p.taxRules?.includes('STOCKEXEMPTION') ?? false}
                      onChange={() => onToggleTaxRule(idx, 'STOCKEXEMPTION')}
                      style={{ marginRight: '0.3rem' }}
                    />
                    Stock Exemption
                  </label>
                </fieldset>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default PhaseList;
