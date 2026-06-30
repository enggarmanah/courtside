import React from 'react';
import { ThreeDot } from 'react-loading-indicators';

interface LoadingProgressProps {
  size?: "small" | "medium" | "large";
  color?: string;
  text?: string;
  className?: string;
}

export const LoadingProgress: React.FC<LoadingProgressProps> = ({
  size = "medium",
  color = "rgb(var(--brand-600))",
  text = "",
  className = ""
}) => {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <ThreeDot color={color} size={size} />
      {text && (
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider">
          {text}
        </span>
      )}
    </div>
  );
};