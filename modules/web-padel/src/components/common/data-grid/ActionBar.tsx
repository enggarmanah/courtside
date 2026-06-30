import React from 'react';
import { Icon } from '../ui/Icon';
import { Tooltip } from '../ui/Tooltip';

interface ActionBarProps {
  title?: string;
  gridTitle?: React.ReactNode;
  onRefresh?: () => void;
  isLoading?: boolean;
  hideRefreshButton?: boolean;
  hideFilterButton?: boolean;
  onBackAction?: () => void;
  hideBackButton?: boolean;
  filters?: React.ReactNode;
  actionsAfterFilter?: React.ReactNode;
  hideSearchBar?: boolean;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  title, gridTitle, onRefresh, isLoading,
  hideRefreshButton,
  onBackAction, hideBackButton,
  filters, actionsAfterFilter,
}) => {
  return (
    <div className="flex flex-col gap-2 mb-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {gridTitle || (
            <h2 className="text-md font-bold text-slate-700 dark:text-slate-300 truncate">
              {title}
            </h2>
          )}
        </div>
        <div className="flex items-center gap-2">
          {filters}
          {!hideBackButton && onBackAction && (
            <Tooltip content="Back">
              <button
                onClick={onBackAction}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-slate-700 transition-all active:scale-95"
              >
                <Icon name="chevron-left" size={18} />
              </button>
            </Tooltip>
          )}
          {actionsAfterFilter}
          {!hideRefreshButton && (
            <Tooltip content="Refresh">
              <button
                onClick={onRefresh}
                disabled={isLoading}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-slate-700 transition-all active:scale-95 disabled:opacity-50"
              >
                <Icon name="refresh" size={18} className={isLoading ? 'animate-spin' : ''} />
              </button>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
};