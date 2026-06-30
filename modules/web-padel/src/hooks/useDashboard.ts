import { useState, useEffect } from 'react';
import { apolloClient, gql } from '../utils/apollo';
import { Club, DashboardClubRow, ClubOverviewItem, ClubOverviewResult, Location } from '../types/padel';

const DASHBOARD_SUMMARY_QUERY = gql`
  query GetDashboardSummary($input: DashboardSummaryInput!) {
    getDashboardSummary(input: $input) {
      totalClubs totalBookings totalRevenue lastUpdatedAt
    }
  }
`;

const CLUB_OVERVIEW_QUERY = gql`
  query GetClubOverview($input: ClubOverviewInput!) {
    getClubOverview(input: $input) {
      items { id name subName address lat lng locationId logoPath price bookingCount totalRevenue }
      totalCount totalPages hasNextPage
    }
  }
`;

const LOCATIONS_QUERY = gql`
  query GetLocations {
    getLocations {
      id name
    }
  }
`;

interface DashboardData {
  clubRows: DashboardClubRow[];
  totalClubs: number;
  totalBookings: number;
  totalRevenue: number;
  loading: boolean;
  overviewResult: ClubOverviewResult;
  locations: Location[];
  lastUpdatedAt?: string;
}

interface DateFilter {
  from?: Date | string;
  to?: Date | string;
  refreshKey?: number;
}

interface DashboardFilter {
  minCourtCount?: number;
  maxCourtCount?: number;
  minPrice?: number;
  maxPrice?: number;
}

interface SortConfig {
  field: string;
  order: string;
}

interface PaginationConfig {
  page: number;
  pageSize: number;
}

export function useDashboard(
  dateFilter?: DateFilter,
  sort?: SortConfig,
  pagination?: PaginationConfig,
  locationId?: string,
  dashboardFilter?: DashboardFilter,
): DashboardData {
  const [data, setData] = useState<DashboardData>({
    clubRows: [],
    totalClubs: 0,
    totalBookings: 0,
    totalRevenue: 0,
    loading: true,
    overviewResult: { items: [], totalCount: 0, totalPages: 0, hasNextPage: false },
    locations: [],
  });

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setData((prev) => ({ ...prev, clubRows: [], totalClubs: 0, totalBookings: 0, totalRevenue: 0, loading: true }));
      try {
        const summaryInput: any = {};
        if (dateFilter?.from) {
          summaryInput.from = typeof dateFilter.from === 'string' ? dateFilter.from : dateFilter.from.toISOString();
        }
        if (dateFilter?.to) {
          summaryInput.to = typeof dateFilter.to === 'string' ? dateFilter.to : dateFilter.to.toISOString();
        }
        if (locationId) summaryInput.locationId = locationId;
        if (dashboardFilter?.minCourtCount != null) summaryInput.minCourtCount = dashboardFilter.minCourtCount;
        if (dashboardFilter?.maxCourtCount != null) summaryInput.maxCourtCount = dashboardFilter.maxCourtCount;
        if (dashboardFilter?.minPrice != null) summaryInput.minPrice = dashboardFilter.minPrice;
        if (dashboardFilter?.maxPrice != null) summaryInput.maxPrice = dashboardFilter.maxPrice;

        const overviewInput: any = {
          page: pagination?.page ?? 1,
          pageSize: pagination?.pageSize ?? 20,
        };
        if (dateFilter?.from) {
          overviewInput.from = typeof dateFilter.from === 'string' ? dateFilter.from : dateFilter.from.toISOString();
        }
        if (dateFilter?.to) {
          overviewInput.to = typeof dateFilter.to === 'string' ? dateFilter.to : dateFilter.to.toISOString();
        }
        if (locationId) overviewInput.locationId = locationId;
        if (sort?.field) overviewInput.sortField = sort.field;
        if (sort?.order) overviewInput.sortOrder = sort.order;
        if (dashboardFilter?.minCourtCount != null) overviewInput.minCourtCount = dashboardFilter.minCourtCount;
        if (dashboardFilter?.maxCourtCount != null) overviewInput.maxCourtCount = dashboardFilter.maxCourtCount;
        if (dashboardFilter?.minPrice != null) overviewInput.minPrice = dashboardFilter.minPrice;
        if (dashboardFilter?.maxPrice != null) overviewInput.maxPrice = dashboardFilter.maxPrice;

        const fetches: Promise<any>[] = [
          apolloClient.query({
            query: DASHBOARD_SUMMARY_QUERY,
            variables: { input: summaryInput },
            fetchPolicy: 'network-only',
          }),
          apolloClient.query({
            query: CLUB_OVERVIEW_QUERY,
            variables: { input: overviewInput },
            fetchPolicy: 'network-only',
          }),
        ];

        if (data.locations.length === 0) {
          fetches.push(
            apolloClient.query({
              query: LOCATIONS_QUERY,
              fetchPolicy: 'network-only',
            })
          );
        }

        const results = await Promise.all(fetches);

        if (cancelled) return;

        const summaryResult = results[0];
        const overviewResult = results[1];
        const locationsData = results[2] ? (results[2].data as any).getLocations : data.locations;

        const summary = (summaryResult.data as any).getDashboardSummary;
        const overview: ClubOverviewResult = (overviewResult.data as any).getClubOverview;

        const clubRows: DashboardClubRow[] = overview.items.map((item: ClubOverviewItem) => ({
          club: {
            id: item.id,
            name: item.name,
            subName: item.subName ?? undefined,
            address: item.address ?? undefined,
            lat: item.lat ?? 0,
            lng: item.lng ?? 0,
            locationId: item.locationId,
            logoPath: item.logoPath ?? undefined,
            price: item.price ?? undefined,
          } as Club,
          bookingCount: item.bookingCount,
          totalRevenue: item.totalRevenue,
        }));

        setData({
          clubRows,
          totalClubs: summary.totalClubs,
          totalBookings: summary.totalBookings,
          totalRevenue: summary.totalRevenue,
          loading: false,
          overviewResult: overview,
          locations: locationsData,
          lastUpdatedAt: summary.lastUpdatedAt ?? undefined,
        });
      } catch {
        if (!cancelled) {
          setData((prev) => ({ ...prev, loading: false }));
        }
      }
    };

    fetchData();

    return () => { cancelled = true; };
  }, [
    typeof dateFilter?.from === 'string' ? dateFilter.from : dateFilter?.from?.getTime(),
    typeof dateFilter?.to === 'string' ? dateFilter.to : dateFilter?.to?.getTime(),
    dateFilter?.refreshKey,
    sort?.field,
    sort?.order,
    pagination?.page,
    pagination?.pageSize,
    locationId,
    dashboardFilter?.minCourtCount,
    dashboardFilter?.maxCourtCount,
    dashboardFilter?.minPrice,
    dashboardFilter?.maxPrice,
  ]);

  return data;
}