import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Icon, IconName, Avatar, LogoImage } from "../ui";
import { useAuth } from "../../../hooks/useAuth";
import { RoutePaths } from "../../../constants/RoutePaths";
import { menuItems, MenuItem } from "../../../constants/menuItems";

const SidebarItemComponent: React.FC<{
  item: { label: string; icon: string; path: string };
  isActive: boolean;
  isCollapsed: boolean;
  onClick: () => void;
}> = ({ item, isActive, isCollapsed, onClick }) => {
  return (
    <div className="w-full relative">
      <button
        onClick={onClick}
        className={`
          flex items-center relative group transition-all duration-200 h-[46px]
          ${isCollapsed ? 'w-[48px] rounded-full' : 'w-full rounded-xl'}
          ${isActive
            ? 'bg-brand-50 dark:bg-slate-800 text-brand-600 dark:text-brand-400'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200'
          }
          font-semibold
        `}
      >
        <div className="w-[48px] h-[46px] flex items-center justify-center flex-shrink-0 absolute left-0 top-0">
          <Icon
            name={item.icon as IconName}
            className={`transition-colors ${isActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-200'}`}
          />
        </div>
        <div className="flex-grow pl-[48px] flex items-center pr-3 overflow-hidden">
          <span className={`
            text-sm truncate transition-all duration-300 ease-in-out
            ${isCollapsed ? 'opacity-0 max-w-0' : 'opacity-100 max-w-[200px] delay-200'}
          `}>
            {item.label}
          </span>
        </div>
        {isCollapsed && (
          <div className="absolute left-full ml-4 invisible group-hover:visible bg-slate-900 dark:bg-slate-700 text-white text-xs font-bold py-1.5 px-3 rounded-lg shadow-xl whitespace-nowrap z-[100] uppercase tracking-wider">
            {item.label}
          </div>
        )}
      </button>
    </div>
  );
};

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const [isLocked, setIsLocked] = useState(() => {
    const stored = localStorage.getItem('padel_sidebarLocked');
    return stored !== 'false';
  });
  const [isHovered, setIsHovered] = useState(false);

  const isCollapsed = !isLocked && !isHovered;

  useEffect(() => {
    localStorage.setItem('padel_sidebarLocked', String(isLocked));
  }, [isLocked]);

  const handleNavigate = (path: string) => {
    if (path === 'logout') {
      logout();
      navigate(RoutePaths.AUTH);
      return;
    }
    navigate(path);
  };

  const userName = user?.name || 'Admin';
  const userEmail = user?.email || 'admin@padelitics.com';

  return (
    <aside
      onMouseEnter={() => !isLocked && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`${isCollapsed ? 'w-[80px]' : 'w-[260px]'} bg-white dark:bg-slate-900 border-r border-slate-300 dark:border-slate-700 h-screen sticky top-0 transition-all duration-300 z-[30] flex flex-col`}
    >
      {/* Header Section */}
      <div className={`flex items-center h-[64px] flex-shrink-0 px-4 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
        {isCollapsed ? (
          <button
            onClick={() => setIsLocked(true)}
            className="w-[48px] h-[46px] rounded-xl flex items-center justify-center bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <Icon name="chevron-right" size={16} />
          </button>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <div className="w-[46px] h-[46px] rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                <LogoImage className="w-7 h-7" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-slate-800 dark:text-brand-200 text-lg leading-tight">Padelitics</span>
                <span className="text-[11px] text-brand-600 dark:text-brand-400 font-bold tracking-widest">By Qelola</span>
              </div>
            </div>
            <button
              onClick={() => setIsLocked(!isLocked)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                isLocked
                  ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-400'
              } hover:bg-brand-100 dark:hover:bg-brand-900/30`}
            >
              <Icon name={isLocked ? "lock" : "lock-open"} size={16} />
            </button>
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-grow flex flex-col gap-1 overflow-y-auto sidebar-scrollbar px-4 pb-6">
        {menuItems.map((item: MenuItem) => (
          <SidebarItemComponent
            key={item.label}
            item={item}
            isActive={item.path === location.pathname}
            isCollapsed={isCollapsed}
            onClick={() => handleNavigate(item.path)}
          />
        ))}
      </nav>

      {/* User Profile Section */}
      <div className={`${isCollapsed ? '' : 'border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'} px-4 py-3`}>
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => handleNavigate('logout')}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-all"
            >
              <Icon name="exit" size={18} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Avatar name={userName} className="w-10 h-10 text-sm" style={{ backgroundColor: "rgb(var(--brand-600))" }} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{userName}</div>
              <div className="text-[11px] text-slate-400 truncate">{userEmail}</div>
            </div>
            <button
              onClick={() => handleNavigate('logout')}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-all flex-shrink-0"
              title="Logout"
            >
              <Icon name="exit" size={18} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};