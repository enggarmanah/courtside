import React from "react";

interface LogoIconProps {
  className?: string;
}

export const LogoIcon: React.FC<LogoIconProps> = ({ className }) => {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      className={className || "w-full h-full"}
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="20" cy="20" r="18" fill="currentColor" opacity="0.15" />
      <circle cx="20" cy="16" r="7" stroke="currentColor" strokeWidth="2" fill="none" />
      <line x1="20" y1="23" x2="20" y2="33" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="14" y1="28" x2="26" y2="28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="20" cy="16" r="2" fill="currentColor" />
    </svg>
  );
};