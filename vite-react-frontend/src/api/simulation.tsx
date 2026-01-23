// src/api/simulation.ts
import { SimulationRequest } from '../models/types';
import { YearlySummary } from '../models/YearlySummary';
import { getApiBaseUrl } from '../config/runtimeEnv';

const BASE_URL = getApiBaseUrl();

const joinUrl = (base: string, path: string): string => {
  const b = String(base ?? '').replace(/\/+$/, '');
  const p = String(path ?? '').replace(/^\/+/, '');
  if (!b) return `/${p}`;
  return `${b}/${p}`;
};

type ApiError = {
  message?: string;
  details?: string[];
};

async function readApiError(res: Response): Promise<string> {
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    try {
      const data = (await res.json()) as ApiError;
      const msg = String(data?.message ?? `Request failed (${res.status})`);
      const details = Array.isArray(data?.details) ? data.details : [];
      if (details.length === 0) return msg;
      return [msg, ...details.map((d) => `- ${d}`)].join('\n');
    } catch {
      // fall through
    }
  }
  try {
    const text = await res.text();
    return text || `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

type StartResponse = { id: string };

export type AdvancedSimulationRequest = {
  startDate: { date: string };
  phases: SimulationRequest['phases'];
  overallTaxRule: string;
  taxPercentage: number;
  // Optional to allow clients to omit when UI sections are disabled/hidden.
  // Backend defaults to dataDrivenReturn when missing/blank.
  returnType?: string;
  seed?: number;
  returnerConfig?: {
    seed?: number;
    simpleAveragePercentage?: number;
    distribution?: {
      type?: string;
      normal?: { mean?: number; standardDeviation?: number };
      brownianMotion?: { drift?: number; volatility?: number };
      studentT?: { mu?: number; sigma?: number; nu?: number };
      regimeBased?: {
        tickMonths?: number;
        regimes?: Array<{
          distributionType?: string;
          expectedDurationMonths?: number;
          switchWeights?: { toRegime0?: number; toRegime1?: number; toRegime2?: number };
          normal?: { mean?: number; standardDeviation?: number };
          studentT?: { mu?: number; sigma?: number; nu?: number };
        }>;
      };
    };
  };
  taxExemptionConfig?: {
    exemptionCard?: { limit?: number; yearlyIncrease?: number };
    stockExemption?: { taxRate?: number; limit?: number; yearlyIncrease?: number };
  };
  // Optional to allow omitting when UI sections are disabled/hidden.
  // Backend defaults to 1.02 when missing/<=0.
  inflationFactor?: number;

  // Optional: yearly fee percent charged on capital at year-end (e.g. 0.5 = 0.5% per year).
  // Backend defaults to 0 when missing/invalid.
  yearlyFeePercentage?: number;
};

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

export type RunListItem = {
  id: string;
  createdAt?: string;
  rngSeed?: number | null;
  modelAppVersion?: string | null;
  inputHash?: string | null;
};

export type RunDiffResponse = {
  a: RunListItem;
  b: RunListItem;
  attribution?: {
    inputsChanged?: boolean;
    randomnessChanged?: boolean;
    modelVersionChanged?: boolean;
    summary?: string;
  };
  output?: {
    exactMatch?: boolean;
    withinTolerance?: boolean;
    mismatches?: number;
    maxAbsDiff?: number;
  };
};

export async function getCompletedSummaries(simulationId: string): Promise<YearlySummary[] | null> {
  const res = await fetch(`${BASE_URL}/progress/${encodeURIComponent(simulationId)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await readApiError(res));
  return (await res.json()) as YearlySummary[];
}

export async function startSimulation(req: SimulationRequest): Promise<string> {
  const res = await fetch(`${BASE_URL}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(await readApiError(res));
  const data: StartResponse = await res.json();
  if (!data?.id) throw new Error('No simulation id returned');
  return data.id;
}

export async function startAdvancedSimulation(req: AdvancedSimulationRequest): Promise<string> {
  const res = await fetch(`${BASE_URL}/start-advanced`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(await readApiError(res));
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
  if (!res.ok) throw new Error(await readApiError(res));
  const data = (await res.json()) as ImportReplayResponse;
  if (!data?.replayId || !data?.simulationId) throw new Error('Invalid import response');
  return data;
}

export async function getReplayStatus(replayId: string): Promise<ReplayStatusResponse> {
  const res = await fetch(`${BASE_URL}/replay/${encodeURIComponent(replayId)}`, { method: 'GET' });
  if (!res.ok) throw new Error(await readApiError(res));
  return (await res.json()) as ReplayStatusResponse;
}

export async function listRuns(): Promise<RunListItem[]> {
  const res = await fetch(`${BASE_URL}/runs`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return (await res.json()) as RunListItem[];
}

export async function getRunSummaries(runId: string): Promise<YearlySummary[]> {
  const res = await fetch(`${BASE_URL}/runs/${encodeURIComponent(runId)}/summaries`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (res.status === 404) throw new Error('Run not found (or not persisted).');
  if (!res.ok) throw new Error(await readApiError(res));
  return (await res.json()) as YearlySummary[];
}

export async function getRunInput(runId: string): Promise<unknown> {
  const res = await fetch(`${BASE_URL}/runs/${encodeURIComponent(runId)}/input`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (res.status === 404) throw new Error('Run input not found (or not persisted).');
  if (!res.ok) throw new Error(await readApiError(res));
  return (await res.json()) as unknown;
}

export async function diffRuns(runAId: string, runBId: string): Promise<RunDiffResponse> {
  const res = await fetch(
    `${BASE_URL}/diff/${encodeURIComponent(runAId)}/${encodeURIComponent(runBId)}`,
    { method: 'GET', headers: { Accept: 'application/json' } }
  );
  if (res.status === 404) throw new Error('One or both runs were not found (or not persisted).');
  if (!res.ok) throw new Error(await readApiError(res));
  return (await res.json()) as RunDiffResponse;
}



export const exportSimulationCsv = async (simulationId?: string | null): Promise<void> => {
  const base = BASE_URL.replace(/\/+$/, '');
  const path = simulationId
    ? `${encodeURIComponent(simulationId)}/export`
    : 'export';
  const url = joinUrl(base, path);
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
  const url = joinUrl(base, `${encodeURIComponent(simulationId)}/bundle`);

  const res = await fetch(url, { method: 'GET' });
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

