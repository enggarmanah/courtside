import React from 'react';
import { useEffect, useState } from 'react';
import { GenericModal } from './GenericModal';

export const TokenBanner: React.FC = () => {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      setError(detail?.message || 'Session issue detected');
    };
    window.addEventListener('padel:token-error', handler);
    return () => window.removeEventListener('padel:token-error', handler);
  }, []);

  if (!error) return null;

  return (
    <GenericModal
      key={error}
      title="Session Notice"
      message={error}
      onClose={() => setError(null)}
    />
  );
};
