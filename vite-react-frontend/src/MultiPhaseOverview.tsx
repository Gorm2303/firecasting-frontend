import React from 'react';
import { YearlySummary } from './models/YearlySummary';
import { SimulationTimelineContext } from './models/types';
import YearlySummaryOverview from './YearlySummaryOverview';
import { addMonthsClamped, parseIsoDateLocal, toIsoDateLocal } from './utils/phaseTimeline';

interface MultiPhaseOverviewProps {
  data: YearlySummary[];
  timeline?: SimulationTimelineContext | null;
}

const MultiPhaseOverview: React.FC<MultiPhaseOverviewProps> = ({ data, timeline }) => {
  const normalized = data.map((s) => ({ ...s, phaseName: (s.phaseName ?? '').toUpperCase() }));

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
      {blocks.length
        ? (() => {
            const start = parseIsoDateLocal(timeline!.startDate);
            if (!start) return null;

            let previousBlockLast: YearlySummary | undefined;

            return blocks.map((b, blockIndex) => {
              const startDate = addMonthsClamped(start, b.startOffsetMonths);
              const endDate = addMonthsClamped(start, b.endOffsetMonths);
              const startYear = startDate.getFullYear();
              const endYear = endDate.getFullYear();
              const startMonth = startDate.getMonth() + 1;

              const groupData = normalized.filter(
                (s) => s.phaseName === b.type && s.year >= startYear && s.year <= endYear
              );

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
                startAnchor = previousBlockLast;
              }

              // Update previousBlockLast for next block (use the last available year from this block's groupData).
              if (groupData.length) {
                previousBlockLast = groupData.reduce(
                  (best, s) => (s.year > best.year ? s : best),
                  groupData[0]
                );
              }

              return (
                <div key={`${b.type}-${b.startOffsetMonths}-${b.endOffsetMonths}`}>
                  <h2 style={{ textAlign: 'center' }}>
                    {b.type.charAt(0) + b.type.slice(1).toLowerCase()} – {b.phaseNumbersLabel}
                  </h2>
                  <YearlySummaryOverview
                    data={groupData}
                    firstYearStartMonth={startMonth}
                    phaseStartDateIso={toIsoDateLocal(startDate)}
                    phaseEndDateIso={toIsoDateLocal(endDate)}
                    startAnchor={startAnchor}
                  />
                </div>
              );
            });
          })()
        : fallbackGrouped.map((g, idx) => (
            <div key={idx}>
              <h2 style={{ textAlign: 'center' }}>{g.title.charAt(0) + g.title.slice(1).toLowerCase()}</h2>
              <YearlySummaryOverview data={g.data} />
            </div>
          ))}
    </div>
  );
};

export default MultiPhaseOverview;
