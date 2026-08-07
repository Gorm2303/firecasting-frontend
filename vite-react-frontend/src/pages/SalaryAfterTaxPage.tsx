import React, { useEffect, useMemo, useState } from 'react';
import PageLayout from '../components/PageLayout';
import municipalTaxRates2026 from '../data/dk/municipalTaxRates2026.json';
import { monthlyEquivalentFromSalaryAmount } from '../lib/income/sharedSalary';
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

const controlClass = 'h-11 rounded border border-card-border bg-card px-2.5 text-xl text-card-fg';
const inputGroupClass = 'flex h-11 items-stretch overflow-hidden rounded border border-card-border bg-card text-xl text-card-fg';
const inputGroupInputClass = 'w-full flex-1 border-none bg-transparent px-2.5 font-inherit text-inherit outline-none';
const inputGroupUnitClass = 'flex items-center whitespace-nowrap border-l border-subtle-border bg-subtle px-2.5 text-xl font-semibold text-card-muted';
const formLabelTextClass = 'text-xl font-semibold';

const toDisplayPeriod = (annualDkk: number, grossPeriod: GrossPeriod): number => {
  const safe = Number.isFinite(annualDkk) ? annualDkk : 0;
  return grossPeriod === 'monthly' ? Math.round(safe / 12) : Math.round(safe);
};

const toSalaryTaxatorReference = (
  referenceGrossSalaryAmount: number,
  referenceSalaryPeriod: ReturnType<typeof useAssumptions>['currentAssumptions']['incomeSetupDefaults']['referenceSalaryPeriod'],
  workingHoursPerMonth: number,
): { amount: number; period: GrossPeriod } => {
  if (referenceSalaryPeriod === 'yearly') {
    return {
      amount: Math.round(Number(referenceGrossSalaryAmount) || 0),
      period: 'annual',
    };
  }

  return {
    amount: Math.round(
      monthlyEquivalentFromSalaryAmount(
        Number(referenceGrossSalaryAmount) || 0,
        referenceSalaryPeriod,
        workingHoursPerMonth,
      ),
    ),
    period: 'monthly',
  };
};

const SalaryAfterTaxPage: React.FC = () => {
  const taxYear = 2026 as const;
  const municipalDataset = municipalTaxRates2026 as MunicipalityDataset;
  const { currentAssumptions } = useAssumptions();

  const referenceSalary = useMemo(
    () =>
      toSalaryTaxatorReference(
        currentAssumptions.incomeSetupDefaults.referenceGrossSalaryAmount,
        currentAssumptions.incomeSetupDefaults.referenceSalaryPeriod,
        currentAssumptions.incomeSetupDefaults.workingHoursPerMonth,
      ),
    [
      currentAssumptions.incomeSetupDefaults.referenceGrossSalaryAmount,
      currentAssumptions.incomeSetupDefaults.referenceSalaryPeriod,
      currentAssumptions.incomeSetupDefaults.workingHoursPerMonth,
    ],
  );

  const [grossPeriod, setGrossPeriod] = useState<GrossPeriod>(() => referenceSalary.period);
  const [grossAmount, setGrossAmount] = useState<number>(() => referenceSalary.amount);

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

  useEffect(() => {
    setGrossPeriod(referenceSalary.period);
    setGrossAmount(referenceSalary.amount);
    setEmployeePensionRatePct(currentAssumptions.salaryTaxatorDefaults.employeePensionRatePct);
    setOtherDeductionsAnnualDkk(currentAssumptions.salaryTaxatorDefaults.otherDeductionsAnnualDkk);
    setMunicipalityId(currentAssumptions.salaryTaxatorDefaults.municipalityId);
    setChurchMember(currentAssumptions.salaryTaxatorDefaults.churchMember);
  }, [
    currentAssumptions.salaryTaxatorDefaults.churchMember,
    currentAssumptions.salaryTaxatorDefaults.employeePensionRatePct,
    currentAssumptions.salaryTaxatorDefaults.municipalityId,
    currentAssumptions.salaryTaxatorDefaults.otherDeductionsAnnualDkk,
    referenceSalary.amount,
    referenceSalary.period,
  ]);

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
      <h1 className="text-center text-3xl font-extrabold">Salary Taxator (after tax)</h1>

      <div className="mx-auto max-w-150">
        <div className="mb-4 grid grid-cols-1 gap-3.5">
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid flex-[1_1_160px] gap-1">
              <span className={formLabelTextClass}>Year</span>
              <select aria-label="tax year" value={taxYear} disabled className={controlClass}>
                <option value={2026}>2026</option>
              </select>
            </label>

            <label className="grid flex-[1_1_160px] gap-1">
              <span className={formLabelTextClass}>Country</span>
              <select aria-label="country" value={country} disabled className={controlClass}>
                <option value="DK">Denmark</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <label className="grid flex-[1_1_160px] gap-1">
              <span className={formLabelTextClass}>Gross salary</span>
              <div className="flex flex-wrap gap-2">
                <div className={inputGroupClass}>
                  <input
                    aria-label="gross amount"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={grossAmount}
                    onChange={(e) => setGrossAmount(Number(e.target.value))}
                    className={inputGroupInputClass}
                  />
                  <span aria-hidden className={inputGroupUnitClass}>
                    DKK
                  </span>
                </div>
                <select
                  aria-label="gross period"
                  value={grossPeriod}
                  onChange={(e) => onChangeGrossPeriod(e.target.value as GrossPeriod)}
                  className={controlClass}
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
            className="rounded-md border border-subtle-border bg-card p-2.5 text-card-fg"
          >
            <summary className="cursor-pointer text-base font-bold">
              Optionals
            </summary>

            <div className="mt-3 grid gap-3.5">
              <div className="flex flex-wrap gap-2">
                <label className="grid flex-[1_1_240px] gap-1">
                  <span className={formLabelTextClass}>Employee pension</span>
                  <div className={inputGroupClass}>
                    <input
                      aria-label="employee pension percent"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={100}
                      step={0.1}
                      value={employeePensionRatePct}
                      onChange={(e) => setEmployeePensionRatePct(Number(e.target.value))}
                      className={inputGroupInputClass}
                    />
                    <span aria-hidden className={inputGroupUnitClass}>
                      % of gross
                    </span>
                  </div>
                </label>

                <label className="grid flex-[1_1_240px] gap-1">
                  <span className={formLabelTextClass}>Other deductions</span>
                  <div className={inputGroupClass}>
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
                      className={inputGroupInputClass}
                    />
                    <span aria-hidden className={inputGroupUnitClass}>
                      {otherDeductionsUnit}
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <label className="grid flex-[1_1_240px] gap-1">
                  <span className={formLabelTextClass}>Municipality</span>
                  <select
                    aria-label="municipality"
                    value={municipalityId}
                    onChange={(e) => setMunicipalityId(e.target.value)}
                    className={controlClass}
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

                <label className="flex flex-[0_0_auto] items-center gap-2.5 pb-2.5">
                  <input
                    aria-label="church member"
                    type="checkbox"
                    checked={churchMember}
                    onChange={(e) => setChurchMember(e.target.checked)}
                    className="h-4.5 w-4.5"
                  />
                  <span className={formLabelTextClass}>Church tax</span>
                </label>
              </div>
            </div>
          </details>
          <div className="grid gap-2.5 rounded border border-card-border bg-card p-3.5 text-card-fg">
            <div className="flex items-baseline justify-between gap-3">
              <div className="text-2xl font-bold">Net salary</div>
              <div className="text-3xl font-extrabold tabular-nums">
                {formatDkk(netDisplay)}
              </div>
            </div>
            <div className="text-right opacity-75">
              per {grossPeriod === 'monthly' ? 'month' : 'year'}
            </div>

            <div className="grid gap-1.5">
              <div className="flex justify-between gap-3">
                <div className="opacity-90">Total tax</div>
                <div className="tabular-nums opacity-90">{formatDkk(totalTaxDisplay)}</div>
              </div>
              <div className="flex justify-between gap-3">
                <div className="opacity-75">Effective tax rate (avg)</div>
                <div className="opacity-75">{formatPct(breakdown.effectiveTaxRate, 2)}</div>
              </div>
              <div className="flex justify-between gap-3">
                <div className="opacity-70">Marginal rate (approx)</div>
                <div className="opacity-70">{formatPct(breakdown.marginalTaxRate, 2)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-6 max-w-175">
        <details>
          <summary className="cursor-pointer text-base font-bold">
            Breakdown + calculation (annual DKK)
          </summary>
          <div className="my-2.5 opacity-75">
            This is the full yearly path from gross salary → deductions/taxes → net salary.
          </div>

          <table className="w-full border-collapse">
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
                const cellPadding = showTopSeparator ? 'pt-3.5 pb-1.5' : 'pt-1.5 pb-1.5';
                const cellBorder = ['border-b border-subtle-border', showTopSeparator ? 'border-t-2 border-t-card-border' : ''].join(' ');

                return (
                  <tr key={label}>
                    <td className={[cellPadding, cellBorder, isMilestone ? 'font-bold' : 'font-normal'].join(' ')}>
                      {label}
                    </td>
                    <td className={[cellPadding, cellBorder, 'text-right tabular-nums', isNet ? 'font-black' : isMilestone ? 'font-bold' : 'font-normal'].join(' ')}>
                      {value < 0 ? '-' : ''}
                      {formatDkk(Math.abs(value))}
                    </td>
                    <td className={[cellPadding, cellBorder, 'pl-6.5 opacity-75'].join(' ')}>
                      {note}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <details className="mt-3.5 rounded-md border border-subtle-border bg-card p-2.5 text-card-fg">
            <summary className="cursor-pointer text-sm font-extrabold">Assumptions</summary>

            <div className="mt-3 grid gap-3.5 text-xs leading-snug opacity-75">
              <div>
                <div className="mb-1.5 font-extrabold">Period/annualization assumption</div>
                <div>
                  Monthly inputs are annualized as <strong>gross × 12</strong>. "Net (monthly)" is shown as <strong>net (annual) ÷ 12</strong>.
                </div>
              </div>

              <div>
                <div className="mb-1.5 font-extrabold">Non-negative base assumption</div>
                <div>
                  Negative inputs and intermediate bases are clamped to <strong>0</strong> (no negative income base, no negative deductions, no
                  negative taxes).
                </div>
              </div>

              <div>
                <div className="mb-1.5 font-extrabold">Ordering assumption (what is deducted where)</div>
                <div>
                  Employee pension and ATP are deducted <strong>before</strong> AM-bidrag. Personfradrag, beskæftigelsesfradrag, jobfradrag, and
                  "other deductions" are deducted <strong>after</strong> AM-bidrag to compute taxable income.
                </div>
              </div>

              <div>
                <div className="mb-1.5 font-extrabold">Threshold base assumption</div>
                <div>
                  Bracket thresholds (mellemskat/topskat/toptopskat) are based on <strong>personal income after AM-bidrag</strong> (not taxable income).
                </div>
              </div>

              <div>
                <div className="mb-1.5 font-extrabold">Bracket stacking (cumulative) assumption</div>
                <div>
                  Bracket taxes are modeled as <strong>cumulative</strong> taxes above each threshold, so they can stack when income exceeds multiple
                  thresholds.
                </div>
              </div>

              <div>
                <div className="mb-1.5 font-extrabold">Rounding assumption</div>
                <div>
                  Each line item is rounded to the <strong>nearest DKK</strong> before totals are summed (including "Total tax" and net salary).
                </div>
              </div>

              <div>
                <div className="mb-1.5 font-extrabold">Municipality/church assumption</div>
                <div>
                  If no municipality is selected, the municipal tax rate defaults to{' '}
                  <strong>{(Number(currentAssumptions.salaryTaxatorDefaults.defaultMunicipalTaxRatePct) || 0).toFixed(1)}%</strong>. Church tax is only
                  applied when enabled and a municipality (and its church tax rate) is available.
                </div>
              </div>

              <div>
                <div className="mb-1.5 font-extrabold">ATP assumption</div>
                <div>
                  ATP is only deducted when an employee works more than <strong>39 hours/month</strong>. Since this tool does not ask for hours, it
                  uses a simple proxy: <strong>no ATP deduction</strong> when gross monthly salary is under{' '}
                  <strong>{(Number(currentAssumptions.salaryTaxatorDefaults.atpEligibilityGrossMonthlyThresholdDkk) || 0).toLocaleString('da-DK')} DKK</strong>.
                </div>

                <div className="mt-2.5 font-extrabold">ATP contribution rates (employee share)</div>
                <table className="mt-1.5 w-full border-collapse text-xs">
                  <thead>
                    <tr>
                      <th className="border-b border-subtle-border py-1.5 text-left">
                        Hours/month
                      </th>
                      <th className="border-b border-subtle-border py-1.5 text-right">
                        Employee share
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border-b border-subtle-border py-1.5">Min. 117</td>
                      <td className="border-b border-subtle-border py-1.5 text-right">94.65 DKK</td>
                    </tr>
                    <tr>
                      <td className="border-b border-subtle-border py-1.5">78 – 116</td>
                      <td className="border-b border-subtle-border py-1.5 text-right">63.10 DKK</td>
                    </tr>
                    <tr>
                      <td className="border-b border-subtle-border py-1.5">39 – 77</td>
                      <td className="border-b border-subtle-border py-1.5 text-right">31.55 DKK</td>
                    </tr>
                    <tr>
                      <td className="py-1.5">Under 39</td>
                      <td className="py-1.5 text-right">0.00 DKK</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div>
                <div className="mb-1.5 font-extrabold">Tax rate output assumption</div>
                <div>
                  "Effective tax rate" and "Marginal rate" are calculated using <strong>taxes only</strong> (AM-bidrag + municipal/church + state
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
