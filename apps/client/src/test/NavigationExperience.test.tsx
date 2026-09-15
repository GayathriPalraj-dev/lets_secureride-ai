import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = [
  readFileSync('src/components/SiteHeader.tsx', 'utf8'),
  readFileSync('src/components/DashboardLayout.tsx', 'utf8'),
].join('\n');
const contracts = [
  'Primary navigation',
  'aria-expanded',
  'aria-controls',
  'primary-navigation',
  'Toggle navigation',
  'nav-links is-open',
  'Home',
  'Cars',
  'My bookings',
  'Admin',
  'Account',
  'Sign in',
  'Create account',
  'aria-label={admin',
];

describe('NavigationExperience', () => {
  it.each(contracts)('includes %s', (contract) => {
    expect(source).toContain(contract);
  });
});
