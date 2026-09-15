import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = [
  readFileSync('src/styles/global.css', 'utf8'),
  readFileSync('src/styles/components.css', 'utf8'),
  readFileSync('src/styles/pages.css', 'utf8'),
  readFileSync('src/components/StatusPanel.tsx', 'utf8'),
].join('\n');
const contracts = [
  ':focus-visible',
  'outline: 3px solid var(--amber-500)',
  'skip-link:focus',
  'role=',
  'prefers-reduced-motion',
  'max-width: 760px',
  'max-width: 620px',
  'sr-only',
  'aria-current',
  'status-panel',
  'tone ===',
  'loading-state',
  'min-width: 320px',
  'scroll-behavior: smooth',
];

describe('AccessibilityResponsive', () => {
  it.each(contracts)('includes %s', (contract) => {
    expect(source).toContain(contract);
  });
});
