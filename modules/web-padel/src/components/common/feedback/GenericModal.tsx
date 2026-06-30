import React, { useEffect, useRef } from 'react';
import { Icon, IconName } from '../ui/Icon';

interface GenericModalProps {
  title: string;
  message?: string;
  icon?: IconName;
  isOpen?: boolean;
  onClose: () => void;
  children?: React.ReactNode;
  className?: string;
  width?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

const WIDTH_MAP = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-full mx-4',
};

export const GenericModal: React.FC<GenericModalProps> = ({
  title, message, icon, isOpen = true, onClose, children, className, width = 'md'
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 animate-fadeIn"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 w-full ${WIDTH_MAP[width]} animate-slideUp ${className || ''}`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            {icon && <Icon name={icon} size={20} className="text-brand-600 dark:text-brand-400" />}
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
          >
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          {message && (
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4 whitespace-pre-line">{message}</p>
          )}
          {children}
        </div>
      </div>
    </div>
  );
};