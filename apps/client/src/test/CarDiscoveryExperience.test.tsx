import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = [
  readFileSync('src/components/CarCard.tsx', 'utf8'),
  readFileSync('src/components/CarFilters.tsx', 'utf8'),
  readFileSync('src/pages/CarsPage.tsx', 'utf8'),
  readFileSync('src/pages/CarDetailPage.tsx', 'utf8'),
].join('\n');
const contracts = [
  'car-card',
  'No car image available',
  'per day',
  'View details',
  'Filter cars',
  'Clear filters',
  'Available cars',
  'Loading cars',
  'No cars match',
  'Loading car',
  'Book this car',
  'Features',
];

describe('CarDiscoveryExperience', () => {
  it.each(contracts)('includes %s', (contract) => {
    expect(source).toContain(contract);
  });
});
