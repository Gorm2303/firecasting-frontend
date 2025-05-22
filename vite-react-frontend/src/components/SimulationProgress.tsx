import React, { useState, useEffect } from 'react';

interface SimulationProgressProps {
  simulationId: string;
  onComplete: (result: any) => void;
}

const SimulationProgress: React.FC<SimulationProgressProps> = ({ simulationId, onComplete }) => {
  const [progressMessages, setProgressMessages] = useState<string[]>([]);

  useEffect(() => {
    const eventSource = new EventSource(`http://localhost:8080/api/simulation/progress/${simulationId}`);

    var counter = 0;
    eventSource.onmessage = (event) => {
      const trimmed = event.data.trim();
      // When the backend sends the final result, we assume it begins with "[{"
      if (trimmed.startsWith('[{')) {
        try {
          const data = JSON.parse(trimmed);
          onComplete(data);
          eventSource.close();
        } catch (error) {
          console.error("Error parsing final result:", error);
          setProgressMessages((prev) => [...prev, "Error parsing final result"]);
        }
      } else {
        if (counter == 1){
            setProgressMessages([])
            counter = 0;
        }
        // Otherwise, it's a progress update message.
        setProgressMessages((prev) => [...prev, event.data]);
        counter++;
      }
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
    <div style={{ marginTop: '1rem', padding: '0.5rem', border: '1px solid #ccc', maxHeight: '150px', overflowY: 'auto' }}>
      {progressMessages.map((msg, idx) => (
        <div key={idx}>{msg}</div>
      ))}
    </div>
  );
};

export default SimulationProgress;
