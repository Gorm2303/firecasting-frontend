import {
  clampNonNegative,
  roundDkk,
  type SalaryAfterTaxBreakdown,
  type SalaryAfterTaxInputs,
} from './taxYearTypes';
import { getDkTaxYearConfig } from './taxYears';

const annualize = (amount: number, period: SalaryAfterTaxInputs['grossPeriod']): number => {
  if (!Number.isFinite(amount)) return 0;
  return period === 'monthly' ? amount * 12 : amount;
};

const computeBeskaeftigelsesfradragAnnualDkk = (incomeBaseAnnualDkk: number, rate: number, max: number): number => {
  const raw = clampNonNegative(incomeBaseAnnualDkk) * rate;
  return Math.min(raw, max);
};

const computeJobfradragAnnualDkk = (
  incomeBaseAnnualDkk: number,
  rate: number,
  threshold: number,
  max: number,
): number => {
  const above = clampNonNegative(incomeBaseAnnualDkk - threshold);
  const raw = above * rate;
  return Math.min(raw, max);
};

const computeCumulativeBracketTax = (personalIncomeAfterAmAnnualDkk: number, threshold: number, rate: number): number => {
  return clampNonNegative(personalIncomeAfterAmAnnualDkk - threshold) * rate;
};

export const calculateSalaryAfterTax = (inputs: SalaryAfterTaxInputs): SalaryAfterTaxBreakdown => {
  const cfg = getDkTaxYearConfig(inputs.year);

  const grossAnnualDkk = clampNonNegative(annualize(inputs.grossAmount, inputs.grossPeriod));
  const grossMonthlyDkk = grossAnnualDkk / 12;

  const employeePensionAnnualDkk = clampNonNegative(grossAnnualDkk * clampNonNegative(inputs.employeePensionRate));
  const atpAnnualDkk = clampNonNegative(inputs.atpAnnualDkk);

  const amBaseAnnualDkk = clampNonNegative(grossAnnualDkk - employeePensionAnnualDkk - atpAnnualDkk);
  const amBidragAnnualDkk = clampNonNegative(amBaseAnnualDkk * cfg.amBidragRate);

  const personalIncomeAfterAmAnnualDkk = clampNonNegative(amBaseAnnualDkk - amBidragAnnualDkk);

  const personfradragAnnualDkk = cfg.personfradragAnnualDkk;
  const beskaeftigelsesfradragAnnualDkk = computeBeskaeftigelsesfradragAnnualDkk(
    personalIncomeAfterAmAnnualDkk,
    cfg.beskaeftigelsesfradragRate,
    cfg.beskaeftigelsesfradragMaxAnnualDkk,
  );
  const jobfradragAnnualDkk = computeJobfradragAnnualDkk(
    personalIncomeAfterAmAnnualDkk,
    cfg.jobfradragRate,
    cfg.jobfradragIncomeThresholdAnnualDkk,
    cfg.jobfradragMaxAnnualDkk,
  );
  const otherDeductionsAnnualDkk = clampNonNegative(inputs.otherDeductionsAnnualDkk);

  const taxableIncomeAnnualDkk = clampNonNegative(
    personalIncomeAfterAmAnnualDkk -
      personfradragAnnualDkk -
      beskaeftigelsesfradragAnnualDkk -
      jobfradragAnnualDkk -
      otherDeductionsAnnualDkk,
  );

  const municipalTaxAnnualDkk = clampNonNegative(taxableIncomeAnnualDkk * clampNonNegative(inputs.municipalTaxRate));
  const churchTaxAnnualDkk = inputs.churchMember
    ? clampNonNegative(taxableIncomeAnnualDkk * clampNonNegative(inputs.churchTaxRate))
    : 0;

  const bundskatAnnualDkk = clampNonNegative(taxableIncomeAnnualDkk * cfg.bundskatRate);

  // Bracket taxes are modeled as cumulative taxes above each threshold (per requirement).
  const mellemskatAnnualDkk = computeCumulativeBracketTax(
    personalIncomeAfterAmAnnualDkk,
    cfg.mellemskatThresholdAnnualDkk,
    cfg.mellemskatRate,
  );
  const topskatAnnualDkk = computeCumulativeBracketTax(
    personalIncomeAfterAmAnnualDkk,
    cfg.topskatThresholdAnnualDkk,
    cfg.topskatRate,
  );
  const toptopskatAnnualDkk = computeCumulativeBracketTax(
    personalIncomeAfterAmAnnualDkk,
    cfg.toptopskatThresholdAnnualDkk,
    cfg.toptopskatRate,
  );

  // Rounding: nearest DKK per line item.
  const rounded = {
    employeePensionAnnualDkk: roundDkk(employeePensionAnnualDkk),
    atpAnnualDkk: roundDkk(atpAnnualDkk),
    amBaseAnnualDkk: roundDkk(amBaseAnnualDkk),
    amBidragAnnualDkk: roundDkk(amBidragAnnualDkk),
    personalIncomeAfterAmAnnualDkk: roundDkk(personalIncomeAfterAmAnnualDkk),
    beskaeftigelsesfradragAnnualDkk: roundDkk(beskaeftigelsesfradragAnnualDkk),
    jobfradragAnnualDkk: roundDkk(jobfradragAnnualDkk),
    taxableIncomeAnnualDkk: roundDkk(taxableIncomeAnnualDkk),
    municipalTaxAnnualDkk: roundDkk(municipalTaxAnnualDkk),
    churchTaxAnnualDkk: roundDkk(churchTaxAnnualDkk),
    bundskatAnnualDkk: roundDkk(bundskatAnnualDkk),
    mellemskatAnnualDkk: roundDkk(mellemskatAnnualDkk),
    topskatAnnualDkk: roundDkk(topskatAnnualDkk),
    toptopskatAnnualDkk: roundDkk(toptopskatAnnualDkk),
  };

  const totalTaxAnnualDkk =
    rounded.amBidragAnnualDkk +
    rounded.municipalTaxAnnualDkk +
    rounded.churchTaxAnnualDkk +
    rounded.bundskatAnnualDkk +
    rounded.mellemskatAnnualDkk +
    rounded.topskatAnnualDkk +
    rounded.toptopskatAnnualDkk;

  const netAnnualDkk =
    roundDkk(grossAnnualDkk) - rounded.employeePensionAnnualDkk - rounded.atpAnnualDkk - totalTaxAnnualDkk;
  const netMonthlyDkk = netAnnualDkk / 12;

  const effectiveTaxRate = grossAnnualDkk > 0 ? totalTaxAnnualDkk / grossAnnualDkk : 0;

  const bracketAddRate =
    (personalIncomeAfterAmAnnualDkk > cfg.mellemskatThresholdAnnualDkk ? cfg.mellemskatRate : 0) +
    (personalIncomeAfterAmAnnualDkk > cfg.topskatThresholdAnnualDkk ? cfg.topskatRate : 0) +
    (personalIncomeAfterAmAnnualDkk > cfg.toptopskatThresholdAnnualDkk ? cfg.toptopskatRate : 0);

  const marginalTaxRate =
    cfg.amBidragRate +
    clampNonNegative(inputs.municipalTaxRate) +
    (inputs.churchMember ? clampNonNegative(inputs.churchTaxRate) : 0) +
    cfg.bundskatRate +
    bracketAddRate;

  return {
    year: inputs.year,

    grossAnnualDkk: roundDkk(grossAnnualDkk),
    grossMonthlyDkk: roundDkk(grossMonthlyDkk),

    employeePensionAnnualDkk: rounded.employeePensionAnnualDkk,
    atpAnnualDkk: rounded.atpAnnualDkk,

    amBaseAnnualDkk: rounded.amBaseAnnualDkk,
    amBidragAnnualDkk: rounded.amBidragAnnualDkk,

    personalIncomeAfterAmAnnualDkk: rounded.personalIncomeAfterAmAnnualDkk,

    personfradragAnnualDkk,
    beskaeftigelsesfradragAnnualDkk: rounded.beskaeftigelsesfradragAnnualDkk,
    jobfradragAnnualDkk: rounded.jobfradragAnnualDkk,
    otherDeductionsAnnualDkk: roundDkk(otherDeductionsAnnualDkk),

    taxableIncomeAnnualDkk: rounded.taxableIncomeAnnualDkk,

    municipalTaxAnnualDkk: rounded.municipalTaxAnnualDkk,
    churchTaxAnnualDkk: rounded.churchTaxAnnualDkk,
    bundskatAnnualDkk: rounded.bundskatAnnualDkk,
    mellemskatAnnualDkk: rounded.mellemskatAnnualDkk,
    topskatAnnualDkk: rounded.topskatAnnualDkk,
    toptopskatAnnualDkk: rounded.toptopskatAnnualDkk,

    totalTaxAnnualDkk: roundDkk(totalTaxAnnualDkk),
    netAnnualDkk: roundDkk(netAnnualDkk),
    netMonthlyDkk: roundDkk(netMonthlyDkk),

    effectiveTaxRate,
    marginalTaxRate,

    assumptions: {
      rounding: 'nearest-dkk-each-line-item',
      thresholdsBasedOn: 'personal-income-after-am',
      bracketTaxesAreCumulative: true,
    },
  };
};
