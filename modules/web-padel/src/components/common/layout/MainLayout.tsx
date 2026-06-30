import React from "react";
import { BottomBar } from "./BottomBar";

interface MainLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children, className }) => {
  return (
    <div className={`h-full flex flex-col overflow-hidden bg-slate-100 dark:bg-slate-900 ${className || ""}`}>
      <main className="flex-1 w-full overflow-hidden flex flex-col">
        {children}
      </main>
      <BottomBar />
    </div>
  );
};