import React, { useState } from 'react';
import { YearlySummary } from './models/YearlySummary';
import ExportStatisticsButton from './components/ExportStatisticsButton';
import SimulationProgress from './SimulationProgress';

export interface PhaseRequest {
  phaseType: string; // "DEPOSIT", "PASSIVE", "WITHDRAW"
  durationInMonths: number;
  initialDeposit?: number;
  monthlyDeposit?: number;
  withdrawRate?: number;
}

export interface SimulationRequest {
  startDate: { date: string };
  taxPercentage: number;
  returnPercentage: number;
  phases: PhaseRequest[];
}

interface InputFormProps {
  onSimulationComplete: (stats: any[]) => void;
}

const InputForm: React.FC<InputFormProps> = ({ onSimulationComplete }) => {
  // Global simulation inputs
  const [startDate, setStartDate] = useState("2025-01-01");
  const [taxPercentage, setTaxPercentage] = useState(42);
  const [returnPercentage, setReturnPercentage] = useState(0.07);

  // For the phase form
  const [phaseType, setPhaseType] = useState("DEPOSIT");
  const [durationInMonths, setDurationInMonths] = useState(240);
  const [initialDeposit, setInitialDeposit] = useState(10000);
  const [monthlyDeposit, setMonthlyDeposit] = useState(10000);
  const [withdrawRate, setWithdrawRate] = useState(0.04);

  // Array to hold the phases
  const [phases, setPhases] = useState<PhaseRequest[]>([]);
  const [stats, setStats] = useState<YearlySummary[] | null>(null);
  const [simulateInProgress, setSimulateInProgress] = useState(false);
  const [simulationId, setSimulationId] = useState<string | null>(null);

  // Handler to add a phase to the phases array
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSimulateInProgress(true);
  
    const requestBody: SimulationRequest = {
      startDate: { date: startDate },
      taxPercentage,
      returnPercentage,
      phases,
    };
  
    try {
      // Use the new endpoint to start the simulation.
      const response = await fetch("http://localhost:8080/api/simulation/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
  
      if (!response.ok) {
        const text = await response.text();
        alert(`Simulation failed: ${response.status}\n${text}`);
        setSimulateInProgress(false);
        return;
      }
  
      // Get simulationId as plain text
      const simulationIdText = await response.text();
      setSimulationId(simulationIdText);
    } catch (error) {
      console.error("Error:", error);
      alert("An error occurred while running the simulation.");
      setSimulateInProgress(false);
    }
  };
  
  // Handler for CSV export (kept as is)
  const handleExport = () => {
    window.open("http://localhost:8080/api/simulation/export", "_blank");
  };
  
  return (
    <div>
      <h1>Firecasting Simulation</h1>
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: "400px" }}
      >
        <label>
          Start Date:
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
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
        <button type="button" onClick={addPhase}>Add Phase</button>
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
        {simulateInProgress && simulationId && (
          <SimulationProgress
            simulationId={simulationId}
            onComplete={(result) => {
              setStats(result);
              onSimulationComplete(result);
              setSimulateInProgress(false);
              setSimulationId(null);
            }}
          />
        )}

        <button type="button" onClick={handleExport}>Export Simulation CSV</button>
        {stats && <ExportStatisticsButton data={stats} />}
      </form>
    </div>
  );
};

export default InputForm;
