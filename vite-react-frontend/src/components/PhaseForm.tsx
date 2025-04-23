import React, { useState } from 'react';
import { PhaseRequest } from '../models/types';

interface PhaseFormProps {
  onAddPhase: (phase: PhaseRequest) => void;
}

const PhaseForm: React.FC<PhaseFormProps> = ({ onAddPhase }) => {
  const [phaseType, setPhaseType] = useState<PhaseRequest['phaseType']>('DEPOSIT');
  const [durationInMonths, setDurationInMonths] = useState(240);
  const [initialDeposit, setInitialDeposit] = useState(10000);
  const [monthlyDeposit, setMonthlyDeposit] = useState(10000);
  const [yearlyIncreaseInPercentage, setYearlyIncreaseInPercentage] = useState(2);

  // Withdrawal-specific states
  const [withdrawMode, setWithdrawMode] = useState<'RATE' | 'AMOUNT'>('RATE');
  const [withdrawRate, setWithdrawRate] = useState(4);
  const [withdrawAmount, setWithdrawAmount] = useState(0);
  const [withdrawVariationPercentage, setWithdrawVariationPercentage] = useState(0);

  const handleAdd = () => {
    const phase: PhaseRequest = { phaseType, durationInMonths };
    if (phaseType === 'DEPOSIT') {
      phase.initialDeposit = initialDeposit;
      phase.monthlyDeposit = monthlyDeposit;
      phase.yearlyIncreaseInPercentage = yearlyIncreaseInPercentage;
    } else if (phaseType === 'WITHDRAW') {
      // Always include variation percentage
      phase.withdrawVariationPercentage = withdrawVariationPercentage;
      if (withdrawMode === 'RATE') {
        phase.withdrawRate = withdrawRate;
        phase.withdrawAmount = 0;
      } else {
        phase.withdrawAmount = withdrawAmount;
        phase.withdrawRate = 0;
      }
    }
    onAddPhase(phase);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <h2>Add Phase</h2>
      <label>
        Type:
        <select value={phaseType} onChange={e => setPhaseType(e.target.value as any)}>
          <option value="DEPOSIT">DEPOSIT</option>
          <option value="PASSIVE">PASSIVE</option>
          <option value="WITHDRAW">WITHDRAW</option>
        </select>
      </label>
      <label>
        Duration (months):
        <input
          type="number"
          value={durationInMonths}
          onChange={e => setDurationInMonths(+e.target.value)}
        />
      </label>

      {phaseType === 'DEPOSIT' && (
        <>
          <label>
            Initial Deposit:
            <input
              type="number"
              value={initialDeposit}
              onChange={e => setInitialDeposit(+e.target.value)}
            />
          </label>
          <label>
            Monthly Deposit:
            <input
              type="number"
              value={monthlyDeposit}
              onChange={e => setMonthlyDeposit(+e.target.value)}
            />
          </label>
          <label>
            Yearly Increase %:
            <input
              type="number"
              step="0.01"
              value={yearlyIncreaseInPercentage}
              onChange={e => setYearlyIncreaseInPercentage(+e.target.value)}
            />
          </label>
        </>
      )}

      {phaseType === 'WITHDRAW' && (
        <>
          <label>
            Withdraw Type:
            <select
              value={withdrawMode}
              onChange={e => setWithdrawMode(e.target.value as 'RATE' | 'AMOUNT')}
            >
              <option value="RATE">Withdraw Rate</option>
              <option value="AMOUNT">Withdraw Amount</option>
            </select>
          </label>
          {withdrawMode === 'RATE' ? (
            <label>
              Withdraw %:
              <input
                type="number"
                step="0.01"
                value={withdrawRate}
                onChange={e => setWithdrawRate(+e.target.value)}
              />
            </label>
          ) : (
            <label>
              Withdraw Amount:
              <input
                type="number"
                value={withdrawAmount}
                onChange={e => setWithdrawAmount(+e.target.value)}
              />
            </label>
          )}
            <label>
                Monthly Max Variation %:
                <input
                type="number"
                step="0.01"
                value={withdrawVariationPercentage}
                onChange={e => setWithdrawVariationPercentage(+e.target.value)}
                />
            </label>
        </>
      )}

      <button type="button" onClick={handleAdd}>
        Add Phase
      </button>
    </div>
  );
};

export default PhaseForm;