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
            // - Phase #1: initial deposit.
            // - Phase #2+: previous phase's last available yearly value.
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
                // Phase starts at "year 0" (calendar startYear) but only reports after 1 year.
                startAnchor = makeDepositAnchor(group.name, startYear);
              } else {
                const prev = grouped[index - 1]?.data ?? [];
                const last = prev.length ? prev.reduce((best, s) => (s.year > best.year ? s : best), prev[0]) : undefined;
                startAnchor = last;
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
