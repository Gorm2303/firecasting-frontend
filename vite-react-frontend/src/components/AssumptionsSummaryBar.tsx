import React from 'react';
import { Link } from 'react-router-dom';
import { useAssumptions } from '../state/assumptions';

const AssumptionsSummaryBar: React.FC = () => {
  const { currentAssumptions, isDraftDirty } = useAssumptions();

  return (
    <div
      role="note"
      aria-label="Current assumptions"
      className="flex items-center justify-between gap-2.5 rounded-xl border border-subtle-border bg-subtle px-3 py-2.5"
    >
      <div className="flex flex-wrap gap-2.5 text-xs text-card-fg/90">
        <span className="font-extrabold">Assumptions</span>
        <span>Currency: {currentAssumptions.currency}</span>
        <span>Inflation: {currentAssumptions.inflationPct}%</span>
        <span>Fee: {currentAssumptions.yearlyFeePct}%</span>
        <span>Return: {currentAssumptions.expectedReturnPct}%</span>
        <span>SWR: {currentAssumptions.safeWithdrawalPct}%</span>
        {isDraftDirty && <span className="font-bold text-card-fg/90">(Draft differs)</span>}
      </div>

      <Link to="/assumptions" className="whitespace-nowrap">
        Edit
      </Link>
    </div>
  );
};

export default AssumptionsSummaryBar;
