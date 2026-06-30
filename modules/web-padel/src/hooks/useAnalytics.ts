import { useState, useEffect, useMemo } from 'react';
import { apolloClient, gql } from '../utils/apollo';

export interface AnalyticsFilter {
  locationId?: string;
  from?: string;
  to?: string;
  minCourtCount?: number;
  maxCourtCount?: number;
  minPrice?: number;
  maxPrice?: number;
}

interface AnalyticsChartItem {
  label: string;
  value: number;
}

interface AnalyticsSeriesItem {
  name: string;
  value: number;
}

interface AnalyticsMultiSeries {
  label: string;
  series: AnalyticsSeriesItem[];
}

interface AnalyticsPieItem {
  name: string;
  value: number;
}

interface AnalyticsSummary {
  totalClubs: number;
  totalBookings: number;
  totalRevenue: number;
  lastUpdatedAt?: string;
}

type SectionLoadingState = boolean;

interface AnalyticsLoadingStates {
  summary: SectionLoadingState;
  bookingTrend: SectionLoadingState;
  bookingsPerClub: SectionLoadingState;
  clubsPerCityGrowth: SectionLoadingState;
  courtsPerCityGrowth: SectionLoadingState;
  bookingDistribution: SectionLoadingState;
  clubsPerCity: SectionLoadingState;
  priceDistribution: SectionLoadingState;
  courtDistribution: SectionLoadingState;
}

interface AnalyticsData {
  loading: boolean;
  loadingStates: AnalyticsLoadingStates;
  error: string | null;
  bookingTrend: AnalyticsChartItem[];
  bookingsPerClub: AnalyticsMultiSeries[];
  clubsPerCityGrowth: AnalyticsMultiSeries[];
  courtsPerCityGrowth: AnalyticsMultiSeries[];
  bookingDistribution: AnalyticsPieItem[];
  clubsPerCity: AnalyticsPieItem[];
  priceDistribution: AnalyticsPieItem[];
  courtDistribution: AnalyticsPieItem[];
  summary: AnalyticsSummary;
}

const GET_ANALYTICS_SUMMARY = gql`
  query GetAnalyticsSummary($filter: AnalyticsFilter!) {
    getAnalyticsSummary(filter: $filter) {
      totalClubs totalBookings totalRevenue lastUpdatedAt
    }
  }
`;

const GET_BOOKING_TREND = gql`
  query GetBookingTrend($filter: AnalyticsFilter!) {
    getBookingTrend(filter: $filter) { label value }
  }
`;

const GET_BOOKINGS_PER_CLUB = gql`
  query GetBookingsPerClub($filter: AnalyticsFilter!, $topX: Int!) {
    getBookingsPerClub(filter: $filter, topX: $topX) {
      label
      series { name value }
    }
  }
`;

const GET_CLUB_GROWTH_BY_CITY = gql`
  query GetClubGrowthByCity($filter: AnalyticsFilter!) {
    getClubGrowthByCity(filter: $filter) {
      label
      series { name value }
    }
  }
`;

const GET_COURT_GROWTH_BY_CITY = gql`
  query GetCourtGrowthByCity($filter: AnalyticsFilter!) {
    getCourtGrowthByCity(filter: $filter) {
      label
      series { name value }
    }
  }
`;

const GET_BOOKING_DISTRIBUTION = gql`
  query GetBookingDistribution($filter: AnalyticsFilter!, $topX: Int!) {
    getBookingDistribution(filter: $filter, topX: $topX) { name value }
  }
`;

const GET_CLUBS_PER_CITY = gql`
  query GetClubsPerCity($filter: AnalyticsFilter!) {
    getClubsPerCity(filter: $filter) { name value }
  }
`;

const GET_PRICE_DISTRIBUTION = gql`
  query GetPriceDistribution($filter: AnalyticsFilter!) {
    getPriceDistribution(filter: $filter) { name value }
  }
`;

const GET_COURT_DISTRIBUTION = gql`
  query GetCourtDistribution($filter: AnalyticsFilter!) {
    getCourtDistribution(filter: $filter) { name value }
  }
`;

function flattenMultiSeries(data: AnalyticsMultiSeries[]): Record<string, any>[] {
  return data.map((item) => {
    const point: Record<string, any> = { date: item.label };
    item.series.forEach((s) => {
      point[s.name] = s.value;
    });
    return point;
  });
}

const initialLoadingStates: AnalyticsLoadingStates = {
  summary: true,
  bookingTrend: true,
  bookingsPerClub: true,
  clubsPerCityGrowth: true,
  courtsPerCityGrowth: true,
  bookingDistribution: true,
  clubsPerCity: true,
  priceDistribution: true,
  courtDistribution: true,
};

export function useAnalytics(filter: AnalyticsFilter, topX: number = 25, fetchTrigger: number = 0): AnalyticsData {
  const [data, setData] = useState<AnalyticsData>({
    loading: true,
    loadingStates: initialLoadingStates,
    error: null,
    bookingTrend: [],
    bookingsPerClub: [],
    clubsPerCityGrowth: [],
    courtsPerCityGrowth: [],
    bookingDistribution: [],
    clubsPerCity: [],
    priceDistribution: [],
    courtDistribution: [],
    summary: { totalClubs: 0, totalBookings: 0, totalRevenue: 0 },
  });

  const filterKey = useMemo(() => JSON.stringify(filter), [filter]);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setData((prev) => ({ ...prev, loading: true, loadingStates: initialLoadingStates, error: null }));

      const markSectionLoaded = (key: keyof AnalyticsLoadingStates, update: Partial<AnalyticsData>) => {
        if (!cancelled) {
          setData((prev) => {
            const newLoadingStates = { ...prev.loadingStates, [key]: false };
            const allLoaded = Object.values(newLoadingStates).every((v) => !v);
            return { ...prev, ...update, loadingStates: newLoadingStates, loading: !allLoaded };
          });
        }
      };

      try {
        const topXVariables = { filter, topX };

        apolloClient.query({ query: GET_ANALYTICS_SUMMARY, variables: { filter }, fetchPolicy: 'network-only' })
          .then((res) => { const d = res.data as any; markSectionLoaded('summary', { summary: d?.getAnalyticsSummary || { totalClubs: 0, totalBookings: 0, totalRevenue: 0 } }); })
          .catch(() => markSectionLoaded('summary', {}));

        apolloClient.query({ query: GET_BOOKING_TREND, variables: { filter }, fetchPolicy: 'network-only' })
          .then((res) => { const d = res.data as any; markSectionLoaded('bookingTrend', { bookingTrend: d?.getBookingTrend || [] }); })
          .catch(() => markSectionLoaded('bookingTrend', {}));

        apolloClient.query({ query: GET_BOOKINGS_PER_CLUB, variables: topXVariables, fetchPolicy: 'network-only' })
          .then((res) => { const d = res.data as any; markSectionLoaded('bookingsPerClub', { bookingsPerClub: d?.getBookingsPerClub || [] }); })
          .catch(() => markSectionLoaded('bookingsPerClub', {}));

        apolloClient.query({ query: GET_CLUB_GROWTH_BY_CITY, variables: { filter }, fetchPolicy: 'network-only' })
          .then((res) => { const d = res.data as any; markSectionLoaded('clubsPerCityGrowth', { clubsPerCityGrowth: d?.getClubGrowthByCity || [] }); })
          .catch(() => markSectionLoaded('clubsPerCityGrowth', {}));

        apolloClient.query({ query: GET_COURT_GROWTH_BY_CITY, variables: { filter }, fetchPolicy: 'network-only' })
          .then((res) => { const d = res.data as any; markSectionLoaded('courtsPerCityGrowth', { courtsPerCityGrowth: d?.getCourtGrowthByCity || [] }); })
          .catch(() => markSectionLoaded('courtsPerCityGrowth', {}));

        apolloClient.query({ query: GET_BOOKING_DISTRIBUTION, variables: topXVariables, fetchPolicy: 'network-only' })
          .then((res) => { const d = res.data as any; markSectionLoaded('bookingDistribution', { bookingDistribution: d?.getBookingDistribution || [] }); })
          .catch(() => markSectionLoaded('bookingDistribution', {}));

        apolloClient.query({ query: GET_CLUBS_PER_CITY, variables: { filter }, fetchPolicy: 'network-only' })
          .then((res) => { const d = res.data as any; markSectionLoaded('clubsPerCity', { clubsPerCity: d?.getClubsPerCity || [] }); })
          .catch(() => markSectionLoaded('clubsPerCity', {}));

        apolloClient.query({ query: GET_PRICE_DISTRIBUTION, variables: { filter }, fetchPolicy: 'network-only' })
          .then((res) => { const d = res.data as any; markSectionLoaded('priceDistribution', { priceDistribution: d?.getPriceDistribution || [] }); })
          .catch(() => markSectionLoaded('priceDistribution', {}));

        apolloClient.query({ query: GET_COURT_DISTRIBUTION, variables: { filter }, fetchPolicy: 'network-only' })
          .then((res) => { const d = res.data as any; markSectionLoaded('courtDistribution', { courtDistribution: d?.getCourtDistribution || [] }); })
          .catch(() => markSectionLoaded('courtDistribution', {}));
      } catch (err: any) {
        if (!cancelled) {
          setData((prev) => ({
            ...prev,
            loading: false,
            loadingStates: { summary: false, bookingTrend: false, bookingsPerClub: false, clubsPerCityGrowth: false, courtsPerCityGrowth: false, bookingDistribution: false, clubsPerCity: false, priceDistribution: false, courtDistribution: false },
            error: err.message || 'Failed to fetch analytics data',
          }));
        }
      }
    };

    fetchData();

    return () => { cancelled = true; };
  }, [filterKey, topX, fetchTrigger]);

  return data;
}

export { flattenMultiSeries };
