import React, { useMemo, useState } from 'react';

import PageLayout from '../components/PageLayout';
import { Button, Card, Chip, PageHeader } from '../components/ui';

const APP_PREFIX = 'firecasting:';

type StoredKey = { key: string; bytes: number };

const listStoredKeys = (): StoredKey[] => {
  if (typeof window === 'undefined') return [];
  const out: StoredKey[] = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (!key || !key.startsWith(APP_PREFIX)) continue;
    const value = window.localStorage.getItem(key) ?? '';
    out.push({ key, bytes: new Blob([value]).size });
  }
  return out.sort((a, b) => b.bytes - a.bytes);
};

const formatBytes = (bytes: number): string => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`);

const SecurityPrivacyCenterPage: React.FC = () => {
  const [refreshTick, setRefreshTick] = useState(0);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [status, setStatus] = useState('');

  const storedKeys = useMemo(() => listStoredKeys(), [refreshTick]);
  const totalBytes = storedKeys.reduce((sum, k) => sum + k.bytes, 0);

  const exportAll = () => {
    const bundle: Record<string, unknown> = {};
    storedKeys.forEach(({ key }) => {
      const raw = window.localStorage.getItem(key);
      try {
        bundle[key] = raw ? JSON.parse(raw) : null;
      } catch {
        bundle[key] = raw;
      }
    });
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `firecasting-local-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus('Exported all local data to a JSON file.');
  };

  const clearAll = () => {
    storedKeys.forEach(({ key }) => window.localStorage.removeItem(key));
    setConfirmingClear(false);
    setRefreshTick((t) => t + 1);
    setStatus('Cleared all local Firecasting data from this browser.');
  };

  return (
    <PageLayout variant="wide">
      <div className="mx-auto grid max-w-330 gap-4">
        <PageHeader title="Security & Privacy Center" subtitle="What Firecasting stores, where it lives, and how to export or delete it — for real, not a mockup." />

        <Card className="grid gap-2">
          <div className="font-extrabold">How this app handles your data</div>
          <div className="text-sm opacity-85">
            Firecasting is a client-side app. Your assumptions, saved scenarios, journal entries, goals, and every
            planning tool on this site store data only in this browser's local storage — it never leaves your device
            unless you explicitly export it below. The one exception: running a simulation sends the simulation inputs
            (phases, tax rules, return assumptions) to the backend to compute results, since that calculation happens
            server-side. Nothing else is transmitted.
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Card><div className="text-xs opacity-75">Stored items</div><div className="text-2xl font-extrabold">{storedKeys.length}</div></Card>
          <Card><div className="text-xs opacity-75">Total size</div><div className="text-2xl font-extrabold">{formatBytes(totalBytes)}</div></Card>
          <Card><div className="text-xs opacity-75">Storage location</div><div className="text-lg font-extrabold">This browser only</div></Card>
        </div>

        <Card className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-extrabold">What's stored locally</div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={exportAll} disabled={storedKeys.length === 0}>Export all as JSON</Button>
              {!confirmingClear ? (
                <Button variant="secondary" onClick={() => setConfirmingClear(true)} disabled={storedKeys.length === 0}>
                  Clear all local data
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-danger">Delete all {storedKeys.length} items? This can't be undone.</span>
                  <Button variant="primary" onClick={clearAll}>Yes, delete everything</Button>
                  <Button variant="secondary" onClick={() => setConfirmingClear(false)}>Cancel</Button>
                </div>
              )}
            </div>
          </div>

          {storedKeys.length === 0 ? (
            <div className="text-sm opacity-70">No local Firecasting data found in this browser.</div>
          ) : (
            <div className="grid gap-1.5">
              {storedKeys.map((k) => (
                <div key={k.key} className="flex items-center justify-between gap-2 rounded-lg border border-card-border p-2.5 text-sm">
                  <span className="font-mono text-xs opacity-85">{k.key}</span>
                  <Chip>{formatBytes(k.bytes)}</Chip>
                </div>
              ))}
            </div>
          )}
          {status && <div className="text-xs opacity-70">{status}</div>}
        </Card>

        <Card className="text-sm opacity-80">
          There are no user accounts, sessions, or devices to manage — Firecasting doesn't have a login, so there's
          nothing server-side tied to you to show here.
        </Card>
      </div>
    </PageLayout>
  );
};

export default SecurityPrivacyCenterPage;
