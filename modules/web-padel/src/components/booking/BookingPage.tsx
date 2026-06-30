import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout, TopBar, ActionBar, Icon, LineChart, LoadingProgress } from '../common';
import { OccupancyHeatmap } from '../club/ClubOverviewCharts';
import { ClubCard } from '../club/ClubCard';
import { Club } from '../../types/padel';
import { DateRangeSelectionDialog } from '../common/period/DateRangeSelectionDialog';
import { ClubSelector } from './ClubSelector';
import { useBookingClubs } from './useBookingClubs';
import { useLocationSelector } from '../../context/LocationContext';
import { apolloClient, gql } from '../../utils/apollo';
import { CHART_COLORS, SeriesConfig } from '../common/chart';
import { formatNumber, formatCurrency, formatShortDateRange, toLocalISODate } from '../../utils/formatHelper';

const GET_CLUB_DETAIL = gql`
  query GetClubDetail($id: String!) {
    club(id: $id) {
      id
      name
      subName
      address
      logoPath
      openingDate
      courtCount
    }
  }
`;

const STANDARD_TIMESLOTS = [
  '06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00',
  '20:00', '21:00', '22:00'
];

const MAX_CLUBS = 10;
const STORAGE_KEY = 'padel_bookingClubIds';

const getTodayKey = () => toLocalISODate(new Date());

const loadStoredClubIds = (): string[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_CLUBS) : [];
  } catch {
    return [];
  }
};

export const BookingPage: React.FC = () => {
  const { t } = useTranslation();
  const { selectedLocationId } = useLocationSelector();

  const [selectedClubIds, setSelectedClubIds] = useState<string[]>(loadStoredClubIds);
  const [dateRangeDialogOpen, setDateRangeDialogOpen] = useState(false);
  const [dateRangeStart, setDateRangeStart] = useState(getTodayKey);
  const [dateRangeEnd, setDateRangeEnd] = useState(getTodayKey);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedClubIds));
  }, [selectedClubIds]);

  const { clubAnalytics, loading: analyticsLoading } = useBookingClubs(
    selectedClubIds,
    dateRangeStart,
    dateRangeEnd,
    refreshKey
  );

  const [clubDetailsMap, setClubDetailsMap] = useState<Record<string, Club>>({});

  useEffect(() => {
    if (selectedClubIds.length === 0) {
      setClubDetailsMap({});
      return;
    }
    let cancelled = false;
    const fetchDetails = async () => {
      try {
        const results = await Promise.all(
          selectedClubIds.map((id) =>
            apolloClient.query({
              query: GET_CLUB_DETAIL,
              variables: { id },
              fetchPolicy: 'network-only',
            })
          )
        );
        if (!cancelled) {
          const map: Record<string, Club> = {};
          results.forEach((res) => {
            const c = (res.data as any)?.club;
            if (c) map[c.id] = c;
          });
          setClubDetailsMap(map);
        }
      } catch {
        if (!cancelled) setClubDetailsMap({});
      }
    };
    fetchDetails();
    return () => { cancelled = true; };
  }, [selectedClubIds]);

  const getClubName = (clubId: string) => clubDetailsMap[clubId]?.name || clubId;

  const summaryMetrics = useMemo(() => {
    if (clubAnalytics.length === 0) {
      return { totalBookings: 0, avgDailyBookings: 0, totalRevenue: 0, avgDailyRevenue: 0 };
    }
    const totalBookings = clubAnalytics.reduce((sum, c) => sum + c.metrics.totalBookings, 0);
    const totalRevenue = clubAnalytics.reduce((sum, c) => sum + c.metrics.totalRevenue, 0);
    const avgDailyBookings = clubAnalytics.reduce((sum, c) => sum + c.metrics.avgDailyBookings, 0) / clubAnalytics.length;
    const avgDailyRevenue = clubAnalytics.reduce((sum, c) => sum + c.metrics.avgDailyRevenue, 0) / clubAnalytics.length;
    return { totalBookings, avgDailyBookings, totalRevenue, avgDailyRevenue };
  }, [clubAnalytics]);

  const { mergedChartData, seriesConfig } = useMemo(() => {
    if (clubAnalytics.length === 0) {
      return { mergedChartData: [], seriesConfig: [] as SeriesConfig[] };
    }

    const dateMap: Record<string, Record<string, number>> = {};
    clubAnalytics.forEach((club) => {
      const clubName = getClubName(club.clubId);
      club.bookingChart.forEach((point) => {
        if (!dateMap[point.label]) {
          dateMap[point.label] = { date: point.label } as unknown as Record<string, number>;
        }
        dateMap[point.label][clubName] = point.value;
      });
    });

    const merged = Object.values(dateMap).sort((a, b) => {
      const dateA = new Date((a as any).date as string);
      const dateB = new Date((b as any).date as string);
      return dateA.getTime() - dateB.getTime();
    });

    const series: SeriesConfig[] = clubAnalytics.map((club, idx) => ({
      dataKey: getClubName(club.clubId),
      color: CHART_COLORS[idx % CHART_COLORS.length],
      name: getClubName(club.clubId),
    }));

    return { mergedChartData: merged, seriesConfig: series };
  }, [clubAnalytics, clubDetailsMap]);

  const dateDisplayValue = formatShortDateRange(dateRangeStart, dateRangeEnd);

  return (
    <MainLayout>
      <div className="flex flex-col h-full">
        <TopBar
          title={t('nav.bookings', 'Bookings')}
          showLocationSelector
        />

        <div className="flex-1 flex flex-col min-h-0 p-2 md:p-3 overflow-y-auto sidebar-scrollbar">
          <ActionBar
            gridTitle={
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Icon name="chart-bar" size={14} className="text-brand-600" />
                <span>{t('dashboard.clubPerformance', 'Booking Overview')}:</span>
              </div>
            }
            isLoading={analyticsLoading}
            hideSearchBar
            onRefresh={() => {
              setRefreshKey((k) => k + 1);
            }}
            filters={
              <div className="flex items-center gap-2 flex-wrap">
                <ClubSelector
                  selectedClubIds={selectedClubIds}
                  onChange={setSelectedClubIds}
                  maxClubs={MAX_CLUBS}
                  locationId={selectedLocationId || undefined}
                />
                <div className="relative">
                  <div
                    className="inline-flex items-center gap-2 h-9 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-brand-600 dark:text-brand-400 cursor-pointer hover:bg-brand-50 dark:hover:bg-slate-700 transition-colors"
                    onClick={() => setDateRangeDialogOpen(true)}
                  >
                    <Icon name="calendar" size={16} />
                    <span className="hidden sm:inline">{dateDisplayValue}</span>
                    <span className="sm:hidden text-xs">{dateDisplayValue}</span>
                  </div>
                  <DateRangeSelectionDialog
                    isOpen={dateRangeDialogOpen}
                    startDate={dateRangeStart}
                    endDate={dateRangeEnd}
                    maxDayRange={7}
                    onApply={(start, end) => {
                      setDateRangeStart(start);
                      setDateRangeEnd(end);
                      setDateRangeDialogOpen(false);
                    }}
                    onClose={() => setDateRangeDialogOpen(false)}
                  />
                </div>
              </div>
            }
          />

          {selectedClubIds.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center">
                  <Icon name="calendar" size={36} className="text-brand-400" />
                </div>
                <h3 className="text-md font-semibold text-brand-700 dark:text-slate-300 mb-2">Select Clubs to Begin</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
                  Choose one or more clubs from the dropdown above to view booking analytics and occupancy heatmaps.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                {[
                  { label: t('dashboard.totalBookings', 'Total Booking'), value: summaryMetrics.totalBookings, icon: 'calendar', color: 'bg-emerald-500', format: formatNumber },
                  { label: t('dashboard.avgDailyBookings', 'Average Daily Booking'), value: Math.round(summaryMetrics.avgDailyBookings), icon: 'clock', color: 'bg-teal-500', format: formatNumber },
                  { label: t('dashboard.totalRevenue', 'Total Revenue'), value: summaryMetrics.totalRevenue, icon: 'dollar', color: 'bg-blue-500', format: formatCurrency },
                  { label: t('dashboard.avgDailyRevenue', 'Avg Daily Revenue'), value: Math.round(summaryMetrics.avgDailyRevenue), icon: 'chart-bar', color: 'bg-amber-500', format: formatCurrency },
                ].map((card) => (
                  <div key={card.label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-3">
                    <div className={`w-10 h-10 ${card.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                      <Icon name={card.icon as any} size={20} className="text-white" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-semibold text-brand-500 dark:text-slate-400 uppercase tracking-wider">{card.label}</div>
                      {analyticsLoading && clubAnalytics.length === 0 ? (
                        <div className="h-5 lg:h-6 w-20 mt-0.5 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
                      ) : (
                        <div className="text-md lg:text-lg font-black text-slate-800 dark:text-slate-200 mt-0.5 truncate">{card.format(card.value)}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Main Grid: Left (Heatmaps) | Right (Line Chart) */}
              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(380px,1fr)] gap-3 min-h-0 flex-1">
                {/* Left: Per-club occupancy heatmaps */}
                <div className="space-y-4">
                  {analyticsLoading && clubAnalytics.length === 0 && selectedClubIds.length > 0 ?
                    selectedClubIds.map((clubId) => (
                      <div key={clubId} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 animate-pulse" />
                          <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
                        </div>
                          <div className="flex items-center justify-center py-10">
                          <LoadingProgress size="small" text={t('common.loading', 'Loading...')} />
                        </div>
                      </div>
                    ))
                  : clubAnalytics.length === 0 ? (
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
                      <span className="text-sm text-slate-400">No data available for selected clubs</span>
                    </div>
                  ) : (
                    clubAnalytics.map((club) => (
                      <div key={club.clubId} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <ClubCard club={clubDetailsMap[club.clubId] || { id: club.clubId, name: getClubName(club.clubId), lat: 0, lng: 0, locationId: '' }} />
                          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex-shrink-0 ml-2">
                            {formatNumber(club.metrics.totalBookings)} bookings
                          </span>
                        </div>
                        {club.occupancyRows.length > 0 ? (
                          <OccupancyHeatmap timeSlots={STANDARD_TIMESLOTS} rows={club.occupancyRows} yAxisLabel="Date" totalCourts={clubDetailsMap[club.clubId]?.courtCount} />
                        ) : (
                          <div className="flex items-center justify-center py-6 text-sm text-slate-400">
                            No occupancy data
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Right: Multi-club line chart */}
                <div className="h-full">
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden flex flex-col sticky top-3 h-full">
                    <div className="p-4 flex-1 min-h-0">
                      <LineChart
                        data={mergedChartData}
                        series={seriesConfig}
                        useArea={false}
                        showLegend
                        height={320}
                        title={t('dashboard.bookingCount', 'Bookings Trend')}
                        icon="calendar"
                        loading={analyticsLoading}
                        bordered={false}
                      />
                    </div>
                    <div className="border-t border-slate-100 dark:border-slate-700 p-4">
                      <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm mb-3 flex items-center gap-2">
                        <Icon name="list" size={14} className="text-brand-600" />
                        Club Ranking
                      </h4>
                      <div className="space-y-2">
                        {clubAnalytics.map((club, idx) => (
                          <div key={club.clubId} className="flex items-center gap-2.5">
                            <div
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                            />
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate flex-1">
                              {getClubName(club.clubId)}
                            </span>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              {formatNumber(club.metrics.totalBookings)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
};
