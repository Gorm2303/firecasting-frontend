import React from 'react';
import { PhaseRequest } from '../models/types';

type ExemptionRule = 'EXEMPTIONCARD' | 'STOCKEXEMPTION';

interface PhaseListProps {
  phases: PhaseRequest[];
  onPhaseChange: (
    index: number,
    field: keyof PhaseRequest,
    value: number | string
  ) => void;
  onPhaseRemove: (index: number) => void;
  onToggleTaxRule: (index: number, rule: ExemptionRule) => void;
}

const PhaseList: React.FC<PhaseListProps> = ({
  phases,
  onPhaseChange,
  onPhaseRemove,
  onToggleTaxRule,
}) => {
  const handleChange =
    (idx: number, field: keyof PhaseRequest) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const val = e.target.type === 'number' ? Number(raw) : raw;
      onPhaseChange(idx, field, val);
    };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem 0' }}>
      <div
        style={{
          width: '400px',
          display: 'flex',
          flexDirection: 'column',
          fontSize: '0.95rem',
          gap: '0.75rem',
        }}
      >
        <h2 style={{ textAlign: 'center', fontSize: '1.5rem', margin: 0 }}>
          Phases Added
        </h2>

        {phases.length === 0 ? (
          <p style={{ textAlign: 'center', margin: '1rem 0' }}>
            No phases added yet.
          </p>
        ) : (
          phases.map((p, idx) => (
            <div
              key={idx}
              style={{
                border: '1px solid #ccc',
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
                    e.currentTarget.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
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
                  gridTemplateColumns: '140px auto',
                  columnGap: '0.5rem',
                  rowGap: '0.3rem',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: '0.95rem' }}>Duration (months):</span>
                <input
                  type="number"
                  value={p.durationInMonths}
                  onChange={handleChange(idx, 'durationInMonths')}
                  style={{
                    width: '100%',
                    padding: '0.15rem 0.3rem',
                    boxSizing: 'border-box',
                    fontSize: '0.95rem',
                  }}
                />

                {p.phaseType === 'DEPOSIT' && (
                  <>
                    <span style={{ fontSize: '0.95rem' }}>Initial Deposit:</span>
                    <input
                      type="number"
                      value={p.initialDeposit}
                      onChange={handleChange(idx, 'initialDeposit')}
                      style={{
                        width: '100%',
                        padding: '0.15rem 0.3rem',
                        boxSizing: 'border-box',
                        fontSize: '0.95rem',
                      }}
                    />

                    <span style={{ fontSize: '0.95rem' }}>Monthly Deposit:</span>
                    <input
                      type="number"
                      value={p.monthlyDeposit}
                      onChange={handleChange(idx, 'monthlyDeposit')}
                      style={{
                        width: '100%',
                        padding: '0.15rem 0.3rem',
                        boxSizing: 'border-box',
                        fontSize: '0.95rem',
                      }}
                    />

                    <span style={{ fontSize: '0.95rem' }}>Yearly Increase %:</span>
                    <input
                      type="number"
                      step="0.01"
                      value={p.yearlyIncreaseInPercentage}
                      onChange={handleChange(idx, 'yearlyIncreaseInPercentage')}
                      style={{
                        width: '100%',
                        padding: '0.15rem 0.3rem',
                        boxSizing: 'border-box',
                        fontSize: '0.95rem',
                      }}
                    />
                  </>
                )}

                {p.phaseType === 'WITHDRAW' && (
                  <>
                    {p.withdrawAmount != null && p.withdrawAmount > 0 ? (
                      <>
                        <span style={{ fontSize: '0.95rem' }}>Withdraw Amount:</span>
                        <input
                          type="number"
                          value={p.withdrawAmount}
                          onChange={handleChange(idx, 'withdrawAmount')}
                          style={{
                            width: '100%',
                            padding: '0.15rem 0.3rem',
                            boxSizing: 'border-box',
                            fontSize: '0.95rem',
                          }}
                        />
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: '0.95rem' }}>Withdraw Rate %:</span>
                        <input
                          type="number"
                          step="0.01"
                          value={p.withdrawRate ?? ''}
                          onChange={handleChange(idx, 'withdrawRate')}
                          style={{
                            width: '100%',
                            padding: '0.15rem 0.3rem',
                            boxSizing: 'border-box',
                            fontSize: '0.95rem',
                          }}
                        />
                      </>
                    )}

                    {p.lowerVariationPercentage != null && (
                      <>
                        <span style={{ fontSize: '0.95rem' }}>Lower Variation %:</span>
                        <input
                          type="number"
                          value={p.lowerVariationPercentage}
                          onChange={handleChange(idx, 'lowerVariationPercentage')}
                          style={{
                            width: '100%',
                            padding: '0.15rem 0.3rem',
                            boxSizing: 'border-box',
                            fontSize: '0.95rem',
                          }}
                        />
                      </>
                    )}

                    {p.upperVariationPercentage != null && (
                      <>
                        <span style={{ fontSize: '0.95rem' }}>Upper Variation %:</span>
                        <input
                          type="number"
                          value={p.upperVariationPercentage}
                          onChange={handleChange(idx, 'upperVariationPercentage')}
                          style={{
                            width: '100%',
                            padding: '0.15rem 0.3rem',
                            boxSizing: 'border-box',
                            fontSize: '0.95rem',
                          }}
                        />
                      </>
                    )}
                  </>
                )}
              </div>

              <fieldset
                style={{
                  border: '1px solid #ddd',
                  padding: '0.2rem',
                  marginTop: '0.3rem',
                }}
              >
                <legend style={{ fontSize: '0.95rem' }}>Tax Exemptions</legend>
                <label style={{ display: 'block', fontSize: '0.95rem', marginBottom: '0.3rem' }}>
                  <input
                    type="checkbox"
                    checked={p.taxRules?.includes('EXEMPTIONCARD') ?? false}
                    onChange={() => onToggleTaxRule(idx, 'EXEMPTIONCARD')}
                    style={{ marginRight: '0.3rem' }}
                  />
                  Exemption Card
                </label>
                <label style={{ display: 'block', fontSize: '0.95rem' }}>
                  <input
                    type="checkbox"
                    checked={p.taxRules?.includes('STOCKEXEMPTION') ?? false}
                    onChange={() => onToggleTaxRule(idx, 'STOCKEXEMPTION')}
                    style={{ marginRight: '0.3rem' }}
                  />
                  Stock Exemption
                </label>
              </fieldset>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PhaseList;
