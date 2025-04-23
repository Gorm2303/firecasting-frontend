import React from 'react';
import { YearlySummary } from './models/YearlySummary';
import YearlySummaryOverview from './YearlySummaryOverview';

interface MultiPhaseOverviewProps {
  data: YearlySummary[];
}

const MultiPhaseOverview: React.FC<MultiPhaseOverviewProps> = ({ data }) => {
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
    <div style={{ marginTop: '2rem' }}>
      {grouped.map((group, index) => (
        <div key={index} style={{ marginBottom: '3rem' }}>
          <h2>{group.name.charAt(0) + group.name.slice(1).toLowerCase()} - Phase #{index + 1}</h2>
          <YearlySummaryOverview data={group.data} />
        </div>
      ))}
    </div>
  );
};

export default MultiPhaseOverview;
