import React, { useState } from 'react';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children }) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);

  if (!content) return <>{children}</>;

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={(e) => { setPosition({ x: e.clientX, y: e.clientY }); setVisible(true); }}
      onMouseMove={(e) => { setPosition({ x: e.clientX, y: e.clientY }); }}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          className="fixed z-[9999] px-2 py-1 text-xs font-medium text-white bg-slate-900 dark:bg-slate-700 rounded-md shadow-lg whitespace-nowrap pointer-events-none"
          style={{ left: position.x, top: position.y - 32 }}
        >
          {content}
        </div>
      )}
    </div>
  );
};