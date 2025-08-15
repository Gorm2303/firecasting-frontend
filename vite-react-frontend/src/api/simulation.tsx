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

export const exportSimulationCsv = (): void => {
  window.open(`${BASE_URL}/export`, '_blank');
};
