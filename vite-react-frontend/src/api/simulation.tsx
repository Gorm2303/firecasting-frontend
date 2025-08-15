// src/api/simulation.ts
import { SimulationRequest } from '../models/types';

const BASE_URL = `${import.meta.env.VITE_API_BASE_URL}`;

export const startSimulation = async (req: SimulationRequest): Promise<string> => {
  const res = await fetch(`${BASE_URL}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Simulation failed: ${res.status} ${text}`);
  }
  return res.text();
};

export const exportSimulationCsv = async (): Promise<void> => {
  const url = new URL('export', BASE_URL.replace(/\/+$/, '/') + '/').toString();
  const res = await fetch(url, { method: 'GET' }); // ← no credentials
  if (!res.ok) throw new Error(`Export failed: ${res.status} ${res.statusText}`);

  const blob = await res.blob();
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

