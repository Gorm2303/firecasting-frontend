import React from 'react';

interface TimeToWorkCalculatorProps {
  expenseAmount: number;
  hourlyWage: number;
  annualReturnRate: number;
  years: number;
}

const TimeToWorkCalculator: React.FC<TimeToWorkCalculatorProps> = ({
  expenseAmount,
  hourlyWage,
  annualReturnRate,
  years
}) => {
  // Calculate how many hours of work the expense represents
  const hoursOfWork = expenseAmount / hourlyWage;
  
  // Calculate future value of the expense if invested instead
  const futureValue = expenseAmount * Math.pow(1 + annualReturnRate / 100, years);
  
  // Calculate how many hours of work the future value represents
  const futureHoursOfWork = futureValue / hourlyWage;
  
  return (
    <div style={{ padding: '10px 0' }}>
      <div style={{ marginBottom: '8px' }}>
        <strong>Hours of Work for Expense:</strong> {hoursOfWork.toLocaleString(undefined, { maximumFractionDigits: 2 })} hours
      </div>
      <div style={{ marginBottom: '8px' }}>
        <strong>Future Value of Expense:</strong> ${futureValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </div>
      <div>
        <strong>Future Hours of Work:</strong> {futureHoursOfWork.toLocaleString(undefined, { maximumFractionDigits: 2 })} hours
      </div>
    </div>
  );
};

export default TimeToWorkCalculator;