import React from 'react';

type IntervalType = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'few_years';

interface RecurringInvestmentCalculatorProps {
  expenseAmount: number;
  interval: IntervalType;
  years: number;
  annualReturnRate: number;
  inflationRate: number;
  fewYearsInterval?: number; // For 'few_years' interval type
}

const RecurringInvestmentCalculator: React.FC<RecurringInvestmentCalculatorProps> = ({
  expenseAmount,
  interval,
  years,
  annualReturnRate,
  inflationRate,
  fewYearsInterval = 2
}) => {
  // Convert all intervals to monthly contributions for calculation
  let monthlyContribution = 0;
  let totalContributions = 0;
  let intervalLabel = '';

  switch (interval) {
    case 'daily':
      monthlyContribution = expenseAmount * 30; // Approximate 30 days per month
      totalContributions = expenseAmount * 365 * years; // More precise calculation
      intervalLabel = 'Daily';
      break;
    case 'weekly':
      monthlyContribution = expenseAmount * 4.33; // Approximate 4.33 weeks per month
      totalContributions = expenseAmount * 52 * years; // More precise calculation
      intervalLabel = 'Weekly';
      break;
    case 'monthly':
      monthlyContribution = expenseAmount;
      totalContributions = expenseAmount * 12 * years;
      intervalLabel = 'Monthly';
      break;
    case 'yearly':
      monthlyContribution = expenseAmount / 12;
      totalContributions = expenseAmount * years;
      intervalLabel = 'Yearly';
      break;
    case 'few_years':
      // For expenses that occur every few years
      const totalPeriods = Math.floor(years / fewYearsInterval);
      const remainingYears = years % fewYearsInterval;

      // Calculate total contributions: full periods + partial period if applicable
      totalContributions = totalPeriods * expenseAmount;
      if (remainingYears >= fewYearsInterval) {
        totalContributions += expenseAmount;
      }

      // Convert to equivalent monthly contribution for investment calculation
      monthlyContribution = totalContributions / (years * 12);
      intervalLabel = `Every ${fewYearsInterval} years`;
      break;
    default:
      monthlyContribution = expenseAmount;
      totalContributions = expenseAmount * 12 * years;
      intervalLabel = 'Monthly';
  }

  // Calculate future value of recurring investment
  const monthlyRate = annualReturnRate / 100 / 12;
  const totalMonths = years * 12;

  // Future value of a series formula for monthly contributions
  let futureValue = 0;
  if (monthlyRate > 0) {
    futureValue = monthlyContribution * (Math.pow(1 + monthlyRate, totalMonths) - 1) / monthlyRate;
  } else {
    futureValue = monthlyContribution * totalMonths; // If no return rate, just sum the contributions
  }

  // Calculate future value adjusted for inflation
  const futureValueAdjustedForInflation = futureValue / Math.pow(1 + inflationRate / 100, years);

  return (
    <div style={{ padding: '10px 0' }}>
      <div style={{ marginBottom: '8px' }}>
        <strong>Expense Interval:</strong> {intervalLabel}
      </div>
      <div style={{ marginBottom: '8px' }}>
        <strong>Total Amount Spent:</strong> ${totalContributions.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </div>
      <div style={{ marginBottom: '8px' }}>
        <strong>Future Value of Investment:</strong> ${futureValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </div>
      <div style={{ marginBottom: '8px' }}>
        <strong>Future Value (Adjusted for Inflation):</strong> ${futureValueAdjustedForInflation.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </div>
      <div>
        <strong>Opportunity Cost:</strong> ${(futureValue - totalContributions).toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </div>
    </div>
  );
};

export default RecurringInvestmentCalculator;