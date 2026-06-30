import React, { useState } from 'react';

interface AvatarProps {
  src?: string;
  name?: string;
  className?: string;
  style?: React.CSSProperties;
}

const COLOR_PALETTE = ['#059669', '#2563eb', '#7c3aed', '#db2777', '#d97706', '#0f766e', '#4338ca', '#b4232f'];
const hashStr = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; } return Math.abs(h); };
const getInitials = (name?: string) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('');
};

export const Avatar: React.FC<AvatarProps> = ({ src, name, className = '', style }) => {
  const [imgError, setImgError] = useState(false);
  const initials = getInitials(name);
  const color = style?.backgroundColor || COLOR_PALETTE[hashStr(name || '') % COLOR_PALETTE.length];

  if (src && !imgError) {
    return (
      <div className={`flex-shrink-0 rounded-full overflow-hidden ${className}`}>
        <img
          src={src}
          alt={name || 'Avatar'}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={`flex-shrink-0 rounded-full flex items-center justify-center font-bold text-white ${className}`}
      style={{ backgroundColor: color, ...style }}
    >
      {initials}
    </div>
  );
};