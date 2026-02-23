import React from 'react';
import { Link } from 'react-router-dom';
import { useAssumptions } from '../state/assumptions';

const AssumptionsSummaryBar: React.FC = () => {
  const { assumptions } = useAssumptions();

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
        <span>Currency: {assumptions.currency}</span>
        <span>Inflation: {assumptions.inflationPct}%</span>
        <span>Return: {assumptions.expectedReturnPct}%</span>
        <span>SWR: {assumptions.safeWithdrawalPct}%</span>
      </div>

      <Link to="/assumptions" style={{ whiteSpace: 'nowrap' }}>
        Edit
      </Link>
    </div>
  );
};

export default AssumptionsSummaryBar;
