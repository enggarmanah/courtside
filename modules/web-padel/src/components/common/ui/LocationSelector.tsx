import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@apollo/client/react';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import { useLocationSelector } from '../../../context/LocationContext';
import { gql } from '../../../utils/apollo';
import { Location } from '../../../types/padel';

const GET_LOCATIONS = gql`
  query GetLocations {
    getLocations {
      id
      name
    }
  }
`;

export const LocationSelector: React.FC = () => {
  const { selectedLocationId, setSelectedLocationId } = useLocationSelector();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  const { data } = useQuery<{ getLocations: Location[] }>(GET_LOCATIONS);
  const locations = data?.getLocations || [];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedLocation = locations.find((l) => l.id === selectedLocationId);
  const selectedLocationName = selectedLocation?.name || t('dashboard.allLocations', 'All Locations');

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group flex items-center justify-between px-2 h-9 w-[200px] bg-slate-100/50 hover:bg-white border border-slate-300 rounded-xl transition-all dark:bg-slate-800/50 dark:border-slate-700 dark:hover:bg-slate-800"
      >
        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
          <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400">
            <Icon name="building" size={14} weight="duotone" />
          </div>
          <span className="flex items-center h-4 text-sm font-medium text-brand-700 dark:text-slate-200 leading-none truncate">
            {selectedLocationName}
          </span>
        </div>
        <Icon name="chevron-down" size={14} className="flex-shrink-0 text-slate-400 group-hover:text-brand-500 transition-colors" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-md bg-white border border-slate-200 shadow-xl z-20 dark:bg-slate-800 dark:border-slate-700">
            <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
              <span className="text-xs font-semibold text-brand-600 uppercase tracking-widest">Select Location</span>
            </div>
            <div className="p-1.5 max-h-[300px] overflow-auto">
              <button
                onClick={() => {
                  setSelectedLocationId('');
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between rounded-md py-2.5 pl-3 pr-3 text-sm transition-colors ${
                  !selectedLocationId
                    ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-900 dark:text-brand-200 font-bold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <span className="truncate">{t('dashboard.allLocations', 'All Locations')}</span>
                {!selectedLocationId && (
                  <Icon name="check" size={18} weight="bold" className="text-brand-600 dark:text-brand-400 flex-shrink-0 ml-2" />
                )}
              </button>
              {locations.map((location) => (
                <button
                  key={location.id}
                  onClick={() => {
                    setSelectedLocationId(location.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between rounded-md py-2.5 pl-3 pr-3 text-sm transition-colors ${
                    selectedLocationId === location.id
                      ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-900 dark:text-brand-200 font-bold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <span className="truncate">{location.name}</span>
                  {selectedLocationId === location.id && (
                    <Icon name="check" size={18} weight="bold" className="text-brand-600 dark:text-brand-400 flex-shrink-0 ml-2" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};