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

// Safe URL join (handles missing/extra slashes)
const join = (base: string, path: string) => new URL(path, base.replace(/\/+$/, '/') + '/').toString();

export const exportSimulationCsv = async (): Promise<void> => {
  try {
    const url = join(BASE_URL, 'export'); // becomes .../api/simulation/export
    const res = await fetch(url, {
      method: 'GET',
      // include if you rely on cookies/session; remove if not needed
      credentials: 'include',
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Export failed: ${res.status} ${res.statusText} ${txt}`);
    }

    const blob = await res.blob();

    // Try to honor server filename if provided
    const cd = res.headers.get('content-disposition') || '';
    const m = /filename\*?=(?:UTF-8''|")?([^\";]+)/i.exec(cd);
    const filename = m ? decodeURIComponent(m[1]) : 'simulation.csv';

    const dlUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = dlUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(dlUrl);
  } catch (err) {
    console.error(err);
    alert('Could not export CSV. See console for details.');
  }
};
