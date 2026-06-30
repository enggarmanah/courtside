import React, { useEffect, useMemo, useState } from 'react';
import { formatShortDateRange } from '../../../utils/formatHelper';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const formatDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const parseDateKey = (value: string) => {
  if (!value) return new Date();
  return new Date(`${value}T00:00:00`);
};

const buildMonthDays = (year: number, month: number) => {
  const days: Array<{ date: Date; currentMonth: boolean }> = [];
  const firstDay = new Date(year, month, 1).getDay();
  const padding = firstDay;
  const previousMonthLastDate = new Date(year, month, 0).getDate();

  for (let index = padding - 1; index >= 0; index -= 1) {
    days.push({ date: new Date(year, month - 1, previousMonthLastDate - index), currentMonth: false });
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push({ date: new Date(year, month, day), currentMonth: true });
  }

  const totalDays = padding + daysInMonth;
  const extra = totalDays % 7;
  const trailingPadding = extra === 0 ? 0 : 7 - extra;
  const targetLength = totalDays + trailingPadding;

  while (days.length < targetLength) {
    days.push({ date: new Date(year, month + 1, days.length - daysInMonth - padding + 1), currentMonth: false });
  }

  return days;
};

interface DateRangeSelectionDialogProps {
  isOpen: boolean;
  startDate: string;
  endDate: string;
  onApply: (startDate: string, endDate: string) => void;
  onClose: () => void;
  maxDayRange?: number;
}

const diffDays = (start: string, end: string) => {
  const s = parseDateKey(start);
  const e = parseDateKey(end);
  return Math.abs(Math.round((e.getTime() - s.getTime()) / 86400000)) + 1;
};

const clampEndDate = (start: string, maxDays: number) => {
  const s = parseDateKey(start);
  const clamped = new Date(s.getFullYear(), s.getMonth(), s.getDate() + maxDays - 1);
  return formatDateKey(clamped);
};

export const DateRangeSelectionDialog: React.FC<DateRangeSelectionDialogProps> = ({
  isOpen,
  startDate,
  endDate,
  onApply,
  onClose,
  maxDayRange
}) => {
  const [localStartDate, setLocalStartDate] = useState(startDate);
  const [localEndDate, setLocalEndDate] = useState(endDate);
  const [anchorDate, setAnchorDate] = useState<string | null>(null);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [viewDate, setViewDate] = useState(() => {
    const d = parseDateKey(startDate || formatDateKey(new Date()));
    return d;
  });

  useEffect(() => {
    if (!isOpen) return;
    setLocalStartDate(startDate);
    setLocalEndDate(endDate);
    setAnchorDate(null);
    setHoverDate(null);
    if (startDate) {
      setViewDate(parseDateKey(startDate));
    }
  }, [isOpen, startDate, endDate]);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const displayRange = useMemo(() => {
    if (anchorDate && hoverDate) {
      const start = anchorDate <= hoverDate ? anchorDate : hoverDate;
      const end = anchorDate <= hoverDate ? hoverDate : anchorDate;
      return { start, end };
    }

    return { start: localStartDate, end: localEndDate };
  }, [anchorDate, hoverDate, localStartDate, localEndDate]);

  const presetOptions = useMemo(() => {
    const now = new Date();

    return [
      {
        label: 'Today',
        startDate: formatDateKey(now),
        endDate: formatDateKey(now)
      },
      {
        label: 'This Month',
        startDate: formatDateKey(new Date(now.getFullYear(), now.getMonth(), 1)),
        endDate: formatDateKey(new Date(now.getFullYear(), now.getMonth() + 1, 0))
      },
      {
        label: 'Last Month',
        startDate: formatDateKey(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        endDate: formatDateKey(new Date(now.getFullYear(), now.getMonth(), 0))
      },
      {
        label: 'This Year',
        startDate: `${now.getFullYear()}-01-01`,
        endDate: formatDateKey(now)
      },
      {
        label: 'Last 30 Days',
        startDate: formatDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30)),
        endDate: formatDateKey(now)
      },
      {
        label: 'Last 3 Months',
        startDate: formatDateKey(new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())),
        endDate: formatDateKey(now)
      },
      {
        label: 'Last 1 Year',
        startDate: formatDateKey(new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())),
        endDate: formatDateKey(now)
      }
    ];
  }, []);

  const handleDateClick = (value: string) => {
    if (!anchorDate) {
      setAnchorDate(value);
      setLocalStartDate(value);
      setLocalEndDate(value);
      return;
    }

    let orderedRange =
      anchorDate <= value
        ? { startDate: anchorDate, endDate: value }
        : { startDate: value, endDate: anchorDate };

    if (maxDayRange && diffDays(orderedRange.startDate, orderedRange.endDate) > maxDayRange) {
      orderedRange = {
        startDate: orderedRange.startDate,
        endDate: clampEndDate(orderedRange.startDate, maxDayRange)
      };
    }

    setLocalStartDate(orderedRange.startDate);
    setLocalEndDate(orderedRange.endDate);
    setAnchorDate(null);
    setHoverDate(null);
  };

  const renderMonth = (year: number, month: number) => {
    const monthDays = buildMonthDays(year, month);
    const todayKey = formatDateKey(new Date());

    return (
      <div className="period-calendar-month">
        <div className="text-center text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3 pt-4 pb-2">
          {MONTH_NAMES[month]} {year}
        </div>
        <div className="grid grid-cols-7 text-center mb-1">
          {DAY_NAMES.map((dayName) => (
            <div key={dayName} className="text-[11px] font-bold text-slate-500 dark:text-slate-400 py-1">
              {dayName}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px">
          {monthDays.map(({ date, currentMonth: isCurrMonth }) => {
            const dateKey = formatDateKey(date);
            const isStart = dateKey === displayRange.start;
            const isEnd = dateKey === displayRange.end;
            const isInRange = dateKey > displayRange.start && dateKey < displayRange.end;
            const isToday = dateKey === todayKey;

            const isDisabled = Boolean(
              anchorDate && maxDayRange && Math.abs(diffDays(anchorDate, dateKey)) > maxDayRange
            );

            let classNames = 'calendar-day';
            if (!isCurrMonth) classNames += ' is-outside';
            if (isInRange) classNames += ' is-in-range';
            if (isStart || isEnd) classNames += ' is-selected';
            if (isStart) classNames += ' is-start';
            if (isEnd) classNames += ' is-end';
            if (date.getDay() === 0 || date.getDay() === 6) classNames += ' is-weekend';
            if (isDisabled) classNames += ' is-disabled';

            return (
              <button
                key={dateKey}
                className={classNames}
                onClick={() => !isDisabled && handleDateClick(dateKey)}
                onMouseEnter={() => anchorDate && !isDisabled && setHoverDate(dateKey)}
                type="button"
                disabled={isDisabled}
              >
                <span style={{ position: 'relative', zIndex: 1 }}>{date.getDate()}</span>
                {isToday && !isStart && !isEnd && (
                  <span
                    style={{
                      position: 'absolute',
                      bottom: '3px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '4px',
                      height: '4px',
                      borderRadius: '50%',
                      backgroundColor: 'rgb(var(--brand-500))',
                      zIndex: 1
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth();
  const nextMonthDate = new Date(currentYear, currentMonth + 1, 1);

  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute right-0 top-[calc(100%+8px)] bg-white dark:bg-slate-800 rounded-2xl shadow-lg z-[9990] border border-slate-200 dark:border-slate-700 w-[400px] sm:w-[660px] max-h-[calc(100vh-120px)] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-4 pt-4 flex-shrink-0">
          <div className="flex gap-2 flex-[0_0_40px]">
            <button
              onClick={() => setViewDate(new Date(currentYear, currentMonth - 1, 1))}
              className="w-10 h-10 rounded-xl border border-brand-600 bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 flex items-center justify-center hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
              type="button"
            >
              <svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor">
                <path d="M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z" />
              </svg>
            </button>
          </div>
          <div className="inline-flex items-center gap-2.5 h-10 px-4 rounded-full bg-brand-50 dark:bg-brand-900/30 border border-brand-600 text-sm font-semibold text-brand-700 dark:text-brand-300 flex-1 min-w-0 justify-center whitespace-nowrap">
            <svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor" className="text-brand-500 flex-shrink-0">
              <path d="M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,48v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48V48ZM48,208V96H208V208Z" />
            </svg>
            <span>{formatShortDateRange(displayRange.start, displayRange.end)}</span>
            {maxDayRange && (
              <span className="text-[10px] font-medium text-brand-500 dark:text-brand-400 ml-1">
                (max {maxDayRange}d)
              </span>
            )}
          </div>
          <div className="flex gap-2 flex-[0_0_40px] justify-end">
            <button
              onClick={() => setViewDate(new Date(currentYear, currentMonth + 1, 1))}
              className="w-10 h-10 rounded-xl border border-brand-600 bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 flex items-center justify-center hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
              type="button"
            >
              <svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor">
                <path d="M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 my-2 sidebar-scrollbar">
          <div className="sm:grid sm:grid-cols-2 sm:gap-7 flex flex-col gap-4">
            {renderMonth(currentYear, currentMonth)}
            {renderMonth(nextMonthDate.getFullYear(), nextMonthDate.getMonth())}
          </div>
        </div>

        <div className="flex gap-3 overflow-x-auto px-4 py-3 flex-shrink-0 border-t border-slate-100 dark:border-slate-700" style={{ scrollbarWidth: 'none' }}>
          {presetOptions.map((preset) => {
            const isActive = localStartDate === preset.startDate && localEndDate === preset.endDate;

            return (
              <button
                key={preset.label}
                className={`flex-shrink-0 h-10 px-3.5 rounded-lg border text-sm font-semibold transition-colors ${
                  isActive
                    ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 border-brand-600'
                    : 'bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 border-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20'
                }`}
                onClick={() => {
                  let pStart = preset.startDate;
                  let pEnd = preset.endDate;
                  if (maxDayRange && diffDays(pStart, pEnd) > maxDayRange) {
                    pEnd = clampEndDate(pStart, maxDayRange);
                  }
                  setLocalStartDate(pStart);
                  setLocalEndDate(pEnd);
                  setAnchorDate(null);
                  setHoverDate(null);
                  setViewDate(parseDateKey(pStart));
                }}
                type="button"
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        <div className="flex justify-end gap-3 px-4 pb-4 flex-shrink-0">
          <button
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            onClick={onClose}
            type="button"
          >
            <svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor">
              <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z" />
            </svg>
            Cancel
          </button>
          <button
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 h-10 px-6 rounded-xl text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 transition-colors"
            onClick={() => onApply(localStartDate, localEndDate)}
            type="button"
          >
            <svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor">
              <path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z" />
            </svg>
            Apply
          </button>
        </div>
      </div>
    </>
  );
};