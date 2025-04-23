import React from 'react';
import { PhaseRequest } from '../models/types';

interface PhaseListProps {
  phases: PhaseRequest[];
}

const PhaseList: React.FC<PhaseListProps> = ({ phases }) => (
  <div>
    <h3>Phases Added</h3>
    {phases.length === 0 ? (
      <p>No phases added yet.</p>
    ) : (
      phases.map((p, idx) => (
        <div
          key={idx}
          style={{ border: '1px solid #ccc', padding: '0.5rem', marginBottom: '0.5rem' }}
        >
          <strong>{p.phaseType} Phase</strong> - Duration: {p.durationInMonths} months
          {p.phaseType === 'DEPOSIT' && (
            <div>
              Initial: {p.initialDeposit}, Monthly: {p.monthlyDeposit}, Yearly Increase: {p.yearlyIncreaseInPercentage} %
            </div>
          )}
          {p.phaseType === 'WITHDRAW' && (
            <div>

              {p.withdrawAmount! > 0
                ? `Withdraw Amount: ${p.withdrawAmount}`
                : `Withdraw Rate: ${p.withdrawRate} %`}
                              {p.withdrawVariationPercentage! > 0 && (
                <span>
                 , Variation: {p.withdrawVariationPercentage} %
                </span>
              )}
            </div>
          )}
        </div>
      ))
    )}
  </div>
);

export default PhaseList;