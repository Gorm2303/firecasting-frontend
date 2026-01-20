import type { PhaseRequest, SimulationRequest } from '../../models/types';

const nf0 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

const fmtMoney = (v: number) => nf0.format(Math.round(v));
const fmtPct = (v: number) => nf2.format(v);

const addOneYearSameDay = (isoDate: string): string | null => {
  // ISO date: YYYY-MM-DD
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(isoDate);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;

  const nextY = y + 1;
  // Clamp to last day of month if needed (e.g., Feb 29)
  const dt = new Date(nextY, mo - 1, d);
  if (dt.getMonth() !== mo - 1) {
    // overflowed; go to last day of target month
    const last = new Date(nextY, mo, 0);
    return `${nextY}-${String(mo).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
  }
  return `${nextY}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};

const findPhase = (phases: PhaseRequest[], phaseType: PhaseRequest['phaseType']) =>
  phases.find((p) => p.phaseType === phaseType);

type Props = {
  request: SimulationRequest;
};

export default function AssumptionsPanel({ request }: Props) {
  const deposit = findPhase(request.phases, 'DEPOSIT');
  const withdraw = findPhase(request.phases, 'WITHDRAW');

  // These are the current legacy defaults used by the backend /start endpoint.
  const returnType = 'dataDrivenReturn';
  const inflationFactorPerYear = 1.02;

  const monthlyDeposit = Number(deposit?.monthlyDeposit ?? 0) || 0;
  const yearlyIncreasePct = Number(deposit?.yearlyIncreaseInPercentage ?? 0) || 0;

  const withdrawAmount = Number(withdraw?.withdrawAmount ?? 0) || 0;
  const withdrawRate = Number(withdraw?.withdrawRate ?? 0) || 0;
  const baseMonthlyWithdraw = withdrawAmount > 0 ? withdrawAmount : (withdrawRate > 0 ? withdrawRate * 100 : 0);

  const inflatedWithdrawNextYear = baseMonthlyWithdraw > 0 ? baseMonthlyWithdraw * inflationFactorPerYear : 0;

  const taxPct = Number(request.taxPercentage) || 0;

  const upperVar = Number(withdraw?.upperVariationPercentage ?? 0) || 0;
  const lowerVar = Number(withdraw?.lowerVariationPercentage ?? 0) || 0;

  const exampleMonthlyDepositNextYear = monthlyDeposit > 0 ? monthlyDeposit * (1 + yearlyIncreasePct / 100) : 0;

  const nextYearEnd = addOneYearSameDay(request.startDate?.date);

  // Use a user-derived number for examples where we otherwise lack state.
  const exampleYearlyGain = Math.max(1000, monthlyDeposit > 0 ? monthlyDeposit * 12 : 10000);
  const exampleNotionalTax = exampleYearlyGain * (taxPct / 100);

  const assumedGainsRatio = 0.5;
  const exampleCapGainsTax = baseMonthlyWithdraw > 0
    ? baseMonthlyWithdraw * assumedGainsRatio * (taxPct / 100)
    : 0;

  return (
    <div
      aria-label="Model assumptions"
      style={{
        width: 360,
        border: '1px solid #333',
        borderRadius: 12,
        padding: 12,
        background: '#0f0f0f',
        color: '#fff',
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 6 }}>Assumptions</div>
      <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 10 }}>
        Plain-language notes about how the simulator interprets your inputs.
      </div>

      <details open>
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Returns (market model)</summary>
        <div style={{ fontSize: 13, lineHeight: 1.35, marginTop: 6, opacity: 0.95 }}>
          <div>
            Normal mode currently uses <b>{returnType}</b>: it fits a distribution to historical DJIA prices and
            samples returns each step.
          </div>
          <div style={{ marginTop: 6 }}>
            Example: if your capital is {fmtMoney(Math.max(1000, (deposit?.initialDeposit ?? 0) + monthlyDeposit))} and a sampled
            per-step return is +0.2%, the return that step is roughly {fmtMoney(Math.max(1000, (deposit?.initialDeposit ?? 0) + monthlyDeposit) * 0.002)}.
          </div>
        </div>
      </details>

      <details open style={{ marginTop: 8 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Inflation (real spending)</summary>
        <div style={{ fontSize: 13, lineHeight: 1.35, marginTop: 6, opacity: 0.95 }}>
          <div>
            Inflation compounds once per simulation year (at year-end). In normal mode the default factor is{' '}
            <b>{inflationFactorPerYear}</b> (≈ {fmtPct((inflationFactorPerYear - 1) * 100)}% per year).
          </div>
          {baseMonthlyWithdraw > 0 && (
            <div style={{ marginTop: 6 }}>
              Example with your withdrawal: {fmtMoney(baseMonthlyWithdraw)} / month becomes about {fmtMoney(inflatedWithdrawNextYear)} / month after one year
              due to inflation adjustment.
            </div>
          )}
          {nextYearEnd && (
            <div style={{ marginTop: 6, opacity: 0.9 }}>
              Calendar note: with start date {request.startDate.date}, the first “year-end” checkpoint is around {nextYearEnd}.
            </div>
          )}
        </div>
      </details>

      <details open style={{ marginTop: 8 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Tax timing</summary>
        <div style={{ fontSize: 13, lineHeight: 1.35, marginTop: 6, opacity: 0.95 }}>
          <div>
            Your tax rule is <b>{request.overallTaxRule === 'CAPITAL' ? 'Capital gains' : 'Notional gains'}</b> at{' '}
            <b>{fmtPct(taxPct)}%</b>.
          </div>

          {request.overallTaxRule === 'NOTIONAL' && (
            <div style={{ marginTop: 6 }}>
              Notional gains tax is applied at year-end on gains since the previous year-end.
              Example using your numbers: if the portfolio earns {fmtMoney(exampleYearlyGain)} in a year, tax is about{' '}
              {fmtMoney(exampleNotionalTax)}.
            </div>
          )}

          {request.overallTaxRule === 'CAPITAL' && (
            <div style={{ marginTop: 6 }}>
              Capital gains tax is applied when withdrawing (month-end). The model estimates what fraction of a withdrawal
              is “gains” vs “principal” based on deposited vs current capital.
              {baseMonthlyWithdraw > 0 && (
                <>
                  {' '}Example with your withdrawal: if roughly {fmtPct(assumedGainsRatio * 100)}% of the withdrawal is treated as gains,
                  tax is about {fmtMoney(exampleCapGainsTax)}.
                </>
              )}
            </div>
          )}

          <div style={{ marginTop: 6, opacity: 0.9 }}>
            Phase tax exemptions (e.g. “Exemption card”, “Stock exemption”) reduce the taxable amount before applying the rate.
          </div>
        </div>
      </details>

      <details open style={{ marginTop: 8 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Contributions & withdrawals</summary>
        <div style={{ fontSize: 13, lineHeight: 1.35, marginTop: 6, opacity: 0.95 }}>
          <div>
            Deposits happen at month-end, and your deposit phase increases the monthly deposit once per year.
          </div>
          {monthlyDeposit > 0 && (
            <div style={{ marginTop: 6 }}>
              Example: {fmtMoney(monthlyDeposit)} / month with {fmtPct(yearlyIncreasePct)}% yearly increase becomes about{' '}
              {fmtMoney(exampleMonthlyDepositNextYear)} / month after one year.
            </div>
          )}

          {(upperVar > 0 || lowerVar > 0) && baseMonthlyWithdraw > 0 && (
            <div style={{ marginTop: 6 }}>
              Withdrawal “variation” adjusts spending based on the last month’s return. With your settings, the model can
              increase by up to +{fmtPct(upperVar)}% ({fmtMoney(baseMonthlyWithdraw * (upperVar / 100))}) or decrease by up to -{fmtPct(lowerVar)}% ({fmtMoney(baseMonthlyWithdraw * (lowerVar / 100))})
              relative to the base withdrawal.
            </div>
          )}
        </div>
      </details>

      <details open style={{ marginTop: 8 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Rebalancing</summary>
        <div style={{ fontSize: 13, lineHeight: 1.35, marginTop: 6, opacity: 0.95 }}>
          <div>
            The model tracks a single pooled portfolio value (no explicit asset allocation / rebalancing inputs in normal mode).
          </div>
          <div style={{ marginTop: 6, opacity: 0.9 }}>
            Deposits, withdrawals, taxes, and returns all apply to the same pool.
          </div>
        </div>
      </details>
    </div>
  );
}
