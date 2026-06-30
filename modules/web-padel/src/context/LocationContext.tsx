import React, { createContext, useContext, useState } from 'react';

interface LocationContextType {
  selectedLocationId: string;
  setSelectedLocationId: (id: string) => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

const STORAGE_KEY = 'padel_selectedLocationId';

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedLocationId, setSelectedLocationId] = useState<string>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored || '';
  });

  const handleSet = (id: string) => {
    localStorage.setItem(STORAGE_KEY, id);
    setSelectedLocationId(id);
  };

  return (
    <LocationContext.Provider value={{ selectedLocationId, setSelectedLocationId: handleSet }}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocationSelector = () => {
  const context = useContext(LocationContext);
  if (!context) throw new Error('useLocationSelector must be used within LocationProvider');
  return context;
};