import React, { useState } from 'react';
import { PhaseRequest } from '../../models/types';

type ExemptionRule = NonNullable<PhaseRequest['taxRules']>[number];

interface PhaseFormProps {
  onAddPhase: (phase: PhaseRequest) => void;
}

const MAX_YEARS = 100;
const MAX_TOTAL_MONTHS = MAX_YEARS * 12;

const PhaseForm: React.FC<PhaseFormProps> = ({ onAddPhase }) => {
  const [phaseType, setPhaseType] = useState<PhaseRequest['phaseType']>('DEPOSIT');

  // Duration split into years + months
  const [durationYears, setDurationYears] = useState(20); // 20 years = 240 months default
  const [durationMonths, setDurationMonths] = useState(0);

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

  const normaliseDuration = (years: number, months: number) => {
    let y = Math.max(0, years);
    let m = Math.max(0, months);

    // Convert any extra months into years
    if (m >= 12) {
      y += Math.floor(m / 12);
      m = m % 12;
    }

    // Clamp to 0..100 years total
    if (y > MAX_YEARS) {
      y = MAX_YEARS;
      m = 0;
    }

    return { years: y, months: m };
  };

  const handleYearsChange = (raw: string) => {
    const val = Number(raw);
    if (Number.isNaN(val)) {
      setDurationYears(0);
      return;
    }
    const { years, months } = normaliseDuration(val, durationMonths);
    setDurationYears(years);
    setDurationMonths(months);
  };

  const handleMonthsChange = (raw: string) => {
    const val = Number(raw);
    if (Number.isNaN(val)) {
      setDurationMonths(0);
      return;
    }
    const { years, months } = normaliseDuration(durationYears, val);
    setDurationYears(years);
    setDurationMonths(months);
  };

  const getTotalMonths = () => durationYears * 12 + durationMonths;

  const handleAdd = () => {
    const totalMonths = getTotalMonths();

    if (totalMonths <= 0) {
      alert('Duration must be greater than 0.');
      return;
    }

    if (totalMonths > MAX_TOTAL_MONTHS) {
      alert(`Duration must be at most ${MAX_YEARS} years in total.`);
      return;
    }

    const phase: PhaseRequest = {
      phaseType,
      durationInMonths: totalMonths,
      taxRules: [...taxRules],
    };

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

    // reset exemptions (duration stays as last used)
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

          <span style={{ fontSize: '1.1rem' }}>Duration:</span>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <input
                type="number"
                min={0}
                max={MAX_YEARS}
                value={durationYears}
                onChange={e => handleYearsChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.3rem',
                  boxSizing: 'border-box',
                  fontSize: '0.95rem',
                }}
              />
              <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>Years (0–100)</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <input
                type="number"
                min={0}
                max={12}
                value={durationMonths}
                onChange={e => handleMonthsChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.3rem',
                  boxSizing: 'border-box',
                  fontSize: '0.95rem',
                }}
              />
              <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>Months (0–12)</span>
            </div>
          </div>

          {phaseType === 'DEPOSIT' && (
            <>
              <span style={{ fontSize: '1.1rem' }}>Initial Deposit</span>
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

              <span style={{ fontSize: '1.1rem' }}>Monthly Deposit</span>
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

              <span style={{ fontSize: '1.1rem' }}>Yearly Increase %</span>
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
              <span style={{ fontSize: '1.1rem' }}>Withdraw Type</span>
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
                  <span style={{ fontSize: '1.1rem' }}>Withdraw %</span>
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
                  <span style={{ fontSize: '1.1rem' }}>Withdraw Amount</span>
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

              <span style={{ fontSize: '1.1rem' }}>Lower Variation %</span>
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

              <span style={{ fontSize: '1.1rem' }}>Upper Variation %:</span>
              <input
                type="number"
                step="0.01"
                value={upperVariationPercentage}
                onChange={e =>
                  setUpperVariationPercentage(+e.target.value)
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
        </div>

        {/* Exemptions stay stacked */}
        <fieldset style={{ border: '1px solid #ddd' }}>
          <legend style={{ fontSize: '1.1rem' }}>
            Tax Exemptions
          </legend>
          <label style={{ display: 'block', fontSize: '0.95rem', marginBottom: '0.3rem' }}>
            <input
              type="checkbox"
              checked={taxRules.includes('exemptioncard')}
              onChange={() => toggleRule('exemptioncard')}
              style={{ marginRight: '0.3rem' }}
            />
            Exemption Card
          </label>
          <label style={{ display: 'block', fontSize: '0.95rem' }}>
            <input
              type="checkbox"
              checked={taxRules.includes('stockexemption')}
              onChange={() => toggleRule('stockexemption')}
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
