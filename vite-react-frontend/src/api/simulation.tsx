// src/api/simulation.ts
import { SimulationRequest } from '../models/types';
import { YearlySummary } from '../models/YearlySummary';
import { getApiBaseUrl } from '../config/runtimeEnv';

const BASE_URL = getApiBaseUrl();

type StartResponse = { id: string };

type ImportReplayResponse = {
  replayId: string;
  simulationId: string;
  status: string;
  note?: string;
};

export type ReplayStatusResponse = {
  replayId: string;
  status: string;
  simulationId?: string;
  exactMatch?: boolean;
  withinTolerance?: boolean;
  mismatches?: number;
  maxAbsDiff?: number;
  note?: string;
};

export async function getCompletedSummaries(simulationId: string): Promise<YearlySummary[] | null> {
  const res = await fetch(`${BASE_URL}/progress/${encodeURIComponent(simulationId)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as YearlySummary[];
}

export async function startSimulation(req: SimulationRequest): Promise<string> {
  const res = await fetch(`${BASE_URL}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(await res.text());
  const data: StartResponse = await res.json();
  if (!data?.id) throw new Error('No simulation id returned');
  return data.id;
}

export async function importRunBundle(file: File): Promise<ImportReplayResponse> {
  const fd = new FormData();
  fd.append('file', file);

  const res = await fetch(`${BASE_URL}/import`, {
    method: 'POST',
    body: fd,
  });
  if (!res.ok) throw new Error(await res.text());
  const data = (await res.json()) as ImportReplayResponse;
  if (!data?.replayId || !data?.simulationId) throw new Error('Invalid import response');
  return data;
}

export async function getReplayStatus(replayId: string): Promise<ReplayStatusResponse> {
  const res = await fetch(`${BASE_URL}/replay/${encodeURIComponent(replayId)}`, { method: 'GET' });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as ReplayStatusResponse;
}



export const exportSimulationCsv = async (simulationId?: string | null): Promise<void> => {
  const base = BASE_URL.replace(/\/+$/, '');
  const path = simulationId
    ? `${encodeURIComponent(simulationId)}/export`
    : 'export';
  const url = new URL(path, base + '/').toString();
  const res = await fetch(url, { method: 'GET' }); // ← no credentials
  if (res.status === 204) {
    throw new Error('Simulation CSV not available (backend has no cached results for this run).');
  }
  if (!res.ok) throw new Error(`Export failed: ${res.status} ${res.statusText}`);

  const blob = await res.blob();
  if (blob.size === 0) {
    throw new Error('Received an empty simulation CSV from the backend.');
  }
  const cd = res.headers.get('content-disposition') || '';
  const m = /filename\*?=(?:UTF-8''|")?([^\";]+)/i.exec(cd);
  const filename = m ? decodeURIComponent(m[1]) : 'simulation.csv';

  const dl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = dl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(dl);
};

export const exportRunBundle = async (
  simulationId: string
): Promise<void> => {
  const base = BASE_URL.replace(/\/+$/, '');
  const url = new URL(`${simulationId}/bundle`, base + '/');

  const res = await fetch(url.toString(), { method: 'GET' });
  if (!res.ok) throw new Error(`Export bundle failed: ${res.status} ${res.statusText}`);

  const blob = await res.blob();
  const cd = res.headers.get('content-disposition') || '';
  const m = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(cd);
  const fallback = `firecasting-run-${simulationId}.json`;
  const filename = m ? decodeURIComponent(m[1]) : fallback;

  const dl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = dl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(dl);
};

