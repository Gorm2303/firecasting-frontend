// FailedCasesSummary.tsx
import React, { useMemo, useState } from 'react';
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
      <div
        style={{
          display: 'flex',
          gap: '0.75rem',
          alignItems: 'center',
          justifyContent: 'center',
          flexWrap: 'wrap',
          margin: '0.25rem 0 0.75rem 0',
          padding: '0 0.5rem',
        }}
      >
        <span style={{ fontSize: '0.95rem' }}>View:</span>

        <span style={{ fontSize: '0.95rem', opacity: canShowMonthly || effectiveMode === 'yearly' ? 1 : 0.6 }}>
          Yearly
        </span>

        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            opacity: canShowMonthly ? 1 : 0.5,
            cursor: canShowMonthly ? 'pointer' : 'not-allowed',
          }}
          title={canShowMonthly ? '' : 'Monthly view is unavailable'}
        >
          <input
            type="checkbox"
            role="switch"
            aria-label="Toggle failed cases view monthly"
            checked={effectiveMode === 'monthly'}
            disabled={!canShowMonthly}
            onChange={(e) => setMode(e.target.checked ? 'monthly' : 'yearly')}
            style={{
              position: 'absolute',
              opacity: 0,
              width: 1,
              height: 1,
              overflow: 'hidden',
            }}
          />
          <span
            aria-hidden="true"
            style={{
              width: 44,
              height: 24,
              borderRadius: 999,
              border: '1px solid #444',
              backgroundColor: effectiveMode === 'monthly' ? '#2e2e2e' : '#111',
              display: 'inline-block',
              position: 'relative',
              flex: '0 0 auto',
            }}
          >
            <span
              style={{
                width: 20,
                height: 20,
                borderRadius: 999,
                backgroundColor: '#fff',
                position: 'absolute',
                top: 1,
                left: effectiveMode === 'monthly' ? 22 : 2,
                transition: 'left 120ms ease-out',
              }}
            />
          </span>
        </label>

        <span style={{ fontSize: '0.95rem', opacity: canShowMonthly ? 1 : 0.6 }}>
          Monthly
        </span>
      </div>
      <div
        style={{
          width: '100%',
          maxWidth: '900px',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          padding: '0 0.5rem',
          boxSizing: 'border-box',
        }}
      >
        <table style={{ width: '100%', minWidth: 520, borderCollapse: 'collapse' }}>
          <colgroup>
            {/* Keep first/second/fourth columns tight; let visualization expand */}
            <col style={{ width: '1%', whiteSpace: 'nowrap' }} />
            <col style={{ width: '1%', whiteSpace: 'nowrap' }} />
            <col style={{ width: 'auto' }} />
            <col style={{ width: '1%', whiteSpace: 'nowrap' }} />
          </colgroup>
          <thead>
            <tr>
              <th style={firstColHeaderStyle}>
                {effectiveMode === 'monthly' ? 'Year-Month' : 'Year'}
              </th>
              <th style={{ borderBottom: '1px solid #ccc', padding: '8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                Failure Rate (%)
              </th>
              <th style={{ borderBottom: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>
                Visualization
              </th>
              <th style={{ borderBottom: '1px solid #ccc', padding: '8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
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
                  <td style={{ padding: '8px', textAlign: 'center', color: '#cc6666', whiteSpace: 'nowrap' }}>
                    {fc.negativeCapitalPercentage.toFixed(2)}%
                  </td>
                  <td style={{ padding: '0px 8px', textAlign: 'center' }}>
                    <div
                      style={{
                        background: '#eee',
                        height: '10px',
                        width: '100%',
                        minWidth: '180px',
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
                  <td style={{ padding: '8px', textAlign: 'center', color: '#66cc66', whiteSpace: 'nowrap' }}>
                    {(100 - fc.negativeCapitalPercentage).toFixed(2)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FailedCasesSummary;
