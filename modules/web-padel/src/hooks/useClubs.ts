import { useState, useEffect, useCallback } from 'react';
import { apolloClient, gql } from '../utils/apollo';
import { Club } from '../types/padel';

const GET_CLUBS = gql`
  query GetClubs($input: ClubsInput!) {
    clubs(input: $input) {
      clubs {
        id
        name
        subName
        address
        email
        whatsapp
        instagram
        logoPath
        lat
        lng
        linkMap
        price
        courtCount
        openingDate
      }
      totalCount
      totalPages
      hasNextPage
    }
  }
`;

export interface ClubFilters {
  minCourtCount?: number;
  maxCourtCount?: number;
  minPrice?: number;
  maxPrice?: number;
  openingDateBefore?: string;
  openingDateAfter?: string;
}

export interface ClubsQueryResult {
  clubs: Club[];
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  loading: boolean;
  refetch: () => void;
}

export function useClubs(
  page: number,
  pageSize: number,
  search: string,
  sortField: string,
  sortOrder: string,
  refreshKey: number,
  locationId?: string,
  filters?: ClubFilters
): ClubsQueryResult {
  const [data, setData] = useState<ClubsQueryResult>({
    clubs: [],
    totalCount: 0,
    totalPages: 0,
    hasNextPage: false,
    loading: true,
    refetch: () => {},
  });

  const fetchClubs = useCallback(async () => {
    setData((prev) => ({ ...prev, loading: true }));
    try {
      const input: any = {
        page,
        pageSize,
        sortField: sortField || undefined,
        sortOrder: sortOrder || undefined,
      };
      if (search && search.trim() !== '') {
        input.search = search.trim();
      }
      if (locationId) {
        input.locationId = locationId;
      }
      if (filters?.minCourtCount != null) input.minCourtCount = filters.minCourtCount;
      if (filters?.maxCourtCount != null) input.maxCourtCount = filters.maxCourtCount;
      if (filters?.minPrice != null) input.minPrice = filters.minPrice;
      if (filters?.maxPrice != null) input.maxPrice = filters.maxPrice;
      if (filters?.openingDateBefore) input.openingDateBefore = filters.openingDateBefore;
      if (filters?.openingDateAfter) input.openingDateAfter = filters.openingDateAfter;

      const result = await apolloClient.query({
        query: GET_CLUBS,
        variables: { input },
        fetchPolicy: 'network-only',
      });

      const clubsResult = (result.data as any).clubs;
      const clubs: Club[] = clubsResult.clubs.map((c: any) => ({
        id: c.id,
        name: c.name,
        subName: c.subName ?? undefined,
        address: c.address ?? undefined,
        email: c.email ?? undefined,
        whatsapp: c.whatsapp ?? undefined,
        instagram: c.instagram ?? undefined,
        logoPath: c.logoPath ?? undefined,
        lat: c.lat ?? 0,
        lng: c.lng ?? 0,
        linkMap: c.linkMap ?? undefined,
        price: c.price ?? undefined,
        courtCount: c.courtCount ?? undefined,
        openingDate: c.openingDate ?? undefined,
        locationId: c.locationId,
      }));

      setData({
        clubs,
        totalCount: clubsResult.totalCount,
        totalPages: clubsResult.totalPages,
        hasNextPage: clubsResult.hasNextPage,
        loading: false,
        refetch: fetchClubs,
      });
    } catch {
      setData((prev) => ({ ...prev, loading: false }));
    }
  }, [page, pageSize, search, sortField, sortOrder, refreshKey, locationId, filters]);

  useEffect(() => {
    fetchClubs();
  }, [fetchClubs]);

  return { ...data, refetch: fetchClubs };
}
