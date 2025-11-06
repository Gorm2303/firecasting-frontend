import React, { useState } from 'react';
import { PhaseRequest } from '../../models/types';

type ExemptionRule = 'EXEMPTIONCARD' | 'STOCKEXEMPTION';

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
  const [withdrawMode, setWithdrawMode] = useState<'RATE' | 'AMOUNT'>('AMOUNT');
  const [withdrawRate, setWithdrawRate] = useState(4);
  const [withdrawAmount, setWithdrawAmount] = useState(10000);
  const [lowerVariationPercentage, setLowerVariationPercentage] = useState(0);
  const [upperVariationPercentage, setUpperVariationPercentage] = useState(0);

  // Tax exemptions
  const [taxRules, setTaxRules] = useState<ExemptionRule[]>([]);

  const toggleRule = (rule: ExemptionRule) => {
    setTaxRules(prev =>
      prev.includes(rule) ? prev.filter(r => r !== rule) : [...prev, rule]
    );
  };

  const handleAdd = () => {
    const phase: PhaseRequest = { phaseType, durationInMonths, taxRules: [...taxRules] };
    if (phaseType === 'DEPOSIT') {
      phase.initialDeposit = initialDeposit;
      phase.monthlyDeposit = monthlyDeposit;
      phase.yearlyIncreaseInPercentage = yearlyIncreaseInPercentage;
    } else if (phaseType === 'WITHDRAW') {
      phase.lowerVariationPercentage = lowerVariationPercentage;
      phase.upperVariationPercentage = upperVariationPercentage;
      if (withdrawMode === 'RATE') {
        phase.withdrawRate = withdrawRate;
        phase.withdrawAmount = 0;
      } else {
        phase.withdrawAmount = withdrawAmount;
        phase.withdrawRate = 0;
      }
    }
    onAddPhase(phase);
    // reset exemptions
    setTaxRules([]);
  };

return (
  <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem 0 0 0' }}>
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        fontSize: '0.95rem',
        gap: '0.5rem',
      }}
    >
      <h2 style={{ textAlign: 'center', fontSize: '1.5rem', margin: 0 }}>
        Add Phase
      </h2>

      {/* grid for labels + inputs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '160px auto',
          rowGap: '0.3rem',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: '1.1rem' }}>Type:</span>
        <select
          value={phaseType}
          onChange={e =>
            setPhaseType(e.target.value as PhaseRequest['phaseType'])
          }
          style={{
            width: '100%',
            padding: '0.3rem',
            boxSizing: 'border-box',
            fontSize: '0.95rem',
          }}
        >
          <option value="DEPOSIT">DEPOSIT</option>
          <option value="PASSIVE">PASSIVE</option>
          <option value="WITHDRAW">WITHDRAW</option>
        </select>

        <span style={{ fontSize: '1.1rem' }}>Duration (months):</span>
        <input
          type="number"
          value={durationInMonths}
          onChange={e => setDurationInMonths(+e.target.value)}
          style={{
            width: '100%',
            padding: '0.3rem',
            boxSizing: 'border-box',
            fontSize: '0.95rem',
          }}
        />

        {phaseType === 'DEPOSIT' && (
          <>
            <span style={{ fontSize: '1.1rem' }}>Initial Deposit:</span>
            <input
              type="number"
              value={initialDeposit}
              onChange={e => setInitialDeposit(+e.target.value)}
              style={{
                width: '100%',
                padding: '0.3rem',
                boxSizing: 'border-box',
                fontSize: '0.95rem',
              }}
            />

            <span style={{ fontSize: '1.1rem' }}>Monthly Deposit:</span>
            <input
              type="number"
              value={monthlyDeposit}
              onChange={e => setMonthlyDeposit(+e.target.value)}
              style={{
                width: '100%',
                padding: '0.3rem',
                boxSizing: 'border-box',
                fontSize: '0.95rem',
              }}
            />

            <span style={{ fontSize: '1.1rem' }}>Yearly Increase %:</span>
            <input
              type="number"
              step="0.01"
              value={yearlyIncreaseInPercentage}
              onChange={e =>
                setYearlyIncreaseInPercentage(+e.target.value)
              }
              style={{
                width: '100%',
                padding: '0.3rem',
                boxSizing: 'border-box',
                fontSize: '0.95rem',
              }}
            />
          </>
        )}

        {phaseType === 'WITHDRAW' && (
          <>
            <span style={{ fontSize: '1.1rem' }}>Withdraw Type:</span>
            <select
              value={withdrawMode}
              onChange={e =>
                setWithdrawMode(e.target.value as 'RATE' | 'AMOUNT')
              }
              style={{
                width: '100%',
                padding: '0.3rem',
                boxSizing: 'border-box',
                fontSize: '0.95rem',
              }}
            >
              <option value="RATE">Withdraw Rate</option>
              <option value="AMOUNT">Withdraw Amount</option>
            </select>

            {withdrawMode === 'RATE' ? (
              <>
                <span style={{ fontSize: '1.1rem' }}>
                  Withdraw %:
                </span>
                <input
                  type="number"
                  step="0.01"
                  value={withdrawRate}
                  onChange={e => setWithdrawRate(+e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.3rem',
                    boxSizing: 'border-box',
                    fontSize: '0.95rem',
                  }}
                />
              </>
            ) : (
              <>
                <span style={{ fontSize: '1.1rem' }}>
                  Withdraw Amount:
                </span>
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={e => setWithdrawAmount(+e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.3rem',
                    boxSizing: 'border-box',
                    fontSize: '0.95rem',
                  }}
                />
              </>
            )}

            <span style={{ fontSize: '1.1rem' }}>
              Lower Variation %:
            </span>
            <input
              type="number"
              step="0.01"
              value={lowerVariationPercentage}
              onChange={e =>
                setLowerVariationPercentage(+e.target.value)
              }
              style={{
                width: '100%',
                padding: '0.3rem',
                boxSizing: 'border-box',
                fontSize: '0.95rem',
              }}
            />

            <span style={{ fontSize: '1.1rem' }}>
              Upper Variation %:
            </span>
            <input
              type="number"
              step="0.01"
              value={upperVariationPercentage}
              onChange={e =>
                setUpperVariationPercentage(+e.target.value)}
              style={{
                width: '100%',
                padding: '0.3rem',
                boxSizing: 'border-box',
                fontSize: '0.95rem',
              }}
            />
          </>
        )}
      </div>

      {/* Exemptions stay stacked */}
      <fieldset style={{ border: '1px solid #ddd'}}>
        <legend style={{ fontSize: '1.1rem' }}>
          Tax Exemptions
        </legend>
        <label style={{ display: 'block', fontSize: '0.95rem', marginBottom: '0.3rem' }}>
          <input
            type="checkbox"
            checked={taxRules.includes('EXEMPTIONCARD')}
            onChange={() => toggleRule('EXEMPTIONCARD')}
            style={{ marginRight: '0.3rem' }}
          />
          Exemption Card
        </label>
        <label style={{ display: 'block', fontSize: '0.95rem' }}>
          <input
            type="checkbox"
            checked={taxRules.includes('STOCKEXEMPTION')}
            onChange={() => toggleRule('STOCKEXEMPTION')}
            style={{ marginRight: '0.3rem' }}
          />
          Stock Exemption
        </label>
      </fieldset>

      <button
        type="button"
        onClick={handleAdd}
        style={{
          padding: '0.75rem',
          fontSize: '1.1rem',
        }}
      >
        Add Phase
      </button>
    </div>
  </div>
);

};

export default PhaseForm;