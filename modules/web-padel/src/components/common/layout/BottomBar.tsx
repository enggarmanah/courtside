import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Icon, IconName } from "../ui/Icon";
import { menuItems } from "../../../constants/menuItems";
import { useAuth } from "../../../hooks/useAuth";
import { RoutePaths } from "../../../constants/RoutePaths";

export const BottomBar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [showMore, setShowMore] = useState(false);

  const mainItems = menuItems.slice(0, 4);

  const handleNav = (path: string) => {
    if (path === 'logout') {
      logout();
      navigate(RoutePaths.AUTH);
      return;
    }
    setShowMore(false);
    navigate(path);
  };

  return (
    <>
      {showMore && (
        <>
          <div className="md:hidden fixed inset-0 bottom-16 bg-black/50 z-[9000]" onClick={() => setShowMore(false)} />
          <div className="md:hidden fixed bottom-20 right-4 left-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-[10000] p-3 animate-slideUp">
            <div className="flex flex-col gap-1">
              {menuItems.map((item: { label: string; icon: string; path: string }) => (
                <button
                  key={item.label}
                  onClick={() => handleNav(item.path)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${
                    location.pathname === item.path
                      ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon name={item.icon as IconName} size={20} />
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              ))}
              <button
                onClick={() => handleNav('logout')}
                className="flex items-center gap-3 px-3 py-3 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <Icon name="exit" size={20} />
                <span className="text-sm font-medium">Logout</span>
              </button>
            </div>
          </div>
        </>
      )}

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 z-[40]">
        <div className="flex justify-around items-center h-16">
          {mainItems.map((item: { label: string; icon: string; path: string }) => (
            <button
              key={item.label}
              onClick={() => handleNav(item.path)}
              className={`flex flex-1 flex-col items-center p-2 ${
                location.pathname === item.path
                  ? 'text-brand-600 dark:text-brand-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon name={item.icon as IconName} size={22} />
              <span className="text-[10px] font-semibold mt-1">{item.label}</span>
            </button>
          ))}
          <button
            onClick={() => setShowMore(!showMore)}
            className={`flex flex-1 flex-col items-center p-2 ${showMore ? 'text-brand-600' : 'text-slate-500'}`}
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
            </svg>
            <span className="text-[10px] font-semibold mt-1">More</span>
          </button>
        </div>
      </nav>
    </>
  );
};