import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = [
  readFileSync('src/pages/LoginPage.tsx', 'utf8'),
  readFileSync('src/pages/RegisterPage.tsx', 'utf8'),
  readFileSync('src/pages/AccountPage.tsx', 'utf8'),
].join('\n');
const contracts = [
  'Sign in',
  'Welcome to SecureRide',
  'current-password',
  'Create your account',
  'new-password',
  'password-help',
  '15–128',
  'Customer dashboard',
  'Your account',
  'Sign out all devices',
  'Search cars',
  'Your bookings',
];

describe('AuthAccountExperience', () => {
  it.each(contracts)('includes %s', (contract) => {
    expect(source).toContain(contract);
  });
});
