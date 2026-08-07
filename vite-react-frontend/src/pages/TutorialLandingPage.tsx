import React from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../components/PageLayout';
import { Button, Card } from '../components/ui';

const TutorialLandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <PageLayout variant="constrained" maxWidthPx={900}>
      <h1 className="text-center text-3xl font-extrabold">Tutor</h1>

      <div className="mt-4.5 grid gap-3">
        <Card>
          <div className="mb-1.5 text-lg font-extrabold">Normal tutorial</div>
          <div className="mb-3 opacity-90">
            Great first run: pick start date, add/edit phases, and run a simulation.
          </div>
          <Button variant="primary" onClick={() => navigate('/simulation/tutorial/normal')}>
            Start normal tutorial
          </Button>
        </Card>

        <Card>
          <div className="mb-1.5 text-lg font-extrabold">Advanced tutorial</div>
          <div className="mb-3 opacity-90">
            Dive into seeds, paths/batch size, inflation/fees, tax exemptions, and return models.
          </div>
          <Button variant="primary" onClick={() => navigate('/simulation/tutorial/advanced')}>
            Start advanced tutorial
          </Button>
        </Card>

        <div className="mt-1 flex justify-center">
          <Button variant="ghost" onClick={() => navigate('/simulation')}>
            Back to simulation
          </Button>
        </div>
      </div>
    </PageLayout>
  );
};

export default TutorialLandingPage;
