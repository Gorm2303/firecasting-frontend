# Assumptions Registry

This file is generated from `src/state/assumptionsRegistry.json`.
It documents the “authority layer” assumptions: keys, defaults, and consumers.


## worldModel

- **currency** — Currency
  - Default: "DKK" (string)
  - Used by: AssumptionsSummaryBar, MoneyPerspective
  - Overrideable by strategy: no

- **inflationPct** — Inflation (%/year)
  - Default: 2 (pct)
  - Used by: Simulation, MoneyPerspective
  - Overrideable by strategy: no

- **yearlyFeePct** — Yearly fee (%/year)
  - Default: 0.5 (pct)
  - Used by: Simulation, MoneyPerspective
  - Overrideable by strategy: no

- **expectedReturnPct** — Expected return (%/year)
  - Default: 5 (pct)
  - Used by: MoneyPerspective
  - Overrideable by strategy: no

- **safeWithdrawalPct** — Safe withdrawal rate (%/year)
  - Default: 4 (pct)
  - Used by: AssumptionsSummaryBar
  - Overrideable by strategy: no


## simulatorTax

- **taxExemptionDefaults.exemptionCardLimit** — Exemption card limit (DKK/year)
  - Default: 51600 (dkkPerYear)
  - Used by: Simulation, Explore, Tutorial
  - Overrideable by strategy: yes

- **taxExemptionDefaults.exemptionCardYearlyIncrease** — Exemption card yearly increase (DKK/year)
  - Default: 1000 (dkkPerYear)
  - Used by: Simulation, Explore, Tutorial
  - Overrideable by strategy: yes

- **taxExemptionDefaults.stockExemptionTaxRate** — Stock exemption tax rate (%/year)
  - Default: 27 (pct)
  - Used by: Simulation, Explore, Tutorial
  - Overrideable by strategy: yes

- **taxExemptionDefaults.stockExemptionLimit** — Stock exemption limit (DKK/year)
  - Default: 67500 (dkkPerYear)
  - Used by: Simulation, Explore, Tutorial
  - Overrideable by strategy: yes

- **taxExemptionDefaults.stockExemptionYearlyIncrease** — Stock exemption yearly increase (DKK/year)
  - Default: 1000 (dkkPerYear)
  - Used by: Simulation, Explore, Tutorial
  - Overrideable by strategy: yes


## salaryTaxator

- **salaryTaxatorDefaults.municipalityId** — Default municipality id
  - Default: "average" (string)
  - Used by: SalaryTaxator
  - Overrideable by strategy: yes

- **salaryTaxatorDefaults.defaultMunicipalTaxRatePct** — Fallback municipal tax rate (%)
  - Default: 25 (pct)
  - Used by: SalaryTaxator
  - Overrideable by strategy: yes

- **salaryTaxatorDefaults.atpMonthlyDkk** — ATP employee share (DKK/month)
  - Default: 99 (dkkPerMonth)
  - Used by: SalaryTaxator
  - Overrideable by strategy: yes

- **salaryTaxatorDefaults.atpEligibilityGrossMonthlyThresholdDkk** — ATP eligibility proxy (gross monthly threshold DKK)
  - Default: 2340 (dkkPerMonth)
  - Used by: SalaryTaxator
  - Overrideable by strategy: yes

