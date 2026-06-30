import { Icon, IconName } from '../ui/Icon';
import { Tooltip } from '../ui/Tooltip';
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Filter, FilterType, TextOptionItem, DateFilter, NumberFilter } from '../../../types/FilterTypes';
import { Switch } from './Switch';
import { Combobox } from './Combobox';
import { FormInput } from '../form/FormInput';
import { DateInput } from '../form/DateInput';
import { toLocalISODate } from '../../../utils/formatHelper';

interface FilterItemProps {
  filter: Filter;
  onFilterChange: (updatedFilter: Filter) => void;
}

const FilterItem: React.FC<FilterItemProps> = ({ filter, onFilterChange }) => {
  const { t } = useTranslation();
  const selectText = t('common.select', 'Select');
  const [isExclude, setIsExclude] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<TextOptionItem[]>(
    filter.textFilter?.include ?? []
  );
  const [dateFilter, setDateFilter] = useState<DateFilter>(
    filter.dateFilter || { from: undefined, to: undefined }
  );
  const [numberFilter, setNumberFilter] = useState<NumberFilter>(
    filter.numberFilter || { min: undefined, max: undefined }
  );
  const [query, setQuery] = useState('');

  const filteredOptions = (query === ''
    ? filter.options
    : filter.options?.filter((o) =>
        o.label.toLowerCase().includes(query.toLowerCase())
      )
  )?.sort((a, b) => a.label.localeCompare(b.label)) ?? [];

  const handleOptionChange = (selected: TextOptionItem | TextOptionItem[] | null) => {
    const selectedArray = filter.single
      ? (selected ? [selected as TextOptionItem] : [])
      : Array.isArray(selected) ? selected : [];
    setSelectedOptions(selectedArray);
    onFilterChange({
      ...filter,
      textFilter: {
        include: isExclude ? [] : selectedArray,
        exclude: isExclude ? selectedArray : [],
      },
    });
  };

  return (
    <div className="mb-3 last:mb-0">
      {(filter.type === FilterType.TEXT) && (
        <div className="mb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-brand-600 dark:text-brand-500 uppercase tracking-widest">
              <Icon name={(filter.icon as IconName) || 'tag'} size={14} className="text-slate-500 dark:text-slate-400" />
              <span>{filter.title}</span>
            </div>
            {filter.type === FilterType.TEXT && !filter.disableToggle && (
              <Switch checked={isExclude} onChange={setIsExclude} />
            )}
          </div>
        </div>
      )}

      {filter.type === FilterType.TEXT && (
        <Combobox
          value={filter.single ? selectedOptions[0] || null : selectedOptions}
          onChange={handleOptionChange}
          multiple={!filter.single}
          options={filteredOptions}
          query={query}
          onQueryChange={setQuery}
          placeholder={`${selectText} ${filter.title.toLowerCase()}...`}
          isExclude={isExclude}
        />
      )}

      {filter.type === FilterType.DATE && (
        <DateInput
          label={filter.title}
          icon={filter.icon as IconName}
          value={dateFilter.from ? toLocalISODate(dateFilter.from) : ''}
          onChange={(value) => {
            const selected = value ? new Date(value) : undefined;
            const newDateFilter = { from: selected, to: selected } as DateFilter;
            setDateFilter(newDateFilter);
            onFilterChange({ ...filter, dateFilter: newDateFilter });
          }}
        />
      )}

      {filter.type === FilterType.PERIOD && (
        <div className="flex gap-2">
          <DateInput
            label="From"
          value={dateFilter.from ? toLocalISODate(dateFilter.from) : ''}
            onChange={(value) => {
              const from = value ? new Date(value) : undefined;
              const newDF = { ...dateFilter, from };
              setDateFilter(newDF);
              onFilterChange({ ...filter, dateFilter: newDF });
            }}
          />
          <DateInput
            label="To"
            value={dateFilter.to ? toLocalISODate(dateFilter.to) : ''}
            onChange={(value) => {
              const to = value ? new Date(value) : undefined;
              const newDF = { ...dateFilter, to };
              setDateFilter(newDF);
              onFilterChange({ ...filter, dateFilter: newDF });
            }}
          />
        </div>
      )}

      {filter.type === FilterType.NUMBER && (
        <div className="space-y-2">
          <FormInput
            name={`${filter.field}_min`}
            label={`Min. ${filter.title}`}
            icon={filter.icon as IconName}
            value={numberFilter.min ?? ''}
            onChange={(e) => {
              const raw = e.target.value.replace(/[.,]/g, '');
              const min = raw !== '' && !isNaN(Number(raw)) ? Number(raw) : undefined;
              const newNF = { ...numberFilter, min };
              setNumberFilter(newNF);
              onFilterChange({ ...filter, numberFilter: newNF });
            }}
            placeholder={`Min ${filter.title.toLowerCase()}`}
            useThousandSeparator
          />
          <FormInput
            name={`${filter.field}_max`}
            label={`Max. ${filter.title}`}
            icon={filter.icon as IconName}
            value={numberFilter.max ?? ''}
            onChange={(e) => {
              const raw = e.target.value.replace(/[.,]/g, '');
              const max = raw !== '' && !isNaN(Number(raw)) ? Number(raw) : undefined;
              const newNF = { ...numberFilter, max };
              setNumberFilter(newNF);
              onFilterChange({ ...filter, numberFilter: newNF });
            }}
            placeholder={`Max ${filter.title.toLowerCase()}`}
            useThousandSeparator
          />
        </div>
      )}
    </div>
  );
};

interface FilterButtonProps {
  showFilterOptions: boolean;
  toggleFilterOptions: () => void;
  closeFilterOptions: () => void;
  onFilterChange: (filters: Filter[] | undefined) => void;
  filters: Filter[];
}

export const FilterButton: React.FC<FilterButtonProps> = ({
  showFilterOptions,
  toggleFilterOptions,
  closeFilterOptions,
  onFilterChange,
  filters,
}) => {
  const [currentFilters, setCurrentFilters] = useState<Filter[]>(filters);
  const lastSyncedRef = useRef<string>(JSON.stringify(filters));

  useEffect(() => {
    const str = JSON.stringify(filters);
    if (str !== lastSyncedRef.current) {
      lastSyncedRef.current = str;
      setCurrentFilters(filters);
    }
  }, [filters]);

  const handleFilterChange = (updatedFilter: Filter) => {
    const updated = currentFilters.map((f) =>
      f.field === updatedFilter.field ? updatedFilter : f
    );
    setCurrentFilters(updated);
    onFilterChange(updated);
  };

  const renderButton = () => (
    <Tooltip content="Filter">
      <button
        onClick={toggleFilterOptions}
        className="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-slate-700 hover:border-brand-500 dark:hover:border-brand-500 transition-all active:scale-95"
      >
        <Icon name="filter" size={18} />
      </button>
    </Tooltip>
  );

  if (!showFilterOptions) return renderButton();

  return (
    <div className="relative flex justify-end">
      {renderButton()}
      <div className="fixed inset-0 z-10" onClick={closeFilterOptions} />
      <div className="absolute left-0 sm:left-auto translate-x-[-50%] md:translate-x-0 md:right-0 top-[calc(100%+8px)] bg-white dark:bg-slate-800 rounded-xl shadow-lg z-[9990] border border-slate-200 dark:border-slate-700 transform transition-all duration-200 ease-out opacity-100 scale-100 origin-top">
        <div className="flex flex-col p-4 min-w-[280px] max-h-[70vh] overflow-y-auto sidebar-scrollbar">
          {currentFilters?.filter((f) => !f.hideFilter).map((filter) => (
            <FilterItem key={filter.field} filter={filter} onFilterChange={handleFilterChange} />
          ))}
        </div>
      </div>
    </div>
  );
};