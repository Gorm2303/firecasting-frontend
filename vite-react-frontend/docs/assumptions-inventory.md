# Assumptions inventory (Step 2)

Purpose: enumerate every assumption/default currently used by the app, identify the current source of truth, and surface drift/duplication.

This document is discovery-only (no new assumptions added). It supports later steps:
- Step 1: authority-layer cleanup
- Step 3: multi-tab Assumptions Hub (defaults & conventions)
- Step 4: Assumptions Registry (used-by badges, diffs)

## Current “authority” stores

### Assumptions Authority (global world model)
- Code: `src/state/assumptions.tsx`
- Storage key: `firecasting:assumptions:v2` (shape: `{ current, draft }`)
- Edited via: `src/pages/AssumptionsHubPage.tsx`

### Execution Defaults Authority (execution knobs)
- Code: `src/state/executionDefaults.tsx`
- Storage key: `firecasting:executionDefaults:v1`
- Current consumers: `src/components/normalMode/NormalInputForm.tsx`
- Notes:
  - Intentionally separate from Assumptions (different “kind” of defaults).
  - Migrates legacy fields from `firecasting:advancedOptions:v1` when present.

### Advanced UI options (non-authoritative, UI-only)
- Storage key: `firecasting:advancedOptions:v1`
- Intended to store advanced UI state *excluding* global assumptions and execution defaults.

## Coverage matrix (what exists today)

Legend:
- **Source**: where the value comes from today.
- **Used by**: concrete consumers found via grep (not necessarily exhaustive).
- **Notes**: drift risks / hidden defaults.

### World model assumptions (Assumptions Authority)

| Key path | Default | Source | Used by | Notes |
|---|---:|---|---|---|
| `currency` | `DKK` | Assumptions | Assumptions Hub, Assumptions Summary Bar, Money Perspective | Mostly UI today (MoneyPerspective uses it for formatting/context). |
| `inflationPct` | `2` | Assumptions | Normal simulation, Advanced simulation, Explore, Tutorial, Money Perspective | Tutorial also hard-requires specific values in steps (convention drift risk). |
| `yearlyFeePct` | `0.5` | Assumptions | Normal simulation, Tutorial, Money Perspective | Backend form schema also contains fee defaults; treat schema defaults as non-authoritative. |
| `expectedReturnPct` | `5` | Assumptions | Money Perspective | Not used by simulator run payloads yet (simulator return model is separate). |
| `safeWithdrawalPct` | `4` | Assumptions | Assumptions Summary Bar | Used for display; not yet wired into simulator withdrawal logic. |

### Execution defaults (Execution Defaults Authority)

| Key path | Default | Source | Used by | Notes |
|---|---:|---|---|---|
| `executionDefaults.paths` | `10000` | ExecutionDefaults store | Normal simulation form | Template-apply resets this persisted value; user edits write through. |
| `executionDefaults.batchSize` | `10000` | ExecutionDefaults store | Normal simulation form | Same as above. |
| `executionDefaults.seedMode` | `default` | ExecutionDefaults store | Normal simulation form | Together with `DEFAULT_MASTER_SEED` controls reproducibility. |

### Simulator tax defaults (Assumptions Authority)

| Key path | Default | Source | Used by | Notes |
|---|---:|---|---|---|
| `taxExemptionDefaults.exemptionCardLimit` | `51600` | Assumptions | Normal simulation form, Explore, Tutorial, scenario summaries | Some utilities fall back to `getDefaultAssumptions()` when assumptions are missing → drift risk. |
| `taxExemptionDefaults.exemptionCardYearlyIncrease` | `1000` | Assumptions | Normal simulation form, Explore, Tutorial, scenario summaries | Same drift note. |
| `taxExemptionDefaults.stockExemptionTaxRate` | `27` | Assumptions | Normal simulation form, Explore, Tutorial, scenario summaries | Same drift note. |
| `taxExemptionDefaults.stockExemptionLimit` | `67500` | Assumptions | Normal simulation form, Explore, Tutorial, scenario summaries | Same drift note. |
| `taxExemptionDefaults.stockExemptionYearlyIncrease` | `1000` | Assumptions | Normal simulation form, Explore, Tutorial, scenario summaries | Same drift note. |

### Salary Taxator defaults (Assumptions Authority)

| Key path | Default | Source | Used by | Notes |
|---|---:|---|---|---|
| `salaryTaxatorDefaults.municipalityId` | `average` | Assumptions | Salary After Tax page | Used as UI default selection. |
| `salaryTaxatorDefaults.defaultMunicipalTaxRatePct` | `25` | Assumptions | Salary After Tax page | Used when municipality is unknown/unselected. |
| `salaryTaxatorDefaults.churchMember` | `false` | Assumptions | Salary After Tax page | UI default. |
| `salaryTaxatorDefaults.employeePensionRatePct` | `0` | Assumptions | Salary After Tax page | UI default. |
| `salaryTaxatorDefaults.otherDeductionsAnnualDkk` | `0` | Assumptions | Salary After Tax page | UI default. |
| `salaryTaxatorDefaults.atpMonthlyDkk` | `99` | Assumptions | Salary After Tax page | UI default and explanatory text. |
| `salaryTaxatorDefaults.atpEligibilityGrossMonthlyThresholdDkk` | `2340` | Assumptions | Salary After Tax page | Used for proxy eligibility rule. |

### Money Perspective defaults (Assumptions Authority)

| Key path | Default | Source | Used by | Notes |
|---|---:|---|---|---|
| `moneyPerspectiveDefaults.workingHoursPerMonth` | `160` | Assumptions | Money Perspective page | Used as time accounting baseline. |
| `moneyPerspectiveDefaults.payRaisePct` | `2` | Assumptions | Money Perspective page | Used in projections. |
| `moneyPerspectiveDefaults.timeHorizonYears` | `10` | Assumptions | Money Perspective page | Used in projections. |
| `moneyPerspectiveDefaults.coreExpenseMonthlyDkk` | `12000` | Assumptions | Money Perspective page | Used in projections. |

## Known “hidden defaults” (not yet modeled as assumptions)

These are defaults/conventions embedded in code today and likely candidates for Step 1/3 later.

- Return model default in normal-mode explanation text: fixed (now uses `DEFAULT_RETURN_TYPE` in `src/components/normalMode/AssumptionsPanel.tsx`).
- Timing conventions in explanation/tooltips: centralized into the conventions registry (`src/state/conventionsRegistry.json`) and referenced from UI copy via `src/config/simulationConventions.ts`.
- Utilities that use `getDefaultAssumptions()` when assumptions are missing (drift risk): fixed (Step 1 kickoff)
  - `src/utils/summarizeScenario.ts` (assumptions now required)
  - `src/pages/ExplorePage.tsx` (tax exemption defaults now required)
- Backend form schema includes its own defaults (treat as shape-only per architecture goal):
  - `firecasting-backend/.../advanced-simulation.json`

## Backlog candidates (feed into Step 1 / Step 3)

These are concrete places where the runtime UI still encodes conventions or fallback defaults outside the authority stores.

- Tutorial hard-codes inflation + fee targets
  - Location: `src/pages/TutorialPage.tsx`
  - Symptom: steps require `inflation = 2` and `fee = 0.5` even if Assumptions are changed.
  - Status: fixed (now derives targets + copy from `currentAssumptions`).

- Normal-mode assumptions explainer hard-codes return model name and timing conventions
  - Location: `src/components/normalMode/AssumptionsPanel.tsx`
  - Symptom: `returnType` is hard-coded to `dataDrivenReturn`; text asserts month-end/year-end conventions.
  - Status:
    - returnType default fixed (uses `DEFAULT_RETURN_TYPE`)
    - timing text references the conventions registry (`src/state/conventionsRegistry.json`) via `src/config/simulationConventions.ts`

- Normal-mode phase tooltips embed timing assumptions
  - Location: `src/components/normalMode/NormalPhaseList.tsx`
  - Symptom: tooltips state “Monthly deposit added at each month-end” and “Initial deposit at the beginning of this phase”.
  - Status: fixed (tooltips reference the conventions registry via `src/config/simulationConventions.ts`).

- Runtime fallback to `getDefaultAssumptions()` still exists in a couple of helpers
  - Locations:
    - `src/utils/summarizeScenario.ts` (tax exemption defaults when `assumptions` param is omitted)
    - `src/pages/ExplorePage.tsx` (tax exemption defaults when optional arg omitted)
  - Symptom: these functions silently fall back to built-in defaults if the caller forgets to provide the authority-layer values.
  - Status: fixed in Step 1 kickoff (helpers now require explicit authority inputs).

## Next: what this enables
- Fill/validate registry completeness (used-by badges, consistent labels/units).
- Drive Assumptions Hub tab split without losing fields.
- Identify drift fixes (e.g., eliminate `getDefaultAssumptions()` fallbacks where persisted current assumptions are required).
