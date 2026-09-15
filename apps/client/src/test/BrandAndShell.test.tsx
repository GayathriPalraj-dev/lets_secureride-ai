import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = [
  readFileSync('src/App.tsx', 'utf8'),
  readFileSync('src/components/AppShell.tsx', 'utf8'),
  readFileSync('src/components/BrandMark.tsx', 'utf8'),
  readFileSync('src/components/SiteFooter.tsx', 'utf8'),
].join('\n');
const contracts = [
  'AppShell',
  'skip-link',
  'Skip to main content',
  'SiteHeader',
  'SiteFooter',
  'SecureRide home',
  'secureride-mark.svg',
  'Footer navigation',
  'Browse cars',
  'Built for safe journeys',
  'children',
  'site-footer',
];

describe('BrandAndShell', () => {
  it.each(contracts)('includes %s', (contract) => {
    expect(source).toContain(contract);
  });
});
