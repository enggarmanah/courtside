import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/common';

export const RootLayout: React.FC = () => {
  return (
    <div className="flex bg-slate-50 dark:bg-slate-950 h-screen overflow-hidden">
      <div className="hidden md:block h-full">
        <Sidebar />
      </div>
      <main className="flex-1 bg-slate-50 dark:bg-slate-900 overflow-hidden flex flex-col">
        <div className="flex-1 flex flex-col overflow-hidden h-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
};