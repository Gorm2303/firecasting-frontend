import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import PolicyBuilderPage from './PolicyBuilderPage';
import { AssumptionsProvider } from '../state/assumptions';

const STORAGE_KEY = 'firecasting:strategyProfiles:policyBuilder:v1';

const renderPage = () => {
  return render(
    <MemoryRouter>
      <AssumptionsProvider>
        <PolicyBuilderPage />
      </AssumptionsProvider>
    </MemoryRouter>
  );
};

describe('PolicyBuilderPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('saves a named policy profile and restores it on remount', () => {
    const first = renderPage();

    fireEvent.change(screen.getByLabelText('Policy title'), {
      target: { value: 'Capital preservation' },
    });
    fireEvent.change(screen.getByLabelText('Profile name'), {
      target: { value: 'Capital preservation profile' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save as profile/i }));

    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as {
      profiles?: Array<{ name: string; data: { title: string } }>;
    };
    expect(saved.profiles?.[0]?.name).toBe('Capital preservation profile');
    expect(saved.profiles?.[0]?.data.title).toBe('Capital preservation');

    first.unmount();
    renderPage();

    expect((screen.getByLabelText('Policy title') as HTMLInputElement).value).toBe('Capital preservation');
    expect((screen.getByLabelText('Profile name') as HTMLInputElement).value).toBe('Capital preservation profile');
  });

  it('updates the live simulator when a rule threshold changes', () => {
    renderPage();

    expect(screen.getByText(/severe stress/i)).toBeInTheDocument();
    expect(screen.getAllByText(/2 rules trigger/i).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText('Rule 1 threshold'), {
      target: { value: '99' },
    });
    fireEvent.change(screen.getByLabelText('Rule 2 threshold'), {
      target: { value: '99' },
    });

    expect(screen.getAllByText(/0 rules trigger/i)).toHaveLength(3);
    expect(screen.getAllByText(/No rules trigger\./i).length).toBeGreaterThan(0);
  });
});