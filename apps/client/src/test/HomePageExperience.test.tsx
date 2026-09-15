import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = [
  readFileSync('src/pages/HomePage.tsx', 'utf8'),
  readFileSync('src/components/HomeSearch.tsx', 'utf8'),
  readFileSync('src/components/FeaturedCars.tsx', 'utf8'),
  readFileSync('src/components/TrustSection.tsx', 'utf8'),
].join('\n');
const contracts = [
  'Book your ride with confidence',
  'Find a car',
  'Create an account',
  'Find a car',
  'Vehicle type',
  'Start date',
  'Return date',
  'Search cars',
  'A car for every kind of journey',
  'City compact',
  'Why SecureRide',
  'Confidence from search to return',
];

describe('HomePageExperience', () => {
  it.each(contracts)('includes %s', (contract) => {
    expect(source).toContain(contract);
  });
});
