import municipalTaxRates2026 from '../../data/dk/municipalTaxRates2026.json';
import { calculateSalaryAfterTax } from '../dk/salaryAfterTaxCalculator';
import { monthlyEquivalentFromSalaryAmount, salaryAmountFromMonthlyEquivalent, type SharedSalaryPeriod } from './sharedSalary';

type SalaryTaxDefaults = {
  municipalityId: string;
  defaultMunicipalTaxRatePct: number;
  churchMember: boolean;
  employeePensionRatePct: number;
  otherDeductionsAnnualDkk: number;
  atpMonthlyDkk: number;
  atpEligibilityGrossMonthlyThresholdDkk: number;
};

type ReferenceNetSalaryInputs = {
  referenceSalaryPeriod: SharedSalaryPeriod;
  referenceGrossSalaryAmount: number;
  workingHoursPerMonth: number;
  salaryTaxatorDefaults: SalaryTaxDefaults;
};

type MunicipalityDataset = {
  year: number;
  municipalities: Array<{
    id: number;
    municipalTaxPct: number;
    churchTaxPct: number;
  }>;
};

export type DerivedReferenceNetSalary = {
  value: number;
  sourceLabel: string;
};

export function deriveReferenceNetSalary(inputs: ReferenceNetSalaryInputs): DerivedReferenceNetSalary {
  const municipalityDataset = municipalTaxRates2026 as MunicipalityDataset;
  const salary = inputs.salaryTaxatorDefaults;
  const selectedMunicipality = salary.municipalityId === 'average'
    ? null
    : municipalityDataset.municipalities.find((entry) => entry.id === Number(salary.municipalityId)) ?? null;

  const municipalTaxRate = selectedMunicipality != null
    ? selectedMunicipality.municipalTaxPct / 100
    : (Number(salary.defaultMunicipalTaxRatePct) || 0) / 100;
  const churchTaxRate = selectedMunicipality != null ? selectedMunicipality.churchTaxPct / 100 : 0;
  const grossMonthlyEquivalent = monthlyEquivalentFromSalaryAmount(
    Number(inputs.referenceGrossSalaryAmount) || 0,
    inputs.referenceSalaryPeriod,
    inputs.workingHoursPerMonth,
  );
  const atpAnnualDkk = grossMonthlyEquivalent < (Number(salary.atpEligibilityGrossMonthlyThresholdDkk) || 0)
    ? 0
    : (Number(salary.atpMonthlyDkk) || 0) * 12;

  const breakdown = calculateSalaryAfterTax({
    year: 2026,
    grossAmount: grossMonthlyEquivalent,
    grossPeriod: 'monthly',
    employeePensionRate: (Number(salary.employeePensionRatePct) || 0) / 100,
    atpAnnualDkk,
    otherDeductionsAnnualDkk: Number(salary.otherDeductionsAnnualDkk) || 0,
    municipalTaxRate,
    churchTaxRate,
    churchMember: Boolean(salary.churchMember),
  });

  const value = inputs.referenceSalaryPeriod === 'yearly'
    ? breakdown.netAnnualDkk
    : inputs.referenceSalaryPeriod === 'monthly'
      ? breakdown.netMonthlyDkk
      : salaryAmountFromMonthlyEquivalent(
          breakdown.netMonthlyDkk,
          inputs.referenceSalaryPeriod,
          inputs.workingHoursPerMonth,
        );

  return {
    value: Math.round(value),
    sourceLabel: selectedMunicipality ? `municipality ${salary.municipalityId}` : 'fallback municipal rate',
  };
}