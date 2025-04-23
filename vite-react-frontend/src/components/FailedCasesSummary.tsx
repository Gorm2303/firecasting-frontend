// FailedCasesSummary.tsx
import React from 'react';
import { YearlySummary } from '../models/YearlySummary';

interface FailedCasesSummaryProps {
  data: YearlySummary[];
}

const FailedCasesSummary: React.FC<FailedCasesSummaryProps> = ({ data }) => {
  // Filter only the years with nonzero failure rates.
  const failedCases = data.filter((item) => item.negativeCapitalPercentage > 0);

  if (failedCases.length === 0) {
    return <div style={{ marginTop: '1rem' }}>No failed cases were recorded.</div>;
  }

  return (
    <div style={{ marginTop: '2rem' }}>
      <h3>Failed Cases Summary</h3>
      <table style={{ width: '30%', borderCollapse: 'collapse' }}>
      <colgroup>
          {/* First two columns take only as much width as their content */}
          <col style={{ width: '1%', whiteSpace: 'nowrap' }} />
          <col style={{ width: '1%', whiteSpace: 'nowrap' }} />
          {/* Third column takes remaining space */}
          <col style={{ width: 'auto' }} />
        </colgroup>
        <thead>
          <tr>
            <th style={{ borderBottom: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>
              Year
            </th>
            <th style={{ borderBottom: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>
              Failure Rate (%)
            </th>
            <th style={{ borderBottom: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>
              Visualization
            </th>
          </tr>
        </thead>
        <tbody>
          {failedCases.map((fc) => (
            <tr key={fc.year} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '8px' , textAlign: 'center'}}>{fc.year}</td>
              <td style={{ padding: '8px' , textAlign: 'center'}}>
                {fc.negativeCapitalPercentage.toFixed(2)}%
              </td>
              <td style={{ padding: '0px' , textAlign: 'center'}}>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default FailedCasesSummary;
