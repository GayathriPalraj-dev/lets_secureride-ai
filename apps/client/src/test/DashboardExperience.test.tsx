import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = [
  readFileSync('src/components/DashboardLayout.tsx', 'utf8'),
  readFileSync('src/pages/AdminPage.tsx', 'utf8'),
  readFileSync('src/pages/AdminBookingDetailPage.tsx', 'utf8'),
].join('\n');
const contracts = [
  'dashboard-layout',
  'Administration',
  'My SecureRide',
  'Overview',
  'Find a car',
  'Operations',
  'Car inventory',
  'Manage car inventory',
  'Manage bookings',
  'Manage payments',
  'Booking review',
  'Customer reference',
];

describe('DashboardExperience', () => {
  it.each(contracts)('includes %s', (contract) => {
    expect(source).toContain(contract);
  });
});
