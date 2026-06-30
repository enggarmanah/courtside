import React, { useState } from 'react';
import { Icon } from '../ui/Icon';
import { TextOptionItem } from '../../../types/FilterTypes';

interface ComboboxProps {
  value: TextOptionItem | TextOptionItem[] | null;
  onChange: (selected: TextOptionItem | TextOptionItem[] | null) => void;
  multiple?: boolean;
  options: TextOptionItem[];
  query: string;
  onQueryChange: (q: string) => void;
  placeholder: string;
  isExclude?: boolean;
}

export const Combobox: React.FC<ComboboxProps> = ({
  value, onChange, multiple, options, query, onQueryChange, placeholder, isExclude
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const selected = multiple
    ? (value as TextOptionItem[]) || []
    : value ? [value as TextOptionItem] : [];

  const displayValue = selected.map((s) => s.label).join(', ') || placeholder;

  const toggleOption = (option: TextOptionItem) => {
    if (multiple) {
      const arr = value as TextOptionItem[];
      const exists = arr.some((s) => s.id === option.id);
      const updated = exists ? arr.filter((s) => s.id !== option.id) : [...arr, option];
      onChange(updated);
    } else {
      onChange(option);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative">
      <div
        className="w-full border border-slate-300 dark:border-slate-600 rounded-md py-2 px-3 text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 cursor-pointer flex items-center justify-between"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="truncate">{query || displayValue}</span>
        <Icon name="chevron-down" size={14} className="text-slate-400 flex-shrink-0" />
      </div>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute mt-1 w-full overflow-auto rounded-md bg-white dark:bg-slate-900 py-1 text-sm shadow-lg ring-1 ring-black/5 dark:ring-slate-600 z-[9990] sidebar-scrollbar max-h-48">
            <div className="px-3 py-2">
              <input
                type="text"
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder="Search..."
                className="w-full border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 outline-none focus:border-brand-500"
                autoFocus
              />
            </div>
            {options.length === 0 ? (
              <div className="px-3 py-4 text-center text-slate-400 text-xs">No options found.</div>
            ) : (
              options.map((option) => {
                const isSelected = selected.some((s) => s.id === option.id);
                return (
                  <div
                    key={option.id}
                    onClick={() => toggleOption(option)}
                    className={`px-3 py-2 cursor-pointer flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 font-medium'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>{option.label}</span>
                    {isSelected && (
                      <Icon name={isExclude ? 'x' : 'check'} size={16} className={isExclude ? 'text-red-500' : 'text-brand-600'} />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
};