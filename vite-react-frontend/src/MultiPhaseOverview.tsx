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
            // - Phase #1: use initial deposit
            // - Phase #2+: use previous phase's previous calendar year summary if available
            let startAnchor: YearlySummary | undefined;
            if (timeline && startDate) {
              if (index === 0) {
                const dep = Number(timeline.firstPhaseInitialDeposit);
                if (Number.isFinite(dep)) {
                  startAnchor = {
                    phaseName: group.name,
                    year: startDate.getFullYear() - 1,
                    averageCapital: dep,
                    medianCapital: dep,
                    minCapital: dep,
                    maxCapital: dep,
                    stdDevCapital: 0,
                    cumulativeGrowthRate: 0,
                    quantile5: dep,
                    quantile25: dep,
                    quantile75: dep,
                    quantile95: dep,
                    var: dep,
                    cvar: dep,
                    negativeCapitalPercentage: 0,
                  };
                }
              } else {
                const prev = grouped[index - 1]?.data;
                const prevYear = startDate.getFullYear() - 1;
                const match = prev?.find((s) => s.year === prevYear);
                const fallback = prev && prev.length ? prev[prev.length - 1] : undefined;
                startAnchor = match ?? fallback;
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
