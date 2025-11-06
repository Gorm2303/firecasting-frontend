// src/pages/TutorialPage.tsx
import React, { useMemo} from 'react';
import { useNavigate } from 'react-router-dom';
import NormalInputForm, { TutorialStep } from '../components/normalMode/NormalInputForm';

const TutorialPage: React.FC = () => {
  const navigate = useNavigate();

  const steps: TutorialStep[] = useMemo(() => [
    { id:'welcome', title:'Welcome', body:'We’ll build a simple simulation together.' },
    { id:'start-date', title:'Start Date', body:'Pick when your simulation begins.', selector:'[data-tour="start-date"]', placement:'bottom' },
    { id:'tax-rule',   title:'Tax Rule',   body:'Choose Capital or Notional.', selector:'[data-tour="tax-rule"]', placement:'bottom' },
    { id:'tax-percent',title:'Tax %',      body:'Enter the tax percentage.', selector:'[data-tour="tax-percent"]', placement:'bottom' },
    { id:'phase-form', title:'Add a Phase',body:'Add your first phase and keep defaults.', selector:'[data-tour="phase-form"]', placement:'top' },
    { id:'phase-list', title:'Review',     body:'Edit or remove phases here.', selector:'[data-tour="phase-list"]', placement:'bottom' },
    { id:'run',        title:'Run',        body:'Click to run and see results.', selector:'[data-tour="run"]', placement:'top' },
    { id:'done',       title:'All set!',   body:'You completed the tutorial.' },
  ], []);

  return (
    <div style={{ minHeight:'100vh', padding:16, maxWidth:1500, margin:'0 auto' }}>
      <h1 style={{ textAlign:'center' }}>Firecasting — Tutorial</h1>
      <p style={{ textAlign:'center', opacity:0.85, marginTop:0 }}>
        Learn by doing. Same components, guided steps.
      </p>

      <NormalInputForm
        tutorialSteps={steps}
        // When Exit or Finish is pressed inside the coachmarks:
        onExitTutorial={() => navigate('/simulation')}
        // Optional: if you also want to bounce back after the sim completes:
        onSimulationComplete={() => {/* stay here, or navigate('/simulation') if desired */}}
      />
    </div>
  );
};

export default TutorialPage;
