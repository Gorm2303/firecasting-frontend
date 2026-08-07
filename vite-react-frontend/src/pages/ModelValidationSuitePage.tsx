import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';

import PageLayout from '../components/PageLayout';
import { useAssumptions } from '../state/assumptions';
import { Card, Chip, PageHeader } from '../components/ui';

type CheckStatus = 'pass' | 'warn' | 'fail';

type Check = {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
};

const statusChip: Record<CheckStatus, string> = { pass: 'Pass', warn: 'Warn', fail: 'Fail' };
const statusBorder: Record<CheckStatus, string> = { pass: 'border-card-border', warn: 'border-warning', fail: 'border-danger' };

const ModelValidationSuitePage: React.FC = () => {
  const { currentAssumptions: a } = useAssumptions();

  const checks = useMemo<Check[]>(() => {
    const list: Check[] = [];

    // Monotonicity-adjacent sanity: SWR shouldn't meaningfully exceed the expected return, or
    // withdrawals would systematically outpace growth even before sequence risk.
    list.push({
      id: 'swr-vs-return',
      label: 'Safe withdrawal rate vs expected return',
      status: a.safeWithdrawalPct > a.expectedReturnPct ? 'fail' : a.safeWithdrawalPct > a.expectedReturnPct - 1 ? 'warn' : 'pass',
      detail: `SWR ${a.safeWithdrawalPct}% vs expected return ${a.expectedReturnPct}%. A SWR close to or above the expected return leaves little margin for inflation and sequence risk.`,
    });

    list.push({
      id: 'fee-sanity',
      label: 'Yearly fee is in a sane range',
      status: a.yearlyFeePct > 2 ? 'fail' : a.yearlyFeePct > 1 ? 'warn' : 'pass',
      detail: `Fee assumption: ${a.yearlyFeePct}%/yr. Index fund fees are typically well under 0.5%; actively managed funds can run 1-2%+.`,
    });

    list.push({
      id: 'inflation-sanity',
      label: 'Inflation assumption is in a sane range',
      status: a.inflationPct < 0 || a.inflationPct > 8 ? 'fail' : a.inflationPct > 5 ? 'warn' : 'pass',
      detail: `Inflation assumption: ${a.inflationPct}%/yr. Long-run developed-market inflation has typically run 1.5-3.5%.`,
    });

    list.push({
      id: 'buffer-sanity',
      label: 'Emergency buffer target is reasonable',
      status: a.depositStrategyDefaults.emergencyBufferTargetMonths < 1 ? 'warn' : a.depositStrategyDefaults.emergencyBufferTargetMonths > 24 ? 'warn' : 'pass',
      detail: `Buffer target: ${a.depositStrategyDefaults.emergencyBufferTargetMonths} months. Common guidance is 3-12 months depending on income stability.`,
    });

    list.push({
      id: 'withdrawal-band-sanity',
      label: 'Withdrawal guardrail band is coherent',
      status: a.withdrawalStrategyDefaults.guardrailFloorPct >= a.withdrawalStrategyDefaults.guardrailCeilingPct ? 'fail' : 'pass',
      detail: `Guardrail floor ${a.withdrawalStrategyDefaults.guardrailFloorPct}% vs ceiling ${a.withdrawalStrategyDefaults.guardrailCeilingPct}%. The floor should sit below the ceiling for the band to be meaningful.`,
    });

    list.push({
      id: 'policy-thresholds',
      label: 'Policy Builder warning/critical thresholds are ordered correctly',
      status: a.policyBuilderDefaults.warnFailureRiskPct >= a.policyBuilderDefaults.criticalFailureRiskPct ? 'fail' : 'pass',
      detail: `Warn threshold ${a.policyBuilderDefaults.warnFailureRiskPct}% vs critical threshold ${a.policyBuilderDefaults.criticalFailureRiskPct}%. Warn should trigger before critical.`,
    });

    return list;
  }, [a]);

  const failCount = checks.filter((c) => c.status === 'fail').length;
  const warnCount = checks.filter((c) => c.status === 'warn').length;

  return (
    <PageLayout variant="wide">
      <div className="mx-auto grid max-w-330 gap-4">
        <PageHeader title="Model Validation Suite" subtitle="Client-side sanity checks against your current assumptions — not a backtest, a coherence check." />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Card><div className="text-xs opacity-75">Checks passing</div><div className="text-2xl font-extrabold">{checks.length - failCount - warnCount}/{checks.length}</div></Card>
          <Card><div className="text-xs opacity-75">Warnings</div><div className="text-2xl font-extrabold">{warnCount}</div></Card>
          <Card><div className="text-xs opacity-75">Failures</div><div className="text-2xl font-extrabold">{failCount}</div></Card>
        </div>

        <Card className="grid gap-2.5">
          <div className="font-extrabold">Assumption coherence checks</div>
          {checks.map((c) => (
            <div key={c.id} className={`grid gap-1 rounded-lg border p-3 ${statusBorder[c.status]}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="font-bold">{c.label}</div>
                <Chip>{statusChip[c.status]}</Chip>
              </div>
              <div className="text-sm opacity-80">{c.detail}</div>
            </div>
          ))}
        </Card>

        <Card className="text-sm opacity-80">
          These are input-coherence checks, not statistical backtests — they catch contradictory or implausible
          assumption combinations before you run a simulation. Adjust values in the{' '}
          <Link to="/assumptions" className="underline">
            Assumptions Hub
          </Link>
          .
        </Card>
      </div>
    </PageLayout>
  );
};

export default ModelValidationSuitePage;
