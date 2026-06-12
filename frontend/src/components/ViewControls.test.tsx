import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import ViewControls from './ViewControls';

const setup = (venueFilter: string[] = []) => {
  const onVenueFilterChange = vi.fn();
  const onViewChange = vi.fn();
  render(
    <ViewControls
      venueFilter={venueFilter}
      onVenueFilterChange={onVenueFilterChange}
      view="cards"
      onViewChange={onViewChange}
    />,
  );
  return { onVenueFilterChange, onViewChange };
};

test('renders Alle plus one chip per venue with pressed state', () => {
  setup();
  const alle = screen.getByRole('button', { name: 'Alle' });
  expect(alle).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: 'PMK' })).toHaveAttribute('aria-pressed', 'false');
  expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(9 + 2);
});

test('clicking a venue chip toggles it into the filter', () => {
  const { onVenueFilterChange } = setup();
  fireEvent.click(screen.getByRole('button', { name: 'PMK' }));
  expect(onVenueFilterChange).toHaveBeenCalledWith(['PMK']);
});

test('clicking Alle clears the filter', () => {
  const { onVenueFilterChange } = setup(['PMK']);
  fireEvent.click(screen.getByRole('button', { name: 'Alle' }));
  expect(onVenueFilterChange).toHaveBeenCalledWith([]);
});

test('view toggle reports the chosen view', () => {
  const { onViewChange } = setup();
  const liste = screen.getByRole('button', { name: 'LISTE' });
  expect(liste).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(liste);
  expect(onViewChange).toHaveBeenCalledWith('list');
});
