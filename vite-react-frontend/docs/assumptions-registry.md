# Assumptions Registry

This file is generated from `src/state/assumptionsRegistry.json`.
It documents the “authority layer” assumptions: keys, defaults, and consumers.


## worldModel

- **currency** — Currency
  - Default: "DKK" (string)
  - Used by: MoneyPerspective
  - Overrideable by strategy: no

- **expectedReturnPct** — Expected return (%/year)
  - Default: 5 (pct)
  - Used by: MoneyPerspective
  - Overrideable by strategy: no

- **inflationPct** — Inflation (%/year)
  - Default: 2 (pct)
  - Used by: Explore, MoneyPerspective, Simulation, Tutorial
  - Overrideable by strategy: no

- **passiveStrategyDefaults.cashDragPct** — Cash drag (%/year)
  - Default: 0 (pct)
  - Used by: —
  - Overrideable by strategy: yes

- **passiveStrategyDefaults.rebalancing** — Rebalancing convention
  - Default: "none" (enum)
  - Used by: —
  - Overrideable by strategy: yes

- **passiveStrategyDefaults.returnModel** — Return model
  - Default: "fixed" (enum)
  - Used by: —
  - Overrideable by strategy: yes

- **passiveStrategyDefaults.volatilityPct** — Volatility (%/year)
  - Default: 15 (pct)
  - Used by: —
  - Overrideable by strategy: yes

- **safeWithdrawalPct** — Safe withdrawal rate (%/year)
  - Default: 4 (pct)
  - Used by: —
  - Overrideable by strategy: no

- **yearlyFeePct** — Yearly fee (%/year)
  - Default: 0.5 (pct)
  - Used by: MoneyPerspective, Simulation, Tutorial
  - Overrideable by strategy: no


## execution

- **executionDefaults.batchSize** — Batch size
  - Default: 10000 (count)
  - Used by: Simulation
  - Overrideable by strategy: yes

- **executionDefaults.paths** — Paths (runs)
  - Default: 10000 (count)
  - Used by: Simulation
  - Overrideable by strategy: yes

- **executionDefaults.seedMode** — Master seed mode
  - Default: "default" (enum)
  - Used by: Simulation
  - Overrideable by strategy: yes


## incomeSetup

- **incomeSetupDefaults.bonusFrequency** — Bonus frequency
  - Default: "none" (enum)
  - Used by: —
  - Overrideable by strategy: yes

- **incomeSetupDefaults.bonusPct** — Bonus (% of salary)
  - Default: 0 (pct)
  - Used by: —
  - Overrideable by strategy: yes

- **incomeSetupDefaults.incomeModelType** — Income model type
  - Default: "grossFirst" (enum)
  - Used by: —
  - Overrideable by strategy: yes

- **incomeSetupDefaults.payCadence** — Pay cadence
  - Default: "monthly" (enum)
  - Used by: —
  - Overrideable by strategy: yes

- **incomeSetupDefaults.salaryGrowthRule** — Salary growth rule
  - Default: "fixedPct" (enum)
  - Used by: —
  - Overrideable by strategy: yes

- **incomeSetupDefaults.taxEnabled** — Tax enabled
  - Default: true (boolean)
  - Used by: —
  - Overrideable by strategy: yes

- **incomeSetupDefaults.taxRegime** — Tax regime
  - Default: "DK" (enum)
  - Used by: —
  - Overrideable by strategy: yes


## depositStrategy

- **depositStrategyDefaults.contributionCadence** — Contribution cadence
  - Default: "monthly" (enum)
  - Used by: —
  - Overrideable by strategy: yes

- **depositStrategyDefaults.depositTiming** — Deposit timing
  - Default: "endOfMonth" (enum)
  - Used by: —
  - Overrideable by strategy: yes

- **depositStrategyDefaults.emergencyBufferTargetMonths** — Emergency buffer target (months)
  - Default: 6 (months)
  - Used by: —
  - Overrideable by strategy: yes

- **depositStrategyDefaults.escalationDkkPerYear** — Escalation (DKK/year)
  - Default: 0 (dkkPerYear)
  - Used by: —
  - Overrideable by strategy: yes

- **depositStrategyDefaults.escalationMode** — Escalation mode
  - Default: "none" (enum)
  - Used by: —
  - Overrideable by strategy: yes

- **depositStrategyDefaults.escalationPct** — Escalation (%/year)
  - Default: 0 (pct)
  - Used by: —
  - Overrideable by strategy: yes

- **depositStrategyDefaults.inflationAdjustContributions** — Inflation-adjust contributions
  - Default: false (boolean)
  - Used by: —
  - Overrideable by strategy: yes

- **depositStrategyDefaults.routingPriority** — Default routing priority
  - Default: "buffer>debt>wrappers>taxable" (enum)
  - Used by: —
  - Overrideable by strategy: yes


## simulatorTax

- **taxExemptionDefaults.exemptionCardLimit** — Exemption card limit (DKK/year)
  - Default: 51600 (dkkPerYear)
  - Used by: Explore, Simulation, Tutorial
  - Overrideable by strategy: yes

- **taxExemptionDefaults.exemptionCardYearlyIncrease** — Exemption card yearly increase (DKK/year)
  - Default: 1000 (dkkPerYear)
  - Used by: Explore, Simulation, Tutorial
  - Overrideable by strategy: yes

- **taxExemptionDefaults.stockExemptionLimit** — Stock exemption limit (DKK/year)
  - Default: 67500 (dkkPerYear)
  - Used by: Explore, Simulation, Tutorial
  - Overrideable by strategy: yes

- **taxExemptionDefaults.stockExemptionTaxRate** — Stock exemption tax rate (%/year)
  - Default: 27 (pct)
  - Used by: Explore, Simulation, Tutorial
  - Overrideable by strategy: yes

- **taxExemptionDefaults.stockExemptionYearlyIncrease** — Stock exemption yearly increase (DKK/year)
  - Default: 1000 (dkkPerYear)
  - Used by: Explore, Simulation, Tutorial
  - Overrideable by strategy: yes


## withdrawalStrategy

- **withdrawalStrategyDefaults.cashBufferTargetMonths** — Cash buffer target (months)
  - Default: 6 (months)
  - Used by: —
  - Overrideable by strategy: yes

- **withdrawalStrategyDefaults.guardrailCeilingPct** — Guardrail ceiling (%/year)
  - Default: 5 (pct)
  - Used by: —
  - Overrideable by strategy: yes

- **withdrawalStrategyDefaults.guardrailFloorPct** — Guardrail floor (%/year)
  - Default: 3 (pct)
  - Used by: —
  - Overrideable by strategy: yes

- **withdrawalStrategyDefaults.inflationAdjustSpending** — Inflation-adjust spending
  - Default: true (boolean)
  - Used by: —
  - Overrideable by strategy: yes

- **withdrawalStrategyDefaults.maxCutPctPerYear** — Max spending cut (%/year)
  - Default: 10 (pct)
  - Used by: —
  - Overrideable by strategy: yes

- **withdrawalStrategyDefaults.withdrawalRule** — Default withdrawal rule
  - Default: "fixedPct" (enum)
  - Used by: —
  - Overrideable by strategy: yes


## policyBuilder

- **policyBuilderDefaults.conflictResolution** — Conflict resolution
  - Default: "priority" (enum)
  - Used by: —
  - Overrideable by strategy: yes

- **policyBuilderDefaults.cooldownMonths** — Cooldown (months)
  - Default: 3 (months)
  - Used by: —
  - Overrideable by strategy: yes

- **policyBuilderDefaults.criticalFailureRiskPct** — Critical threshold (failure risk %)
  - Default: 20 (pct)
  - Used by: —
  - Overrideable by strategy: yes

- **policyBuilderDefaults.evaluationFrequency** — Evaluation frequency
  - Default: "monthly" (enum)
  - Used by: —
  - Overrideable by strategy: yes

- **policyBuilderDefaults.maxDepositIncreasePctPerYear** — Max deposit increase (%/year)
  - Default: 10 (pct)
  - Used by: —
  - Overrideable by strategy: yes

- **policyBuilderDefaults.maxSpendingCutPctPerYear** — Max spending cut (%/year)
  - Default: 10 (pct)
  - Used by: —
  - Overrideable by strategy: yes

- **policyBuilderDefaults.warnFailureRiskPct** — Warn threshold (failure risk %)
  - Default: 10 (pct)
  - Used by: —
  - Overrideable by strategy: yes


## milestones

- **fireMilestonesDefaults.baristaFireRequiredMonthlyIncomeDkk** — Barista FIRE: required monthly income (DKK)
  - Default: 0 (dkkPerMonth)
  - Used by: —
  - Overrideable by strategy: yes

- **fireMilestonesDefaults.confidenceTarget** — Confidence target
  - Default: "P90" (enum)
  - Used by: —
  - Overrideable by strategy: yes

- **fireMilestonesDefaults.fatSpendingMonthlyDkk** — Fat spending threshold (DKK/month)
  - Default: 30000 (dkkPerMonth)
  - Used by: —
  - Overrideable by strategy: yes

- **fireMilestonesDefaults.leanSpendingMonthlyDkk** — Lean spending threshold (DKK/month)
  - Default: 12000 (dkkPerMonth)
  - Used by: —
  - Overrideable by strategy: yes

- **fireMilestonesDefaults.milestoneStability** — Milestone stability
  - Default: "instant" (enum)
  - Used by: —
  - Overrideable by strategy: yes

- **fireMilestonesDefaults.sustainedMonths** — Sustained months
  - Default: 12 (months)
  - Used by: —
  - Overrideable by strategy: yes


## goalPlanner

- **goalPlannerDefaults.fundingOrder** — Funding order
  - Default: "buffer>debt>goals>fi" (enum)
  - Used by: —
  - Overrideable by strategy: yes

- **goalPlannerDefaults.goalInflationHandling** — Goal inflation handling
  - Default: "real" (enum)
  - Used by: —
  - Overrideable by strategy: yes

- **goalPlannerDefaults.goalRiskHandling** — Goal risk handling
  - Default: "default" (enum)
  - Used by: —
  - Overrideable by strategy: yes


## salaryTaxator

- **salaryTaxatorDefaults.atpEligibilityGrossMonthlyThresholdDkk** — ATP eligibility proxy (gross monthly threshold DKK)
  - Default: 2340 (dkkPerMonth)
  - Used by: SalaryTaxator
  - Overrideable by strategy: yes

- **salaryTaxatorDefaults.atpMonthlyDkk** — ATP employee share (DKK/month)
  - Default: 99 (dkkPerMonth)
  - Used by: SalaryTaxator
  - Overrideable by strategy: yes

- **salaryTaxatorDefaults.churchMember** — Church member
  - Default: false (boolean)
  - Used by: SalaryTaxator
  - Overrideable by strategy: yes

- **salaryTaxatorDefaults.defaultMunicipalTaxRatePct** — Fallback municipal tax rate (%)
  - Default: 25 (pct)
  - Used by: SalaryTaxator
  - Overrideable by strategy: yes

- **salaryTaxatorDefaults.employeePensionRatePct** — Employee pension rate (%)
  - Default: 0 (pct)
  - Used by: SalaryTaxator
  - Overrideable by strategy: yes

- **salaryTaxatorDefaults.municipalityId** — Default municipality id
  - Default: "average" (string)
  - Used by: SalaryTaxator
  - Overrideable by strategy: yes

- **salaryTaxatorDefaults.otherDeductionsAnnualDkk** — Other deductions (DKK/year)
  - Default: 0 (dkkPerYear)
  - Used by: SalaryTaxator
  - Overrideable by strategy: yes


## moneyPerspective

- **moneyPerspectiveDefaults.coreExpenseMonthlyDkk** — Core expense (DKK/month)
  - Default: 12000 (dkkPerMonth)
  - Used by: MoneyPerspective
  - Overrideable by strategy: yes

- **moneyPerspectiveDefaults.payRaisePct** — Pay raise (%/year)
  - Default: 2 (pct)
  - Used by: MoneyPerspective
  - Overrideable by strategy: yes

- **moneyPerspectiveDefaults.timeHorizonYears** — Time horizon (years)
  - Default: 10 (years)
  - Used by: MoneyPerspective
  - Overrideable by strategy: yes

- **moneyPerspectiveDefaults.workingHoursPerMonth** — Working hours per month
  - Default: 160 (hoursPerMonth)
  - Used by: MoneyPerspective
  - Overrideable by strategy: yes

