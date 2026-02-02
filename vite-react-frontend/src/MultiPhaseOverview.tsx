import React, { useEffect, useMemo, useState, useId } from 'react';
import { YearlySummary } from './models/YearlySummary';
import { SimulationTimelineContext } from './models/types';
import YearlySummaryOverview from './YearlySummaryOverview';
import { addMonthsClamped, parseIsoDateLocal, toIsoDateLocal } from './utils/phaseTimeline';
import { transformYearlyToMonthly } from './utils/transformYearlyToMonthly';

interface MultiPhaseOverviewProps {
  data: YearlySummary[];
  timeline?: SimulationTimelineContext | null;
  /** If set, sync hover/tooltip across multiple MultiPhaseOverview instances (e.g., Run A + Run B). */
  syncId?: string;
}

type CapitalView = 'nominal' | 'real';

const MultiPhaseOverview: React.FC<MultiPhaseOverviewProps> = ({ data, timeline, syncId }) => {
  const internalSyncId = useId();
  const effectiveSyncId = syncId ?? internalSyncId;
  const normalized = data.map((s) => ({ ...s, phaseName: (s.phaseName ?? '').toUpperCase() }));

  const canShowReal = useMemo(() => {
    const f = Number(timeline?.inflationFactorPerYear);
    return Number.isFinite(f) && f > 0 && Math.abs(f - 1) > 1e-12;
  }, [timeline?.inflationFactorPerYear]);

  const [capitalView, setCapitalView] = useState<CapitalView>('nominal');

  // If a bundle/run without inflation is loaded, ensure we don't get stuck in "real" view.
  useEffect(() => {
    if (!canShowReal) setCapitalView('nominal');
  }, [canShowReal]);

  // Preferred grouping: use the request phase sequence (timeline) and merge consecutive same-type phases.
  type PhaseBlock = {
    type: string;
    startOffsetMonths: number;
    endOffsetMonths: number;
    phaseNumbersLabel: string;
  };

  const blocks: PhaseBlock[] = [];
  if (timeline && timeline.phaseTypes?.length && timeline.phaseDurationsInMonths?.length) {
    const types = timeline.phaseTypes.map((t) => String(t).toUpperCase());
    const durations = timeline.phaseDurationsInMonths.map((m) => Number(m) || 0);
    const n = Math.min(types.length, durations.length);

    let offset = 0;
    let i = 0;
    while (i < n) {
      const type = types[i];
      const startI = i;
      let total = durations[i];
      i++;
      while (i < n && types[i] === type) {
        total += durations[i];
        i++;
      }
      const endI = i - 1;
      const startOffset = offset;
      const endOffset = offset + total;
      offset = endOffset;

      const phaseNumbersLabel =
        startI === endI ? `Phase #${startI + 1}` : `Phases #${startI + 1}–${endI + 1}`;
      blocks.push({ type, startOffsetMonths: startOffset, endOffsetMonths: endOffset, phaseNumbersLabel });
    }
  }

  const fallbackGrouped: { title: string; data: YearlySummary[] }[] = [];
  if (!blocks.length) {
    // Fallback: stable grouping by contiguous blocks in the returned array.
    let current: YearlySummary[] = [];
    let currentName = '';
    normalized.forEach((entry, idx) => {
      const name = entry.phaseName?.toUpperCase() ?? 'UNKNOWN';
      if (name !== currentName || current.length === 0) {
        if (current.length) fallbackGrouped.push({ title: currentName, data: current });
        currentName = name;
        current = [entry];
      } else {
        current.push(entry);
      }
      if (idx === normalized.length - 1 && current.length) {
        fallbackGrouped.push({ title: currentName, data: current });
      }
    });
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          flexWrap: 'wrap',
          margin: '6px 0 14px 0',
        }}
      >
        <span style={{ fontSize: 13, opacity: 0.85 }}>Capital view:</span>

        <button
          type="button"
          onClick={() => setCapitalView('nominal')}
          style={{
            padding: '6px 10px',
            borderRadius: 999,
            border: '1px solid #444',
            background: capitalView === 'nominal' ? '#2e2e2e' : 'transparent',
            color: '#ddd',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 650,
          }}
          aria-pressed={capitalView === 'nominal'}
        >
          Nominal
        </button>

        <button
          type="button"
          onClick={() => setCapitalView('real')}
          disabled={!canShowReal}
          title={canShowReal ? 'Show inflation-adjusted (real) capital' : 'Real view requires inflation to be enabled'}
          style={{
            padding: '6px 10px',
            borderRadius: 999,
            border: '1px solid #444',
            background: capitalView === 'real' ? '#2e2e2e' : 'transparent',
            color: '#ddd',
            cursor: canShowReal ? 'pointer' : 'not-allowed',
            fontSize: 13,
            fontWeight: 650,
            opacity: canShowReal ? 1 : 0.5,
          }}
          aria-pressed={capitalView === 'real'}
        >
          Real
        </button>

        <span style={{ fontSize: 12, opacity: 0.75 }}>
          {capitalView === 'real' ? 'Inflation-adjusted (start-date currency)' : 'As-of-that-time currency'}
        </span>
      </div>

      {blocks.length
        ? (() => {
            const start = parseIsoDateLocal(timeline!.startDate);
            if (!start) return null;

            let previousBlockLast: YearlySummary | undefined;
            let previousBlockMonthlyYearMonthIndex: Map<string, YearlySummary> | undefined;

            const toYearMonthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const toYearlyAnchorFromMonthly = (phaseName: string, year: number, from: YearlySummary): YearlySummary =>
              ({
                phaseName,
                year,
                averageCapital: from.averageCapital,
                medianCapital: from.medianCapital,
                minCapital: from.minCapital,
                maxCapital: from.maxCapital,
                stdDevCapital: from.stdDevCapital,
                cumulativeGrowthRate: from.cumulativeGrowthRate,
                quantile5: from.quantile5,
                quantile25: from.quantile25,
                quantile75: from.quantile75,
                quantile95: from.quantile95,
                var: from.var,
                cvar: from.cvar,
                negativeCapitalPercentage: from.negativeCapitalPercentage,
              }) satisfies YearlySummary;

            return blocks.map((b, blockIndex) => {
              const startDate = addMonthsClamped(start, b.startOffsetMonths);
              const endDate = addMonthsClamped(start, b.endOffsetMonths);
              const startYear = startDate.getFullYear();
              const endYear = endDate.getFullYear();
              const startMonth = startDate.getMonth() + 1;
              const startYearMonthKey = toYearMonthKey(startDate);
              const phaseStartDateIso = toIsoDateLocal(startDate);
              const phaseEndDateIso = toIsoDateLocal(endDate);

              const groupData = normalized.filter((s) => {
                if (s.phaseName !== b.type) return false;
                const y = Number(s.year);
                if (!Number.isFinite(y)) return false;
                // Include next-year (Jan) point for interpolation within the final (possibly partial) year.
                return y >= startYear && y <= endYear + 1;
              });

              groupData.sort((a, b) => a.year - b.year);

              // Decide anchor for "year 0" interpolation.
              let startAnchor: YearlySummary | undefined;
              if (blockIndex === 0 && b.type === 'DEPOSIT') {
                const dep = Number(timeline!.firstPhaseInitialDeposit);
                if (Number.isFinite(dep)) {
                  const v = dep;
                  startAnchor = {
                    phaseName: b.type,
                    year: startYear,
                    averageCapital: v,
                    medianCapital: v,
                    minCapital: v,
                    maxCapital: v,
                    stdDevCapital: 0,
                    cumulativeGrowthRate: 0,
                    quantile5: v,
                    quantile25: v,
                    quantile75: v,
                    quantile95: v,
                    var: v,
                    cvar: v,
                    negativeCapitalPercentage: 0,
                  } satisfies YearlySummary;
                }
              } else {
                const prevMonthAnchor = previousBlockMonthlyYearMonthIndex?.get(startYearMonthKey);
                if (prevMonthAnchor) {
                  startAnchor = toYearlyAnchorFromMonthly(b.type, startYear, prevMonthAnchor);
                } else {
                  startAnchor = previousBlockLast;
                }
              }

              // Update previousBlockLast for next block (use the last available year from this block's groupData).
              if (groupData.length) {
                previousBlockLast = groupData.reduce(
                  (best, s) => (s.year > best.year ? s : best),
                  groupData[0]
                );
              }

              // Precompute a monthly-anchor lookup for the next phase boundary.
              // This keeps continuity when phases start mid-year.
              if (groupData.length) {
                const monthly = transformYearlyToMonthly(groupData, {
                  getFirstYearStartMonth: () => startMonth,
                  phaseRange: { startDateIso: phaseStartDateIso, endDateIso: phaseEndDateIso },
                  startAnchor,
                });

                const idx = new Map<string, YearlySummary>();
                for (const m of monthly) {
                  // Store as YearlySummary-shaped values so we can reuse the same anchor type.
                  idx.set(m.yearMonth, {
                    phaseName: b.type,
                    year: m.year,
                    averageCapital: m.averageCapital,
                    medianCapital: m.medianCapital,
                    minCapital: m.minCapital,
                    maxCapital: m.maxCapital,
                    stdDevCapital: m.stdDevCapital,
                    cumulativeGrowthRate: m.cumulativeGrowthRate,
                    quantile5: m.quantile5,
                    quantile25: m.quantile25,
                    quantile75: m.quantile75,
                    quantile95: m.quantile95,
                    var: m.var,
                    cvar: m.cvar,
                    negativeCapitalPercentage: m.negativeCapitalPercentage,
                  } satisfies YearlySummary);
                }
                previousBlockMonthlyYearMonthIndex = idx;
              } else {
                previousBlockMonthlyYearMonthIndex = undefined;
              }

              return (
                <div key={`${b.type}-${b.startOffsetMonths}-${b.endOffsetMonths}`}>
                  <h2 style={{ textAlign: 'center' }}>
                    {b.type.charAt(0) + b.type.slice(1).toLowerCase()} – {b.phaseNumbersLabel}
                  </h2>
                  <YearlySummaryOverview
                    data={groupData}
                    syncId={effectiveSyncId}
                    simulationStartDateIso={timeline!.startDate}
                    inflationFactorPerYear={timeline!.inflationFactorPerYear}
                    capitalView={capitalView}
                    firstYearStartMonth={startMonth}
                    phaseStartDateIso={phaseStartDateIso}
                    phaseEndDateIso={phaseEndDateIso}
                    startAnchor={startAnchor}
                  />
                </div>
              );
            });
          })()
        : fallbackGrouped.map((g, idx) => (
            <div key={idx}>
              <h2 style={{ textAlign: 'center' }}>{g.title.charAt(0) + g.title.slice(1).toLowerCase()}</h2>
              <YearlySummaryOverview
                data={g.data}
                syncId={effectiveSyncId}
                simulationStartDateIso={timeline?.startDate}
                inflationFactorPerYear={timeline?.inflationFactorPerYear}
                capitalView={capitalView}
              />
            </div>
          ))}
    </div>
  );
};

export default MultiPhaseOverview;
