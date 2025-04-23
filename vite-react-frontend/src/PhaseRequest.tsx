import React, { useState } from 'react';

interface PhaseRequest {
  phaseType: string;
  durationInMonths: number;
  initialDeposit?: number;
  monthlyDeposit?: number;
  withdrawRate?: number;
}

interface SimulationRequest {
  startDate: { date: string };
  taxPercentage: number;
  returnPercentage: number;
  phases: PhaseRequest[];
}

function App() {
  // Global simulation inputs
  const [startDate, setStartDate] = useState("2025-01-01");
  const [taxPercentage, setTaxPercentage] = useState(42);
  const [returnPercentage, setReturnPercentage] = useState(0.07);

  // For phase form
  const [phaseType, setPhaseType] = useState("DEPOSIT");
  const [durationInMonths, setDurationInMonths] = useState(240);
  const [initialDeposit, setInitialDeposit] = useState(10000);
  const [monthlyDeposit, setMonthlyDeposit] = useState(10000);
  const [withdrawRate, setWithdrawRate] = useState(0.04);

  // Array to hold phases
  const [phases, setPhases] = useState<PhaseRequest[]>([]);

  // Simulation result state
  const [results, setResults] = useState<any>(null);

  // Handler for adding a phase
  const addPhase = () => {
    const newPhase: PhaseRequest = {
      phaseType,
      durationInMonths,
    };
    if (phaseType === "DEPOSIT") {
      newPhase.initialDeposit = initialDeposit;
      newPhase.monthlyDeposit = monthlyDeposit;
    } else if (phaseType === "WITHDRAW") {
      newPhase.withdrawRate = withdrawRate;
    }
    setPhases([...phases, newPhase]);
  };

  // Handler for the simulation submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const requestBody: SimulationRequest = {
      startDate: { date: startDate },
      taxPercentage,
      returnPercentage,
      phases,
    };

    try {
      const response = await fetch("http://localhost:8080/api/simulation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const text = await response.text();
        alert(`Simulation failed: ${response.status}\n${text}`);
        return;
      }
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error("Error:", error);
      alert("An error occurred while running the simulation.");
    }
  };

  // Handler for exporting CSV
  const handleExport = () => {
    // Open the export endpoint in a new tab
    window.open("http://localhost:8080/api/simulation/export", "_blank");
  };

  return (
    <div style={{ margin: "2rem" }}>
      <h1>Firecasting Simulation</h1>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: "400px" }}>
        <label>
          Start Date:
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </label>
        <label>
          Tax Percentage:
          <input
            type="number"
            step="0.01"
            value={taxPercentage}
            onChange={(e) => setTaxPercentage(parseFloat(e.target.value))}
          />
        </label>
        <label>
          Return Percentage:
          <input
            type="number"
            step="0.01"
            value={returnPercentage}
            onChange={(e) => setReturnPercentage(parseFloat(e.target.value))}
          />
        </label>
        <hr />
        <h2>Add Phase</h2>
        <label>
          Phase Type:
          <select value={phaseType} onChange={(e) => setPhaseType(e.target.value)}>
            <option value="DEPOSIT">DEPOSIT</option>
            <option value="PASSIVE">PASSIVE</option>
            <option value="WITHDRAW">WITHDRAW</option>
          </select>
        </label>
        <label>
          Duration in Months:
          <input
            type="number"
            value={durationInMonths}
            onChange={(e) => setDurationInMonths(parseInt(e.target.value))}
          />
        </label>
        {phaseType === "DEPOSIT" && (
          <>
            <label>
              Initial Deposit:
              <input
                type="number"
                value={initialDeposit}
                onChange={(e) => setInitialDeposit(parseFloat(e.target.value))}
              />
            </label>
            <label>
              Monthly Deposit:
              <input
                type="number"
                value={monthlyDeposit}
                onChange={(e) => setMonthlyDeposit(parseFloat(e.target.value))}
              />
            </label>
          </>
        )}
        {phaseType === "WITHDRAW" && (
          <label>
            Withdraw Rate:
            <input
              type="number"
              step="0.01"
              value={withdrawRate}
              onChange={(e) => setWithdrawRate(parseFloat(e.target.value))}
            />
          </label>
        )}
        <button type="button" onClick={addPhase}>
          Add Phase
        </button>
        <div>
          <h3>Phases Added</h3>
          {phases.length === 0 && <p>No phases added yet.</p>}
          {phases.map((p, idx) => (
            <div key={idx} style={{ border: "1px solid #ccc", padding: "0.5rem", marginBottom: "0.5rem" }}>
              <strong>{p.phaseType} Phase</strong> - Duration: {p.durationInMonths} months
              {p.phaseType === "DEPOSIT" && (
                <div>
                  Initial: {p.initialDeposit}, Monthly: {p.monthlyDeposit}
                </div>
              )}
              {p.phaseType === "WITHDRAW" && (
                <div>Withdraw Rate: {p.withdrawRate}</div>
              )}
            </div>
          ))}
        </div>
        <button type="submit">Run Simulation</button>
      </form>

      {results && (
        <div style={{ marginTop: "2rem" }}>
          <h2>Simulation Results</h2>
          <pre>{JSON.stringify(results, null, 2)}</pre>
          <button onClick={handleExport}>Export CSV</button>
        </div>
      )}
    </div>
  );
}

export default App;
