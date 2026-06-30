export const DAILY_GRANULARITY_MAX_DAYS = 45;

export type Granularity = 'hourly' | 'daily' | 'monthly';

export function determineGranularity(from: Date, to: Date): { granularity: Granularity; daysDiff: number } {
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysDiff = Math.round((to.getTime() - from.getTime()) / msPerDay) + 1;
  if (daysDiff <= 0) {
    return { granularity: 'hourly', daysDiff: 1 };
  }
  if (daysDiff === 1) {
    return { granularity: 'hourly', daysDiff };
  }
  if (daysDiff <= DAILY_GRANULARITY_MAX_DAYS) {
    return { granularity: 'daily', daysDiff };
  }
  return { granularity: 'monthly', daysDiff };
}

export function granularityLabelFormat(granularity: Granularity): string {
  switch (granularity) {
    case 'hourly':
      return 'HH:00';
    case 'daily':
      return 'DD MMM';
    case 'monthly':
      return 'MMM YYYY';
  }
}

export function granularityTrunc(granularity: Granularity): string {
  switch (granularity) {
    case 'hourly':
      return 'hour';
    case 'daily':
      return 'day';
    case 'monthly':
      return 'month';
  }
}
