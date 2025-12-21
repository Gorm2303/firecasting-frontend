import React from 'react';
import { YearlySummary } from './models/YearlySummary';
import { SimulationTimelineContext } from './models/types';
import YearlySummaryOverview from './YearlySummaryOverview';
import { getPhaseStartMonth } from './utils/phaseTimeline';

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
          <YearlySummaryOverview
            data={group.data}
            firstYearStartMonth={
              timeline
                ? getPhaseStartMonth(timeline.startDate, timeline.phaseDurationsInMonths, index) ?? undefined
                : undefined
            }
          />
        </div>
      ))}
    </div>
  );
};

export default MultiPhaseOverview;
