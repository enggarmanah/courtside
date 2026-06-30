import React from 'react';
import { Filter } from '../../../types/FilterTypes';

interface ActiveFilterTagsProps {
  activeFilters: Filter[];
  getFilterDisplayValue: (f: Filter) => string;
  removeFilter: (field: string) => void;
  clearAllFilters: () => void;
}

export const ActiveFilterTags: React.FC<ActiveFilterTagsProps> = ({
  activeFilters, getFilterDisplayValue, removeFilter, clearAllFilters
}) => {
  if (activeFilters.length === 0) return null;

  return (
    <div className="flex items-center flex-wrap gap-1.5">
      {activeFilters.map((filter) => (
        <span
          key={filter.field}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 border border-brand-200 dark:border-brand-800 rounded-full"
        >
          {getFilterDisplayValue(filter)}
          <button onClick={() => removeFilter(filter.field)} className="hover:text-red-500 transition-colors">
            ✕
          </button>
        </span>
      ))}
      <button
        onClick={clearAllFilters}
        className="text-[11px] font-semibold text-slate-400 hover:text-red-500 transition-colors px-1"
      >
        Clear all
      </button>
    </div>
  );
};