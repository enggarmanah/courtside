import React, { useState, useRef, useEffect, useMemo } from 'react';
import { apolloClient, gql } from '../../utils/apollo';

const GET_ALL_CLUBS = gql`
  query GetClubs($input: ClubsInput!) {
    clubs(input: $input) {
      clubs {
        id
        name
        subName
        logoPath
      }
    }
  }
`;

interface ClubOption {
  id: string;
  name: string;
  subName?: string;
  logoPath?: string;
}

interface ClubSelectorProps {
  selectedClubIds: string[];
  onChange: (clubIds: string[]) => void;
  maxClubs?: number;
  locationId?: string;
}

export const ClubSelector: React.FC<ClubSelectorProps> = ({
  selectedClubIds,
  onChange,
  maxClubs = 10,
  locationId,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [clubs, setClubs] = useState<ClubOption[]>([]);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchClubs = async () => {
      setLoading(true);
      try {
        const input: any = { page: 1, pageSize: 500, sortField: 'name', sortOrder: 'asc' };
        if (locationId) input.locationId = locationId;
        const result = await apolloClient.query({
          query: GET_ALL_CLUBS,
          variables: { input },
          fetchPolicy: 'network-only',
        });
        if (!cancelled) {
          const items = (result.data as any)?.clubs?.clubs || [];
          setClubs(items.map((c: any) => ({
            id: c.id,
            name: c.name,
            subName: c.subName ?? undefined,
            logoPath: c.logoPath ?? undefined,
          })));
        }
      } catch {
        if (!cancelled) setClubs([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchClubs();
    return () => { cancelled = true; };
  }, [locationId]);

  const filteredClubs = useMemo(() => {
    if (!search.trim()) return clubs;
    const q = search.toLowerCase();
    return clubs.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.subName && c.subName.toLowerCase().includes(q))
    );
  }, [clubs, search]);

  const visibleClubs = useMemo(() => filteredClubs.slice(0, 10), [filteredClubs]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleClub = (clubId: string) => {
    if (selectedClubIds.includes(clubId)) {
      onChange(selectedClubIds.filter((id) => id !== clubId));
    } else {
      if (selectedClubIds.length >= maxClubs) return;
      onChange([...selectedClubIds, clubId]);
    }
  };

  const selectedClubs = clubs.filter((c) => selectedClubIds.includes(c.id));

  return (
    <div className="relative" ref={dropdownRef}>
      <div
        className="inline-flex items-center gap-2 h-9 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-brand-600 dark:text-brand-400 cursor-pointer hover:bg-brand-50 dark:hover:bg-slate-700 transition-colors"
        style={{ width: '200px' }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor" className="flex-shrink-0">
          <path d="M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,48v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48V48ZM48,208V96H208V208Z" />
        </svg>
        <span className="truncate flex-1 min-w-0">
          {selectedClubIds.length === 0
            ? 'Select Clubs'
            : `${selectedClubIds.length} club${selectedClubIds.length > 1 ? 's' : ''} selected`}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 256 256"
          fill="currentColor"
          className={`flex-shrink-0 ml-auto transition-transform ${isOpen ? 'rotate-180' : ''}`}
        >
          <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z" />
        </svg>
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 top-[calc(100%+8px)] bg-white dark:bg-slate-800 rounded-2xl shadow-lg z-[9990] border border-slate-200 dark:border-slate-700 max-h-[700px] flex flex-col overflow-hidden" style={{ width: '300px' }}>
            <div className="p-3 border-b border-slate-100 dark:border-slate-700">
              <input
                type="text"
                placeholder="Search clubs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-9 px-3 rounded-3xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                autoFocus
              />
              {selectedClubIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {selectedClubs.map((club) => (
                    <span
                      key={club.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-[11px] font-semibold"
                    >
                      {club.name}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleClub(club.id);
                        }}
                        className="hover:text-red-500 transition-colors"
                        type="button"
                      >
                        <svg width="10" height="10" viewBox="0 0 256 256" fill="currentColor">
                          <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto sidebar-scrollbar">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <span className="text-sm text-slate-400">Loading clubs...</span>
                </div>
              ) : filteredClubs.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <span className="text-sm text-slate-400">No clubs found</span>
                </div>
              ) : (
                visibleClubs.map((club) => {
                  const isSelected = selectedClubIds.includes(club.id);
                  const isDisabled = !isSelected && selectedClubIds.length >= maxClubs;
                  const logoUrl = club.logoPath ? `https://static.courtside.id/${club.logoPath}` : null;

                  return (
                    <div
                      key={club.id}
                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                        isDisabled
                          ? 'opacity-40 cursor-not-allowed'
                          : isSelected
                          ? 'bg-brand-50 dark:bg-brand-900/20'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                      }`}
                      onClick={() => !isDisabled && toggleClub(club.id)}
                    >
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-brand-600 border-brand-600'
                            : 'border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {isSelected && (
                          <svg width="12" height="12" viewBox="0 0 256 256" fill="white">
                            <path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z" />
                          </svg>
                        )}
                      </div>
                      <div className="w-8 h-8 rounded-lg bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {logoUrl ? (
                          <img src={logoUrl} alt={club.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-brand-700 dark:text-brand-400 font-bold text-xs">
                            {club.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {club.name}
                        </div>
                        {club.subName && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {club.subName}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              {filteredClubs.length > 10 && (
                <div className="px-3 py-2 text-[11px] text-slate-400 dark:text-slate-500 text-center border-t border-slate-100 dark:border-slate-700/50">
                  Showing 10 of {filteredClubs.length} clubs — refine search
                </div>
              )}
            </div>

            <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              {selectedClubIds.length}/{maxClubs} clubs selected
            </div>
          </div>
        </>
      )}
    </div>
  );
};
