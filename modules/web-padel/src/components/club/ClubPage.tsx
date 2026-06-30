import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout, TopBar, Icon, ColumnDefinition, DataTable, SearchBar, LoadingProgress, FilterButton } from '../common';
import { ClubCard } from './ClubCard';
import { Filter, FilterType } from '../../types/FilterTypes';
import { useClubs } from '../../hooks/useClubs';
import { Club } from '../../types/padel';
import { formatCurrency, toLocalISODate } from '../../utils/formatHelper';
import { useLocationSelector } from '../../context/LocationContext';
import { isValidWhatsApp, formatWhatsAppDisplay, formatWhatsAppLink } from '../../utils/whatsapp';

const PAGE_SIZE = 20;

const columns: ColumnDefinition<Club>[] = [
  {
    key: 'name',
    header: 'Club',
    icon: 'building',
    render: (_value: any, club: Club) => <ClubCard club={club} />,
  },
  {
    key: 'price',
    header: 'Base Price',
    icon: 'dollar',
    align: 'right',
    render: (_value: any, club: Club) => (
      <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">
        {club.price != null ? `${formatCurrency(club.price)} / hour` : '-'}
      </span>
    ),
  },
  {
    key: 'courtCount',
    header: 'Courts',
    icon: 'list',
    align: 'center',
    render: (_value: any, club: Club) => (
      <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">
        {club.courtCount != null ? `${club.courtCount}` : '-'}
      </span>
    ),
  },
  {
    key: 'contact',
    header: 'Contact',
    icon: 'user',
    render: (_value: any, club: Club) => {
      return (
        <div className="min-w-0 space-y-0.5">
          {isValidWhatsApp(club.whatsapp) && (
            <a
              href={`https://wa.me/${formatWhatsAppLink(club.whatsapp)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 hover:text-brand-500 truncate"
              onClick={(e) => e.stopPropagation()}
            >
              <Icon name="phone" size={10} className="flex-shrink-0 text-brand-500" />
              <span className="truncate">{formatWhatsAppDisplay(club.whatsapp)}</span>
            </a>
          )}
          {club.email && (
            <a
              href={`mailto:${club.email}`}
              className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 hover:text-brand-500 truncate"
              onClick={(e) => e.stopPropagation()}
            >
              <Icon name="envelope" size={10} className="flex-shrink-0 text-brand-500" />
              <span className="truncate">{club.email}</span>
            </a>
          )}
          {!isValidWhatsApp(club.whatsapp) && !club.email && <span className="text-slate-400">-</span>}
        </div>
      );
    },
  },
];

export const ClubPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { selectedLocationId } = useLocationSelector();

  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState('name');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [search]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [accumulatedClubs, setAccumulatedClubs] = useState<Club[]>([]);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  const [courtCountFilter, setCourtCountFilter] = useState<Filter>({
    title: 'No of Courts',
    field: 'court_count',
    type: FilterType.NUMBER,
    icon: 'list',
    numberFilter: { min: undefined, max: undefined },
  });

  const [priceRangeFilter, setPriceRangeFilter] = useState<Filter>({
    title: 'Price Range',
    field: 'price',
    type: FilterType.NUMBER,
    icon: 'dollar',
    numberFilter: { min: undefined, max: undefined },
  });

  const [openingAfterFilter, setOpeningAfterFilter] = useState<Filter>({
    title: 'Opening After',
    field: 'opening_after',
    type: FilterType.DATE,
    icon: 'calendar',
    dateFilter: { from: undefined, to: undefined },
  });

  const [openingBeforeFilter, setOpeningBeforeFilter] = useState<Filter>({
    title: 'Opening Before',
    field: 'opening_before',
    type: FilterType.DATE,
    icon: 'calendar',
    dateFilter: { from: undefined, to: undefined },
  });

  const clubFilters = useMemo(() => ({
    minCourtCount: courtCountFilter.numberFilter?.min ?? undefined,
    maxCourtCount: courtCountFilter.numberFilter?.max ?? undefined,
    minPrice: priceRangeFilter.numberFilter?.min ?? undefined,
    maxPrice: priceRangeFilter.numberFilter?.max ?? undefined,
    openingDateAfter: openingAfterFilter.dateFilter?.from ? toLocalISODate(openingAfterFilter.dateFilter.from) : undefined,
    openingDateBefore: openingBeforeFilter.dateFilter?.from ? toLocalISODate(openingBeforeFilter.dateFilter.from) : undefined,
  }), [courtCountFilter, priceRangeFilter, openingAfterFilter, openingBeforeFilter]);

  const analyticsFilters = useMemo(() => [courtCountFilter, priceRangeFilter, openingAfterFilter, openingBeforeFilter], [courtCountFilter, priceRangeFilter, openingAfterFilter, openingBeforeFilter]);

  const { clubs, totalCount, hasNextPage, loading } = useClubs(
    page,
    PAGE_SIZE,
    debouncedSearch,
    sortField,
    sortOrder,
    refreshKey,
    selectedLocationId || undefined,
    clubFilters
  );

  // Reset to page 1 when location changes
  useEffect(() => {
    setPage(1);
  }, [selectedLocationId]);

  // Accumulate clubs on infinite scroll (append new page data, dedup by id)
  useEffect(() => {
    if (page === 1) {
      setAccumulatedClubs(clubs);
    } else if (clubs.length > 0) {
      setAccumulatedClubs((prev) => {
        const existingIds = new Set(prev.map((c) => c.id));
        const newClubs = clubs.filter((c) => !existingIds.has(c.id));
        return [...prev, ...newClubs];
      });
    }
  }, [clubs, page]);

  const handleSearch = useCallback((term: string) => {
    setSearch(term);
  }, []);

  const handleSortChange = useCallback((field: string) => {
    if (field === sortField) {
      setSortOrder((prev) => (prev === 'ASC' ? 'DESC' : 'ASC'));
    } else {
      setSortField(field);
      setSortOrder('ASC');
    }
    setPage(1);
  }, [sortField]);

  const handleRowClick = useCallback((club: Club) => {
    navigate(`/dashboard/club/${club.id}`);
  }, [navigate]);

  // Infinite scroll: load next page when near bottom
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 15;
    if (isAtBottom && !loading && hasNextPage) {
      setPage((prev) => prev + 1);
    }
  }, [loading, hasNextPage]);

  const sortOptions = useMemo(() => [
    { value: 'name', label: t('club.name', 'Name') },
    { value: 'price', label: t('club.price', 'Price') },
    { value: 'courtCount', label: t('club.courtCount', 'Courts') },
  ], [t]);

  return (
    <MainLayout>
      <div className="flex flex-col h-full">
        <TopBar title={t('club.listing', 'Clubs')} />

        <div className="flex-1 flex flex-col min-h-0 p-2 md:p-3">
          {/* Action Bar: Search + Sort + Filter + Refresh */}
          <div className="flex-shrink-0 flex flex-col gap-2 mb-3">
            <div className="flex items-center justify-between gap-2">
              {/* Left side: search */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="hidden md:block w-72">
                  <SearchBar
                    onSearch={handleSearch}
                    placeholder={t('club.searchPlaceholder', 'Search clubs by name, address, or email...')}
                  />
                </div>
                {/* Mobile record count badge */}
                {totalCount > 0 && (
                  <div className="md:hidden flex items-center shrink-0 h-9 px-3 bg-brand-50 dark:bg-brand-900/20 border border-brand-300 dark:border-brand-800/50 rounded-full text-[11px] font-bold text-brand-700 dark:text-brand-400 whitespace-nowrap">
                    {totalCount} {t('club.clubs', 'clubs')}
                  </div>
                )}
              </div>

              {/* Right side: result count + sort + filter + refresh */}
              <div className="flex items-center justify-end gap-2">
                <div className="hidden md:flex items-center gap-2 min-w-0 pr-5">
                  <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider whitespace-nowrap">
                    {loading && accumulatedClubs.length === 0
                      ? t('common.loading', 'Loading...')
                      : `${totalCount} ${t('club.clubs', 'clubs')}`}
                  </span>
                  {search && !loading && (
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                      {t('common.searchingFor', 'for')} &quot;{search}&quot;
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {sortOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleSortChange(option.value)}
                      className={`h-9 w-[80px] px-2.5 rounded-xl text-xs font-semibold transition-colors border ${
                        sortField === option.value
                          ? 'bg-brand-600 text-white border-brand-600'
                          : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400'
                      }`}
                    >
                      {option.label}
                      {sortField === option.value && (
                        <span className="ml-1">{sortOrder === 'ASC' ? '↑' : '↓'}</span>
                      )}
                    </button>
                  ))}
                </div>

                <FilterButton
                  showFilterOptions={showFilterDropdown}
                  toggleFilterOptions={() => setShowFilterDropdown((v) => !v)}
                  closeFilterOptions={() => setShowFilterDropdown(false)}
                  onFilterChange={(updated) => {
                    if (updated) {
                      updated.forEach((f) => {
                        if (f.field === 'court_count') setCourtCountFilter(f);
                        if (f.field === 'price') setPriceRangeFilter(f);
                        if (f.field === 'opening_after') setOpeningAfterFilter(f);
                        if (f.field === 'opening_before') setOpeningBeforeFilter(f);
                      });
                    }
                    setPage(1);
                  }}
                  filters={analyticsFilters}
                />

                <button
                  onClick={() => {
                    setPage(1);
                    setRefreshKey((k) => k + 1);
                  }}
                  disabled={loading}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition-all disabled:opacity-50"
                  title={t('common.refresh', 'Refresh')}
                >
                  <Icon name="refresh" size={18} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* Mobile search bar */}
            <div className="w-full md:hidden">
              <SearchBar
                onSearch={handleSearch}
                placeholder={t('club.searchPlaceholder', 'Search clubs by name, address, or email...')}
              />
            </div>
          </div>

          {/* Club Table with infinite scroll */}
          <div className="flex-1 min-h-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden flex flex-col">
            <div
              className="flex-1 overflow-y-auto sidebar-scrollbar"
              onScroll={handleScroll}
            >
              {accumulatedClubs.length === 0 && !loading ? (
                <div className="py-16 text-center text-sm text-slate-400">
                  {t('club.noClubs', 'No clubs found')}
                </div>
              ) : (
                <>
                  <DataTable<Club>
                    columns={columns}
                    data={accumulatedClubs}
                    onRowClick={handleRowClick}
                    getRowKey={(club) => club.id}
                    emptyMessage={t('club.noClubs', 'No clubs found')}
                  />
                  {loading && (
                    <div className="py-4 flex justify-center">
                      <LoadingProgress size="small" />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};
