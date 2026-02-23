import React from 'react';
import PageLayout from '../components/PageLayout';
import { useNavigate } from 'react-router-dom';
import { NAV_GROUPS, type NavGroup } from '../components/AppNavDrawer';

type PreviewKind = 'chart' | 'table' | 'timeline' | 'calendar' | 'cards';

type PageMeta = {
  description: string;
  preview: { kind: PreviewKind; label: string };
};

const PAGE_META: Record<string, PageMeta> = {
  '/': {
    description: 'A map of the app: what each module does and why it exists.',
    preview: { kind: 'cards', label: 'Catalog' },
  },
  '/info': {
    description: 'Explain Firecasting’s mental model: time, optionality, and what “better” means.',
    preview: { kind: 'table', label: 'Concepts' },
  },
  '/feedback': {
    description: 'Vote on product direction (local-only now). Capture what to build next.',
    preview: { kind: 'cards', label: 'Voting cards' },
  },
  '/assumptions': {
    description: 'Single source of truth for baseline assumptions, profiles, and sensitivity previews.',
    preview: { kind: 'table', label: 'Assumption table' },
  },
  '/security-privacy': {
    description: 'Permissions, export/delete, sessions/devices, and encryption transparency (UI scaffolding).',
    preview: { kind: 'table', label: 'Audit log' },
  },
  '/salary-after-tax': {
    description: 'Translate gross salary into net cashflow and marginal effects (tax intuition builder).',
    preview: { kind: 'chart', label: 'Net vs gross' },
  },
  '/money-perspective': {
    description: 'Convert money into meaning: time, freedom, and trade-offs for purchases and lifestyle choices.',
    preview: { kind: 'chart', label: 'Perspective curve' },
  },
  '/time-accounting': {
    description: 'Turn money into life-hours. Make work + commute + recovery costs visible.',
    preview: { kind: 'chart', label: 'Life-hours ledger' },
  },
  '/fixed-vs-flexible-spending': {
    description: 'Split spending into stiff vs bendable and estimate how flexibility changes survivability.',
    preview: { kind: 'table', label: 'Split + impact' },
  },
  '/life-events-simulator': {
    description: 'Model big life events on a timeline (kids, relocation, health costs) with uncertainty ranges.',
    preview: { kind: 'timeline', label: 'Event timeline' },
  },
  '/side-hustle-lab': {
    description: 'Explore side income ideas and how they affect the plan, time budget, and risk profile.',
    preview: { kind: 'cards', label: 'Idea cards' },
  },
  '/housing-decision-studio': {
    description: 'Rent vs buy vs relocate. Compare break-even, FI impact, and opportunity cost.',
    preview: { kind: 'table', label: 'Compare outcomes' },
  },
  '/household-negotiation-board': {
    description: 'Make household trade-offs explicit: what we choose vs what we give up.',
    preview: { kind: 'table', label: 'Option compare' },
  },
  '/family-mode-planner': {
    description: 'Family setup: childcare waves, leave years, education funds, and hybrid accounts.',
    preview: { kind: 'table', label: 'Family plan' },
  },
  '/debt-freedom-optimizer': {
    description: 'Snowball/avalanche strategy modeling with FI-date and stress impacts (placeholder).',
    preview: { kind: 'table', label: 'Debt plan' },
  },
  '/emergency-buffer-optimizer': {
    description: 'Recommend buffer size and turn it into policies: refill/stop/release rules.',
    preview: { kind: 'chart', label: 'Coverage curve' },
  },
  '/insurance-risk-shield': {
    description: 'Stress scenarios for health/disability/job loss and estimate blast radius (placeholder).',
    preview: { kind: 'cards', label: 'Scenarios' },
  },
  '/scenario-library': {
    description: 'Templates and scenario variations: baseline, conservative, coast, family (placeholder).',
    preview: { kind: 'cards', label: 'Templates' },
  },
  '/fire-milestones': {
    description: 'Milestone map: buffer → coast → lean → FIRE. What unlocks next and why.',
    preview: { kind: 'cards', label: 'Milestones' },
  },
  '/confidence-funnel': {
    description: 'How interventions narrow uncertainty: contributions, fees, taxes, flexibility.',
    preview: { kind: 'chart', label: 'Funnel' },
  },
  '/goal-planner': {
    description: 'Multi-goal planning with priorities, conflict warnings, and contribution splits.',
    preview: { kind: 'table', label: 'Goals' },
  },
  '/uncertainty-tracks': {
    description: 'Parallel percentile tracks (P10..P90) + runbook actions and KPI tables.',
    preview: { kind: 'cards', label: 'Runbook' },
  },
  '/plan-report': {
    description: 'A human report: health, drivers, next actions, assumptions snapshot, risks.',
    preview: { kind: 'table', label: 'Executive summary' },
  },
  '/policy-builder': {
    description: 'Define IF/THEN guardrails so behavior is predictable under stress (placeholder).',
    preview: { kind: 'table', label: 'Policies' },
  },
  '/deposit-strategy': {
    description: 'Build deposit schedules: presets, escalation, one-offs, routing priorities.',
    preview: { kind: 'table', label: 'Deposit preview' },
  },
  '/withdrawal-strategy': {
    description: 'Withdrawal guardrails, blending income, routing and buffer policy.',
    preview: { kind: 'chart', label: 'Withdrawals' },
  },
  '/tutorial': {
    description: 'Guided onboarding to modes, assumptions, and how to use the simulator.',
    preview: { kind: 'cards', label: 'Steps' },
  },
  '/simulation': {
    description: 'Run simulations, view distributions, and iterate on inputs (core engine UI).',
    preview: { kind: 'chart', label: 'Distribution' },
  },
  '/diff-scenarios': {
    description: 'Compare scenarios and runs side-by-side, including metadata and inputs.',
    preview: { kind: 'table', label: 'Diff table' },
  },
  '/stress-test-lab': {
    description: 'Shock templates and custom stress cases, plus an actionable runbook.',
    preview: { kind: 'cards', label: 'Shocks' },
  },
  '/model-validation-suite': {
    description: 'Backtests + invariants + edge cases (placeholder UI for correctness discipline).',
    preview: { kind: 'table', label: 'Test matrix' },
  },
  '/explore': {
    description: 'Explore examples and content. A sandbox area for learn-by-poking (placeholder).',
    preview: { kind: 'cards', label: 'Explore' },
  },
  '/cashflow-command-center': {
    description: 'Operational view: calendar cashflow, spike alerts, and next-best-krone routing.',
    preview: { kind: 'calendar', label: 'Calendar' },
  },
  '/progress-tracker': {
    description: 'A compact dashboard: today’s signals, checklist, milestones, and alerts.',
    preview: { kind: 'table', label: 'Checks' },
  },
  '/portfolio': {
    description: 'Portfolio x-ray: exposures, fee drag, rebalancing plan, concentration/currency risk.',
    preview: { kind: 'table', label: 'Holdings' },
  },
  '/sequence-risk-radar': {
    description: 'Sequence risk around retirement start: danger windows and survival plans.',
    preview: { kind: 'chart', label: 'Radar' },
  },
  '/decision-journal': {
    description: 'Log decisions with thesis and confidence, then review outcomes later (local-only).',
    preview: { kind: 'table', label: 'Journal log' },
  },
  '/decision-replay': {
    description: 'Postmortems: expected vs actual, root cause, and playbook updates (placeholder).',
    preview: { kind: 'table', label: 'Replay' },
  },
  '/happiness-tracker': {
    description: 'Track mood/energy/stress and run small experiments (placeholder).',
    preview: { kind: 'chart', label: 'Timeline' },
  },
  '/community-benchmarks': {
    description: 'Privacy-safe aggregates: cohort-level percentiles only, with k-anonymity threshold.',
    preview: { kind: 'chart', label: 'Aggregates' },
  },
  '/advisor-share-portal': {
    description: 'Share selected views with partner/advisor via permissioned links (placeholder).',
    preview: { kind: 'table', label: 'Invites' },
  },
  '/no-spend-challenge-arena': {
    description: 'Run a no-spend sprint with a daily log and streak (local-only).',
    preview: { kind: 'calendar', label: 'Streak' },
  },
};

const cardStyle: React.CSSProperties = {
  background: 'var(--fc-card-bg)',
  color: 'var(--fc-card-text)',
  border: '1px solid var(--fc-card-border)',
  borderRadius: 14,
  padding: 14,
};

const miniPreviewStyle: React.CSSProperties = {
  marginTop: 10,
  border: '1px dashed var(--fc-card-border)',
  borderRadius: 12,
  background: 'var(--fc-subtle-bg)',
  padding: 10,
  minHeight: 74,
};

const MiniPreview: React.FC<{ kind: PreviewKind; label: string }> = ({ kind, label }) => {
  const header = (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
      <div style={{ fontWeight: 850 }}>{label}</div>
      <div style={{ opacity: 0.75, fontSize: 12 }}>{kind}</div>
    </div>
  );

  if (kind === 'chart') {
    return (
      <div style={miniPreviewStyle} aria-label="Mini chart preview">
        {header}
        <div style={{ height: 36, marginTop: 8, borderRadius: 10, border: '1px solid var(--fc-card-border)', opacity: 0.7 }} />
      </div>
    );
  }
  if (kind === 'timeline') {
    return (
      <div style={miniPreviewStyle} aria-label="Mini timeline preview">
        {header}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
          <div style={{ height: 10, borderRadius: 10, border: '1px solid var(--fc-card-border)', opacity: 0.65, width: '90%' }} />
          <div style={{ height: 10, borderRadius: 10, border: '1px solid var(--fc-card-border)', opacity: 0.65, width: '75%' }} />
          <div style={{ height: 10, borderRadius: 10, border: '1px solid var(--fc-card-border)', opacity: 0.65, width: '82%' }} />
        </div>
      </div>
    );
  }
  if (kind === 'calendar') {
    return (
      <div style={miniPreviewStyle} aria-label="Mini calendar preview">
        {header}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 6, marginTop: 8 }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              style={{
                height: 12,
                borderRadius: 6,
                border: '1px solid var(--fc-card-border)',
                opacity: 0.6,
              }}
            />
          ))}
        </div>
      </div>
    );
  }
  if (kind === 'cards') {
    return (
      <div style={miniPreviewStyle} aria-label="Mini cards preview">
        {header}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6, marginTop: 8 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              style={{
                height: 16,
                borderRadius: 10,
                border: '1px solid var(--fc-card-border)',
                opacity: 0.6,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  // table
  return (
    <div style={miniPreviewStyle} aria-label="Mini table preview">
      {header}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            style={{
              height: 10,
              borderRadius: 10,
              border: '1px solid var(--fc-card-border)',
              opacity: 0.6,
            }}
          />
        ))}
      </div>
    </div>
  );
};

const GroupSection: React.FC<{ group: NavGroup; onGo: (to: string) => void }> = ({ group, onGo }) => {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontWeight: 900, fontSize: 18 }}>{group.title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
        {group.items.map((it) => {
          const meta: PageMeta =
            PAGE_META[it.to] ??
            ({
              description: `${it.label} — a ${group.title.toLowerCase()} workspace (skeleton for now).`,
              preview: { kind: 'table', label: group.title },
            } satisfies PageMeta);
          const isHere = it.to === '/';
          return (
            <div key={it.to} style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ fontWeight: 900, fontSize: 16 }}>{it.label}</div>
                <div style={{ opacity: 0.75, fontSize: 12 }}>{it.to}</div>
              </div>
              <div style={{ marginTop: 6, opacity: 0.85, lineHeight: 1.35 }}>{meta.description}</div>
              <MiniPreview kind={meta.preview.kind} label={meta.preview.label} />
              <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => onGo(it.to)} disabled={isHere} style={{ opacity: isHere ? 0.65 : 1 }}>
                  {isHere ? 'You are here' : 'Open'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <PageLayout variant="constrained">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <header style={{ textAlign: 'center' }}>
          <h1 style={{ margin: 0 }}>Firecasting</h1>
          <div style={{ opacity: 0.85, marginTop: 6 }}>Own your time. Or rent your life out.</div>
          <div style={{ opacity: 0.75, marginTop: 10, fontSize: 13, lineHeight: 1.2 }}>
            Your best hours. Your best days. Yours — or theirs?
          </div>
        </header>

        <div style={cardStyle}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Start here</div>
          <div style={{ opacity: 0.85, marginTop: 6, lineHeight: 1.4 }}>
            This Home page showcases every module. Each card explains what the page is for and shows a small visual preview.
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => navigate('/simulation')}>Open simulator</button>
            <button type="button" onClick={() => navigate('/assumptions')}>Review assumptions</button>
            <button type="button" onClick={() => navigate('/plan-report')}>Open plan report</button>
          </div>
        </div>

        {NAV_GROUPS.filter((g) => g.items.length > 0).map((g) => (
          <GroupSection key={g.title} group={g} onGo={(to) => navigate(to)} />
        ))}
      </div>
    </PageLayout>
  );
};

export default LandingPage;
