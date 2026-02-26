import React from 'react';
import { Link } from 'react-router-dom';
import { useAssumptions } from '../state/assumptions';

const AssumptionsSummaryBar: React.FC = () => {
  const { currentAssumptions, isDraftDirty } = useAssumptions();

  return (
    <div
      role="note"
      aria-label="Current assumptions"
      style={{
        background: 'var(--fc-subtle-bg)',
        border: '1px solid var(--fc-subtle-border)',
        borderRadius: 12,
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 13, opacity: 0.92 }}>
        <span style={{ fontWeight: 800 }}>Assumptions</span>
        <span>Currency: {currentAssumptions.currency}</span>
        <span>Inflation: {currentAssumptions.inflationPct}%</span>
        <span>Fee: {currentAssumptions.yearlyFeePct}%</span>
        <span>Return: {currentAssumptions.expectedReturnPct}%</span>
        <span>SWR: {currentAssumptions.safeWithdrawalPct}%</span>
        {isDraftDirty && (
          <span style={{ fontWeight: 750, opacity: 0.9 }}>(Draft differs)</span>
        )}
      </div>

      <Link to="/assumptions" style={{ whiteSpace: 'nowrap' }}>
        Edit
      </Link>
    </div>
  );
};

export default AssumptionsSummaryBar;
