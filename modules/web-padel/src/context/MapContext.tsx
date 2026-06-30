import React, { createContext, useContext, useRef, useState, useCallback } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';

const GMAPS_API_KEY = import.meta.env.VITE_GMAPS_API_KEY || '';

interface MapContextType {
  map: google.maps.Map | null;
  setMap: (map: google.maps.Map | null) => void;
  panTo: (lat: number, lng: number, zoom?: number) => void;
  isLoaded: boolean;
  loadError: Error | undefined;
}

const MapContext = createContext<MapContextType>({
  map: null,
  setMap: () => {},
  panTo: () => {},
  isLoaded: false,
  loadError: undefined,
});

export const useMapContext = () => useContext(MapContext);

export const MapProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const mapRef = useRef<google.maps.Map | null>(null);
  const [mapState, setMapState] = useState<google.maps.Map | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GMAPS_API_KEY,
  });

  const setMap = useCallback((map: google.maps.Map | null) => {
    mapRef.current = map;
    setMapState(map);
  }, []);

  const panTo = useCallback((lat: number, lng: number, zoom?: number) => {
    const map = mapRef.current;
    if (!map) return;
    if (zoom !== undefined) {
      map.setZoom(zoom);
    }
    map.panTo({ lat, lng });
  }, []);

  return (
    <MapContext.Provider value={{ map: mapState, setMap, panTo, isLoaded, loadError }}>
      {children}
    </MapContext.Provider>
  );
};
