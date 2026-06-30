import React from 'react';
import { Club } from '../../types/padel';
import { Icon } from '../common';
import { ClubName } from './ClubName';
import { formatShortDate } from '../../utils/formatHelper';

interface ClubCardProps {
  club: Club;
  children?: React.ReactNode;
}

export const ClubCard: React.FC<ClubCardProps> = ({ club, children }) => {
  const logoUrl = club.logoPath ? `https://static.courtside.id/${club.logoPath}` : null;

  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center overflow-hidden flex-shrink-0">
        {logoUrl ? (
          <img src={logoUrl} alt={club.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-brand-700 dark:text-brand-400 font-bold text-xs">
            {club.name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate">
          <ClubName name={club.name} subName={club.subName} />
        </div>
        {club.address && (
          <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 truncate">
            <Icon name="map-pin" size={10} className="flex-shrink-0 text-brand-500" />
            <span className="truncate">{club.address}</span>
            {club.courtCount != null && (
              <>
                <span className="flex-shrink-0">·</span>
                <Icon name="tennis-ball" size={10} className="flex-shrink-0 text-brand-500" />
                <span className="whitespace-nowrap">{club.courtCount} Courts</span>
              </>
            )}
            {club.openingDate && (
              <>
                <span className="flex-shrink-0">·</span>
                <Icon name="calendar" size={10} className="flex-shrink-0 text-brand-500" />
                <span className="whitespace-nowrap">{formatShortDate(club.openingDate)}</span>
              </>
            )}
          </div>
        )}
        {!club.address && (
          <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
            {club.courtCount != null && (
              <>
                <Icon name="tennis-ball" size={10} className="flex-shrink-0 text-brand-500" />
                <span>{club.courtCount} Courts</span>
              </>
            )}
            {club.openingDate && (
              <>
                {club.courtCount != null && <span className="flex-shrink-0">·</span>}
                <Icon name="calendar" size={10} className="flex-shrink-0 text-brand-500" />
                <span>{formatShortDate(club.openingDate)}</span>
              </>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
};
