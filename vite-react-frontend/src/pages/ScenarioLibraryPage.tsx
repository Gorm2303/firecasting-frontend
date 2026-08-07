import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import PageLayout from '../components/PageLayout';
import { SIMULATION_TEMPLATES } from '../config/simulationTemplates';
import { deleteScenario, formatSavedScenarioLabel, listSavedScenarios, scenarioHasAssumptionsOverride } from '../config/savedScenarios';
import { Card, Chip, PageHeader } from '../components/ui';

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
};

const summarizePhases = (phases: { phaseType: string; durationInMonths?: number }[]): string =>
  phases.map((p) => `${p.phaseType} (${Math.round((p.durationInMonths ?? 0) / 12)}y)`).join(' → ');

const ScenarioLibraryPage: React.FC = () => {
  const [refreshTick, setRefreshTick] = useState(0);
  const savedScenarios = useMemo(() => listSavedScenarios(), [refreshTick]);
  const templates = useMemo(() => SIMULATION_TEMPLATES.filter((t) => t.id !== 'custom'), []);

  const onDelete = (id: string) => {
    deleteScenario(id);
    setRefreshTick((t) => t + 1);
  };

  return (
    <PageLayout variant="wide">
      <div className="mx-auto grid max-w-330 gap-4">
        <PageHeader
          title="Scenario Library"
          subtitle="Built-in templates and your saved scenarios, in one place."
          actions={<Link to="/fire-simulator" className="text-sm">Open FIRE Simulator →</Link>}
        />

        <div>
          <div className="mb-2 text-lg font-extrabold">Public templates</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => (
              <Card key={t.id} className="grid gap-2">
                <div className="font-bold">{t.label}</div>
                <div className="text-sm opacity-80">{t.description}</div>
                {t.patch?.phases && (
                  <div className="text-xs opacity-70">{summarizePhases(t.patch.phases as any)}</div>
                )}
                <div className="mt-1">
                  <Link to="/fire-simulator" className="text-sm">Open in simulator →</Link>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-lg font-extrabold">Your saved scenarios</div>
            <Chip>{savedScenarios.length} saved</Chip>
          </div>

          {savedScenarios.length === 0 ? (
            <Card>
              <div className="opacity-80">
                No saved scenarios yet. Save one from the FIRE Simulator or Legacy Simulator page, and it will show up
                here.
              </div>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {savedScenarios.map((s) => (
                <Card key={s.id} className="grid gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-bold">{formatSavedScenarioLabel(s)}</div>
                    {scenarioHasAssumptionsOverride(s) && <Chip>overrides</Chip>}
                  </div>
                  <div className="text-xs opacity-70">Saved {formatDate(s.savedAt)}</div>
                  {s.advancedRequest?.phases && (
                    <div className="text-xs opacity-70">{summarizePhases(s.advancedRequest.phases as any)}</div>
                  )}
                  {s.lastRunMeta?.id && (
                    <div className="text-xs opacity-70">Last run: {s.lastRunMeta.id.slice(0, 8)}…</div>
                  )}
                  <div className="mt-1 flex flex-wrap gap-2">
                    <Link to="/fire-simulator" className="text-sm">Open simulator →</Link>
                    <button type="button" onClick={() => onDelete(s.id)} className="text-sm text-danger hover:underline">
                      Delete
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
};

export default ScenarioLibraryPage;
