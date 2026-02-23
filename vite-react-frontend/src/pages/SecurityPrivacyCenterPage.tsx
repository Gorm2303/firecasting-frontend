import React from 'react';
import SkeletonPage from './skeleton/SkeletonPage';

const SecurityPrivacyCenterPage: React.FC = () => {
  return (
    <SkeletonPage
      title="Security & Privacy Center"
      sections={[
        {
          title: 'Data permissions',
          bullets: [
            'What the app can access (placeholder).',
            'Granular toggles + audit log (placeholder).',
            'No backend calls here yet — this is UI scaffolding only.',
          ],
          fields: [
            { label: 'Analytics sharing', placeholder: 'off / on (placeholder)' },
            { label: 'Crash reports', placeholder: 'off / on (placeholder)' },
            { label: 'Personalization', placeholder: 'off / on (placeholder)' },
            { label: 'Partner sharing', placeholder: 'off / on (placeholder)' },
          ],
          actions: ['Review permissions (placeholder)', 'Save settings (placeholder)'],
          widgets: [
            {
              kind: 'cards',
              title: 'Permission categories',
              cards: [
                { title: 'Core functionality', body: 'Scenario inputs, plan outputs, and local preferences.' },
                { title: 'Optional telemetry', body: 'Aggregated diagnostics to improve stability.' },
                { title: 'Sharing', body: 'Only enabled if you intentionally share a link or partner access.' },
              ],
            },
          ],
        },
        {
          title: 'Export / Delete',
          bullets: ['Export your data (placeholder).', 'Delete account and/or specific datasets (placeholder).'],
          fields: [
            { label: 'Export format', placeholder: 'JSON / CSV / “Full bundle” (placeholder)' },
            { label: 'Include', placeholder: 'assumptions, scenarios, journal, reports… (placeholder)' },
            { label: 'Delete scope', placeholder: 'one dataset / everything (placeholder)' },
          ],
          actions: ['Generate export (placeholder)', 'Delete selected (placeholder)', 'Delete everything (placeholder)'],
          widgets: [
            {
              kind: 'table',
              title: 'Datasets (placeholder)',
              columns: ['Dataset', 'Size', 'Last updated', 'Action'],
              rows: 6,
            },
          ],
        },
        {
          title: 'Session / Device history',
          bullets: ['Active sessions list (placeholder).', 'Device list + revoke access (placeholder).'],
          actions: ['Sign out other sessions (placeholder)', 'Revoke device (placeholder)'],
          widgets: [
            {
              kind: 'table',
              title: 'Active sessions',
              columns: ['Session', 'Created', 'Last active', 'IP/Location', 'Action'],
              rows: 4,
            },
            {
              kind: 'table',
              title: 'Known devices',
              columns: ['Device', 'First seen', 'Last seen', 'Trust level', 'Action'],
              rows: 4,
            },
          ],
        },
        {
          title: 'Encryption transparency',
          bullets: ['What is encrypted at rest/in transit (placeholder).', 'Key handling and retention (placeholder).'],
          fields: [
            { label: 'Transport security', placeholder: 'TLS (placeholder)' },
            { label: 'At-rest encryption', placeholder: 'Yes/No + details (placeholder)' },
            { label: 'Secrets handling', placeholder: 'Key rotation / vaulting (placeholder)' },
            { label: 'Data retention', placeholder: 'policy (placeholder)' },
          ],
          widgets: [
            {
              kind: 'cards',
              title: 'Plain-English commitments (placeholder)',
              cards: [
                { title: 'Minimize collection', body: 'Collect only what’s needed for the features you use.' },
                { title: 'Transparency', body: 'Explain what is stored, where, and for how long.' },
                { title: 'User control', body: 'Export and deletion are first-class actions.' },
              ],
            },
          ],
        },
        {
          title: 'Audit log (placeholder)',
          bullets: ['A human-readable log of security/privacy-relevant events.'],
          widgets: [
            {
              kind: 'table',
              title: 'Recent events',
              columns: ['Time', 'Event', 'Actor', 'Result'],
              rows: 6,
            },
          ],
        },
      ]}
    />
  );
};

export default SecurityPrivacyCenterPage;
