import React, { useCallback, useRef, useEffect, useState } from 'react';
import { GoogleMap, OverlayView } from '@react-google-maps/api';
import { useMapContext } from '../../context/MapContext';

const LOGO_BASE = 'https://static.courtside.id/';
const MARKER_COLORS = ['#5375E2', '#d97706', '#059669', '#2563eb', '#7c3aed', '#db2777', '#0f766e', '#4338ca'];

const hashSeed = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const pickColor = (seed: string) => MARKER_COLORS[hashSeed(seed) % MARKER_COLORS.length];

/** Factory that creates the overlay class after Google Maps API is loaded. */
function createHtmlMarkerOverlayClass() {
  return class HtmlMarkerOverlay extends google.maps.OverlayView {
    private div: HTMLDivElement | null = null;
    private position: google.maps.LatLngLiteral;
    private color: string;
    private name?: string;
    private logoPath?: string;
    private onClick?: () => void;

    constructor(
      position: google.maps.LatLngLiteral,
      color: string,
      name?: string,
      logoPath?: string,
      onClick?: () => void,
    ) {
      super();
      this.position = position;
      this.color = color;
      this.name = name;
      this.logoPath = logoPath;
      this.onClick = onClick;
    }

    setActive(active: boolean) {
      if (this.div) {
        this.div.style.zIndex = active ? '9999' : '1';
        if (active) {
          this.div.style.transform = 'translate(-50%, -100%) scale(1.15)';
          this.div.style.filter = 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))';
        }
      }
    }

    onAdd() {
      const hasLogo = !!this.logoPath;
      const safeLogo = this.logoPath ? `${LOGO_BASE}${this.logoPath}` : '';
      const initial = (this.name || 'P').charAt(0).toUpperCase();

      this.div = document.createElement('div');
      this.div.style.position = 'absolute';
      this.div.style.cursor = 'pointer';
      this.div.style.transform = 'translate(-50%, -100%)';
      this.div.style.zIndex = '1';
      this.div.style.pointerEvents = 'auto';
      this.div.style.transition = 'transform 0.15s ease, filter 0.15s ease';
      this.div.innerHTML = `
        <div style="position:relative;width:58px;height:70px;">
          <svg width="58" height="70" viewBox="0 0 58 70" style="position:absolute;left:0;top:0;z-index:1;">
            <polygon points="4,29 54,29 29,71" fill="${this.color}" />
            <rect x="4" y="4" width="50" height="50" rx="8" ry="8" fill="${this.color}" />
          </svg>
          <div style="position:absolute;left:4px;top:4px;width:50px;height:50px;border-radius:8px;display:flex;align-items:center;justify-content:center;z-index:2;">
            <div style="width:42px;height:42px;border-radius:6px;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;">
              ${hasLogo
                ? `<img src="${safeLogo}" alt="${initial}" style="width:100%;height:100%;object-fit:cover;" />`
                : `<span style="font-size:13px;font-weight:700;color:${this.color};font-family:Arial,sans-serif;">${initial}</span>`
              }
            </div>
          </div>
        </div>
      `;

      this.div.addEventListener('mouseenter', () => {
        this.div!.style.transform = 'translate(-50%, -100%) scale(1.15)';
        this.div!.style.filter = 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))';
        this.div!.style.zIndex = '100';
      });

      this.div.addEventListener('mouseleave', () => {
        this.div!.style.transform = 'translate(-50%, -100%) scale(1)';
        this.div!.style.filter = 'none';
        this.div!.style.zIndex = '1';
      });

      if (this.onClick) {
        this.div.addEventListener('click', (e: MouseEvent) => {
          e.stopPropagation();
          e.preventDefault();
          this.onClick?.();
        });
      }
      this.div.addEventListener('mousedown', (e: MouseEvent) => e.stopPropagation());
      this.div.addEventListener('mouseup', (e: MouseEvent) => e.stopPropagation());

      const panes = this.getPanes();
      if (panes) {
        panes.floatPane.appendChild(this.div);
      }
    }

    draw() {
      const overlayProjection = this.getProjection();
      if (!overlayProjection || !this.div) return;

      const pos = overlayProjection.fromLatLngToDivPixel(
        new google.maps.LatLng(this.position.lat, this.position.lng),
      );

      if (pos) {
        this.div.style.left = `${pos.x}px`;
        this.div.style.top = `${pos.y}px`;
      }
    }

    onRemove() {
      if (this.div) {
        this.div.parentNode?.removeChild(this.div);
        this.div = null;
      }
    }
  };
}

interface MarkerData {
  id: string;
  position: { lat: number; lng: number };
  name?: string;
  logoPath?: string;
  colorSeed?: string;
  color?: string;
  popupContent?: React.ReactNode;
}

interface GoogleMapViewProps {
  center: { lat: number; lng: number };
  zoom?: number;
  markers?: MarkerData[];
  fitBounds?: boolean;
  onMarkerClick?: (id: string) => void;
  height?: string | number;
  width?: string | number;
  className?: string;
}

const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: true,
  mapTypeId: 'roadmap',
  streetViewControl: false,
  fullscreenControl: true,
  gestureHandling: 'cooperative',
};

export const GoogleMapView: React.FC<GoogleMapViewProps> = ({
  center,
  zoom = 14,
  markers = [],
  fitBounds = false,
  onMarkerClick,
  height = '100%',
  width = '100%',
  className,
}) => {
  const { map, setMap, isLoaded, loadError } = useMapContext();
  const overlaysRef = useRef<Map<string, InstanceType<ReturnType<typeof createHtmlMarkerOverlayClass>>>>(new Map());
  const [activeMarker, setActiveMarker] = useState<string | null>(null);
  const isFirstLoad = useRef(true);
  const OverlayClassRef = useRef<ReturnType<typeof createHtmlMarkerOverlayClass> | null>(null);

  // Create the overlay class once the API is available
  useEffect(() => {
    if (isLoaded && !OverlayClassRef.current) {
      OverlayClassRef.current = createHtmlMarkerOverlayClass();
    }
  }, [isLoaded]);

  // Update z-index when activeMarker changes
  useEffect(() => {
    overlaysRef.current.forEach((overlay, id) => {
      overlay.setActive(id === activeMarker);
    });
  }, [activeMarker]);

  // Create/remove overlays when markers change
  useEffect(() => {
    if (!map || !OverlayClassRef.current) return;

    // Remove old overlays
    overlaysRef.current.forEach((o) => o.setMap(null));
    overlaysRef.current.clear();

    // Create new overlays
    markers.forEach((marker) => {
      const color = marker.color || pickColor(marker.colorSeed || marker.id);
      const overlay = new OverlayClassRef.current!(
        marker.position,
        color,
        marker.name,
        marker.logoPath,
        () => {
          setActiveMarker(marker.id);
          onMarkerClick?.(marker.id);
        },
      );
      overlay.setMap(map);
      overlay.setActive(marker.id === activeMarker);
      overlaysRef.current.set(marker.id, overlay);
    });

    // Only fit bounds on initial load
    if (isFirstLoad.current && fitBounds && markers.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      markers.forEach((m) => bounds.extend(m.position));
      map.fitBounds(bounds, 40);
      isFirstLoad.current = false;
    }
  }, [map, markers, fitBounds, onMarkerClick, activeMarker]);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, [setMap]);

  if (loadError) {
    return (
      <div className={className} style={{ height, width }}>
        <div className="flex items-center justify-center h-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-sm">
          Failed to load Google Maps
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className={className} style={{ height, width }}>
        <div className="flex items-center justify-center h-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-sm">
          Loading map...
        </div>
      </div>
    );
  }

  return (
    <div className={className} style={{ height, width }}>
      <GoogleMap
        mapContainerStyle={{ width, height }}
        center={center}
        zoom={zoom}
        options={mapOptions}
        onLoad={onLoad}
      >
        {/* Custom popup overlay for active marker */}
        {activeMarker && markers.find((m) => m.id === activeMarker) && (
          <OverlayView
            position={markers.find((m) => m.id === activeMarker)!.position}
            mapPaneName={OverlayView.FLOAT_PANE}
          >
            <div
              style={{
                transform: 'translate(-50%, -100%) translateY(-78px)',
                background: '#fff',
                borderRadius: 12,
                padding: '12px 14px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
                minWidth: 280,
                maxWidth: 340,
                width: 300,
                position: 'relative',
                zIndex: 10000,
                fontFamily: 'Arial, sans-serif',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Arrow pointing down to marker */}
              <div
                style={{
                  position: 'absolute',
                  bottom: -8,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 0,
                  height: 0,
                  borderLeft: '8px solid transparent',
                  borderRight: '8px solid transparent',
                  borderTop: '8px solid #fff',
                }}
              />
              <button
                onClick={() => setActiveMarker(null)}
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 8,
                  background: 'none',
                  border: 'none',
                  fontSize: 16,
                  cursor: 'pointer',
                  color: '#94a3b8',
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                ×
              </button>
              <div style={{ paddingRight: 16 }}>
                {markers.find((m) => m.id === activeMarker)?.popupContent || (
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>
                    {markers.find((m) => m.id === activeMarker)?.name}
                  </div>
                )}
              </div>
            </div>
          </OverlayView>
        )}
      </GoogleMap>
    </div>
  );
};
