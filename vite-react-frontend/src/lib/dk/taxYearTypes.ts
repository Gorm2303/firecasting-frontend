export type TaxYearId = 2026;

export type DkTaxYearConfig = {
  year: TaxYearId;

  /** AM-bidrag rate (e.g. 0.08 for 8%). */
  amBidragRate: number;

  /** Bundskat rate (e.g. 0.1201 for 12.01%). */
  bundskatRate: number;

  /** Personal allowance (DKK per year) deducted from taxable income. */
  personfradragAnnualDkk: number;

  /** Beskæftigelsesfradrag: percent of income, capped by max amount. */
  beskaeftigelsesfradragRate: number;
  beskaeftigelsesfradragMaxAnnualDkk: number;

  /** Jobfradrag: percent of income above a threshold, capped by max amount. */
  jobfradragRate: number;
  jobfradragIncomeThresholdAnnualDkk: number;
  jobfradragMaxAnnualDkk: number;

  /** Thresholds based on personal income after AM-bidrag (annual DKK). */
  mellemskatThresholdAnnualDkk: number;
  topskatThresholdAnnualDkk: number;
  toptopskatThresholdAnnualDkk: number;

  mellemskatRate: number;
  topskatRate: number;
  toptopskatRate: number;

  /** Default municipality tax assumption when not choosing a municipality. */
  defaultMunicipalTaxRate: number;
};

export type DkMunicipalityTaxRate = {
  id: number;
  name: string;
  /** E.g. 25.0 for 25%. */
  municipalTaxPct: number;
  /** E.g. 0.8 for 0.8%. */
  churchTaxPct: number;
};

export type GrossPeriod = 'monthly' | 'annual';

export type SalaryAfterTaxInputs = {
  year: TaxYearId;

  grossAmount: number;
  grossPeriod: GrossPeriod;

  /** Employee pension contribution deducted before AM-bidrag. Rate is applied to gross salary. */
  employeePensionRate: number;

  /** ATP contribution deducted before AM-bidrag (employee share). */
  atpAnnualDkk: number;

  /** Extra deductions the user wants to include (annual DKK). */
  otherDeductionsAnnualDkk: number;

  /** Municipality tax rate (0.25 for 25%). */
  municipalTaxRate: number;
  /** Church tax rate (0.008 for 0.8%). Only applied when enabled. */
  churchTaxRate: number;
  churchMember: boolean;
};

export type SalaryAfterTaxBreakdown = {
  year: TaxYearId;

  grossAnnualDkk: number;
  grossMonthlyDkk: number;

  employeePensionAnnualDkk: number;
  atpAnnualDkk: number;

  amBaseAnnualDkk: number;
  amBidragAnnualDkk: number;

  personalIncomeAfterAmAnnualDkk: number;

  personfradragAnnualDkk: number;
  beskaeftigelsesfradragAnnualDkk: number;
  jobfradragAnnualDkk: number;
  otherDeductionsAnnualDkk: number;

  taxableIncomeAnnualDkk: number;

  municipalTaxAnnualDkk: number;
  churchTaxAnnualDkk: number;
  bundskatAnnualDkk: number;
  mellemskatAnnualDkk: number;
  topskatAnnualDkk: number;
  toptopskatAnnualDkk: number;

  totalTaxAnnualDkk: number;
  netAnnualDkk: number;
  netMonthlyDkk: number;

  /** Average tax rate vs gross (taxes only, excludes pension/ATP). */
  effectiveTaxRate: number;

  /** Approximate marginal tax rate based on active bracket (taxes only). */
  marginalTaxRate: number;

  assumptions: {
    rounding: 'nearest-dkk-each-line-item';
    thresholdsBasedOn: 'personal-income-after-am';
    bracketTaxesAreCumulative: boolean;
  };
};

export const roundDkk = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
};

export const clampNonNegative = (value: number): number => (value < 0 ? 0 : value);
