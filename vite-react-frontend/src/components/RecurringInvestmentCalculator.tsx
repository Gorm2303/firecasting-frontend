import React from 'react';

interface RecurringInvestmentCalculatorProps {
  monthlyExpense: number;
  years: number;
  annualReturnRate: number;
  inflationRate: number;
}

const RecurringInvestmentCalculator: React.FC<RecurringInvestmentCalculatorProps> = ({
  monthlyExpense,
  years,
  annualReturnRate,
  inflationRate
}) => {
  // Calculate future value of recurring investment
  const monthlyRate = annualReturnRate / 100 / 12;
  const totalMonths = years * 12;
  
  // Future value of a series formula for monthly contributions
  let futureValue = 0;
  if (monthlyRate > 0) {
    futureValue = monthlyExpense * (Math.pow(1 + monthlyRate, totalMonths) - 1) / monthlyRate;
  } else {
    futureValue = monthlyExpense * totalMonths; // If no return rate, just sum the contributions
  }
  
  // Calculate future value adjusted for inflation
  const futureValueAdjustedForInflation = futureValue / Math.pow(1 + inflationRate / 100, years);
  
  // Calculate total amount spent over the period
  const totalSpent = monthlyExpense * totalMonths;
  
  return (
    <div style={{ padding: '10px 0' }}>
      <div style={{ marginBottom: '8px' }}>
        <strong>Total Amount Spent:</strong> ${totalSpent.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </div>
      <div style={{ marginBottom: '8px' }}>
        <strong>Future Value of Investment:</strong> ${futureValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </div>
      <div style={{ marginBottom: '8px' }}>
        <strong>Future Value (Adjusted for Inflation):</strong> ${futureValueAdjustedForInflation.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </div>
      <div>
        <strong>Opportunity Cost:</strong> ${(futureValue - totalSpent).toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </div>
    </div>
  );
};

export default RecurringInvestmentCalculator;