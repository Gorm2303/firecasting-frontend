import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import SimulationForm from './NormalInputForm';
import { getTemplateById, resolveTemplateToRequest } from '../../config/simulationTemplates';
import { ExecutionDefaultsProvider } from '../../state/executionDefaults';

describe('NormalInputForm templates', () => {
  it('previews Starter template and applies only after confirmation', async () => {
    const expected = resolveTemplateToRequest(getTemplateById('starter'));

    render(
      <ExecutionDefaultsProvider>
        <SimulationForm />
      </ExecutionDefaultsProvider>
    );

    // Force a change so we become Custom.
    const startDate = screen.getByLabelText(/^Start Date:?$/i) as HTMLInputElement;
    fireEvent.change(startDate, { target: { value: '2030-01-01' } });

    await waitFor(() => {
      expect((screen.getByRole('combobox', { name: /Template/i }) as HTMLSelectElement).value).toBe('custom');
    });

    const templateSelect = screen.getByRole('combobox', { name: /Template/i }) as HTMLSelectElement;
    fireEvent.change(templateSelect, { target: { value: 'starter' } });

    screen.getByRole('dialog', { name: /Template preview/i });

    // Still unchanged until the user confirms.
    expect(startDate.value).toBe('2030-01-01');
    expect(screen.getByText(/Applying this template will overwrite/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Apply template/i }));

    expect(startDate.value).toBe(expected.startDate.date);

    expect(screen.getByText(getTemplateById('starter').description)).toBeInTheDocument();
  });

  it('can cancel template preview without changing inputs', async () => {
    const expected = resolveTemplateToRequest(getTemplateById('starter'));

    render(
      <ExecutionDefaultsProvider>
        <SimulationForm />
      </ExecutionDefaultsProvider>
    );

    const startDate = screen.getByLabelText(/^Start Date:?$/i) as HTMLInputElement;
    fireEvent.change(startDate, { target: { value: '2030-01-01' } });

    await waitFor(() => {
      expect((screen.getByRole('combobox', { name: /Template/i }) as HTMLSelectElement).value).toBe('custom');
    });

    const templateSelect = screen.getByRole('combobox', { name: /Template/i }) as HTMLSelectElement;
    fireEvent.change(templateSelect, { target: { value: 'starter' } });

    screen.getByRole('dialog', { name: /Template preview/i });

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));

    expect(startDate.value).toBe('2030-01-01');

    // Template remains custom since we never confirmed.
    await waitFor(() => {
      expect((screen.getByRole('combobox', { name: /Template/i }) as HTMLSelectElement).value).toBe('custom');
    });

    // Sanity: ensure expected still differs.
    expect(startDate.value).not.toBe(expected.startDate.date);
  });

  it('switches template back to Custom when editing', async () => {
    render(
      <ExecutionDefaultsProvider>
        <SimulationForm />
      </ExecutionDefaultsProvider>
    );

    const startDate = screen.getByLabelText(/^Start Date:?$/i) as HTMLInputElement;
    fireEvent.change(startDate, { target: { value: '2041-01-01' } });

    await waitFor(() => {
      expect((screen.getByRole('combobox', { name: /Template/i }) as HTMLSelectElement).value).toBe('custom');
    });
  });

  it('opens What changed? as read-only (no warning/apply)', () => {
    render(
      <ExecutionDefaultsProvider>
        <SimulationForm />
      </ExecutionDefaultsProvider>
    );

    // Make a change so applying a template actually overwrites something,
    // then ensure What changed? shows those diffs.
    const startDate = screen.getByLabelText(/^Start Date:?$/i) as HTMLInputElement;
    fireEvent.change(startDate, { target: { value: '2030-01-01' } });

    const templateSelect = screen.getByRole('combobox', { name: /Template/i }) as HTMLSelectElement;
    fireEvent.change(templateSelect, { target: { value: 'starter' } });
    screen.getByRole('dialog', { name: /Template preview/i });
    fireEvent.click(screen.getByRole('button', { name: /Apply template/i }));

    fireEvent.click(screen.getByRole('button', { name: /What changed\?/i }));

    const dialog = screen.getByRole('dialog', { name: /What changed\?/i });

    // We should show at least one changed field (start date).
    expect(screen.queryByText(/No fields changed\./i)).not.toBeInTheDocument();
    expect(within(dialog).getByText(/^Start date$/i)).toBeInTheDocument();

    expect(screen.queryByText(/Applying this template will overwrite/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Apply template/i })).not.toBeInTheDocument();
  });

  it('applying a template resets advanced defaults, and editing flips to Custom', async () => {
    render(
      <ExecutionDefaultsProvider>
        <SimulationForm mode="advanced" />
      </ExecutionDefaultsProvider>
    );

    const templateSelect = screen.getByRole('combobox', { name: /Template/i }) as HTMLSelectElement;

    const pathsInput = screen.getByLabelText(/Paths \(runs\)/i) as HTMLInputElement;
    fireEvent.change(pathsInput, { target: { value: '50000' } });

    await waitFor(() => {
      expect(templateSelect.value).toBe('custom');
    });

    fireEvent.change(templateSelect, { target: { value: 'starter' } });
    screen.getByRole('dialog', { name: /Template preview/i });
    fireEvent.click(screen.getByRole('button', { name: /Apply template/i }));

    // Template defaults should be applied to advanced fields.
    expect((screen.getByLabelText(/Paths \(runs\)/i) as HTMLInputElement).value).toBe('10000');
    expect((screen.getByLabelText(/Batch size/i) as HTMLInputElement).value).toBe('10000');

    // Any subsequent edit should flip the template to Custom.
    fireEvent.change(screen.getByLabelText(/Batch size/i), { target: { value: '20000' } });

    await waitFor(() => {
      expect((screen.getByRole('combobox', { name: /Template/i }) as HTMLSelectElement).value).toBe('custom');
    });
  });
});
