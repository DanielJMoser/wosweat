import { render, screen } from '@testing-library/react';
import App from './App';

test('renders app shell', () => {
  render(<App />);
  expect(screen.getByRole('heading', { level: 1, name: 'wosweat' })).toBeInTheDocument();
  expect(screen.getByLabelText('Monatsansicht umschalten')).toBeInTheDocument();
});
