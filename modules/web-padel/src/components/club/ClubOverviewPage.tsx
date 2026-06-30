import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@apollo/client/react';
import { gql } from '../../utils/apollo';
import { MainLayout, TopBar, ActionBar, Icon, GoogleMapView } from '../common';
import { DateRangeSelectionDialog } from '../common/period/DateRangeSelectionDialog';
import { formatNumber, formatCurrency, formatShortDateRange, toLocalISODate } from '../../utils/formatHelper';
import { isValidWhatsApp, formatWhatsAppDisplay, formatWhatsAppLink } from '../../utils/whatsapp';
import { LineChart } from '../common';
import { LoadingProgress } from '../common/feedback/LoadingProgress';
import { OccupancyHeatmap } from './ClubOverviewCharts';
import { PriceHeatmap } from './PriceHeatmap';

const STANDARD_TIMESLOTS = [
  '06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00',
  '20:00', '21:00', '22:00'
];

const GET_CLUB_DETAIL = gql`
  query GetClubDetail($id: String!) {
    club(id: $id) {
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
    }
  }
`;

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
      revenueChart {
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
      priceMap {
        day
        slots {
          time
          price
        }
      }
    }
  }
`;

export const ClubOverviewPage: React.FC = () => {
  const { t } = useTranslation();
  const { clubId } = useParams<{ clubId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Date filters
  const [dateRangeDialogOpen, setDateRangeDialogOpen] = useState(false);
  const [dateRangeStart, setDateRangeStart] = useState(() => {
    const now = new Date();
    const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    console.log('[ClubOverview] today local:', toLocalISODate(now), 'defaultStart:', start);
    return start;
  });
  const [dateRangeEnd, setDateRangeEnd] = useState(() => {
    const now = new Date();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const end = toLocalISODate(yesterday);
    console.log('[ClubOverview] today local:', toLocalISODate(now), 'defaultEnd:', end);
    return end;
  });

  // Fetch actual club details from the database
  const { data: clubDetailData, loading: clubLoading } = useQuery<any>(GET_CLUB_DETAIL, {
    variables: { id: clubId || '' },
    skip: !clubId,
  });

  const clubDetail = useMemo(() => {
    const club = clubDetailData?.club;
    if (club) {
      return {
        id: club.id,
        name: club.name || 'Padel Club',
        subName: club.subName || undefined,
        address: club.address || 'Address not specified',
        email: club.email,
        whatsapp: club.whatsapp,
        instagram: club.instagram,
        logoPath: club.logoPath,
        lat: club.lat || -6.2297,
        lng: club.lng || 106.8294,
        linkMap: club.linkMap,
        price: club.price || 150000,
        courtCount: club.courtCount,
      };
    }
    return {
      id: '',
      name: clubLoading ? 'Loading...' : 'Grand Padel Arena',
      subName: undefined,
      address: 'Jl. Padel Utama No. 10, Jakarta',
      email: undefined,
      whatsapp: undefined,
      instagram: undefined,
      logoPath: undefined,
      lat: -6.2297,
      lng: 106.8294,
      linkMap: undefined,
      price: 160000,
      courtCount: undefined,
    };
  }, [clubDetailData, clubLoading]);

  // Format date range values into ISO-8601 strings expected by the backend analytics API
  const fromISO = useMemo(() => dateRangeStart ? `${dateRangeStart}T00:00:00+07:00` : '', [dateRangeStart]);
  const toISO = useMemo(() => dateRangeEnd ? `${dateRangeEnd}T00:00:00+07:00` : '', [dateRangeEnd]);

  // Fetch actual performance analytics from the database
  const { data: performanceData, loading: performanceLoading } = useQuery<any>(GET_CLUB_PERFORMANCE_ANALYTICS, {
    variables: {
      input: {
        clubId: clubId || '',
        from: fromISO,
        to: toISO,
      },
    },
    skip: !clubId,
    fetchPolicy: 'network-only',
  });

  const performance = useMemo(() => {
    const analytics = performanceData?.getClubPerformanceAnalytics;
    if (analytics) {
      return {
        metrics: {
          totalBookings: analytics.metrics.totalBookings,
          avgDailyBookings: analytics.metrics.avgDailyBookings,
          totalRevenue: analytics.metrics.totalRevenue,
          avgDailyRevenue: analytics.metrics.avgDailyRevenue,
        },
        bookingChartData: analytics.bookingChart || [],
        revenueChartData: analytics.revenueChart || [],
        occupancyRows: analytics.occupancyHeatmap?.map((row: any) => ({
          period: row.day,
          slots: row.slots || [],
        })) || [],
        priceRows: analytics.priceMap || [],
      };
    }

    return {
      metrics: {
        totalBookings: 0,
        avgDailyBookings: 0,
        totalRevenue: 0,
        avgDailyRevenue: 0,
      },
      bookingChartData: [],
      revenueChartData: [],
      occupancyRows: [],
      priceRows: [],
    };
  }, [performanceData]);

  const { metrics, bookingChartData, revenueChartData, occupancyRows, priceRows } = performance;
  console.log('[ClubOverview] selectedPeriod:', { dateRangeStart, dateRangeEnd });

  // Construct Custom TopBar titleIcon displaying the club's logo or initial
  const logoUrl = clubDetail.logoPath ? `https://static.courtside.id/${clubDetail.logoPath}` : null;
  const titleIcon = (
    <div className="w-8 h-8 rounded-lg bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center overflow-hidden flex-shrink-0 mr-1 shadow-sm">
      {logoUrl ? (
        <img src={logoUrl} alt={clubDetail.name} className="w-full h-full object-cover" />
      ) : (
        <span className="text-brand-700 dark:text-brand-400 font-bold text-xs">
          {clubDetail.name.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );

  return (
    <MainLayout>
      <div className="flex flex-col h-full">
        <TopBar
          title={clubDetail.subName ? `${clubDetail.name} · ${clubDetail.subName}` : clubDetail.name}
          showLocationSelector={false}
          titleIcon={titleIcon}
        />

        <div className="flex-1 flex flex-col min-h-0 p-2 md:p-3 overflow-y-auto sidebar-scrollbar">
          {/* Action Bar with Date Selection & Back Button */}
          <ActionBar
            gridTitle={
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Icon name="chart-bar" size={14} className="text-brand-600" />
                <span>{t('dashboard.clubPerformance', 'Performance Summary')}:</span>
              </div>
            }
            isLoading={clubLoading || performanceLoading}
            hideSearchBar
            onBackAction={() => navigate(-1)}
            hideBackButton={false}
            hideRefreshButton={true}
            filters={
              <div className="flex items-center gap-2">
                {/* Date Filter */}
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
                      const params = new URLSearchParams(searchParams);
                      params.set('from', start);
                      params.set('to', end);
                      navigate(`?${params.toString()}`, { replace: true });
                      setDateRangeDialogOpen(false);
                    }}
                    onClose={() => setDateRangeDialogOpen(false)}
                  />
                </div>
              </div>
            }
          />

           {/* 1. Top Panel: Metrics Cards */}
           <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
             {[
               { label: t('dashboard.totalBookings', 'Total Booking'), value: formatNumber(metrics.totalBookings), icon: 'calendar', color: 'bg-emerald-500' },
               { label: t('dashboard.avgDailyBookings', 'Average Daily Booking'), value: formatNumber(Math.round(metrics.avgDailyBookings)), icon: 'clock', color: 'bg-teal-500' },
               { label: t('dashboard.totalRevenue', 'Total Revenue'), value: formatCurrency(metrics.totalRevenue), icon: 'dollar', color: 'bg-blue-500' },
               { label: t('dashboard.avgDailyRevenue', 'Avg Daily Revenue'), value: formatCurrency(metrics.avgDailyRevenue), icon: 'chart-bar', color: 'bg-amber-500' },
             ].map((card) => (
               <div key={card.label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-3">
                 <div className={`w-10 h-10 ${card.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                   <Icon name={card.icon as any} size={20} className="text-white" />
                 </div>
                 <div className="min-w-0 flex-1">
                   <div className="text-[10px] font-semibold text-brand-500 dark:text-slate-400 uppercase tracking-wider">{card.label}</div>
                   {performanceLoading ? (
                     <div className="mt-1 h-5 w-20 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                   ) : (
                     <div className="text-md lg:text-lg font-black text-slate-800 dark:text-slate-200 mt-0.5 truncate">{card.value}</div>
                   )}
                 </div>
               </div>
             ))}
           </div>

          {/* Main Grid: Left (Main Content) & Right (Sidebar details) */}
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(380px,1fr)] gap-3 min-h-0 flex-1">

            {/* Left Content Column */}
            <div className="space-y-4">
             {/* Booking Line Chart Card */}
             <LineChart
               data={bookingChartData.map((d: any) => ({ date: d.label, value: d.value }))}
               series={[{ dataKey: 'value', color: '#059669', name: 'Bookings' }]}
               useArea
               areaColor="#059669"
               areaGradientId="bookingsGrad"
               height={280}
               title={t('dashboard.bookingCount', 'Booking Analytics')}
               icon="calendar"
               loading={performanceLoading}
             />

             {/* Revenue Line Chart Card */}
             <LineChart
               data={revenueChartData.map((d: any) => ({ date: d.label, value: d.value }))}
               series={[{ dataKey: 'value', color: '#2563eb', name: 'Revenue' }]}
               useArea
               areaColor="#2563eb"
               areaGradientId="revenueGrad"
               isCurrency
               height={280}
               title={t('dashboard.revenue', 'Revenue Analytics')}
               icon="dollar"
               loading={performanceLoading}
             />

               {/* Occupancy Heatmap Grid Card */}
               <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                 <div className="flex items-center justify-between mb-3">
                   <div className="flex items-center gap-2">
                     <Icon name="list" size={16} className="text-teal-600" />
                     <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Court Occupancy Rate Heatmap</h3>
                   </div>
                   {performanceLoading && <LoadingProgress size="small" />}
                 </div>
                <OccupancyHeatmap timeSlots={STANDARD_TIMESLOTS} rows={occupancyRows} yAxisLabel="Day" loading={performanceLoading} totalCourts={clubDetail.courtCount} />
                </div>

                {/* Price Map Grid Card */}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Icon name="dollar" size={16} className="text-amber-600" />
                      <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Price Map</h3>
                    </div>
                    {performanceLoading && <LoadingProgress size="small" />}
                  </div>
                  <PriceHeatmap timeSlots={STANDARD_TIMESLOTS} rows={priceRows} loading={performanceLoading} />
                </div>
             </div>

            <div className="h-full">
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden flex flex-col sticky top-3 h-full">
                {/* 1/3 Section: Map directly without padding */}
                <div className="h-1/3 min-h-[220px] w-full relative border-b border-slate-100 dark:border-slate-700">
                  <GoogleMapView
                    center={{ lat: clubDetail.lat, lng: clubDetail.lng }}
                    zoom={14}
                    markers={[
                      {
                        id: clubDetail.id,
                        position: { lat: clubDetail.lat, lng: clubDetail.lng },
                        name: clubDetail.name,
                        logoPath: clubDetail.logoPath,
                        color: '#059669',
                        popupContent: (
                          <div className="font-bold text-xs">
                            {clubDetail.name}
                            {clubDetail.subName && (
                              <span className="text-slate-400"> · {clubDetail.subName}</span>
                            )}
                          </div>
                        ),
                      },
                    ]}
                  />
                </div>

                {/* 2/3 Section: Club Details with scrollable padding */}
                <div className="h-2/3 p-4 overflow-y-auto sidebar-scrollbar flex flex-col min-h-0">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm mb-4 border-b border-slate-100 dark:border-slate-700 pb-2 flex items-center gap-2">
                    <Icon name="tennis-ball" size={16} className="text-brand-600 dark:text-brand-400" />
                    <span>Club Details</span>
                  </h3>

                  <div className="space-y-4 text-xs">
                    <div className="flex items-start gap-2.5">
                      <Icon name="building" size={16} className="text-slate-400 mt-0.5" />
                      <div>
                        <div className="text-[10px] font-medium text-brand-500 dark:text-slate-500 uppercase tracking-wider">Address</div>
                        <div className="text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed font-normal">{clubDetail.address}</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <Icon name="dollar" size={16} className="text-slate-400 mt-0.5" />
                      <div>
                        <div className="text-[10px] font-medium text-brand-500 dark:text-slate-500 uppercase tracking-wider">Base Price</div>
                        <div className="text-slate-600 dark:text-slate-300 mt-0.5 font-normal">{formatCurrency(clubDetail.price || 150000)} / hour</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <Icon name="list" size={16} className="text-slate-400 mt-0.5" />
                      <div>
                        <div className="text-[10px] font-medium text-brand-500 dark:text-slate-500 uppercase tracking-wider">Total Courts</div>
                        <div className="text-slate-600 dark:text-slate-300 mt-0.5 font-normal">
                          {clubDetail.courtCount !== undefined && clubDetail.courtCount !== null
                            ? `${clubDetail.courtCount} courts available`
                            : 'No courts specified'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <Icon name="clock" size={16} className="text-slate-400 mt-0.5" />
                      <div>
                        <div className="text-[10px] font-medium text-brand-500 dark:text-slate-500 uppercase tracking-wider">Operating Hours</div>
                        <div className="text-slate-600 dark:text-slate-300 mt-0.5 font-normal">Monday - Sunday, 06:00 - 23:00</div>
                      </div>
                    </div>

                    {isValidWhatsApp(clubDetail.whatsapp) && (
                      <div className="flex items-start gap-2.5">
                        <Icon name="phone" size={16} className="text-brand-500 mt-0.5" />
                        <div>
                          <div className="text-[10px] font-medium text-brand-500 dark:text-slate-500 uppercase tracking-wider">WhatsApp</div>
                          <a href={`https://wa.me/${formatWhatsAppLink(clubDetail.whatsapp)}`} target="_blank" rel="noopener noreferrer" className="text-brand-600 dark:text-brand-400 hover:underline mt-0.5 block font-normal">
                            {formatWhatsAppDisplay(clubDetail.whatsapp)}
                          </a>
                        </div>
                      </div>
                    )}

                    {clubDetail.instagram && (
                      <div className="flex items-start gap-2.5">
                        <Icon name="user" size={16} className="text-slate-400 mt-0.5" />
                        <div>
                          <div className="text-[10px] font-medium text-brand-500 dark:text-slate-500 uppercase tracking-wider">Instagram</div>
                          <a href={`https://instagram.com/${clubDetail.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-brand-600 dark:text-brand-400 hover:underline mt-0.5 block font-normal">
                            {clubDetail.instagram}
                          </a>
                        </div>
                      </div>
                    )}

                    {clubDetail.email && (
                      <div className="flex items-start gap-2.5">
                        <Icon name="info" size={16} className="text-slate-400 mt-0.5" />
                        <div>
                          <div className="text-[10px] font-medium text-brand-500 dark:text-slate-500 uppercase tracking-wider">Email</div>
                          <a href={`mailto:${clubDetail.email}`} className="text-brand-600 dark:text-brand-400 hover:underline mt-0.5 block font-normal">
                            {clubDetail.email}
                          </a>
                        </div>
                      </div>
                    )}

                    {clubDetail.linkMap && (
                      <div className="flex items-start gap-2.5">
                        <Icon name="map-pin" size={16} className="text-slate-400 mt-0.5" />
                        <div>
                          <div className="text-[10px] font-medium text-brand-500 dark:text-slate-500 uppercase tracking-wider">Directions</div>
                          <a href={clubDetail.linkMap} target="_blank" rel="noopener noreferrer" className="text-brand-600 dark:text-brand-400 hover:underline mt-0.5 block font-normal">
                            Open in Google Maps
                          </a>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start gap-2.5">
                      <Icon name="info" size={16} className="text-slate-400 mt-0.5" />
                      <div>
                        <div className="text-[10px] font-medium text-brand-500 dark:text-slate-500 uppercase tracking-wider">Facilities Available</div>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {['Cafe & Juice Bar', 'Secured Parking', 'Premium Showers', 'Pro Shop', 'Equipment Rental', 'Free Wi-Fi'].map((f) => (
                            <span
                              key={f}
                              className="px-2 py-1 rounded bg-slate-50 dark:bg-slate-800 text-[10px] text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-700 font-normal"
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </MainLayout>
  );
};
