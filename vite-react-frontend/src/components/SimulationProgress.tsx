// src/components/SimulationProgress.tsx
import React, { useEffect, useRef, useState } from "react";
import { YearlySummary } from "../models/YearlySummary";

interface SimulationProgressProps {
  simulationId: string;
  onComplete: (result: YearlySummary[]) => void;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL;
const MAX_LINES = 300;

const SimulationProgress: React.FC<SimulationProgressProps> = ({ simulationId, onComplete }) => {
  const [lines, setLines] = useState<string[]>([]);
  const [status, setStatus] = useState<'queued' | 'running' | 'done' | 'error' | 'open'>('open');
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const url = `${API_BASE}/progress/${simulationId}`;
    const es = new EventSource(url, { withCredentials: false });

    const push = (msg: string) => {
      setLines(prev => {
        const next = [...prev, msg];
        return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
      });
      // auto-scroll
      if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
    };

    // Named events from backend
    es.addEventListener("open", (ev) => {
      setStatus('open');
      const d = (ev as MessageEvent).data ?? 'connected';
      push(`[open] ${d}`);
    });

    es.addEventListener("queued", (ev) => {
      setStatus('queued');
      const d = String((ev as MessageEvent).data ?? '');
      if (d.startsWith('position:')) {
        push(`Queued (position ${d.split(':')[1]})`);
      } else {
        push('Queued');
      }
    });

    es.addEventListener("started", () => {
      setStatus('running');
      push('Started');
    });

    es.addEventListener("heartbeat", () => {
      // keep-alive; omit log to reduce noise (uncomment to debug)
      // push('♥');
    });

    es.addEventListener("progress", (ev) => {
      setStatus('running');
      const msg = String((ev as MessageEvent).data ?? '').trim();
      if (msg) push(msg);
    });

    es.addEventListener("completed", (ev) => {
      try {
        const payload = JSON.parse(String((ev as MessageEvent).data ?? 'null')) as YearlySummary[];
        setStatus('done');
        push('Completed');
        onComplete(payload);
      } catch (e) {
        setStatus('error');
        push('Error parsing final results');
        console.error(e);
      } finally {
        es.close();
      }
    });

    // Fallback for unnamed messages (older servers)
    es.onmessage = (event) => {
      const trimmed = String(event.data ?? '').trim();
      if (!trimmed) return;
      if (trimmed.startsWith('[')) {
        try { onComplete(JSON.parse(trimmed)); } finally { es.close(); }
      } else {
        push(trimmed);
      }
    };

    es.onerror = (err) => {
      setStatus('error');
      push('SSE connection error');
      console.error('SSE error', err);
      es.close();
    };

    return () => es.close();
  }, [simulationId, onComplete]);

  return (
    <div style={{ marginTop: '1rem' }}>
      <div style={{ marginBottom: 8, fontWeight: 600 }}>
        Status: {status}
      </div>
      <div
        ref={boxRef}
        style={{
          padding: '0.5rem',
          border: '1px solid #ccc',
          maxHeight: 180,
          overflowY: 'auto',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          fontSize: '0.9rem',
          whiteSpace: 'pre-wrap',
        }}
      >
        {lines.map((l, i) => (<div key={i}>{l}</div>))}
      </div>
    </div>
  );
};

export default SimulationProgress;
