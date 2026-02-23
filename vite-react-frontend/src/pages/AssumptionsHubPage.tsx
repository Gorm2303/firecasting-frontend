import React, { useMemo } from 'react';
import PageLayout from '../components/PageLayout';
import { useAssumptions } from '../state/assumptions';

const fieldRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(160px, 0.9fr) minmax(0, 1.2fr)',
  gap: 10,
  alignItems: 'center',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid var(--fc-card-border)',
  background: 'transparent',
  color: 'inherit',
  boxSizing: 'border-box',
};

const cardStyle: React.CSSProperties = {
  background: 'var(--fc-card-bg)',
  color: 'var(--fc-card-text)',
  border: '1px solid var(--fc-card-border)',
  borderRadius: 14,
  padding: 14,
};

const AssumptionsHubPage: React.FC = () => {
  const { assumptions, updateAssumptions, resetAssumptions } = useAssumptions();

  const jsonPreview = useMemo(() => JSON.stringify(assumptions, null, 2), [assumptions]);

  return (
    <PageLayout variant="constrained">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Assumptions Hub</h1>
          <div style={{ opacity: 0.78, marginTop: 6 }}>
            Single source of truth for the app’s baseline assumptions (stored locally for now).
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ fontWeight: 850, fontSize: 18 }}>Baseline assumptions</div>
            <button type="button" onClick={resetAssumptions} style={{ padding: '8px 10px' }}>
              Reset
            </button>
          </div>

          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 750 }}>
              <input
                type="checkbox"
                checked={assumptions.showAssumptionsBar}
                onChange={(e) => updateAssumptions({ showAssumptionsBar: e.target.checked })}
              />
              Show assumptions bar at top
            </label>
            <div style={{ opacity: 0.75, fontSize: 13, textAlign: 'right' }}>
              Default is hidden.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            <div style={fieldRowStyle}>
              <label htmlFor="assumptions-currency" style={{ fontWeight: 700 }}>
                Currency
              </label>
              <input
                id="assumptions-currency"
                value={assumptions.currency}
                onChange={(e) => updateAssumptions({ currency: e.target.value })}
                style={inputStyle}
                placeholder="e.g. DKK"
              />
            </div>

            <div style={fieldRowStyle}>
              <label htmlFor="assumptions-inflation" style={{ fontWeight: 700 }}>
                Inflation (% / year)
              </label>
              <input
                id="assumptions-inflation"
                type="number"
                step="0.1"
                value={assumptions.inflationPct}
                onChange={(e) => updateAssumptions({ inflationPct: Number(e.target.value) })}
                style={inputStyle}
              />
            </div>

            <div style={fieldRowStyle}>
              <label htmlFor="assumptions-return" style={{ fontWeight: 700 }}>
                Expected return (% / year)
              </label>
              <input
                id="assumptions-return"
                type="number"
                step="0.1"
                value={assumptions.expectedReturnPct}
                onChange={(e) => updateAssumptions({ expectedReturnPct: Number(e.target.value) })}
                style={inputStyle}
              />
            </div>

            <div style={fieldRowStyle}>
              <label htmlFor="assumptions-swr" style={{ fontWeight: 700 }}>
                Safe withdrawal rate (% / year)
              </label>
              <input
                id="assumptions-swr"
                type="number"
                step="0.1"
                value={assumptions.safeWithdrawalPct}
                onChange={(e) => updateAssumptions({ safeWithdrawalPct: Number(e.target.value) })}
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontWeight: 850, fontSize: 18, marginBottom: 8 }}>Preview</div>
          <pre style={{ margin: 0, overflow: 'auto', opacity: 0.92 }}>{jsonPreview}</pre>
        </div>
      </div>
    </PageLayout>
  );
};

export default AssumptionsHubPage;
