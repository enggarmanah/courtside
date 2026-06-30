import React from 'react';
import { Icon, IconName } from '../ui/Icon';
import { Tooltip } from '../ui/Tooltip';

interface ActionBarButtonProps {
  tooltip: string;
  icon: IconName;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  iconClass?: string;
}

export const ActionBarButton: React.FC<ActionBarButtonProps> = ({
  tooltip, icon, onClick, disabled, className, iconClass
}) => {
  return (
    <Tooltip content={tooltip}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={className || `w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-slate-700 hover:border-brand-500 dark:hover:border-brand-500 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <Icon name={icon} size={18} className={iconClass || ''} />
      </button>
    </Tooltip>
  );
};