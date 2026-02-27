import React, { useMemo, useState } from 'react';
import PageLayout from '../components/PageLayout';
import municipalTaxRates2026 from '../data/dk/municipalTaxRates2026.json';
import { calculateSalaryAfterTax } from '../lib/dk/salaryAfterTaxCalculator';
import { DK_TAX_YEAR_2026 } from '../lib/dk/taxYears';
import type { DkMunicipalityTaxRate, GrossPeriod, SalaryAfterTaxInputs } from '../lib/dk/taxYearTypes';
import { useAssumptions } from '../state/assumptions';

type MunicipalityDataset = {
  year: number;
  municipalities: DkMunicipalityTaxRate[];
};

const formatDkk = (value: number): string => {
  const safe = Number.isFinite(value) ? value : 0;
  return safe.toLocaleString('da-DK');
};

const formatPct = (value: number, digits = 1): string => {
  const safe = Number.isFinite(value) ? value : 0;
  return `${(safe * 100).toFixed(digits)}%`;
};

const ANNUAL_BREAKDOWN_MILESTONE_LABELS = new Set<string>([
  'Gross salary (year)',
  'AM base',
  'Personal income after AM',
  'Taxable income',
  'Net salary (year)',
]);

const controlStyle: React.CSSProperties = {
  height: 44,
  padding: '0 10px',
  border: '1px solid var(--fc-card-border)',
  borderRadius: 4,
  background: 'var(--fc-card-bg)',
  color: 'var(--fc-card-text)',
  fontSize: 20,
};

const inputGroupStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'stretch',
  height: 44,
  border: '1px solid var(--fc-card-border)',
  borderRadius: 4,
  overflow: 'hidden',
  background: 'var(--fc-card-bg)',
  color: 'var(--fc-card-text)',
  fontSize: 20,
};

const inputGroupInputStyle: React.CSSProperties = {
  flex: '1 1 auto',
  width: '100%',
  padding: '0 10px',
  border: 'none',
  outline: 'none',
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
};

const inputGroupUnitStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '0 10px',
  borderLeft: '1px solid var(--fc-subtle-border)',
  background: 'var(--fc-subtle-bg)',
  color: 'var(--fc-card-muted)',
  fontSize: 20,
  fontWeight: 600,
  whiteSpace: 'nowrap',
};

const formLabelTextStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 20,
};

const toDisplayPeriod = (annualDkk: number, grossPeriod: GrossPeriod): number => {
  const safe = Number.isFinite(annualDkk) ? annualDkk : 0;
  return grossPeriod === 'monthly' ? Math.round(safe / 12) : Math.round(safe);
};

const SalaryAfterTaxPage: React.FC = () => {
  const taxYear = 2026 as const;
  const municipalDataset = municipalTaxRates2026 as MunicipalityDataset;
  const { currentAssumptions } = useAssumptions();

  const [grossPeriod, setGrossPeriod] = useState<GrossPeriod>('monthly');
  const [grossAmount, setGrossAmount] = useState<number>(50_000);

  const [employeePensionRatePct, setEmployeePensionRatePct] = useState<number>(
    () => currentAssumptions.salaryTaxatorDefaults.employeePensionRatePct
  );

  const [otherDeductionsAnnualDkk, setOtherDeductionsAnnualDkk] = useState<number>(
    () => currentAssumptions.salaryTaxatorDefaults.otherDeductionsAnnualDkk
  );

  const [municipalityId, setMunicipalityId] = useState<string>(
    () => currentAssumptions.salaryTaxatorDefaults.municipalityId
  );
  const [churchMember, setChurchMember] = useState<boolean>(
    () => currentAssumptions.salaryTaxatorDefaults.churchMember
  );

  const [country] = useState<'DK'>('DK');
  const [optionalsOpen, setOptionalsOpen] = useState<boolean>(false);

  const onChangeGrossPeriod = (next: GrossPeriod) => {
    setGrossAmount((current) => {
      const safe = Number.isFinite(current) ? current : 0;
      if (next === grossPeriod) return safe;
      if (next === 'annual') return Math.round(safe * 12);
      return Math.round(safe / 12);
    });
    setGrossPeriod(next);
  };

  const effectiveMunicipalityId = optionalsOpen ? municipalityId : 'average';
  const effectiveChurchMember = optionalsOpen ? churchMember : false;

  const selectedMunicipality = useMemo(() => {
    if (effectiveMunicipalityId === 'average') return null;
    const id = Number(effectiveMunicipalityId);
    return municipalDataset.municipalities.find((m) => m.id === id) ?? null;
  }, [effectiveMunicipalityId, municipalDataset.municipalities]);

  const municipalTaxRate =
    selectedMunicipality != null
      ? selectedMunicipality.municipalTaxPct / 100
      : (Number(currentAssumptions.salaryTaxatorDefaults.defaultMunicipalTaxRatePct) || 0) / 100;
  const churchTaxRate = selectedMunicipality != null ? selectedMunicipality.churchTaxPct / 100 : 0;

  const grossMonthlyEquivalent = useMemo(() => {
    const safeGross = Number.isFinite(grossAmount) ? grossAmount : 0;
    return grossPeriod === 'monthly' ? safeGross : safeGross / 12;
  }, [grossAmount, grossPeriod]);

  // Assumption: ATP (employee share) is only deducted when working > 39 hours/month.
  // We don't model hours directly, so we approximate eligibility using gross monthly salary.
  const atpAnnualDkk = useMemo(() => {
    const threshold = Number(currentAssumptions.salaryTaxatorDefaults.atpEligibilityGrossMonthlyThresholdDkk) || 0;
    const monthly = Number(currentAssumptions.salaryTaxatorDefaults.atpMonthlyDkk) || 0;
    return grossMonthlyEquivalent < threshold ? 0 : monthly * 12;
  }, [
    currentAssumptions.salaryTaxatorDefaults.atpEligibilityGrossMonthlyThresholdDkk,
    currentAssumptions.salaryTaxatorDefaults.atpMonthlyDkk,
    grossMonthlyEquivalent,
  ]);

  const usingDefaultMunicipal = selectedMunicipality == null;

  const breakdown = useMemo(() => {
    const inputs: SalaryAfterTaxInputs = {
      year: taxYear,
      grossAmount,
      grossPeriod,
      employeePensionRate: optionalsOpen ? employeePensionRatePct / 100 : 0,
      atpAnnualDkk,
      otherDeductionsAnnualDkk: optionalsOpen ? otherDeductionsAnnualDkk : 0,
      municipalTaxRate,
      churchTaxRate,
      churchMember: effectiveChurchMember,
    };

    return calculateSalaryAfterTax(inputs);
  }, [
    atpAnnualDkk,
    effectiveChurchMember,
    churchTaxRate,
    employeePensionRatePct,
    grossAmount,
    grossPeriod,
    municipalTaxRate,
    otherDeductionsAnnualDkk,
    optionalsOpen,
    taxYear,
  ]);

  const netDisplay = grossPeriod === 'monthly' ? breakdown.netMonthlyDkk : breakdown.netAnnualDkk;
  const totalTaxDisplay = toDisplayPeriod(breakdown.totalTaxAnnualDkk, grossPeriod);

  const otherDeductionsDisplayDkk =
    grossPeriod === 'monthly' ? Math.round(otherDeductionsAnnualDkk / 12) : Math.round(otherDeductionsAnnualDkk);
  const otherDeductionsUnit = grossPeriod === 'monthly' ? 'DKK/mo' : 'DKK/y';

  const annualBreakdownRows = [
    { label: 'Gross salary (year)', value: breakdown.grossAnnualDkk, note: 'annualized from input' },
    { label: 'Employee pension', value: -breakdown.employeePensionAnnualDkk, note: 'deducted before AM-bidrag' },
    {
      label: 'ATP',
      value: -breakdown.atpAnnualDkk,
      note:
        breakdown.atpAnnualDkk === 0
          ? `0 DKK (gross/mo < ${(Number(currentAssumptions.salaryTaxatorDefaults.atpEligibilityGrossMonthlyThresholdDkk) || 0).toLocaleString('da-DK')})`
          : `${Number(currentAssumptions.salaryTaxatorDefaults.atpMonthlyDkk) || 0} DKK/mo (fixed; gross/mo ≥ ${(Number(currentAssumptions.salaryTaxatorDefaults.atpEligibilityGrossMonthlyThresholdDkk) || 0).toLocaleString('da-DK')})`,
    },
    { label: 'AM base', value: breakdown.amBaseAnnualDkk, note: 'gross - pension - ATP' },
    { label: 'AM-bidrag (8%)', value: -breakdown.amBidragAnnualDkk, note: '8% of AM base' },
    { label: 'Personal income after AM', value: breakdown.personalIncomeAfterAmAnnualDkk, note: 'AM base - AM-bidrag' },
    {
      label: 'Personfradrag',
      value: -breakdown.personfradragAnnualDkk,
      note: `first ${formatDkk(DK_TAX_YEAR_2026.personfradragAnnualDkk)} of income`,
    },
    {
      label: 'Beskæftigelsesfradrag',
      value: -breakdown.beskaeftigelsesfradragAnnualDkk,
      note: '12.75% of income (cap 63,300)',
    },
    { label: 'Jobfradrag', value: -breakdown.jobfradragAnnualDkk, note: '4.5% above 235,200 (cap 3,100)' },
    { label: 'Other deductions', value: -breakdown.otherDeductionsAnnualDkk, note: 'user input' },
    { label: 'Taxable income', value: breakdown.taxableIncomeAnnualDkk, note: 'income after AM - deductions' },
    {
      label: 'Municipal tax',
      value: -breakdown.municipalTaxAnnualDkk,
      note: usingDefaultMunicipal
        ? `rate: ${(Number(currentAssumptions.salaryTaxatorDefaults.defaultMunicipalTaxRatePct) || 0).toFixed(1)}% fallback`
        : `rate: ${formatPct(municipalTaxRate, 2)}`,
    },
    ...(breakdown.churchTaxAnnualDkk !== 0
      ? [
          {
            label: 'Church tax',
            value: -breakdown.churchTaxAnnualDkk,
            note: `rate: ${formatPct(churchTaxRate, 2)}`,
          },
        ]
      : [
          {
            label: 'Church tax',
            value: 0,
            note: selectedMunicipality ? 'not enabled' : '0% (no municipality selected)',
          },
        ]),
    { label: 'Bundskat (12.01%)', value: -breakdown.bundskatAnnualDkk, note: '12.01% of taxable income' },
    { label: 'Mellemskat', value: -breakdown.mellemskatAnnualDkk, note: '7.5% above 641,200 (after AM)' },
    { label: 'Topskat', value: -breakdown.topskatAnnualDkk, note: '7.5% above 777,900 (after AM)' },
    { label: 'Toptopskat', value: -breakdown.toptopskatAnnualDkk, note: '5% above 2,592,700 (after AM)' },
    { label: 'Total tax', value: -breakdown.totalTaxAnnualDkk, note: 'sum of tax line items' },
    { label: 'Net salary (year)', value: breakdown.netAnnualDkk, note: 'gross - pension - ATP - taxes' },
  ] satisfies Array<{ label: string; value: number; note: string }>;

  return (
    <PageLayout variant="constrained" maxWidthPx={980}>
      <h1 style={{ textAlign: 'center' }}>Salary Taxator (after tax)</h1>

      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <div
          style={{
            display: 'grid',
            gap: 14,
            gridTemplateColumns: '1fr',
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={{ display: 'grid', gap: 4, flex: '1 1 160px' }}>
              <span style={formLabelTextStyle}>Year</span>
              <select aria-label="tax year" value={taxYear} disabled style={controlStyle}>
                <option value={2026}>2026</option>
              </select>
            </label>

            <label style={{ display: 'grid', gap: 4, flex: '1 1 160px' }}>
              <span style={formLabelTextStyle}>Country</span>
              <select aria-label="country" value={country} disabled style={controlStyle}>
                <option value="DK">Denmark</option>
              </select>
            </label>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={{ display: 'grid', gap: 4, flex: '1 1 160px' }}>
              <span style={formLabelTextStyle}>Gross salary</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <div style={inputGroupStyle}>
                  <input
                    aria-label="gross amount"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={grossAmount}
                    onChange={(e) => setGrossAmount(Number(e.target.value))}
                    style={inputGroupInputStyle}
                  />
                  <span aria-hidden style={inputGroupUnitStyle}>
                    DKK
                  </span>
                </div>
                <select
                  aria-label="gross period"
                  value={grossPeriod}
                  onChange={(e) => onChangeGrossPeriod(e.target.value as GrossPeriod)}
                  style={controlStyle}
                >
                  <option value="monthly">Monthly</option>
                  <option value="annual">Annual</option>
                </select>
              </div>
            </label>
          </div>
          <details
            open={optionalsOpen}
            onToggle={(e) => {
              const nextOpen = (e.currentTarget as HTMLDetailsElement).open;
              if (!nextOpen) {
                setEmployeePensionRatePct(0);
                setOtherDeductionsAnnualDkk(0);
                setMunicipalityId('average');
                setChurchMember(false);
              }
              setOptionalsOpen(nextOpen);
            }}
            style={{
              border: '1px solid var(--fc-subtle-border)',
              borderRadius: 6,
              padding: 10,
              background: 'var(--fc-card-bg)',
              color: 'var(--fc-card-text)',
            }}
          >
            <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 16 }}>
              Optionals
            </summary>

            <div style={{ display: 'grid', gap: 14, marginTop: 12 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <label style={{ display: 'grid', gap: 4, flex: '1 1 240px' }}>
                  <span style={formLabelTextStyle}>Employee pension</span>
                  <div style={inputGroupStyle}>
                    <input
                      aria-label="employee pension percent"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={100}
                      step={0.1}
                      value={employeePensionRatePct}
                      onChange={(e) => setEmployeePensionRatePct(Number(e.target.value))}
                      style={inputGroupInputStyle}
                    />
                    <span aria-hidden style={inputGroupUnitStyle}>
                      % of gross
                    </span>
                  </div>
                </label>

                <label style={{ display: 'grid', gap: 4, flex: '1 1 240px' }}>
                  <span style={formLabelTextStyle}>Other deductions</span>
                  <div style={inputGroupStyle}>
                    <input
                      aria-label="other deductions"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      value={otherDeductionsDisplayDkk}
                      onChange={(e) => {
                        const raw = Number(e.target.value);
                        setOtherDeductionsAnnualDkk(grossPeriod === 'monthly' ? raw * 12 : raw);
                      }}
                      style={inputGroupInputStyle}
                    />
                    <span aria-hidden style={inputGroupUnitStyle}>
                      {otherDeductionsUnit}
                    </span>
                  </div>
                </label>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <label style={{ display: 'grid', gap: 4, flex: '1 1 240px' }}>
                  <span style={formLabelTextStyle}>Municipality</span>
                  <select
                    aria-label="municipality"
                    value={municipalityId}
                    onChange={(e) => setMunicipalityId(e.target.value)}
                    style={controlStyle}
                  >
                    <option value="average">Average (25.0%)</option>
                    {municipalDataset.municipalities
                      .slice()
                      .sort((a, b) => a.name.localeCompare(b.name, 'da-DK'))
                      .map((m) => (
                        <option key={m.id} value={String(m.id)}>
                          {m.name} ({m.municipalTaxPct.toFixed(2)}%)
                        </option>
                      ))}
                  </select>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 10, flex: '0 0 auto' }}>
                  <input
                    aria-label="church member"
                    type="checkbox"
                    checked={churchMember}
                    onChange={(e) => setChurchMember(e.target.checked)}
                    style={{ width: 18, height: 18 }}
                  />
                  <span style={formLabelTextStyle}>Church tax</span>
                </label>
              </div>
            </div>
          </details>
          <div
            style={{
              border: '1px solid var(--fc-card-border)',
              background: 'var(--fc-card-bg)',
              color: 'var(--fc-card-text)',
              padding: 14,
              borderRadius: 4,
              display: 'grid',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
              <div style={{ fontWeight: 700, fontSize: 26 }}>Net salary</div>
              <div style={{ fontWeight: 800, fontSize: 32, fontVariantNumeric: 'tabular-nums' }}>
                {formatDkk(netDisplay)}
              </div>
            </div>
            <div style={{ opacity: 0.75, textAlign: 'right' }}>
              per {grossPeriod === 'monthly' ? 'month' : 'year'}
            </div>

            <div style={{ display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ opacity: 0.9 }}>Total tax</div>
                <div style={{ opacity: 0.9, fontVariantNumeric: 'tabular-nums' }}>{formatDkk(totalTaxDisplay)}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ opacity: 0.75 }}>Effective tax rate (avg)</div>
                <div style={{ opacity: 0.75 }}>{formatPct(breakdown.effectiveTaxRate, 2)}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ opacity: 0.7 }}>Marginal rate (approx)</div>
                <div style={{ opacity: 0.7 }}>{formatPct(breakdown.marginalTaxRate, 2)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 700, margin: '24px auto 0' }}>
        <details>
          <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 16 }}>
            Breakdown + calculation (annual DKK)
          </summary>
          <div style={{ opacity: 0.75, margin: '10px 0' }}>
            This is the full yearly path from gross salary → deductions/taxes → net salary.
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '38%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '44%' }} />
            </colgroup>
            <tbody>
              {annualBreakdownRows.map(({ label, value, note }, idx) => {
                const isMilestone = ANNUAL_BREAKDOWN_MILESTONE_LABELS.has(label);
                const isNet = label === 'Net salary (year)';
                const showTopSeparator = isMilestone && idx !== 0;
                const paddingTop = showTopSeparator ? 14 : 7;

                return (
                  <tr key={label}>
                    <td
                      style={{
                        padding: `${paddingTop}px 0 7px 0`,
                        borderTop: showTopSeparator ? '2px solid var(--fc-card-border)' : undefined,
                        borderBottom: '1px solid var(--fc-subtle-border)',
                        fontWeight: isMilestone ? 700 : 400,
                      }}
                    >
                      {label}
                    </td>
                    <td
                      style={{
                        padding: `${paddingTop}px 0 7px 0`,
                        borderTop: showTopSeparator ? '2px solid var(--fc-card-border)' : undefined,
                        borderBottom: '1px solid var(--fc-subtle-border)',
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                        fontWeight: isNet ? 900 : isMilestone ? 700 : 400,
                      }}
                    >
                      {value < 0 ? '-' : ''}
                      {formatDkk(Math.abs(value))}
                    </td>
                    <td
                      style={{
                        padding: `${paddingTop}px 0 7px 26px`,
                        borderTop: showTopSeparator ? '2px solid var(--fc-card-border)' : undefined,
                        borderBottom: '1px solid var(--fc-subtle-border)',
                        opacity: 0.75,
                      }}
                    >
                      {note}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <details
            style={{
              marginTop: 14,
              border: '1px solid var(--fc-subtle-border)',
              borderRadius: 6,
              padding: 10,
              background: 'var(--fc-card-bg)',
              color: 'var(--fc-card-text)',
            }}
          >
            <summary style={{ cursor: 'pointer', fontWeight: 800, fontSize: 14 }}>Assumptions</summary>

            <div style={{ marginTop: 12, opacity: 0.75, fontSize: 13, lineHeight: 1.35, display: 'grid', gap: 14 }}>
              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Period/annualization assumption</div>
                <div>
                  Monthly inputs are annualized as <strong>gross × 12</strong>. “Net (monthly)” is shown as <strong>net (annual) ÷ 12</strong>.
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Non-negative base assumption</div>
                <div>
                  Negative inputs and intermediate bases are clamped to <strong>0</strong> (no negative income base, no negative deductions, no
                  negative taxes).
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Ordering assumption (what is deducted where)</div>
                <div>
                  Employee pension and ATP are deducted <strong>before</strong> AM-bidrag. Personfradrag, beskæftigelsesfradrag, jobfradrag, and
                  “other deductions” are deducted <strong>after</strong> AM-bidrag to compute taxable income.
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Threshold base assumption</div>
                <div>
                  Bracket thresholds (mellemskat/topskat/toptopskat) are based on <strong>personal income after AM-bidrag</strong> (not taxable income).
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Bracket stacking (cumulative) assumption</div>
                <div>
                  Bracket taxes are modeled as <strong>cumulative</strong> taxes above each threshold, so they can stack when income exceeds multiple
                  thresholds.
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Rounding assumption</div>
                <div>
                  Each line item is rounded to the <strong>nearest DKK</strong> before totals are summed (including “Total tax” and net salary).
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Municipality/church assumption</div>
                <div>
                  If no municipality is selected, the municipal tax rate defaults to{' '}
                  <strong>{(Number(currentAssumptions.salaryTaxatorDefaults.defaultMunicipalTaxRatePct) || 0).toFixed(1)}%</strong>. Church tax is only
                  applied when enabled and a municipality (and its church tax rate) is available.
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>ATP assumption</div>
                <div>
                  ATP is only deducted when an employee works more than <strong>39 hours/month</strong>. Since this tool does not ask for hours, it
                  uses a simple proxy: <strong>no ATP deduction</strong> when gross monthly salary is under{' '}
                  <strong>{(Number(currentAssumptions.salaryTaxatorDefaults.atpEligibilityGrossMonthlyThresholdDkk) || 0).toLocaleString('da-DK')} DKK</strong>.
                </div>

                <div style={{ marginTop: 10, fontWeight: 800 }}>ATP contribution rates (employee share)</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6, fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '6px 0', borderBottom: '1px solid var(--fc-subtle-border)' }}>
                        Hours/month
                      </th>
                      <th style={{ textAlign: 'right', padding: '6px 0', borderBottom: '1px solid var(--fc-subtle-border)' }}>
                        Employee share
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: '6px 0', borderBottom: '1px solid var(--fc-subtle-border)' }}>Min. 117</td>
                      <td style={{ padding: '6px 0', borderBottom: '1px solid var(--fc-subtle-border)', textAlign: 'right' }}>94.65 DKK</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '6px 0', borderBottom: '1px solid var(--fc-subtle-border)' }}>78 – 116</td>
                      <td style={{ padding: '6px 0', borderBottom: '1px solid var(--fc-subtle-border)', textAlign: 'right' }}>63.10 DKK</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '6px 0', borderBottom: '1px solid var(--fc-subtle-border)' }}>39 – 77</td>
                      <td style={{ padding: '6px 0', borderBottom: '1px solid var(--fc-subtle-border)', textAlign: 'right' }}>31.55 DKK</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '6px 0' }}>Under 39</td>
                      <td style={{ padding: '6px 0', textAlign: 'right' }}>0.00 DKK</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Tax rate output assumption</div>
                <div>
                  “Effective tax rate” and “Marginal rate” are calculated using <strong>taxes only</strong> (AM-bidrag + municipal/church + state
                  taxes) and exclude pension/ATP.
                </div>
              </div>
            </div>
          </details>
        </details>
      </div>
    </PageLayout>
  );
};

export default SalaryAfterTaxPage;
