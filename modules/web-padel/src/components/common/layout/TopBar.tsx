import React from "react";
import { Icon, LanguageSelector, LocationSelector } from "..";
import { useTheme } from "../../../context/ThemeContext";

interface TopBarProps {
  title?: string;
  subtitle?: string;
  onBackAction?: () => void;
  children?: React.ReactNode;
  showLocationSelector?: boolean;
  titleIcon?: React.ReactNode;
}

const moduleIconName = 'chart-pie';

export const TopBar: React.FC<TopBarProps> = ({
  title,
  subtitle,
  onBackAction,
  children,
  showLocationSelector = true,
  titleIcon,
}) => {
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <header className="!h-[60px] flex-shrink-0 flex items-center justify-between pl-3 pr-3 bg-white border-b border-slate-300 sticky top-0 z-20 dark:bg-slate-800 dark:border-slate-700">
      <div className="flex items-center gap-1 min-w-0">
        {onBackAction && (
          <button
            onClick={onBackAction}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-slate-600 transition-all mr-1"
          >
            <Icon name="chevron-left" size={18} />
          </button>
        )}
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            {titleIcon ? (
              titleIcon
            ) : (
              <div className="text-brand-600 flex items-center justify-center flex-shrink-0">
                <Icon name={moduleIconName} size={20} weight="regular" />
              </div>
            )}
            <h1 className="text-md font-bold text-slate-900 tracking-tight dark:text-slate-100 truncate whitespace-nowrap">
              {title}
            </h1>
          </div>
          {subtitle && (
            <p className="text-sm font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 -mt-1 truncate">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 flex justify-center px-8">
        {children}
      </div>

      <div className="flex items-center gap-4">
        {showLocationSelector && (
          <div className="hidden md:block">
            <LocationSelector />
          </div>
        )}

        <button
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-slate-300 text-slate-500 hover:text-brand-600 hover:bg-brand-50 hover:border-brand-500 transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:text-brand-400"
          aria-label="Notifications"
        >
          <Icon name="bell" size={20} weight="regular" />
        </button>

        <LanguageSelector />

        <button
          onClick={toggleTheme}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 border border-slate-300 text-slate-500 hover:text-brand-600 hover:bg-white transition-all active:scale-95 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-600 dark:hover:text-brand-400"
          aria-label="Toggle theme"
        >
          <Icon name={isDarkMode ? "sun" : "moon"} size={20} weight="regular" />
        </button>
      </div>
    </header>
  );
};