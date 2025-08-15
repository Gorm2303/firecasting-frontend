// src/components/SimulationProgress.tsx
import React, { useEffect, useRef, useState } from "react";
interface SimulationProgressProps {
  simulationId: string;
  onComplete: (result: any) => void;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL; // e.g. https://api.local.test/api/simulation

const SimulationProgress: React.FC<SimulationProgressProps> = ({ simulationId, onComplete }) => {
  const [progressMessages, setProgressMessages] = useState<string[]>([]);
  const clearCounter = useRef(0);

  useEffect(() => {
    // Build SSE URL from the same base as your POST
    const url = `${API_BASE}/progress/${simulationId}`;

    // If you don’t use cookies/Authorization headers, keep withCredentials=false
    const eventSource = new EventSource(url, { withCredentials: false });

    eventSource.onmessage = (event) => {
      const trimmed = (event.data ?? "").trim();

      // Backend ends by sending the final array (JSON) once
      if (trimmed.startsWith("[{")) {
        try {
          const data = JSON.parse(trimmed);
          onComplete(data);
        } catch (e) {
          console.error("Error parsing final result:", e);
          setProgressMessages((prev) => [...prev, "Error parsing final result"]);
        } finally {
          eventSource.close();
        }
        return;
      }

      // Otherwise treat as progress text lines
      if (clearCounter.current === 1) {
        setProgressMessages([]);
        clearCounter.current = 0;
      }
      setProgressMessages((prev) => [...prev, trimmed]);
      clearCounter.current += 1;
    };

    eventSource.onerror = (err) => {
      console.error("SSE error:", err);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [simulationId, onComplete]);

  return (
    <div style={{ marginTop: "1rem", padding: "0.5rem", border: "1px solid #ccc", maxHeight: 150, overflowY: "auto" }}>
      {progressMessages.map((msg, idx) => (
        <div key={idx}>{msg}</div>
      ))}
    </div>
  );
};

export default SimulationProgress;
