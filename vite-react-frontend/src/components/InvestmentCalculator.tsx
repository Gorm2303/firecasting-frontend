import React, { useState, useEffect } from 'react';

interface InvestmentCalculatorProps {
  expenseAmount: number;
  years: number;
  annualReturnRate: number;
  inflationRate: number;
}

const InvestmentCalculator: React.FC<InvestmentCalculatorProps> = ({
  expenseAmount,
  years,
  annualReturnRate,
  inflationRate
}) => {
  // Calculate future value of the investment
  const futureValue = expenseAmount * Math.pow(1 + annualReturnRate / 100, years);
  
  // Calculate future value adjusted for inflation
  const futureValueAdjustedForInflation = futureValue / Math.pow(1 + inflationRate / 100, years);
  
  // Calculate purchasing power (how much the future amount would be worth in today's money)
  const purchasingPower = futureValue / Math.pow(1 + inflationRate / 100, years);
  
  return (
    <div style={{ padding: '10px 0' }}>
      <div style={{ marginBottom: '8px' }}>
        <strong>Future Value of Investment:</strong> ${futureValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </div>
      <div style={{ marginBottom: '8px' }}>
        <strong>Future Value (Adjusted for Inflation):</strong> ${futureValueAdjustedForInflation.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </div>
      <div>
        <strong>Purchasing Power:</strong> ${purchasingPower.toLocaleString(undefined, { maximumFractionDigits: 2 })} (in today's money)
      </div>
    </div>
  );
};

export default InvestmentCalculator;