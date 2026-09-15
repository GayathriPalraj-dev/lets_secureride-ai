import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = [
  readFileSync('src/components/BookingForm.tsx', 'utf8'),
  readFileSync('src/components/BookingStatus.tsx', 'utf8'),
  readFileSync('src/components/PaymentForm.tsx', 'utf8'),
  readFileSync('src/components/PaymentStatus.tsx', 'utf8'),
  readFileSync('src/pages/PaymentPage.tsx', 'utf8'),
].join('\n');
const contracts = [
  'return date is exclusive',
  'Start date',
  'Create booking',
  'booking-status',
  'PaymentElement',
  'aria-busy',
  'Confirming',
  'Payment processing',
  'Payment status being verified',
  'Pay securely',
  'PAYMENT_AMOUNT_UNSUPPORTED',
  'clientSecret',
];

describe('BookingPaymentExperience', () => {
  it.each(contracts)('includes %s', (contract) => {
    expect(source).toContain(contract);
  });
});
