import type { DkTaxYearConfig, TaxYearId } from './taxYearTypes';

export const DK_TAX_YEAR_2026: DkTaxYearConfig = {
  year: 2026,

  amBidragRate: 0.08,

  bundskatRate: 0.1201,

  personfradragAnnualDkk: 54_100,

  beskaeftigelsesfradragRate: 0.1275,
  beskaeftigelsesfradragMaxAnnualDkk: 63_300,

  jobfradragRate: 0.045,
  jobfradragIncomeThresholdAnnualDkk: 235_200,
  jobfradragMaxAnnualDkk: 3_100,

  mellemskatThresholdAnnualDkk: 641_200,
  topskatThresholdAnnualDkk: 777_900,
  toptopskatThresholdAnnualDkk: 2_592_700,

  mellemskatRate: 0.075,
  topskatRate: 0.075,
  toptopskatRate: 0.05,

  defaultMunicipalTaxRate: 0.25,
};

export const DK_TAX_YEARS: Record<TaxYearId, DkTaxYearConfig> = {
  2026: DK_TAX_YEAR_2026,
};

export const getDkTaxYearConfig = (year: TaxYearId): DkTaxYearConfig => DK_TAX_YEARS[year];
