import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout, TopBar, ActionBar, Icon, LoadingProgress } from '../common';
import { DateRangeSelectionDialog } from '../common/period/DateRangeSelectionDialog';
import { LineChart, PieChart, CHART_COLORS, SeriesConfig, MultiSeriesPoint, flattenMultiSeries } from '../common';
import { formatShortDateRange, toLocalISODate } from '../../utils/formatHelper';
import { FilterButton } from '../common/data-grid/FilterButton';
import { Filter, FilterType } from '../../types/FilterTypes';
import { useAnalytics, AnalyticsFilter } from '../../hooks/useAnalytics';
import { useLocationSelector } from '../../context/LocationContext';
import { showErrorToast } from '../../utils/toastHelper';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

const formatNumber = (value: number) =>
  new Intl.NumberFormat('id-ID').format(value);

const TOP_X = 10;

export const AnalyticsPage: React.FC = () => {
  const { t } = useTranslation();
  const { selectedLocationId } = useLocationSelector();
  const [dateRangeDialogOpen, setDateRangeDialogOpen] = useState(false);
  const [dateRangeStart, setDateRangeStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return toLocalISODate(d);
  });
  const [dateRangeEnd, setDateRangeEnd] = useState(() => toLocalISODate(new Date()));
  const [refreshKey, setRefreshKey] = useState(0);
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

  const analyticsFilter = useMemo<AnalyticsFilter>(() => ({
    locationId: selectedLocationId || undefined,
    from: dateRangeStart ? `${dateRangeStart}T00:00:00+07:00` : undefined,
    to: dateRangeEnd ? `${dateRangeEnd}T00:00:00+07:00` : undefined,
    minCourtCount: courtCountFilter.numberFilter?.min ?? undefined,
    maxCourtCount: courtCountFilter.numberFilter?.max ?? undefined,
    minPrice: priceRangeFilter.numberFilter?.min ?? undefined,
    maxPrice: priceRangeFilter.numberFilter?.max ?? undefined,
  }), [dateRangeStart, dateRangeEnd, selectedLocationId, courtCountFilter, priceRangeFilter, refreshKey]);

  const analyticsFilters = useMemo(() => [courtCountFilter, priceRangeFilter], [courtCountFilter, priceRangeFilter]);

  const {
    loading: dataLoading,
    loadingStates,
    error,
    bookingTrend,
    bookingsPerClub,
    clubsPerCityGrowth,
    courtsPerCityGrowth,
    bookingDistribution,
    clubsPerCity,
    priceDistribution,
    courtDistribution,
    summary,
  } = useAnalytics(analyticsFilter, TOP_X, refreshKey);

  const prevErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (error && error !== prevErrorRef.current) {
      showErrorToast(error);
    }
    prevErrorRef.current = error;
  }, [error]);

  const clubSeriesConfig = useMemo((): SeriesConfig[] => {
    if (bookingsPerClub.length === 0) return [];
    const firstItem = bookingsPerClub[0];
    return firstItem.series.map((s, i) => ({
      dataKey: s.name,
      color: CHART_COLORS[i % CHART_COLORS.length],
      name: s.name,
    }));
  }, [bookingsPerClub]);

  const cityGrowthSeries = useMemo((): SeriesConfig[] => {
    if (clubsPerCityGrowth.length === 0) return [];
    const firstItem = clubsPerCityGrowth[0];
    return firstItem.series.map((s, i) => ({
      dataKey: s.name,
      color: CHART_COLORS[i % CHART_COLORS.length],
      name: s.name,
    }));
  }, [clubsPerCityGrowth]);

  const flatBookingsPerClub = useMemo(() => flattenMultiSeries(bookingsPerClub), [bookingsPerClub]);
  const flatClubGrowth = useMemo(() => flattenMultiSeries(clubsPerCityGrowth), [clubsPerCityGrowth]);
  const flatCourtGrowth = useMemo(() => flattenMultiSeries(courtsPerCityGrowth), [courtsPerCityGrowth]);

  const trendData = useMemo(() =>
    bookingTrend.map((d) => ({ date: d.label, value: d.value })),
    [bookingTrend]
  );

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
  };

  const isDaily = useMemo(() => {
    const s = new Date(dateRangeStart + 'T00:00:00');
    const e = new Date(dateRangeEnd + 'T00:00:00');
    const days = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
    return days <= 31;
  }, [dateRangeStart, dateRangeEnd]);

  return (
    <MainLayout>
      <div className="flex flex-col h-full">
        <TopBar title={t('analytics.title', 'Analytics')} />
        <div className="flex-1 flex flex-col min-h-0 p-2 md:p-3">
          <ActionBar
            gridTitle={
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Icon name="chart-bar" size={14} className="text-brand-600" />
                <span>{isDaily ? t('analytics.daily', 'Daily') : t('analytics.monthly', 'Monthly')}</span>
              </div>
            }
            isLoading={dataLoading}
            hideSearchBar
            hideBackButton
            hideRefreshButton={false}
            onRefresh={handleRefresh}
            filters={
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div
                    className="inline-flex items-center gap-2 h-9 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-brand-600 dark:text-brand-400 cursor-pointer hover:bg-brand-50 dark:hover:bg-slate-700 transition-colors"
                    onClick={() => setDateRangeDialogOpen(true)}
                  >
                    <Icon name="calendar" size={16} />
                    <span className="hidden sm:inline">
                      {formatShortDateRange(dateRangeStart, dateRangeEnd)}
                    </span>
                    <span className="sm:hidden text-xs">
                      {formatShortDateRange(dateRangeStart, dateRangeEnd)}
                    </span>
                  </div>
                  <DateRangeSelectionDialog
                    isOpen={dateRangeDialogOpen}
                    startDate={dateRangeStart}
                    endDate={dateRangeEnd}
                    onApply={(start, end) => {
                      setDateRangeStart(start);
                      setDateRangeEnd(end);
                      setDateRangeDialogOpen(false);
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

          <div className="grid grid-cols-3 gap-3 mb-3">
            {loadingStates.summary ? (
              <div className="col-span-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 flex items-center justify-center">
                <LoadingProgress size="medium" text={t('analytics.loadingSummary', 'Loading summary...')} />
              </div>
            ) : (
              <>
                {[
                  { label: t('dashboard.totalClubs', 'Total Clubs'), value: formatNumber(summary.totalClubs), icon: 'building', color: 'bg-brand-500' },
                  { label: t('dashboard.totalBookings', 'Total Bookings'), value: formatNumber(summary.totalBookings), icon: 'calendar', color: 'bg-blue-500' },
                  { label: t('dashboard.totalRevenue', 'Total Revenue'), value: formatCurrency(summary.totalRevenue), icon: 'dollar', color: 'bg-amber-500' },
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
              </>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(380px,1fr)] gap-3 min-h-0 flex-1 overflow-auto sidebar-scrollbar">
            <div className="space-y-4">
              {loadingStates.bookingTrend ? (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 flex items-center justify-center min-h-[200px]">
                  <LoadingProgress size="small" text={t('analytics.loadingChart', 'Loading chart...')} />
                </div>
              ) : (
                <LineChart
                  chartId="booking-trend"
                  data={trendData}
                  series={[{ dataKey: 'value', color: '#6366f1', name: 'Bookings' }]}
                  useArea
                  areaColor="#6366f1"
                  areaGradientId="bookingTrendGrad"
                  title={t('analytics.bookingTrend', 'Booking Trend')}
                   icon="chevron-up"
                />
              )}

              {loadingStates.bookingsPerClub ? (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 flex items-center justify-center min-h-[200px]">
                  <LoadingProgress size="small" text={t('analytics.loadingChart', 'Loading chart...')} />
                </div>
              ) : (
                <LineChart
                  chartId="bookings-per-club"
                  data={flatBookingsPerClub as MultiSeriesPoint[]}
                  series={clubSeriesConfig}
                  showLegend
                  title={t('analytics.bookingsPerClub', `Bookings per Club (Top ${TOP_X})`)}
                  icon="chart-bar"
                />
              )}

              {loadingStates.clubsPerCityGrowth ? (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 flex items-center justify-center min-h-[200px]">
                  <LoadingProgress size="small" text={t('analytics.loadingChart', 'Loading chart...')} />
                </div>
              ) : (
                <LineChart
                  chartId="club-growth-city"
                  data={flatClubGrowth as MultiSeriesPoint[]}
                  series={cityGrowthSeries}
                  showLegend
                  title={t('analytics.clubsPerCityGrowth', 'Clubs per City (Growth)')}
                  icon="building"
                />
              )}

              {loadingStates.courtsPerCityGrowth ? (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 flex items-center justify-center min-h-[200px]">
                  <LoadingProgress size="small" text={t('analytics.loadingChart', 'Loading chart...')} />
                </div>
              ) : (
                <LineChart
                  chartId="court-growth-city"
                  data={flatCourtGrowth as MultiSeriesPoint[]}
                  series={cityGrowthSeries}
                  showLegend
                  title={t('analytics.courtsPerCityGrowth', 'Courts per City (Growth)')}
                  icon="list"
                />
              )}
            </div>

            <div className="space-y-4">
              {loadingStates.bookingDistribution ? (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 flex items-center justify-center min-h-[200px]">
                  <LoadingProgress size="small" text={t('analytics.loadingChart', 'Loading chart...')} />
                </div>
              ) : (
                <PieChart
                  chartId="booking-distribution"
                  data={bookingDistribution}
                  title={t('analytics.bookingDistribution', `Booking Distribution (Top ${TOP_X})`)}
                  icon="chart-pie"
                  valueFormatter={(v) => formatNumber(v) + ' bookings'}
                />
              )}

              {loadingStates.clubsPerCity ? (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 flex items-center justify-center min-h-[200px]">
                  <LoadingProgress size="small" text={t('analytics.loadingChart', 'Loading chart...')} />
                </div>
              ) : (
                <PieChart
                  chartId="clubs-per-city"
                  data={clubsPerCity}
                  title={t('analytics.clubDistribution', 'Clubs per City')}
                  icon="map-pin"
                  valueFormatter={(v) => formatNumber(v) + ' clubs'}
                />
              )}

              {loadingStates.priceDistribution ? (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 flex items-center justify-center min-h-[200px]">
                  <LoadingProgress size="small" text={t('analytics.loadingChart', 'Loading chart...')} />
                </div>
              ) : (
                <PieChart
                  chartId="price-distribution"
                  data={priceDistribution}
                  title={t('analytics.priceDistribution', 'Price Distribution')}
                  icon="dollar"
                  valueFormatter={(v) => formatNumber(v) + ' clubs'}
                />
              )}

              {loadingStates.courtDistribution ? (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 flex items-center justify-center min-h-[200px]">
                  <LoadingProgress size="small" text={t('analytics.loadingChart', 'Loading chart...')} />
                </div>
              ) : (
                <PieChart
                  chartId="court-distribution"
                  data={courtDistribution}
                  title={t('analytics.courtDistribution', 'Court Count Distribution')}
                  icon="list"
                  valueFormatter={(v) => formatNumber(v) + ' clubs'}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};
