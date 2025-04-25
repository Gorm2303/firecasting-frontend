import React from 'react';
import { PhaseRequest } from '../models/types';

interface PhaseListProps {
  phases: PhaseRequest[];
  /**
   * Called when a field on a phase is changed.
   * @param index index of the phase in the array
   * @param field the key of PhaseRequest being updated
   * @param value the new value for that field
   */
  onPhaseChange: (index: number, field: keyof PhaseRequest, value: number | string) => void;
  /**
   * Called when a phase should be removed.
   * @param index index of the phase in the array
   */
  onPhaseRemove: (index: number) => void;
}

const PhaseList: React.FC<PhaseListProps> = ({ phases, onPhaseChange, onPhaseRemove }) => {
  const handleChange = (
    idx: number,
    field: keyof PhaseRequest,
  ) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const val = e.target.type === 'number' ? Number(raw) : raw;
    onPhaseChange(idx, field, val);
  };

  return (
    <div>
      <h3>Phases Added</h3>
      {phases.length === 0 ? (
        <p>No phases added yet.</p>
      ) : (
        phases.map((p, idx) => (
          <div
            key={idx}
            style={{ border: '1px solid #ccc', padding: '0.5rem', marginBottom: '0.5rem', position: 'relative' }}
          >
            {/* Remove Button */}
            <button
              type="button"
              onClick={() => onPhaseRemove(idx)}
              style={{ position: 'absolute', top: '0.5rem', right: '0.5rem' }}
            >
              X
            </button>

            <div>
              <strong>{p.phaseType} Phase</strong>
            </div>

            <div>
              <label>
                Duration (months):
                <input
                  type="number"
                  value={p.durationInMonths}
                  onChange={handleChange(idx, 'durationInMonths')}
                />
              </label>
            </div>

            {p.phaseType === 'DEPOSIT' && (
              <>  
                <div>
                  <label>
                    Initial Deposit:
                    <input
                      type="number"
                      value={p.initialDeposit}
                      onChange={handleChange(idx, 'initialDeposit')}
                    />
                  </label>
                </div>
                <div>
                  <label>
                    Monthly Deposit:
                    <input
                      type="number"
                      value={p.monthlyDeposit}
                      onChange={handleChange(idx, 'monthlyDeposit')}
                    />
                  </label>
                </div>
                <div>
                  <label>
                    Yearly Increase (%):
                    <input
                      type="number"
                      value={p.yearlyIncreaseInPercentage}
                      onChange={handleChange(idx, 'yearlyIncreaseInPercentage')}
                    />
                  </label>
                </div>
              </>
            )}

            {p.phaseType === 'WITHDRAW' && (
              <>
                {p.withdrawAmount != null ? (
                  <div>
                    <label>
                      Withdraw Amount:
                      <input
                        type="number"
                        value={p.withdrawAmount}
                        onChange={handleChange(idx, 'withdrawAmount')}
                      />
                    </label>
                  </div>
                ) : (
                  <div>
                    <label>
                      Withdraw Rate (%):
                      <input
                        type="number"
                        value={p.withdrawRate ?? ''}
                        onChange={handleChange(idx, 'withdrawRate')}
                      />
                    </label>
                  </div>
                )}
                {p.lowerVariationPercentage != null && (
                  <div>
                    <label>
                      Lower Variation (%):
                      <input
                        type="number"
                        value={p.lowerVariationPercentage}
                        onChange={handleChange(idx, 'lowerVariationPercentage')}
                      />
                    </label>
                  </div>
                )}
                {p.upperVariationPercentage != null && (
                  <div>
                    <label>
                      Upper Variation (%):
                      <input
                        type="number"
                        value={p.upperVariationPercentage}
                        onChange={handleChange(idx, 'upperVariationPercentage')}
                      />
                    </label>
                  </div>
                )}
              </>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default PhaseList;