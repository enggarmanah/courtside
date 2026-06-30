import React, { useRef } from 'react';
import { Icon, IconName } from '../ui/Icon';

interface DateInputProps {
  label?: string;
  value?: string;
  onChange?: (value: string) => void;
  icon?: IconName;
  className?: string;
}

const toDisplay = (iso: string): string => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
};

const toISO = (display: string): string => {
  if (!display) return '';
  const [d, m, y] = display.split('-');
  return `${y}-${m}-${d}`;
};

export const DateInput: React.FC<DateInputProps> = ({
  label,
  value,
  onChange,
  icon,
  className = '',
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const displayValue = toDisplay(value ?? '');

  const openPicker = () => {
    inputRef.current?.showPicker?.();
    inputRef.current?.focus();
  };

  return (
    <div className={className}>
      {label && (
        <label className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 uppercase tracking-wider flex items-center gap-1 mb-1">
          {icon && <Icon name={icon} size={12} className="text-brand-500 dark:text-brand-400" />}
          <span>{label}</span>
        </label>
      )}
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          placeholder="dd-mm-yyyy"
          value={displayValue}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^0-9-]/g, '');
            const parts = raw.split('-');
            if (parts.length === 3) {
              const [d, m, y] = parts;
              if (d.length <= 2 && m.length <= 2 && y.length <= 4) {
                onChange?.(toISO(raw));
              }
            } else if (raw.length <= 8) {
              onChange?.(toISO(raw));
            }
          }}
          onFocus={openPicker}
          className="w-full p-2 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-md outline-none transition-colors focus:border-brand-500 focus:bg-brand-50 dark:focus:bg-slate-800 cursor-pointer [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <input
          ref={inputRef}
          type="date"
          value={value ?? ''}
          onChange={(e) => onChange?.(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer"
          tabIndex={-1}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
          <Icon name="calendar" size={14} />
        </div>
      </div>
    </div>
  );
};
