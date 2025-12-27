import React, { useState } from 'react';
import InvestmentCalculator from '../components/InvestmentCalculator';
import RecurringInvestmentCalculator from '../components/RecurringInvestmentCalculator';
import TimeToWorkCalculator from '../components/TimeToWorkCalculator';

type IntervalType = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'few_years';

const InvestmentCalculatorPage: React.FC = () => {
  // One-time expense state
  const [oneTimeExpense, setOneTimeExpense] = useState<number>(100000);
  const [years, setYears] = useState<number>(30);
  const [annualReturnRate, setAnnualReturnRate] = useState<number>(7);
  const [inflationRate, setInflationRate] = useState<number>(2.5);

  // Recurring expense state with interval support
  const [recurringExpense, setRecurringExpense] = useState<number>(100);
  const [interval, setInterval] = useState<IntervalType>('monthly');
  const [fewYearsInterval, setFewYearsInterval] = useState<number>(2);

  // Time to work state
  const [hourlyWage, setHourlyWage] = useState<number>(50);

  return (
    <div style={{ minHeight: '100vh', padding: 16, maxWidth: 980, margin: '0 auto' }}>
      <h1>Investment Opportunity Calculator</h1>
      <p>Calculate how much your expenses would be worth if you invested them instead.</p>

      <div style={{ marginBottom: '20px' }}>
        <h2>One-Time Expense Calculator</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' }}>
          <div>
            <label>Expense Amount: $</label>
            <input
              type="number"
              value={oneTimeExpense}
              onChange={(e) => setOneTimeExpense(Number(e.target.value))}
              style={{ marginLeft: '5px', padding: '5px' }}
            />
          </div>

          <div>
            <label>Years: </label>
            <input
              type="number"
              value={years}
              onChange={(e) => setYears(Number(e.target.value))}
              style={{ marginLeft: '5px', padding: '5px' }}
            />
          </div>

          <div>
            <label>Annual Return Rate (%): </label>
            <input
              type="number"
              step="0.1"
              value={annualReturnRate}
              onChange={(e) => setAnnualReturnRate(Number(e.target.value))}
              style={{ marginLeft: '5px', padding: '5px' }}
            />
          </div>

          <div>
            <label>Inflation Rate (%): </label>
            <input
              type="number"
              step="0.1"
              value={inflationRate}
              onChange={(e) => setInflationRate(Number(e.target.value))}
              style={{ marginLeft: '5px', padding: '5px' }}
            />
          </div>
        </div>

        <InvestmentCalculator
          expenseAmount={oneTimeExpense}
          years={years}
          annualReturnRate={annualReturnRate}
          inflationRate={inflationRate}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h2>Recurring Expense Calculator</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' }}>
          <div>
            <label>Expense Amount: $</label>
            <input
              type="number"
              value={recurringExpense}
              onChange={(e) => setRecurringExpense(Number(e.target.value))}
              style={{ marginLeft: '5px', padding: '5px' }}
            />
          </div>

          <div>
            <label>Expense Interval: </label>
            <select
              value={interval}
              onChange={(e) => setInterval(e.target.value as IntervalType)}
              style={{ marginLeft: '5px', padding: '5px' }}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="few_years">Every Few Years</option>
            </select>
          </div>

          {interval === 'few_years' && (
            <div>
              <label>Interval (years): </label>
              <input
                type="number"
                value={fewYearsInterval}
                onChange={(e) => setFewYearsInterval(Number(e.target.value))}
                style={{ marginLeft: '5px', padding: '5px' }}
                min="2"
              />
            </div>
          )}

          <div>
            <label>Years: </label>
            <input
              type="number"
              value={years}
              onChange={(e) => setYears(Number(e.target.value))}
              style={{ marginLeft: '5px', padding: '5px' }}
            />
          </div>

          <div>
            <label>Annual Return Rate (%): </label>
            <input
              type="number"
              step="0.1"
              value={annualReturnRate}
              onChange={(e) => setAnnualReturnRate(Number(e.target.value))}
              style={{ marginLeft: '5px', padding: '5px' }}
            />
          </div>

          <div>
            <label>Inflation Rate (%): </label>
            <input
              type="number"
              step="0.1"
              value={inflationRate}
              onChange={(e) => setInflationRate(Number(e.target.value))}
              style={{ marginLeft: '5px', padding: '5px' }}
            />
          </div>
        </div>

        <RecurringInvestmentCalculator
          expenseAmount={recurringExpense}
          interval={interval}
          years={years}
          annualReturnRate={annualReturnRate}
          inflationRate={inflationRate}
          fewYearsInterval={fewYearsInterval}
        />
      </div>

      <div>
        <h2>Time to Work Calculator</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' }}>
          <div>
            <label>Expense Amount: $</label>
            <input
              type="number"
              value={oneTimeExpense}
              onChange={(e) => setOneTimeExpense(Number(e.target.value))}
              style={{ marginLeft: '5px', padding: '5px' }}
            />
          </div>

          <div>
            <label>Hourly Wage: $</label>
            <input
              type="number"
              step="0.01"
              value={hourlyWage}
              onChange={(e) => setHourlyWage(Number(e.target.value))}
              style={{ marginLeft: '5px', padding: '5px' }}
            />
          </div>

          <div>
            <label>Years: </label>
            <input
              type="number"
              value={years}
              onChange={(e) => setYears(Number(e.target.value))}
              style={{ marginLeft: '5px', padding: '5px' }}
            />
          </div>

          <div>
            <label>Annual Return Rate (%): </label>
            <input
              type="number"
              step="0.1"
              value={annualReturnRate}
              onChange={(e) => setAnnualReturnRate(Number(e.target.value))}
              style={{ marginLeft: '5px', padding: '5px' }}
            />
          </div>
        </div>

        <TimeToWorkCalculator
          expenseAmount={oneTimeExpense}
          hourlyWage={hourlyWage}
          annualReturnRate={annualReturnRate}
          years={years}
        />
      </div>
    </div>
  );
};

export default InvestmentCalculatorPage;