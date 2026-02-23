import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import ExplorePage from './pages/ExplorePage';
import InfoPage from './pages/InfoPage';
import LandingPage from './pages/LandingPage';
import MoneyPerspectivePage from './pages/MoneyPerspectivePage';
import ProgressTrackerPage from './pages/ProgressTrackerPage';
import RunDiffPage from './pages/RunDiffPage';
import SalaryAfterTaxPage from './pages/SalaryAfterTaxPage';
import SimulationPage from './pages/SimulationPage';
import TutorialLandingPage from './pages/TutorialLandingPage';
import TutorialPage from './pages/TutorialPage';

import SkeletonPage, { type SkeletonSection } from './pages/skeleton/SkeletonPage';
import FeedbackPage from './pages/FeedbackPage';
import SecurityPrivacyCenterPage from './pages/SecurityPrivacyCenterPage';
import AssumptionsHubPage from './pages/AssumptionsHubPage';

type SkeletonRoute = {
  path: string;
  title: string;
  subtitle?: string;
  sections?: SkeletonSection[];
};

const skeletonRoutes: SkeletonRoute[] = [
  // Lifestyle
  {
    path: '/time-accounting',
    title: 'Time Accounting Dashboard',
    sections: [
      {
        title: 'Inputs',
        bullets: ['Turns money into time. Philosophy weaponized into UI.'],
        fields: [
          { label: 'Net monthly income', placeholder: 'e.g. 35,000 DKK' },
          { label: 'Work hours / week', placeholder: 'e.g. 37' },
          { label: 'Commute (minutes/day)', placeholder: 'e.g. 60' },
          { label: 'Stress recovery (hours/week)', placeholder: 'e.g. 5' },
          { label: 'Side income (monthly)', placeholder: 'e.g. 2,000 DKK' },
          { label: 'Vacations (weeks/year)', placeholder: 'e.g. 6' },
          { label: 'Overtime (hours/week)', placeholder: 'e.g. 2' },
        ],
        actions: ['Calculate (placeholder)', 'Save as scenario (placeholder)'],
        widgets: [
          {
            kind: 'sliders',
            title: 'Quick tweak knobs',
            sliders: [
              { label: 'Commute minutes/day', min: 0, max: 180, value: 60, unit: '' },
              { label: 'Work hours/week', min: 0, max: 70, value: 37, unit: '' },
              { label: 'Recovery hours/week', min: 0, max: 20, value: 5, unit: '' },
              { label: 'Income “raise”', min: 0, max: 30, value: 0, unit: '%' },
            ],
          },
        ],
      },
      {
        title: 'Outputs',
        bullets: ['Commuting time cost', 'Stress recovery time cost', '“Net life-hours” after work'],
        fields: [
          { label: 'Commute cost (life-hours / month)', placeholder: 'computed' },
          { label: 'Recovery cost (life-hours / month)', placeholder: 'computed' },
          { label: 'Net free life-hours / week', placeholder: 'computed' },
          { label: 'Effective hourly rate (incl commute)', placeholder: 'computed' },
        ],
        widgets: [
          { kind: 'chart', title: 'Life-hours ledger', subtitle: 'Chart placeholder: work + commute + recovery vs free time.' },
          { kind: 'table', title: 'Monthly ledger (placeholder)', columns: ['Category', 'Hours', 'Cost (DKK)', 'Note'], rows: 6 },
        ],
      },
      {
        title: 'Interpretation',
        bullets: [
          'What changed the most (placeholder)',
          'If commute increases by 30 min/day: impact (placeholder)',
          'If salary increases by X: impact (placeholder)',
        ],
      },
      {
        title: 'Scenario comparison (placeholder)',
        bullets: ['Compare “Remote”, “Hybrid”, “Promotion”, “Part-time”, etc.'],
        widgets: [
          { kind: 'table', title: 'Scenarios', columns: ['Scenario', 'Net free hours/week', 'Effective hourly', 'Stress score', 'Notes'], rows: 4 },
        ],
        actions: ['Add scenario (placeholder)', 'Set baseline (placeholder)'],
      },
    ],
  },
  {
    path: '/fixed-vs-flexible-spending',
    title: 'Fixed vs Flexible Spending Analyzer',
    sections: [
      {
        title: 'Expense Split',
        bullets: ['Split expenses into fixed (non-negotiable) vs flexible (adjustable).'],
        fields: [
          { label: 'Fixed expenses / month', placeholder: 'rent, debt, insurance…' },
          { label: 'Flexible expenses / month', placeholder: 'food, fun, travel…' },
          { label: 'Target cut in downturn', placeholder: 'e.g. -15%' },
        ],
        actions: ['Analyze stiffness (placeholder)', 'Generate cut plan (placeholder)'],
      },
      {
        title: 'Stiff vs Bendable',
        bullets: ['How much of your plan is “stiff” vs “bendable”.'],
        fields: [
          { label: 'Stiffness ratio', placeholder: 'computed' },
          { label: 'Max safe cut potential', placeholder: 'computed' },
          { label: 'Months of survival gain', placeholder: 'computed' },
        ],
      },
      {
        title: 'Tail-Risk Survival',
        bullets: ['Show how flexibility changes survival in bad sequences (placeholder).'],
        fields: [
          { label: 'P10 “survival months”', placeholder: 'computed' },
          { label: 'P50 “survival months”', placeholder: 'computed' },
          { label: 'Recommended flexible buffer', placeholder: 'computed' },
        ],
      },
    ],
  },
  {
    path: '/life-events-simulator',
    title: 'Life Events Simulator',
    sections: [
      {
        title: 'Scenario setup',
        bullets: ['Model life events as timeline blocks with uncertainty ranges.'],
        fields: [
          { label: 'Simulation start age', placeholder: 'e.g. 30' },
          { label: 'Horizon (years)', placeholder: 'e.g. 60' },
          { label: 'Currency', placeholder: 'e.g. DKK' },
          { label: 'Baseline scenario', placeholder: 'select (placeholder)' },
        ],
        actions: ['Add event (placeholder)', 'Duplicate scenario (placeholder)', 'Compare scenarios (placeholder)'],
      },
      {
        title: 'Event types',
        bullets: [
          'Children, career breaks, parental leave, relocations',
          'Home purchase, divorce, inheritance, health costs',
        ],
      },
      {
        title: 'Timeline (placeholder)',
        bullets: ['Later: drag events on a timeline and see cashflow/portfolio impacts immediately.'],
        widgets: [
          {
            kind: 'timeline',
            title: 'Life timeline',
            rows: [
              { label: 'Career', range: '2026–2060', note: 'baseline income path (placeholder)' },
              { label: 'Parental leave', range: '2031', note: 'income dip + time bonus (placeholder)' },
              { label: 'Relocation', range: '2036', note: 'cost shock + salary change (placeholder)' },
              { label: 'Health costs', range: '2044–2046', note: 'expense wave (placeholder)' },
            ],
          },
          { kind: 'chart', title: 'Cashflow impact', subtitle: 'Chart placeholder.' },
        ],
      },
      {
        title: 'Event library (placeholder)',
        widgets: [
          { kind: 'table', title: 'Events', columns: ['Event', 'Start', 'Duration', 'Income Δ', 'Cost Δ', 'Uncertainty'], rows: 6 },
        ],
        actions: ['Create template event (placeholder)', 'Import template pack (placeholder)'],
      },
      {
        title: 'Event editor (placeholder)',
        fields: [
          { label: 'Event name', placeholder: 'e.g. Parental leave' },
          { label: 'Start (year)', placeholder: 'e.g. 2030' },
          { label: 'Duration', placeholder: 'e.g. 10 months' },
          { label: 'Monthly cost delta', placeholder: 'e.g. +3,000 DKK' },
          { label: 'Income delta', placeholder: 'e.g. -12,000 DKK' },
          { label: 'Uncertainty range', placeholder: 'min / most likely / max' },
          { label: 'Notes', placeholder: 'why this matters / what triggers it', multiline: true },
        ],
        actions: ['Add to timeline (placeholder)', 'Remove (placeholder)'],
      },
      {
        title: 'Uncertainty',
        bullets: ['Ranges + distributions (placeholder)', 'Compare multiple scenarios (placeholder)'],
        widgets: [
          { kind: 'chart', title: 'FI date range under events', subtitle: 'Chart placeholder.' },
          { kind: 'chart', title: 'Plan health over time', subtitle: 'Chart placeholder.' },
        ],
      },
    ],
  },
  {
    path: '/side-hustle-lab',
    title: 'Side Hustle Lab',
    sections: [
      {
        title: 'Explore',
        bullets: ['Explore side hustle ideas and how they fit your life and FIRE plan.'],
        fields: [
          { label: 'Time available (hours/week)', placeholder: 'e.g. 6' },
          { label: 'Energy level', placeholder: 'low / medium / high' },
          { label: 'Risk tolerance', placeholder: 'low / medium / high' },
          { label: 'Target monthly income', placeholder: 'e.g. 4,000 DKK' },
        ],
        actions: ['Generate ideas (placeholder)', 'Filter ideas (placeholder)'],
      },
      {
        title: 'Dream hustle builder',
        fields: [
          { label: 'Hustle concept', placeholder: 'describe your idea' },
          { label: 'Startup cost', placeholder: 'e.g. 2,500 DKK' },
          { label: 'Recurring costs', placeholder: 'e.g. 250 DKK/mo' },
          { label: 'Expected income', placeholder: 'min / likely / max' },
          { label: 'Hours/week', placeholder: 'e.g. 5–8' },
        ],
        actions: ['Fit into plan (placeholder)', 'Create a timeline (placeholder)'],
      },
    ],
  },
  {
    path: '/housing-decision-studio',
    title: 'Housing Decision Studio',
    sections: [
      {
        title: 'Decision modes',
        bullets: ['Rent vs buy vs relocate.'],
        fields: [{ label: 'Mode', placeholder: 'rent / buy / relocate' }],
      },
      {
        title: 'Inputs (placeholder)',
        fields: [
          { label: 'Current rent', placeholder: 'per month' },
          { label: 'Home price', placeholder: 'if buying' },
          { label: 'Down payment', placeholder: 'amount or %' },
          { label: 'Mortgage rate', placeholder: '% / year' },
          { label: 'Maintenance', placeholder: '% of value / year' },
          { label: 'Transaction costs', placeholder: 'fees + taxes' },
          { label: 'Opportunity cost', placeholder: 'expected return %' },
        ],
        actions: ['Compare outcomes (placeholder)'],
      },
      {
        title: 'Outputs (placeholder)',
        fields: [
          { label: 'Break-even year', placeholder: 'computed' },
          { label: 'Total cost difference', placeholder: 'computed' },
          { label: 'FI date impact', placeholder: 'computed' },
        ],
      },
    ],
  },
  {
    path: '/household-negotiation-board',
    title: 'Household Negotiation Board',
    sections: [
      {
        title: 'Trade-off board',
        bullets: ['Make trade-offs explicit to reduce silent resentment via math.'],
        fields: [
          { label: 'Household goal', placeholder: 'FI / house / travel / buffer…' },
          { label: 'Decision under discussion', placeholder: 'e.g. car upgrade' },
          { label: 'Cost / month', placeholder: 'e.g. 1,200 DKK' },
          { label: 'Duration', placeholder: 'e.g. 36 months' },
          { label: 'Non-negotiables', placeholder: 'list (placeholder)', multiline: true },
        ],
        actions: ['Show what this delays (placeholder)', 'Add counter-offer (placeholder)'],
      },
      {
        title: 'Board view (placeholder)',
        bullets: ['Columns: “We choose this” vs “We give up this”.', 'List impacts: FI date, buffer months, vacations, stress score.'],
        widgets: [
          {
            kind: 'table',
            title: 'Option comparison',
            columns: ['Option', 'Monthly cost', 'FI delay', 'Buffer impact', 'Stress impact', 'Notes'],
            rows: 4,
          },
          {
            kind: 'cards',
            title: 'Counter-offer cards',
            cards: [
              { title: 'Option A: Upgrade now', body: 'Higher monthly cost, keeps convenience now. Trade-off: delays goal X.' },
              { title: 'Option B: Delay 12 months', body: 'Cuts FI delay, keeps optionality. Trade-off: tolerate current situation.' },
              { title: 'Option C: Buy used / smaller', body: 'Lower cost. Trade-off: features/comfort.' },
            ],
          },
        ],
        actions: ['Draft agreement (placeholder)', 'Export summary (placeholder)'],
      },
      {
        title: 'Agreement draft (placeholder)',
        bullets: ['Turn the chosen option into a concrete agreement and a review date.'],
        fields: [
          { label: 'Decision', placeholder: 'chosen option (placeholder)' },
          { label: 'Why we chose it', placeholder: 'shared rationale (placeholder)', multiline: true },
          { label: 'Review date', placeholder: 'YYYY-MM-DD' },
          { label: 'If things go wrong, we will…', placeholder: 'fallback plan (placeholder)', multiline: true },
        ],
        actions: ['Save (placeholder)'],
      },
    ],
  },
  {
    path: '/family-mode-planner',
    title: 'Family Mode Planner',
    sections: [
      {
        title: 'Setup',
        bullets: ['Dedicated setup for couples/families.'],
        fields: [
          { label: 'Accounts', placeholder: 'shared / separate / hybrid' },
          { label: 'Parental leave years', placeholder: 'years + income impacts' },
          { label: 'Childcare waves', placeholder: 'age ranges + cost' },
          { label: 'Education funds', placeholder: 'target amounts + timelines' },
        ],
        actions: ['Generate family plan (placeholder)'],
      },
    ],
  },
  {
    path: '/debt-freedom-optimizer',
    title: 'Debt Freedom Optimizer',
    sections: [
      {
        title: 'Debts (placeholder)',
        fields: [
          { label: 'Debt list', placeholder: 'name + balance + rate + minimum' },
          { label: 'Extra payment budget', placeholder: 'e.g. 1,500 DKK/mo' },
        ],
        actions: ['Add debt (placeholder)', 'Optimize (placeholder)'],
      },
      {
        title: 'Strategies',
        bullets: ['Snowball', 'Avalanche', 'Pay minimum'],
        fields: [{ label: 'Selected strategy', placeholder: 'snowball / avalanche / minimum' }],
      },
      {
        title: 'Consequences (placeholder)',
        fields: [
          { label: 'Debt-free date', placeholder: 'computed' },
          { label: 'Total interest', placeholder: 'computed' },
          { label: 'FI-date change', placeholder: 'computed' },
          { label: 'Stress score', placeholder: 'computed' },
        ],
      },
    ],
  },
  {
    path: '/emergency-buffer-optimizer',
    title: 'Emergency Buffer Optimizer',
    sections: [
      {
        title: 'Inputs',
        fields: [
          { label: 'Monthly core expenses', placeholder: 'e.g. 18,000 DKK' },
          { label: 'Income stability', placeholder: 'stable / variable / seasonal' },
          { label: 'Expense volatility', placeholder: 'low / medium / high' },
          { label: 'Dependents', placeholder: 'count' },
          { label: 'Job market confidence', placeholder: 'low / medium / high' },
          { label: 'Access to credit', placeholder: 'none / some / strong (placeholder)' },
          { label: 'Insurance coverage quality', placeholder: 'low / medium / high (placeholder)' },
        ],
        actions: ['Recommend buffer (placeholder)'],
        widgets: [
          {
            kind: 'sliders',
            title: 'Risk knobs (placeholder)',
            sliders: [
              { label: 'Income stability', min: 0, max: 10, value: 6, unit: '' },
              { label: 'Expense volatility', min: 0, max: 10, value: 4, unit: '' },
              { label: 'Job market confidence', min: 0, max: 10, value: 5, unit: '' },
              { label: 'Dependents factor', min: 0, max: 5, value: 1, unit: '' },
            ],
          },
        ],
      },
      {
        title: 'Recommendation (placeholder)',
        fields: [
          { label: 'Target buffer (months)', placeholder: 'computed' },
          { label: 'Target buffer (amount)', placeholder: 'computed' },
          { label: 'Refill policy', placeholder: 'computed' },
        ],
        widgets: [
          { kind: 'chart', title: 'Coverage curve', subtitle: 'Chart placeholder: probability of covering job loss durations.' },
          { kind: 'table', title: 'Coverage table (placeholder)', columns: ['Shock', 'Duration', 'Covered?', 'Gap', 'Note'], rows: 5 },
        ],
      },
      {
        title: 'Reasoning breakdown',
        bullets: ['Explain which factors pushed the target up/down (placeholder).'],
      },
      {
        title: 'Refill rules (placeholder)',
        bullets: ['Turn the buffer into a policy, not a number.'],
        widgets: [
          {
            kind: 'cards',
            title: 'Policies',
            cards: [
              { title: 'Refill trigger', body: 'If buffer < 70% target → prioritize refill deposits.' },
              { title: 'Pause trigger', body: 'If buffer < 40% target → pause discretionary + pause investments (placeholder).' },
              { title: 'Release trigger', body: 'If buffer > 120% target → route excess to goals (placeholder).' },
            ],
          },
        ],
        actions: ['Save policy (placeholder)'],
      },
    ],
  },
  {
    path: '/insurance-risk-shield',
    title: 'Insurance Risk Shield',
    sections: [
      {
        title: 'Coverage inputs (placeholder)',
        fields: [
          { label: 'Health coverage', placeholder: 'deductible + max out-of-pocket' },
          { label: 'Disability coverage', placeholder: '% income covered' },
          { label: 'Income protection', placeholder: 'months covered' },
          { label: 'Liability coverage', placeholder: 'amount' },
        ],
        actions: ['Stress test (placeholder)'],
      },
      {
        title: 'Stress scenarios',
        bullets: ['Health event', 'Disability', 'Job loss', 'Legal liability'],
      },
      {
        title: 'Financial blast radius (placeholder)',
        fields: [
          { label: 'Worst-month cashflow gap', placeholder: 'computed' },
          { label: 'Buffer months needed', placeholder: 'computed' },
          { label: 'FI impact', placeholder: 'computed' },
        ],
      },
    ],
  },

  // Plan
  {
    path: '/scenario-library',
    title: 'Scenario Library',
    sections: [
      {
        title: 'Public templates',
        bullets: ['Aggressive saver', 'Family of 4', 'Late start', 'Coast FIRE', 'Barista FIRE'],
        actions: ['Use template (placeholder)', 'Preview template (placeholder)'],
      },
      {
        title: 'Personal scenario builder',
        fields: [
          { label: 'Template name', placeholder: 'e.g. “Our baseline”' },
          { label: 'Notes', placeholder: 'what makes this scenario special' },
          { label: 'Visibility', placeholder: 'private / shared with partner (placeholder)' },
        ],
        actions: ['Save template (placeholder)', 'Share link (placeholder)'],
      },
    ],
  },
  {
    path: '/fire-milestones',
    title: 'FIRE Milestones',
    sections: [
      { title: 'Timeline', bullets: ['Deposits, yearly reports, withdrawals', 'Emergency buffer / Coast / Barista / Lean / FIRE / Fat unlocks'] },
      {
        title: 'Milestones overview (placeholder)',
        bullets: ['A single screen for “where we are now” and what’s next.'],
        widgets: [
          {
            kind: 'cards',
            title: 'Milestone cards',
            cards: [
              { title: 'Emergency buffer', body: 'Target: 3–12 months. Status: placeholder.' },
              { title: 'Coast FIRE', body: 'When contributions can stop and still reach FI. Status: placeholder.' },
              { title: 'Lean FIRE', body: 'Core needs covered. Status: placeholder.' },
              { title: 'FIRE', body: 'Full lifestyle covered. Status: placeholder.' },
            ],
          },
          {
            kind: 'table',
            title: 'Milestone table',
            columns: ['Milestone', 'Target age', 'Range', 'Probability', 'Key driver'],
            rows: 6,
          },
        ],
      },
      {
        title: 'Probabilities',
        bullets: ['Chance of FI by age X (placeholder)', 'Estimated date ranges (placeholder)'],
        widgets: [
          { kind: 'chart', title: 'Probability curves', subtitle: 'Chart placeholder: P(FI by age).' },
        ],
      },
      { title: 'Editors', bullets: ['What-If slider wall (placeholder)', 'Timeline editor (placeholder)'] },
      {
        title: 'What unlocks next',
        fields: [
          { label: 'Next milestone', placeholder: 'computed' },
          { label: 'Unlock condition', placeholder: 'computed' },
          { label: 'Fastest lever', placeholder: 'computed' },
        ],
      },
      {
        title: 'Goal “What-If” Slider Wall (placeholder)',
        bullets: ['A grid of sliders with instant FI-date range changes (computed later).'],
        widgets: [
          {
            kind: 'sliders',
            title: 'What-If sliders',
            sliders: [
              { label: 'Retirement age', min: 40, max: 75, value: 60, unit: '' },
              { label: 'Savings rate', min: 0, max: 80, value: 35, unit: '%' },
              { label: 'Monthly expenses', min: 5000, max: 50000, value: 22000, unit: '' },
              { label: 'Side income', min: 0, max: 20000, value: 2000, unit: '' },
            ],
          },
          { kind: 'chart', title: 'FI date range changes', subtitle: 'Chart placeholder: instant feedback later (local calc initially).' },
        ],
      },
      {
        title: 'Timeline editor (placeholder)',
        bullets: ['Drag-and-drop timeline for events: house purchase, sabbatical, kid, job change, pension start, FI milestone.'],
        widgets: [
          {
            kind: 'timeline',
            title: 'Timeline',
            rows: [
              { label: 'Deposit schedule', range: '2026–2046', note: 'monthly deposits (placeholder)' },
              { label: 'House purchase', range: '2031', note: 'down payment + mortgage (placeholder)' },
              { label: 'Parental leave', range: '2033', note: 'income drop (placeholder)' },
              { label: 'Coast FIRE', range: '2040', note: 'milestone (placeholder)' },
              { label: 'FIRE', range: '2046–2050', note: 'date range (placeholder)' },
            ],
          },
        ],
      },
    ],
  },
  {
    path: '/confidence-funnel',
    title: 'Confidence Funnel',
    sections: [
      { title: 'Uncertainty Funnel', bullets: ['Baseline vs interventions (placeholder)', 'Show narrowing/widening over time'] },
      {
        title: 'Interventions (placeholder)',
        bullets: ['Increase contributions', 'Reduce fees', 'Tax optimization', 'Spending flexibility', 'Sequence risk hedges'],
        widgets: [
          {
            kind: 'sliders',
            title: 'Intervention knobs',
            sliders: [
              { label: 'Contribution increase', min: 0, max: 50, value: 10, unit: '%' },
              { label: 'Fee reduction', min: 0, max: 1.5, value: 0.2, unit: '%' },
              { label: 'Tax improvement', min: 0, max: 15, value: 3, unit: '%' },
              { label: 'Flexibility buffer', min: 0, max: 30, value: 10, unit: '%' },
            ],
          },
        ],
        actions: ['Apply intervention set (placeholder)', 'Save as preset (placeholder)'],
      },
      {
        title: 'Compare funnels (placeholder)',
        fields: [
          { label: 'Baseline width', placeholder: 'computed' },
          { label: 'After intervention width', placeholder: 'computed' },
          { label: 'Confidence gain', placeholder: 'computed' },
          { label: 'Worst-case FI delay', placeholder: 'computed' },
        ],
      },
      {
        title: 'Funnels (placeholder)',
        widgets: [
          { kind: 'chart', title: 'Baseline funnel', subtitle: 'Uncertainty over time.' },
          { kind: 'chart', title: 'After intervention funnel', subtitle: 'Compare narrowing/widening.' },
        ],
      },
      {
        title: 'Comparison table (placeholder)',
        widgets: [
          { kind: 'table', title: 'Before vs after', columns: ['Metric', 'Baseline', 'After', 'Delta'], rows: 6 },
        ],
      },
    ],
  },
  {
    path: '/goal-planner',
    title: 'Goal Planner',
    sections: [
      { title: 'Multiple Goals', bullets: ['FI, house, sabbatical, buffer (placeholder)'] },
      {
        title: 'Prioritization',
        bullets: ['Priority sliders (placeholder)', 'Conflict warnings (placeholder)', 'Optimized split (placeholder)'],
        widgets: [
          {
            kind: 'sliders',
            title: 'Priority sliders (placeholder)',
            sliders: [
              { label: 'FIRE', min: 0, max: 10, value: 8 },
              { label: 'House', min: 0, max: 10, value: 5 },
              { label: 'Sabbatical', min: 0, max: 10, value: 4 },
              { label: 'Buffer', min: 0, max: 10, value: 7 },
            ],
          },
          { kind: 'chart', title: 'Allocation over time', subtitle: 'Chart placeholder: monthly contributions split.' },
        ],
      },
      {
        title: 'Expense Cut Impact',
        bullets: ['Rank expenses by “FI days bought per krone reduced” (placeholder)'],
        widgets: [
          { kind: 'table', title: 'Cuts ranked (placeholder)', columns: ['Expense', 'Cut', 'Monthly saved', 'FI days bought', 'Pain score'], rows: 6 },
        ],
      },
      {
        title: 'Goal list (placeholder)',
        fields: [
          { label: 'Goal', placeholder: 'name + target amount/date' },
          { label: 'Monthly contributions', placeholder: 'per goal (placeholder)' },
          { label: 'Priority', placeholder: 'slider (placeholder)' },
        ],
        actions: ['Add goal (placeholder)', 'Optimize split (placeholder)'],
        widgets: [
          { kind: 'table', title: 'Goals', columns: ['Goal', 'Target', 'Due', 'Funded', 'Status'], rows: 5 },
          { kind: 'table', title: 'Conflict matrix (placeholder)', columns: ['Conflict', 'What it means', 'Suggested resolution'], rows: 4 },
        ],
      },
    ],
  },
  {
    path: '/uncertainty-tracks',
    title: 'Uncertainty Tracks',
    sections: [
      { title: 'Parallel Tracks', bullets: ['P10, P25, P50, P75, P90'] },
      { title: 'Per-Track KPIs', bullets: ['FI date range', 'Safe monthly spending', 'Failure probability', 'Required savings-rate changes', 'Plan health color'] },
      { title: 'Action Cards', bullets: ['Runbook-style “If we hit percentile X, do this” (placeholder)', 'Simulated alerts per scenario (placeholder)'] },
      { title: 'Core Needs Coverage', bullets: ['Months of core needs secured (placeholder)'] },
      {
        title: 'Track selector (placeholder)',
        fields: [
          { label: 'Active track', placeholder: 'P10 / P25 / P50 / P75 / P90' },
          { label: 'Plan health', placeholder: 'green / yellow / red' },
        ],
        actions: ['Generate runbook (placeholder)', 'Simulate alerts (placeholder)'],
      },
      {
        title: 'Runbook Action Cards (placeholder)',
        bullets: ['Think runbook, not report. “If we hit percentile X, do this.”'],
        widgets: [
          {
            kind: 'cards',
            title: 'Percentile actions',
            cards: [
              { title: 'P10 actions', body: 'Reduce discretionary 12%, delay retirement 18 months, temporary side income target.' },
              { title: 'P50 actions', body: 'Stay course, rebalance annually, keep emergency runway.' },
              { title: 'P90 actions', body: 'Option to derisk, accelerate FI, fund mini-retirements.' },
            ],
          },
          { kind: 'chart', title: 'Track comparison', subtitle: 'Chart placeholder: P10/P50/P90 over time.' },
        ],
      },
      {
        title: 'Per-track KPIs table (placeholder)',
        widgets: [
          { kind: 'table', title: 'KPIs', columns: ['Track', 'FI range', 'Safe spend', 'Failure %', 'Savings-rate delta', 'Health'], rows: 5 },
        ],
        actions: ['Export runbook (placeholder)', 'Pin track to header (placeholder)'],
      },
    ],
  },
  {
    path: '/plan-report',
    title: 'Plan Report',
    sections: [
      {
        title: 'Executive summary (placeholder)',
        bullets: ['A report for humans: short, clear, and action-oriented.'],
        fields: [
          { label: 'Plan health', placeholder: 'green / yellow / red (placeholder)' },
          { label: 'FI date range', placeholder: 'computed' },
          { label: 'Worst-case delay', placeholder: 'computed' },
          { label: 'Main driver', placeholder: 'computed' },
        ],
        widgets: [
          { kind: 'chart', title: 'Plan trajectory', subtitle: 'Chart placeholder: baseline vs stress cases.' },
        ],
      },
      {
        title: 'Key drivers (placeholder)',
        bullets: ['Savings rate', 'Fees', 'Taxes', 'Sequence risk', 'Spending flexibility'],
        widgets: [
          { kind: 'table', title: 'Drivers ranked (placeholder)', columns: ['Driver', 'Impact', 'Confidence', 'Suggested action'], rows: 5 },
        ],
      },
      {
        title: 'Next best actions (placeholder)',
        bullets: ['Small changes with big impact (placeholder).'],
        widgets: [
          {
            kind: 'cards',
            title: 'Action cards',
            cards: [
              { title: 'Reduce fees', body: 'Lower fund fee by 0.3% could buy back months of FI time.' },
              { title: 'Increase contribution', body: 'A small monthly increase often beats risky assumptions.' },
              { title: 'Add flexibility plan', body: 'Define a downturn cut plan now, not in panic.' },
            ],
          },
        ],
        actions: ['Generate 7-day plan (placeholder)', 'Export report (placeholder)'],
      },
      {
        title: 'Assumptions snapshot (placeholder)',
        bullets: ['This should match the Assumptions Hub.'],
        widgets: [
          { kind: 'table', title: 'Assumptions', columns: ['Assumption', 'Value', 'Source', 'Last updated'], rows: 5 },
        ],
      },
      {
        title: 'Risks & mitigations (placeholder)',
        widgets: [
          { kind: 'table', title: 'Risk register', columns: ['Risk', 'Likelihood', 'Impact', 'Mitigation'], rows: 6 },
        ],
      },
    ],
  },

  // Model / Build
  {
    path: '/policy-builder',
    title: 'Policy Builder',
    sections: [
      {
        title: 'Adaptive rules',
        bullets: ['Define IF/THEN guardrails to automate behavior.'],
        fields: [
          { label: 'Rule', placeholder: 'If funded ratio < 0.9 AND percentile < 25 → cut discretionary 10%' },
          { label: 'Rule', placeholder: 'If percentile > 80 for 12 months → rebalance + increase giving' },
          { label: 'Rule', placeholder: 'If drawdown > 20% early retirement → apply guardrail withdrawals' },
        ],
        actions: ['Add rule (placeholder)', 'Validate policy (placeholder)'],
      },
      {
        title: 'Policy simulator (placeholder)',
        bullets: ['Show how rules would have triggered under different percentile tracks.'],
        actions: ['Simulate triggers (placeholder)'],
      },
    ],
  },
  {
    path: '/deposit-strategy',
    title: 'Deposit Strategy',
    sections: [
      { title: 'Strategy Header', bullets: ['Name + description', 'Preset selector (placeholder)'] },
      {
        title: 'Preset selector (placeholder)',
        fields: [
          { label: 'Preset', placeholder: 'e.g. “Steady monthly”, “Front-load”, “Step-up yearly”' },
          { label: 'Mode', placeholder: 'Normal / Lean / Aggressive / Emergency' },
        ],
        actions: ['Load preset (placeholder)'],
      },
      {
        title: 'Deposit schedule',
        fields: [
          { label: 'Base deposit amount', placeholder: 'e.g. 6,000 DKK' },
          { label: 'Frequency', placeholder: 'monthly / yearly' },
          { label: 'Start condition', placeholder: 'date/age or “until FI”' },
          { label: 'End condition', placeholder: 'date/age or “for N years”' },
          { label: 'Break periods', placeholder: 'pause intervals (placeholder)' },
        ],
      },
      {
        title: 'Step-ups / escalation',
        fields: [
          { label: 'Increase deposits', placeholder: 'none / fixed amount / % per year' },
          { label: 'Inflation adjust', placeholder: 'toggle (placeholder)' },
        ],
      },
      {
        title: 'One-off deposits',
        fields: [
          { label: 'One-time contribution', placeholder: 'date + amount + label' },
          { label: 'Irregular recurring', placeholder: 'e.g. “every March +X”' },
        ],
        actions: ['Add one-off (placeholder)'],
      },
      {
        title: 'Contribution routing (priorities)',
        bullets: ['Drag/drop priority order (placeholder).'],
        fields: [
          { label: 'Priority order', placeholder: 'buffer → debt → wrappers → taxable' },
          { label: 'Caps/targets', placeholder: 'simple numeric fields (placeholder)' },
        ],
      },
      {
        title: 'Preview',
        bullets: ['Avg monthly deposit', 'Total deposits (20y)', 'Pause months count', 'Timeline preview + chart placeholders'],
        fields: [
          { label: 'Avg monthly deposit', placeholder: 'computed' },
          { label: 'Total deposits (20y)', placeholder: 'computed' },
          { label: 'Pause months', placeholder: 'computed' },
        ],
        widgets: [
          {
            kind: 'table',
            title: 'Timeline preview (placeholder)',
            columns: ['Year', 'Planned deposits', 'One-offs', 'Mode'],
            rows: 5,
          },
          { kind: 'chart', title: 'Deposits over time', subtitle: 'Chart placeholder.' },
        ],
      },
    ],
  },
  {
    path: '/withdrawal-strategy',
    title: 'Withdrawal Strategy',
    sections: [
      { title: 'Strategy Header', bullets: ['Name + description', 'Preset selector (placeholder)'] },
      {
        title: 'Retirement timing',
        fields: [
          { label: 'Withdrawal start', placeholder: 'age/date' },
          { label: 'Horizon', placeholder: 'until age X / indefinite' },
        ],
      },
      {
        title: 'Base withdrawal rule',
        bullets: ['Pick one (placeholder).'],
        fields: [
          { label: 'Rule', placeholder: 'fixed % / fixed spending / guardrails / floor-ceiling / variable' },
          { label: 'Inflation adjust', placeholder: 'toggle (placeholder)' },
        ],
      },
      {
        title: 'Guardrails & limits',
        fields: [
          { label: 'Spending floor', placeholder: 'e.g. 18,000 DKK/mo' },
          { label: 'Spending ceiling', placeholder: 'e.g. 35,000 DKK/mo' },
          { label: 'Max cut per year', placeholder: 'e.g. 8%' },
          { label: 'Triggers', placeholder: 'drawdown / percentile (placeholder)' },
        ],
      },
      {
        title: 'Income blending',
        fields: [
          { label: 'Include pension', placeholder: 'toggle (placeholder)' },
          { label: 'Include part-time', placeholder: 'toggle (placeholder)' },
          { label: 'Include side hustle', placeholder: 'toggle (placeholder)' },
          { label: 'Income schedule', placeholder: 'from-to + monthly amount (placeholder)' },
        ],
      },
      {
        title: 'Withdrawal routing & buffer',
        fields: [
          { label: 'Routing order', placeholder: 'cash → taxable → wrappers/pension' },
          { label: 'Cash buffer target', placeholder: 'months' },
          { label: 'Refill threshold', placeholder: 'months' },
        ],
      },
      {
        title: 'Bad-year playbook',
        bullets: ['P10/P25/P50/P75/P90 action cards with editable adjustments (placeholder).'],
        actions: ['Generate action cards (placeholder)'],
      },
      {
        title: 'Preview',
        bullets: ['Timeline preview table + charts placeholders.'],
        fields: [
          { label: 'Initial withdrawal', placeholder: 'computed' },
          { label: 'Floor / ceiling band', placeholder: 'computed' },
          { label: 'Buffer months', placeholder: 'computed' },
        ],
        widgets: [
          {
            kind: 'table',
            title: 'Timeline preview (placeholder)',
            columns: ['Year', 'Spending target', 'Income', 'Withdrawals', 'Mode'],
            rows: 5,
          },
          { kind: 'chart', title: 'Withdrawals over time', subtitle: 'Chart placeholder.' },
          { kind: 'chart', title: 'Floor/Ceiling band', subtitle: 'Chart placeholder.' },
        ],
      },
    ],
  },

  // Simulation
  {
    path: '/stress-test-lab',
    title: 'Stress Test Lab',
    sections: [
      { title: 'Shock Templates', bullets: ['Bad first 5 years', 'High inflation decade', 'Job loss year', 'Flat market period', 'Big unexpected expense'] },
      { title: 'Outputs', bullets: ['Sequence-of-returns fragility (placeholder)', 'Suggested interventions (placeholder)'] },
      {
        title: 'Shock builder (placeholder)',
        fields: [
          { label: 'Template', placeholder: 'select premade shock' },
          { label: 'Severity', placeholder: 'mild / medium / severe' },
          { label: 'Duration', placeholder: 'years' },
        ],
        actions: ['Run stress test (placeholder)'],
      },
    ],
  },
  {
    path: '/model-validation-suite',
    title: 'Model Validation Suite',
    sections: [
      {
        title: 'Validation',
        bullets: ['Backtests across known historical periods (placeholder)', 'Synthetic edge cases (placeholder)'],
        actions: ['Run backtests (placeholder)', 'Run edge cases (placeholder)'],
      },
      {
        title: 'Sanity checks (placeholder)',
        bullets: ['Does increasing savings always help?', 'Do fees always delay FI?', 'Are taxes applied consistently?'],
      },
    ],
  },

  // Execute / Progress
  {
    path: '/cashflow-command-center',
    title: 'Cashflow Command Center',
    sections: [
      { title: 'Calendar View', bullets: ['Monthly cashflow with deposits + recurring expenses', 'Annual spikes (insurance, travel, subscriptions)'] },
      { title: 'Guidance', bullets: ['Forecast surplus/deficit (placeholder)', 'Spike alerts (placeholder)', 'Auto-suggest buffer size (placeholder)'] },
      { title: 'Tax Map', bullets: ['Withdrawal tax thresholds over time (placeholder)'] },
      { title: 'Next Best Krone', bullets: ['Rank buffer vs debt vs wrappers vs index vs pension (placeholder)'] },
      {
        title: 'Cashflow inputs (placeholder)',
        fields: [
          { label: 'Monthly income', placeholder: 'amount' },
          { label: 'Recurring expenses', placeholder: 'list (placeholder)' },
          { label: 'Planned deposits', placeholder: 'schedule (placeholder)' },
          { label: 'Annual spikes', placeholder: 'month + amount + label' },
        ],
        actions: ['Build calendar (placeholder)', 'Suggest buffer (placeholder)'],
      },
      {
        title: 'Calendar view (placeholder)',
        widgets: [
          {
            kind: 'calendar',
            title: 'Monthly cashflow',
            months: [
              { label: 'Jan', note: 'baseline' },
              { label: 'Feb', note: 'baseline' },
              { label: 'Mar', note: 'insurance spike (placeholder)' },
              { label: 'Apr', note: 'baseline' },
              { label: 'May', note: 'baseline' },
              { label: 'Jun', note: 'travel spike (placeholder)' },
              { label: 'Jul', note: 'baseline' },
              { label: 'Aug', note: 'baseline' },
              { label: 'Sep', note: 'subscription renewals (placeholder)' },
              { label: 'Oct', note: 'baseline' },
              { label: 'Nov', note: 'baseline' },
              { label: 'Dec', note: 'gifts spike (placeholder)' },
            ],
          },
        ],
      },
    ],
  },

  // Portfolio
  {
    path: '/portfolio',
    title: 'Portfolio',
    sections: [
      { title: 'Health Score', bullets: ['Diversification', 'Fee drag', 'Tax drag', 'Drawdown tolerance', 'Withdrawal robustness (placeholder)'] },
      { title: 'Optimizers & X-Ray', bullets: ['Tax wrapper optimizer (placeholder)', 'Exposure decomposition (placeholder)', 'Currency risk (placeholder)'] },
      { title: 'Workshops', bullets: ['Rebalancing', 'Glidepath', 'Fee forensics (placeholders)'] },
      {
        title: 'Portfolio inputs (placeholder)',
        fields: [
          { label: 'Holdings', placeholder: 'funds + weights + fees' },
          { label: 'Account types', placeholder: 'taxable / wrappers / pension' },
          { label: 'Base currency', placeholder: 'e.g. DKK' },
        ],
        actions: ['Compute health score (placeholder)', 'Run x-ray (placeholder)'],
      },
      {
        title: 'Portfolio X-Ray (placeholder)',
        widgets: [
          { kind: 'table', title: 'Exposure breakdown', columns: ['Category', 'Weight', 'Notes'], rows: 6 },
          { kind: 'chart', title: 'Fee drag vs freedom', subtitle: 'Chart placeholder: FI-delay per fee component.' },
        ],
      },
    ],
  },
  {
    path: '/sequence-risk-radar',
    title: 'Sequence Risk Radar',
    sections: [
      { title: 'Fragility View', bullets: ['Danger zones around retirement start (placeholder)', 'Runway by spending mode (placeholder)'] },
      { title: 'Bad Years', bullets: ['Worst-year return slider (placeholder)', 'Required buffer/spending cut/income boost (placeholder)'] },
      {
        title: 'Bad-year slider (placeholder)',
        fields: [
          { label: 'Worst year return', placeholder: '-X%' },
          { label: 'Inflation spike', placeholder: '+Y%' },
          { label: 'Spending mode', placeholder: 'Normal / Lean / Emergency' },
        ],
        actions: ['Compute survival plan (placeholder)'],
      },
    ],
  },

  // Reflect
  {
    path: '/decision-journal',
    title: 'Decision Journal',
    sections: [
      { title: 'Entries', bullets: ['Decision thesis (placeholder)', 'Confidence score (placeholder)', 'Future check-in date (placeholder)'] },
      { title: 'Review', bullets: ['Hindsight review (placeholder)'] },
      {
        title: 'New entry (placeholder)',
        fields: [
          { label: 'Decision', placeholder: 'what did you do?' },
          { label: 'Thesis', placeholder: 'why did you do it?', multiline: true },
          { label: 'Confidence', placeholder: '0–100' },
          { label: 'Check-in date', placeholder: 'YYYY-MM-DD' },
        ],
        actions: ['Save entry (placeholder)'],
      },
      {
        title: 'Entries (placeholder)',
        widgets: [
          { kind: 'table', title: 'Log', columns: ['Date', 'Decision', 'Confidence', 'Status'], rows: 5 },
        ],
      },
    ],
  },
  {
    path: '/decision-replay',
    title: 'Decision Replay / Postmortem',
    sections: [
      { title: 'Replay', bullets: ['Evaluate decisions vs original assumptions (placeholder)'] },
    ],
  },
  {
    path: '/happiness-tracker',
    title: 'Happiness Tracker',
    sections: [
      { title: 'Tracking', bullets: ['Simple mood + notes timeline (placeholder)'] },
    ],
  },
  {
    path: '/community-benchmarks',
    title: 'Community Benchmarks (privacy-safe)',
    sections: [
      { title: 'Cohort Compare', bullets: ['Country, age band, savings rate band, goal type (placeholder)'] },
      { title: 'Privacy', bullets: ['Anonymized aggregates only (placeholder)'] },
    ],
  },
  {
    path: '/advisor-share-portal',
    title: 'Advisor / Share Portal',
    sections: [
      { title: 'Share Mode', bullets: ['Partner/advisor read access (placeholder)', 'Permissions + comments (placeholder)'] },
      {
        title: 'Share controls (placeholder)',
        fields: [
          { label: 'Invite by email/link', placeholder: 'partner/advisor' },
          { label: 'Permissions', placeholder: 'read / comment / edit (placeholder)' },
          { label: 'Scope', placeholder: 'which scenarios/pages are shared' },
        ],
        actions: ['Create share link (placeholder)', 'Revoke access (placeholder)'],
      },
    ],
  },

  // Challenges
  {
    path: '/no-spend-challenge-arena',
    title: 'No-Spend Challenge Arena',
    sections: [
      { title: 'Sprints', bullets: ['7-day challenges (placeholder)', 'Connect to FI-date movement (placeholder)'] },
      {
        title: 'Challenge setup (placeholder)',
        fields: [
          { label: 'Duration', placeholder: '7 / 14 / 30 days' },
          { label: 'Rules', placeholder: 'allowed categories (placeholder)' },
          { label: 'Reward framing', placeholder: '“buys back X days” (placeholder)' },
        ],
        actions: ['Start challenge (placeholder)'],
      },
    ],
  },
];

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Firecasting */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/info" element={<InfoPage />} />
      <Route path="/feedback" element={<FeedbackPage />} />
      <Route path="/assumptions" element={<AssumptionsHubPage />} />
      <Route path="/security-privacy" element={<SecurityPrivacyCenterPage />} />

      {/* Existing app pages */}
      <Route path="/tutorial" element={<TutorialLandingPage />} />
      <Route path="/tutorial/:mode" element={<TutorialPage />} />
      <Route path="/diff-scenarios" element={<RunDiffPage />} />
      <Route path="/salary-after-tax" element={<SalaryAfterTaxPage />} />
      <Route path="/money-perspective" element={<MoneyPerspectivePage />} />
      <Route path="/progress-tracker" element={<ProgressTrackerPage />} />
      <Route path="/simulation" element={<SimulationPage />} />
      <Route path="/simulation/tutorial" element={<TutorialLandingPage />} />
      <Route path="/simulation/tutorial/:mode" element={<TutorialPage />} />
      <Route path="/simulation/diff" element={<RunDiffPage />} />
      <Route path="/explore" element={<ExplorePage />} />

      {/* Skeleton routes */}
      {skeletonRoutes.map((r) => (
        <Route
          key={r.path}
          path={r.path}
          element={<SkeletonPage title={r.title} subtitle={r.subtitle} sections={r.sections} />}
        />
      ))}

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRoutes;
