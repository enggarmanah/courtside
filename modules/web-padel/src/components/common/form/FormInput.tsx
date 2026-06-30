import React, { useState, useEffect, useRef } from 'react';
import { Icon, IconName } from '../ui/Icon';
import { formatNumber } from '../../../utils/formatHelper';

interface FormInputProps {
  name?: string;
  label?: string;
  value: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  placeholder?: string;
  icon?: IconName;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  error?: boolean;
  className?: string;
  useThousandSeparator?: boolean;
  minValue?: number;
  maxValue?: number;
}

export const FormInput: React.FC<FormInputProps> = ({
  label,
  name,
  value,
  onChange,
  onBlur,
  placeholder,
  icon,
  disabled = false,
  readOnly = false,
  required = false,
  error = false,
  className = '',
  useThousandSeparator = true,
  minValue,
  maxValue,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState(
    typeof value === 'number' || typeof value === 'string'
      ? (useThousandSeparator && value !== '' && value !== null && value !== undefined
        ? formatNumber(Number(value), 0)
        : String(value ?? ''))
      : ''
  );

  useEffect(() => {
    if (value === '' || value === null || value === undefined) {
      setInputValue('');
    } else if (useThousandSeparator) {
      setInputValue(formatNumber(Number(value), 0));
    } else {
      setInputValue(String(value));
    }
  }, [value, useThousandSeparator]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const stripped = raw.replace(/[.,]/g, '');
    const numVal = Number(stripped);

    if (useThousandSeparator && stripped !== '' && !isNaN(numVal)) {
      const formatted = formatNumber(numVal, 0);
      setInputValue(formatted);
      const syntheticEvent = {
        ...e,
        target: { ...e.target, value: String(numVal) },
      } as React.ChangeEvent<HTMLInputElement>;
      onChange?.(syntheticEvent);
    } else {
      setInputValue(raw);
      onChange?.(e);
    }

    if (minValue !== undefined || maxValue !== undefined) {
      if (!isNaN(numVal)) {
        if (minValue !== undefined && numVal < minValue) {
          setInputValue(formatNumber(minValue, 0));
        } else if (maxValue !== undefined && numVal > maxValue) {
          setInputValue(formatNumber(maxValue, 0));
        }
      }
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (useThousandSeparator) {
      requestAnimationFrame(() => {
        const input = e.target;
        const length = input.value.length;
        input.setSelectionRange(length, length);
      });
    }
  };

  return (
    <div className={className}>
      {label && (
         <label
           htmlFor={name}
           className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 uppercase tracking-wider flex items-center gap-1 mb-1"
         >
           {icon && <Icon name={icon} size={12} className="text-brand-500 dark:text-brand-400" />}
           <span>{label}</span>
           {required && <span className="text-red-500 ml-0.5">*</span>}
         </label>
      )}
      <input
        ref={inputRef}
        type="text"
        name={name}
        id={name}
        inputMode="numeric"
        placeholder={placeholder}
        value={inputValue}
        onChange={handleChange}
        onBlur={onBlur}
        onFocus={handleFocus}
        disabled={disabled}
        readOnly={readOnly}
        className={`w-full p-2 text-sm text-right border rounded-md outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
          disabled
            ? 'bg-slate-50 text-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700 cursor-default'
            : error && required && (!value || value === '' || value === '0')
              ? 'bg-red-50 dark:bg-red-900/20 text-slate-800 dark:text-white border-red-300 dark:border-red-700 focus:border-red-500'
              : 'bg-white text-slate-800 dark:text-white border-slate-300 dark:border-slate-700 focus:border-brand-600 dark:focus:border-brand-500 focus:bg-white'
        }`}
      />
    </div>
  );
};
