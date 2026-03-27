import { render } from '@testing-library/react';
import App from './App';

test('renders app shell', () => {
  const { baseElement } = render(<App />);
  expect(baseElement).toBeDefined();
});
