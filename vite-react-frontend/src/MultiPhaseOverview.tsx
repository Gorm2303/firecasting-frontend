import React from 'react';
import { YearlySummary } from './models/YearlySummary';
import { SimulationTimelineContext } from './models/types';
import YearlySummaryOverview from './YearlySummaryOverview';
import { getPhaseEndDate, getPhaseStartDate, getPhaseStartMonth, toIsoDateLocal } from './utils/phaseTimeline';

interface MultiPhaseOverviewProps {
  data: YearlySummary[];
  timeline?: SimulationTimelineContext | null;
}

const MultiPhaseOverview: React.FC<MultiPhaseOverviewProps> = ({ data, timeline }) => {
  // Group entries by contiguous phaseName blocks
  const grouped: { name: string; data: YearlySummary[] }[] = [];

  let currentGroup: YearlySummary[] = [];
  let currentPhase = '';

  data.forEach((entry, idx) => {
    const normalizedName = entry.phaseName?.toUpperCase() ?? 'UNKNOWN';

    if (normalizedName !== currentPhase || currentGroup.length === 0) {
      if (currentGroup.length > 0) {
        grouped.push({ name: currentPhase, data: currentGroup });
      }
      currentPhase = normalizedName;
      currentGroup = [entry];
    } else {
      currentGroup.push(entry);
    }

    // push final group
    if (idx === data.length - 1 && currentGroup.length > 0) {
      grouped.push({ name: currentPhase, data: currentGroup });
    }
  });

  return (
    <div>
      {grouped.map((group, index) => (
        <div key={index}>
          <h2 style={{ textAlign: 'center' }}>
            {group.name.charAt(0) + group.name.slice(1).toLowerCase()} – Phase #{index + 1}
          </h2>
          {(() => {
            const startMonth =
              timeline
                ? getPhaseStartMonth(timeline.startDate, timeline.phaseDurationsInMonths, index) ?? undefined
                : undefined;

            const startDate =
              timeline
                ? getPhaseStartDate(timeline.startDate, timeline.phaseDurationsInMonths, index)
                : null;
            const endDate =
              timeline
                ? getPhaseEndDate(timeline.startDate, timeline.phaseDurationsInMonths, index)
                : null;

            // Start anchor for the first partial year:
            // - Prefer the previous calendar year (startYear-1) value.
            // - If unavailable, use the closest available year <= startYear from previous phase.
            // - Phase #1 uses initial deposit.
            let startAnchor: YearlySummary | undefined;
            if (timeline && startDate) {
              const startYear = startDate.getFullYear();
              const makeDepositAnchor = (phaseName: string, anchorYear: number) => {
                const dep = Number(timeline.firstPhaseInitialDeposit);
                if (!Number.isFinite(dep)) return undefined;
                const v = dep;
                return {
                  phaseName,
                  year: anchorYear,
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
              };

              if (index === 0) {
                startAnchor = makeDepositAnchor(group.name, startYear - 1);
              } else {
                const prev = grouped[index - 1]?.data ?? [];
                const prevYearWanted = startYear - 1;
                const exactPrevYear = prev.find((s) => s.year === prevYearWanted);
                if (exactPrevYear) {
                  startAnchor = exactPrevYear;
                } else {
                  // closest year <= startYear
                  const closest = prev
                    .filter((s) => s.year <= startYear)
                    .sort((a, b) => b.year - a.year)[0];
                  startAnchor = closest ?? makeDepositAnchor(group.name, prevYearWanted);
                }
              }
            }

            return (
              <YearlySummaryOverview
                data={group.data}
                firstYearStartMonth={startMonth}
                phaseStartDateIso={startDate ? toIsoDateLocal(startDate) : undefined}
                phaseEndDateIso={endDate ? toIsoDateLocal(endDate) : undefined}
                startAnchor={startAnchor}
              />
            );
          })()}
        </div>
      ))}
    </div>
  );
};

export default MultiPhaseOverview;
