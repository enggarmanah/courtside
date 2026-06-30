import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { MainLayout, TopBar, ActionBar, LoadingProgress, Icon, GoogleMapView } from '../common';
import { DateRangeSelectionDialog } from '../common/period/DateRangeSelectionDialog';
import { FilterButton } from '../common/data-grid/FilterButton';
import { Filter, FilterType } from '../../types/FilterTypes';
import { useDashboard } from '../../hooks/useDashboard';
import { ClubCardItem } from './ClubCardItem';
import { ClubName } from '../club/ClubName';
import { DashboardClubRow } from '../../types/padel';
import { useLocationSelector } from '../../context/LocationContext';
import { formatDateTime, formatNumber, formatShortDateRange } from '../../utils/formatHelper';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
};

const PAGE_SIZE = 20;

export const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [dateRangeDialogOpen, setDateRangeDialogOpen] = useState(false);
  const [dateRangeStart, setDateRangeStart] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [dateRangeEnd, setDateRangeEnd] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState('booking_count');
  const [sortAscending, setSortAscending] = useState(false);
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
  const { selectedLocationId } = useLocationSelector();

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedLocationId]);

  const dateFilter = useMemo(() => {
    const from = dateRangeStart ? `${dateRangeStart}T00:00:00+07:00` : undefined;
    const to = dateRangeEnd ? `${dateRangeEnd}T00:00:00+07:00` : undefined;
    return { from, to, refreshKey };
  }, [dateRangeStart, dateRangeEnd, refreshKey]);

  const dashboardFilter = useMemo(() => ({
    minCourtCount: courtCountFilter.numberFilter?.min ?? undefined,
    maxCourtCount: courtCountFilter.numberFilter?.max ?? undefined,
    minPrice: priceRangeFilter.numberFilter?.min ?? undefined,
    maxPrice: priceRangeFilter.numberFilter?.max ?? undefined,
  }), [courtCountFilter, priceRangeFilter]);

  const analyticsFilters = useMemo(() => [courtCountFilter, priceRangeFilter], [courtCountFilter, priceRangeFilter]);

  const sort = useMemo(() => ({
    field: sortField,
    order: sortAscending ? 'ASC' : 'DESC',
  }), [sortField, sortAscending]);

  const pagination = useMemo(() => ({
    page: currentPage,
    pageSize: PAGE_SIZE,
  }), [currentPage]);

  const { clubRows, totalClubs, totalBookings, totalRevenue, loading, overviewResult, lastUpdatedAt } = useDashboard(dateFilter, sort, pagination, selectedLocationId || undefined, dashboardFilter);

  const [accumulatedClubRows, setAccumulatedClubRows] = useState<DashboardClubRow[]>([]);

  useEffect(() => {
    if (currentPage === 1) {
      setAccumulatedClubRows(clubRows);
    } else if (clubRows.length > 0) {
      setAccumulatedClubRows((prev) => {
        const existingIds = new Set(prev.map((r) => r.club.id));
        const newRows = clubRows.filter((r) => !existingIds.has(r.club.id));
        return [...prev, ...newRows];
      });
    }
  }, [clubRows, currentPage]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 15;
    if (isAtBottom && !loading && currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const totalPages = overviewResult.totalPages || 1;

  const handleSort = (field: string) => {
    setCurrentPage(1);
    setSortField(field);
    setSortAscending(false);
  };

  const SortIcon: React.FC<{ field: string }> = ({ field }) => {
    if (sortField !== field) return <Icon name="chevron-down" size={12} className="text-slate-300 opacity-40" />;
    return (
      <Icon
        name={sortAscending ? 'chevron-up' : 'chevron-down'}
        size={12}
        className="text-brand-600"
      />
    );
  };

  return (
    <MainLayout>
      <div className="flex flex-col h-full">
        <TopBar title={t('dashboard.title', 'Padelitics Dashboard')} />
        <div className="flex-1 flex flex-col min-h-0 p-2 md:p-3">
          <ActionBar
            gridTitle={
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Icon name="clock" size={14} className="text-brand-600" />
                <span>{t('dashboard.lastUpdate', 'Last update')}:</span>
                <span className="text-brand-600 font-bold">{lastUpdatedAt ? formatDateTime(lastUpdatedAt) : '-'}</span>
              </div>
            }
            isLoading={loading}
            hideSearchBar
            hideBackButton
            hideRefreshButton={false}
            onRefresh={() => { setRefreshKey((k) => k + 1); setCurrentPage(1); }}
            filters={
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="inline-flex items-center gap-2 h-9 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-brand-600 dark:text-brand-400 cursor-pointer hover:bg-brand-50 dark:hover:bg-slate-700 transition-colors" onClick={() => setDateRangeDialogOpen(true)}>
                    <Icon name="calendar" size={16} />
                    <span className="hidden sm:inline">{formatShortDateRange(dateRangeStart, dateRangeEnd)}</span>
                    <span className="sm:hidden text-xs">{formatShortDateRange(dateRangeStart, dateRangeEnd)}</span>
                  </div>
                  <DateRangeSelectionDialog
                    isOpen={dateRangeDialogOpen}
                    startDate={dateRangeStart}
                    endDate={dateRangeEnd}
                    onApply={(start, end) => {
                      setDateRangeStart(start);
                      setDateRangeEnd(end);
                      setDateRangeDialogOpen(false);
                      setCurrentPage(1);
                    }}
                    onClose={() => setDateRangeDialogOpen(false)}
                  />
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
                      });
                    }
                  }}
                  filters={analyticsFilters}
                />
              </div>
            }
          />

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3 mb-3">
            {[
              { label: t('dashboard.totalClubs', 'Total Clubs'), value: formatNumber(totalClubs), icon: 'building', color: 'bg-brand-500' },
              { label: t('dashboard.totalBookings', 'Total Bookings'), value: formatNumber(totalBookings), icon: 'calendar', color: 'bg-blue-500' },
              { label: t('dashboard.totalRevenue', 'Total Revenue'), value: formatCurrency(totalRevenue), icon: 'dollar', color: 'bg-amber-500' },
            ].map((card) => (
              <div key={card.label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-4">
                <div className={`w-12 h-12 ${card.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <Icon name={card.icon as any} size={24} className="text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{card.label}</div>
                  <div className="text-xl font-black text-slate-800 dark:text-slate-200 mt-0.5 truncate">{card.value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Map + Club List */}
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(380px,1fr)] gap-3 min-h-0 flex-1">
            <div className="relative bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden min-h-[300px]">
              {accumulatedClubRows.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <LoadingProgress text={t('common.loading', 'Loading...')} />
                </div>
              ) : (
                <GoogleMapView
                  center={{ lat: -6.2, lng: 106.8 }}
                  zoom={11}
                  fitBounds
                  markers={accumulatedClubRows
                    .filter((r) => r.club.lat && r.club.lng)
                    .map((row) => ({
                      id: row.club.id,
                      position: { lat: row.club.lat, lng: row.club.lng },
                      name: row.club.name,
                      logoPath: row.club.logoPath,
                      colorSeed: row.club.id,
                      address: row.club.address,
                      popupContent: (
                        <div style={{ minWidth: 260 }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                            {row.club.logoPath && (
                              <div style={{ width: 50, height: 50, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, border: '1px solid #e2e8f0' }}>
                                <img
                                  src={`https://static.courtside.id/${row.club.logoPath}`}
                                  alt={row.club.name}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                              </div>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                className="font-bold text-sm text-slate-800 dark:text-slate-200 cursor-pointer hover:underline"
                                style={{ lineHeight: 1.3 }}
                                onClick={() => navigate(`/dashboard/club/${row.club.id}`)}
                              >
                                <ClubName name={row.club.name} subName={row.club.subName} className="font-bold text-sm text-slate-800 dark:text-slate-200 cursor-pointer hover:underline" subClassName="text-xs font-normal text-brand-600 dark:text-slate-500" />
                              </div>
                              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.4 }}>
                                {row.club.address || '-'}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#334155' }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} />
                              {row.bookingCount} bookings
                            </span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#334155' }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
                              {formatCurrency(row.totalRevenue)}
                            </span>
                          </div>
                        </div>
                      ),
                    }))}
                />
              )}
            </div>

            {/* Right: Club List */}
            <div className="min-h-0 overflow-auto sidebar-scrollbar" onScroll={handleScroll}>
              {/* Sort Controls */}
              <div className="flex items-center gap-3 mb-2 px-1">
                <button
                  className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-brand-600 transition-colors"
                  onClick={() => handleSort('booking_count')}
                >
                  {t('dashboard.bookings', 'Bookings')}
                  <SortIcon field="booking_count" />
                </button>
                <button
                  className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-brand-600 transition-colors"
                  onClick={() => handleSort('total_revenue')}
                >
                  {t('dashboard.revenue', 'Revenue')}
                  <SortIcon field="total_revenue" />
                </button>
              </div>

              {accumulatedClubRows.length === 0 && !loading ? (
                <div className="py-12 text-center text-sm text-slate-400">
                  {t('dashboard.noData', 'No data for selected period')}
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {accumulatedClubRows.map((row, index) => (
                      <div
                        key={row.club.id}
                        onClick={() => navigate(`/dashboard/club/${row.club.id}`)}
                        className="cursor-pointer"
                      >
                        <ClubCardItem row={row} index={index} />
                      </div>
                    ))}
                  </div>

                  {loading && (
                    <div className="py-4 flex justify-center">
                      <LoadingProgress size="small" text={t('common.loading', 'Loading...')} />
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