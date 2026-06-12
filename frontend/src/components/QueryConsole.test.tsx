import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import QueryConsole from './QueryConsole';
import type { EventData } from '../../../shared/types/events';

const events: EventData[] = [
  { id: '1', title: 'Molchat Doma', date: '2026-06-11', description: '', url: 'https://e.x/1', venue: 'PMK Innsbruck' },
  { id: '2', title: 'Jazz Trio', date: '2026-06-12', description: '', url: 'https://e.x/2', venue: 'Treibhaus Innsbruck' },
  { id: '3', title: 'Der Revisor', date: '2026-06-18', description: '', url: 'https://e.x/3', venue: 'Innsbrucker Kellertheater' },
];

const type = (value: string) => {
  const input = screen.getByLabelText('WQL-Abfrage');
  fireEvent.change(input, { target: { value } });
  fireEvent.submit(input.closest('form')!);
};

test('select prints results and a summary', () => {
  render(<QueryConsole events={events} todayIso="2026-06-11" />);
  type('SELECT * FROM events');
  expect(screen.getByText(/→ 3 events \(/)).toBeInTheDocument();
  expect(screen.getByText(/Molchat Doma \[PMK Innsbruck\]/)).toBeInTheDocument();
});

test('errors render friendly message without crashing', () => {
  render(<QueryConsole events={events} todayIso="2026-06-11" />);
  type('kaputt');
  expect(screen.getByText(/✗ .*SELECT oder EXPORT/)).toBeInTheDocument();
});

test('export with zero matches downloads nothing and says so', () => {
  render(<QueryConsole events={events} todayIso="2026-06-11" />);
  type("EXPORT ICS WHERE venue = 'nirgendwo'");
  expect(screen.getByText(/→ 0 events — kein Download/)).toBeInTheDocument();
});
