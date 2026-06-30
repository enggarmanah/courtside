import { useState, useEffect } from 'react';
import { apolloClient, gql } from '../../utils/apollo';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const GET_CLUB_PERFORMANCE_ANALYTICS = gql`
  query GetClubPerformanceAnalytics($input: ClubPerformanceAnalyticsInput!) {
    getClubPerformanceAnalytics(input: $input) {
      metrics {
        totalBookings
        avgDailyBookings
        totalRevenue
        avgDailyRevenue
      }
      bookingChart {
        label
        value
      }
      occupancyHeatmap {
        day
        slots {
          time
          occupancyRate
        }
      }
    }
  }
`;

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const mapDayNamesToDates = (
  occupancyHeatmap: Array<{ day: string; slots: Array<{ time: string; occupancyRate: number }> }>,
  dateRangeStart: string,
  dateRangeEnd: string
): Array<{ period: string; day: string; slots: Array<{ time: string; occupancyRate: number }> }> => {
  if (!occupancyHeatmap || occupancyHeatmap.length === 0) return [];

  const start = new Date(`${dateRangeStart}T00:00:00`);
  const end = new Date(`${dateRangeEnd}T00:00:00`);

  const result: Array<{ period: string; day: string; slots: Array<{ time: string; occupancyRate: number }> }> = [];

  const dayMap: Record<string, { time: string; occupancyRate: number }[]> = {};
  occupancyHeatmap.forEach((row) => {
    dayMap[row.day] = row.slots || [];
  });

  const current = new Date(start);
  while (current <= end) {
    const dayName = DAY_NAMES[current.getDay()];
    const slots = dayMap[dayName] || [];
    result.push({
      period: `${current.getDate()} ${MONTH_SHORT[current.getMonth()]}`,
      day: DAY_NAMES[current.getDay()],
      slots,
    });
    current.setDate(current.getDate() + 1);
  }

  return result;
};

export interface ClubAnalyticsResult {
  clubId: string;
  metrics: {
    totalBookings: number;
    avgDailyBookings: number;
    totalRevenue: number;
    avgDailyRevenue: number;
  };
  bookingChart: Array<{ label: string; value: number }>;
  occupancyRows: Array<{ period: string; day: string; slots: Array<{ time: string; occupancyRate: number }> }>;
}

export interface UseBookingClubsResult {
  clubAnalytics: ClubAnalyticsResult[];
  loading: boolean;
  error: string | null;
}

export function useBookingClubs(
  clubIds: string[],
  dateRangeStart: string,
  dateRangeEnd: string,
  refreshKey: number = 0
): UseBookingClubsResult {
  const [result, setResult] = useState<UseBookingClubsResult>({
    clubAnalytics: [],
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!clubIds || clubIds.length === 0) {
      setResult({ clubAnalytics: [], loading: false, error: null });
      return;
    }

    let cancelled = false;
    setResult({ clubAnalytics: [], loading: true, error: null });

    const fromISO = dateRangeStart ? `${dateRangeStart}T00:00:00+07:00` : '';
    const toISO = dateRangeEnd ? `${dateRangeEnd}T00:00:00+07:00` : '';

    const fetchAll = async () => {
      try {
        const responses = await Promise.all(
          clubIds.map(async (clubId) => {
            const res = await apolloClient.query({
              query: GET_CLUB_PERFORMANCE_ANALYTICS,
              variables: {
                input: { clubId, from: fromISO, to: toISO },
              },
              fetchPolicy: 'network-only',
            });
            const analytics = (res.data as any)?.getClubPerformanceAnalytics;
            return { clubId, analytics };
          })
        );

        if (cancelled) return;

        const clubAnalytics: ClubAnalyticsResult[] = responses
          .filter((r) => r.analytics)
          .map(({ clubId, analytics }) => ({
            clubId,
            metrics: {
              totalBookings: analytics.metrics?.totalBookings || 0,
              avgDailyBookings: analytics.metrics?.avgDailyBookings || 0,
              totalRevenue: analytics.metrics?.totalRevenue || 0,
              avgDailyRevenue: analytics.metrics?.avgDailyRevenue || 0,
            },
            bookingChart: analytics.bookingChart || [],
            occupancyRows: mapDayNamesToDates(
              analytics.occupancyHeatmap || [],
              dateRangeStart,
              dateRangeEnd
            ),
          }))
          .sort((a, b) => b.metrics.totalBookings - a.metrics.totalBookings);

        setResult({ clubAnalytics, loading: false, error: null });
      } catch (err: any) {
        if (!cancelled) {
          setResult({ clubAnalytics: [], loading: false, error: err.message || 'Failed to fetch analytics' });
        }
      }
    };

    fetchAll();
    return () => { cancelled = true; };
  }, [clubIds.join(','), dateRangeStart, dateRangeEnd, refreshKey]);

  return result;
}
