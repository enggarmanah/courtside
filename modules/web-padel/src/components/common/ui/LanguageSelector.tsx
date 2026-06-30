import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import FlagEn from '../../../images/flags/flag-en.svg';
import FlagId from '../../../images/flags/flag-id.svg';

export type Language = 'en' | 'id';

export const LANGUAGE_OPTIONS: { code: Language; name: string; flag: string }[] = [
  { code: 'en', name: 'English', flag: FlagEn },
  { code: 'id', name: 'Indonesia', flag: FlagId },
];

export const LanguageSelector: React.FC = () => {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const currentLanguage = i18n.language?.startsWith('id') ? 'id' : 'en';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (lang: Language) => {
    i18n.changeLanguage(lang);
    setIsOpen(false);
  };

  const currentOption = LANGUAGE_OPTIONS.find((opt) => opt.code === currentLanguage);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-[3px] w-[34px] h-[34px] rounded-md border border-transparent hover:border-brand-500 dark:hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-slate-700 flex items-center justify-center transition-all dark:bg-slate-800"
      >
        <img
          src={currentOption?.flag || FlagEn}
          alt={currentOption?.name}
          className="w-[24px] h-[24px] rounded-full object-cover border border-slate-400"
        />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 z-20 overflow-hidden">
            {LANGUAGE_OPTIONS.map((option) => (
              <button
                key={option.code}
                onClick={() => handleChange(option.code)}
                className={`w-full px-4 py-2.5 flex items-center gap-3 text-sm transition-colors ${
                  currentLanguage === option.code
                    ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <img
                  src={option.flag}
                  alt={option.name}
                  className="w-[24px] h-[24px] rounded-full object-cover border border-slate-400"
                />
                <span>{option.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};