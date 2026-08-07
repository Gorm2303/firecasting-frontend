import React, { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import PageLayout from '../components/PageLayout';
import { useAssumptions } from '../state/assumptions';
import { Card, Chip, PageHeader } from '../components/ui';

const asNumber = (value: unknown, fallback: number): number => {
  const next = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const fieldClass = 'w-full box-border rounded-md border border-card-border bg-card px-2.5 py-2 text-sm text-card-fg';
const HORIZON_YEARS = 25;

const HousingDecisionStudioPage: React.FC = () => {
  const { currentAssumptions } = useAssumptions();
  const [monthlyRent, setMonthlyRent] = useState(12000);
  const [homePrice, setHomePrice] = useState(3200000);
  const [downPaymentPct, setDownPaymentPct] = useState(15);
  const [mortgageRatePct, setMortgageRatePct] = useState(4);
  const [maintenancePct, setMaintenancePct] = useState(1.2);
  const [transactionCostPct, setTransactionCostPct] = useState(3);
  const [opportunityReturnPct, setOpportunityReturnPct] = useState(currentAssumptions.expectedReturnPct);

  const { chartData, breakEvenYear } = useMemo(() => {
    const downPayment = homePrice * (downPaymentPct / 100);
    const loanAmount = homePrice - downPayment;
    const transactionCost = homePrice * (transactionCostPct / 100);
    const monthlyMortgageRate = mortgageRatePct / 100 / 12;
    const nMonths = 30 * 12;
    const monthlyMortgagePayment = monthlyMortgageRate > 0
      ? (loanAmount * monthlyMortgageRate) / (1 - Math.pow(1 + monthlyMortgageRate, -nMonths))
      : loanAmount / nMonths;
    const monthlyMaintenance = (homePrice * (maintenancePct / 100)) / 12;
    const monthlyBuyingCashCost = monthlyMortgagePayment + monthlyMaintenance;
    const monthlyOpportunityRate = opportunityReturnPct / 100 / 12;
    const homeAppreciationMonthlyRate = Math.pow(1.02, 1 / 12) - 1; // rough 2%/yr appreciation

    // Buying's wealth is home equity (value minus remaining loan balance), built via amortized
    // principal payments plus appreciation. Renting's wealth is the down payment + transaction
    // costs (what buying would have spent upfront) invested from day one, plus any month where
    // renting is cheaper than buying, with that difference invested too.
    let loanBalance = loanAmount;
    let homeValue = homePrice;
    let investedPortfolio = downPayment + transactionCost;

    const rows: { year: number; buyingNetWorth: number; rentingNetWorth: number }[] = [];
    let breakEven: number | null = null;

    for (let year = 1; year <= HORIZON_YEARS; year += 1) {
      for (let m = 0; m < 12; m += 1) {
        const interestPortion = loanBalance * monthlyMortgageRate;
        const principalPortion = Math.max(0, monthlyMortgagePayment - interestPortion);
        loanBalance = Math.max(0, loanBalance - principalPortion);
        homeValue *= 1 + homeAppreciationMonthlyRate;

        const monthlyDiff = monthlyBuyingCashCost - monthlyRent;
        investedPortfolio = investedPortfolio * (1 + monthlyOpportunityRate) + Math.max(0, monthlyDiff);
      }
      const buyingNetWorth = homeValue - loanBalance;
      rows.push({ year, buyingNetWorth: Math.round(buyingNetWorth), rentingNetWorth: Math.round(investedPortfolio) });
      if (breakEven === null && buyingNetWorth >= investedPortfolio) breakEven = year;
    }

    return { chartData: rows, breakEvenYear: breakEven };
  }, [monthlyRent, homePrice, downPaymentPct, mortgageRatePct, maintenancePct, transactionCostPct, opportunityReturnPct]);

  return (
    <PageLayout variant="wide">
      <div className="mx-auto grid max-w-330 gap-4">
        <PageHeader title="Housing Decision Studio" subtitle="Rent vs buy: compare net worth over time — home equity vs an invested down payment." />

        <Card className="grid gap-3">
          <div className="font-extrabold">Inputs</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="grid gap-1 text-xs">Current rent / month<input type="number" value={monthlyRent} onChange={(e) => setMonthlyRent(Math.max(0, asNumber(e.target.value, monthlyRent)))} className={fieldClass} /></label>
            <label className="grid gap-1 text-xs">Home price<input type="number" value={homePrice} onChange={(e) => setHomePrice(Math.max(0, asNumber(e.target.value, homePrice)))} className={fieldClass} /></label>
            <label className="grid gap-1 text-xs">Down payment (%)<input type="number" value={downPaymentPct} onChange={(e) => setDownPaymentPct(Math.max(0, Math.min(100, asNumber(e.target.value, downPaymentPct))))} className={fieldClass} /></label>
            <label className="grid gap-1 text-xs">Mortgage rate (%/yr)<input type="number" value={mortgageRatePct} onChange={(e) => setMortgageRatePct(Math.max(0, asNumber(e.target.value, mortgageRatePct)))} className={fieldClass} /></label>
            <label className="grid gap-1 text-xs">Maintenance (%/yr of value)<input type="number" value={maintenancePct} onChange={(e) => setMaintenancePct(Math.max(0, asNumber(e.target.value, maintenancePct)))} className={fieldClass} /></label>
            <label className="grid gap-1 text-xs">Transaction costs (%)<input type="number" value={transactionCostPct} onChange={(e) => setTransactionCostPct(Math.max(0, asNumber(e.target.value, transactionCostPct)))} className={fieldClass} /></label>
            <label className="grid gap-1 text-xs">Opportunity cost return (%/yr)<input type="number" value={opportunityReturnPct} onChange={(e) => setOpportunityReturnPct(Math.max(0, asNumber(e.target.value, opportunityReturnPct)))} className={fieldClass} /></label>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Card>
            <div className="text-xs opacity-75">Break-even year</div>
            <div className="text-2xl font-extrabold">{breakEvenYear ?? `> ${HORIZON_YEARS}`}</div>
            {breakEvenYear && <Chip>Buying wins after this</Chip>}
          </Card>
          <Card>
            <div className="text-xs opacity-75">Net worth at year {HORIZON_YEARS} (buy → home equity)</div>
            <div className="text-2xl font-extrabold">{chartData[chartData.length - 1]?.buyingNetWorth.toLocaleString()} {currentAssumptions.currency}</div>
          </Card>
          <Card>
            <div className="text-xs opacity-75">Net worth at year {HORIZON_YEARS} (rent → invested)</div>
            <div className="text-2xl font-extrabold">{chartData[chartData.length - 1]?.rentingNetWorth.toLocaleString()} {currentAssumptions.currency}</div>
          </Card>
        </div>

        <Card>
          <div className="mb-2 font-extrabold">Net worth over time</div>
          <div style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="year" label={{ value: 'Year', position: 'insideBottomRight', offset: -6 }} />
                <YAxis width={90} tickFormatter={(v) => Math.round(v / 1000) + 'k'} />
                <Tooltip formatter={(v: number) => `${Math.round(v).toLocaleString()} ${currentAssumptions.currency}`} />
                <Line type="monotone" dataKey="buyingNetWorth" name="Buying (home equity)" stroke="#6366f1" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="rentingNetWorth" name="Renting (invested down payment + savings)" stroke="#22c55e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 text-xs opacity-70">
            "Buying" net worth is home equity: value (grown at a rough 2%/yr appreciation) minus the remaining mortgage
            balance, with real monthly amortization. "Renting" net worth is the down payment + transaction costs
            invested from day one at the opportunity-cost return rate, plus any month where renting is cheaper than
            buying, with that saved difference invested too. Simplified models — not a substitute for real tax and
            fee specifics.
          </div>
        </Card>
      </div>
    </PageLayout>
  );
};

export default HousingDecisionStudioPage;
