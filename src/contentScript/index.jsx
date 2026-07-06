/* global chrome */
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

function mount() {
  const target = document.body || document.documentElement;
  if (!target) return;

  const container = document.createElement('div');
  container.id = 'ct-react-root';
  target.appendChild(container);

  const root = createRoot(container);
  root.render(<App />);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}
