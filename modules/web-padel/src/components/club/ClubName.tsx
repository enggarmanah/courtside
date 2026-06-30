import React from 'react';

/**
 * Renders club name with optional sub_name in the format:
 * Club Name · Sub Name
 * where sub_name is shown in a lighter shade (shade -100).
 */
export const ClubName: React.FC<{
  name: string;
  subName?: string;
  className?: string;
  subClassName?: string;
}> = ({ name, subName, className, subClassName }) => {
  if (!subName) {
    return <span className={className}>{name}</span>;
  }
  return (
    <span className={className}>
      {name}
      <span className={subClassName || 'text-sm font-semibold text-brand-600 dark:text-slate-500'}> · {subName}</span>
    </span>
  );
};
