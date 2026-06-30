import React, { useState } from 'react';
import { Icon } from '../ui/Icon';
import { toLocalISODate } from '../../../utils/formatHelper';

interface DateRangePickerProps {
  startDate?: Date;
  endDate?: Date;
  onChange: (start: Date | undefined, end: Date | undefined) => void;
  onClose: () => void;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({ startDate, endDate, onChange, onClose }) => {
  const [start, setStart] = useState(startDate ? toLocalISODate(startDate) : '');
  const [end, setEnd] = useState(endDate ? toLocalISODate(endDate) : '');

  const apply = () => {
    onChange(start ? new Date(start) : undefined, end ? new Date(end) : undefined);
    onClose();
  };

  return (
    <div className="absolute mt-1 z-[9990] bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-4 min-w-[260px]">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="calendar" size={16} className="text-slate-400" />
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Select Period</span>
      </div>
      <div className="flex flex-col gap-3">
        <div>
          <label className="text-xs font-semibold text-slate-500 mb-1 block">Start Date</label>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="w-full border border-slate-300 dark:border-slate-600 rounded-md py-2 px-3 text-sm bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 focus:border-brand-500 outline-none"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 mb-1 block">End Date</label>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="w-full border border-slate-300 dark:border-slate-600 rounded-md py-2 px-3 text-sm bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 focus:border-brand-500 outline-none"
          />
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <button
          onClick={onClose}
          className="flex-1 py-2 px-3 text-sm font-semibold text-slate-600 bg-slate-100 dark:bg-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={apply}
          className="flex-1 py-2 px-3 text-sm font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors"
        >
          Apply
        </button>
      </div>
    </div>
  );
};