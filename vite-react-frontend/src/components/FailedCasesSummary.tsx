// FailedCasesSummary.tsx
import React, { useId, useMemo, useState } from 'react';
import { MonthlySummary } from '../models/MonthlySummary';
import { YearlySummary } from '../models/YearlySummary';

type FailedCasesSummaryMode = 'yearly' | 'monthly';

interface FailedCasesSummaryProps {
  yearlyData: YearlySummary[];
  monthlyData?: MonthlySummary[];
  defaultMode?: FailedCasesSummaryMode;
}

const FailedCasesSummary: React.FC<FailedCasesSummaryProps> = ({
  yearlyData,
  monthlyData,
  defaultMode = 'yearly',
}) => {
  const [mode, setMode] = useState<FailedCasesSummaryMode>(defaultMode);
  const radioName = useId();

  const canShowMonthly = Boolean(monthlyData && monthlyData.length > 0);
  const effectiveMode: FailedCasesSummaryMode = mode === 'monthly' && !canShowMonthly ? 'yearly' : mode;

  const failedCases = useMemo(() => {
    const source = effectiveMode === 'monthly' ? (monthlyData ?? []) : yearlyData;
    return source.filter((item) => item.negativeCapitalPercentage > 0);
  }, [effectiveMode, monthlyData, yearlyData]);

  if (failedCases.length === 0) {
    return <div style={{ marginTop: '1rem' }}>No failed cases were recorded.</div>;
  }

  const firstColMinWidth = effectiveMode === 'monthly' ? 90 : 60;
  const firstColCellStyle = {
    padding: '8px',
    textAlign: 'center' as const,
    whiteSpace: 'nowrap' as const,
    minWidth: `${firstColMinWidth}px`,
  };
  const firstColHeaderStyle = {
    borderBottom: '1px solid #ccc',
    padding: '8px',
    textAlign: 'center' as const,
    whiteSpace: 'nowrap' as const,
    minWidth: `${firstColMinWidth}px`,
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',           
        display: 'flex',
        flexDirection: 'column',  
        alignItems: 'center',     
      }}
    >      
      <h3 style={{ fontSize: '1.4rem', marginBottom: '0' }}>Failed Cases Summary</h3>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', margin: '0.25rem 0 0.75rem 0' }}>
        <span style={{ fontSize: '0.95rem' }}>View:</span>
        <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          <input
            type="radio"
            name={radioName}
            checked={effectiveMode === 'yearly'}
            onChange={() => setMode('yearly')}
          />
          Yearly
        </label>
        <label
          style={{
            display: 'flex',
            gap: '0.35rem',
            alignItems: 'center',
            opacity: canShowMonthly ? 1 : 0.5,
          }}
          title={canShowMonthly ? '' : 'Monthly view is unavailable'}
        >
          <input
            type="radio"
            name={radioName}
            checked={effectiveMode === 'monthly'}
            onChange={() => setMode('monthly')}
            disabled={!canShowMonthly}
          />
          Monthly
        </label>
      </div>
        <table style={{ width: '60%', borderCollapse: 'collapse' }}>
      <colgroup>
          {/* First two columns take only as much width as their content */}
          <col style={{ width: '1%', whiteSpace: 'nowrap' }} />
          <col style={{ width: '1%', whiteSpace: 'nowrap' }} />
          {/* Third column takes remaining space */}
          <col style={{ width: 'auto' }} />
          <col style={{ width: '1%', whiteSpace: 'nowrap' }} />
        </colgroup>
        <thead>
          <tr>
            <th style={firstColHeaderStyle}>
              {effectiveMode === 'monthly' ? 'Year-Month' : 'Year'}
            </th>
            <th style={{ borderBottom: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>
              Failure Rate (%)
            </th>
            <th style={{ borderBottom: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>
              Visualization
            </th>
            <th style={{ borderBottom: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>
              Success Rate (%)
            </th>
          </tr>
        </thead>
        <tbody>
          {failedCases.map((fc) => {
            const key =
              effectiveMode === 'monthly'
                ? (fc as MonthlySummary).yearMonth
                : String((fc as YearlySummary).year);
            const label =
              effectiveMode === 'monthly'
                ? (fc as MonthlySummary).yearMonth
                : String((fc as YearlySummary).year);

            return (
              <tr key={key} style={{ borderBottom: '1px solid #eee' }}>
                <td style={firstColCellStyle}>{label}</td>
              <td style={{ padding: '8px', textAlign: 'center', color: '#cc6666' }}>
                {fc.negativeCapitalPercentage.toFixed(2)}%
              </td>
              <td style={{ padding: '0px', textAlign: 'center' }}>
                <div
                  style={{
                    background: '#eee',
                    height: '10px',
                    width: '100%',
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      background: '#ff4d4d',
                      height: '10px',
                      width: `${Math.min(fc.negativeCapitalPercentage, 100)}%`,
                      position: 'absolute',
                      top: 0,
                      left: 0,
                    }}
                  />
                </div>
              </td>
              <td style={{ padding: '8px', textAlign: 'center', color: '#66cc66' }}>
                {(100 - fc.negativeCapitalPercentage).toFixed(2)}%
              </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default FailedCasesSummary;
