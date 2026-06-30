import React from 'react';
import { useTranslation } from 'react-i18next';
import { DashboardClubRow } from '../../types/padel';
import { formatNumber, getMarkerColor } from '../../utils/formatHelper';
import { ClubName } from '../club/ClubName';

const LOGO_BASE = 'https://static.courtside.id/';
const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

interface ClubCardItemProps {
  row: DashboardClubRow;
  index: number;
}

export const ClubCardItem: React.FC<ClubCardItemProps> = ({ row, index }) => {
  const { t } = useTranslation();
  const logoUrl = row.club.logoPath ? `${LOGO_BASE}${row.club.logoPath}` : null;

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 hover:border-brand-400 dark:hover:border-brand-600 transition-all">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center overflow-hidden flex-shrink-0">
          {logoUrl ? (
            <img src={logoUrl} alt={row.club.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-brand-700 dark:text-brand-400 font-bold text-xs">
              {row.club.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <ClubName name={row.club.name} subName={row.club.subName} className="truncate" />
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: getMarkerColor(index) }} />
          </div>
          <div className="text-[11px] text-slate-400 truncate">{row.club.address || '-'}</div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-sm font-bold text-brand-600">{formatNumber(row.bookingCount)}</div>
          <div className="text-[10px] text-slate-400">{t('dashboard.bookings', 'bookings')}</div>
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
        <span className="text-[11px] text-slate-500">{t('dashboard.price', 'Price')}: {row.club.price != null ? formatCurrency(row.club.price) : '-'}</span>
        <span className="text-xs font-bold text-brand-600">{row.totalRevenue > 0 ? formatCurrency(row.totalRevenue) : '-'}</span>
      </div>
    </div>
  );
};