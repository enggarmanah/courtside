import React from 'react';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export const Switch: React.FC<SwitchProps> = ({ checked, onChange }) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`${checked ? 'bg-red-500 dark:bg-red-600' : 'bg-brand-600 dark:bg-brand-500'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
    >
      <span className="sr-only">Toggle</span>
      <span className={`${checked ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition`} />
    </button>
  );
};