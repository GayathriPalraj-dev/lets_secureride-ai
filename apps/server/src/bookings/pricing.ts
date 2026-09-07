export const DAY_MS = 86_400_000;
export function bookingPrice(dailyRateMinor: number, start: Date, end: Date) {
  const days = (end.getTime() - start.getTime()) / DAY_MS;
  if (
    !Number.isInteger(days) ||
    days < 1 ||
    days > 30 ||
    !Number.isSafeInteger(dailyRateMinor) ||
    dailyRateMinor < 1
  )
    throw new Error('Invalid booking price');
  const total = dailyRateMinor * days;
  if (
    !Number.isSafeInteger(total) ||
    total < 1 ||
    total > Number.MAX_SAFE_INTEGER
  )
    throw new Error('Invalid booking price');
  return { billableDays: days, totalAmountMinor: total };
}
