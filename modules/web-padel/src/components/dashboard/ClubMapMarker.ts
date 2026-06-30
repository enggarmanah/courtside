import L from 'leaflet';

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

const buildPinShellSvg = (ringColor: string) => `
  <svg width="58" height="70" viewBox="0 0 58 70" style="position:absolute;left:0;top:0;z-index:1;">
    <polygon points="4,29 54,29 29,71" fill="${ringColor}" />
    <rect x="4" y="4" width="50" height="50" rx="8" ry="8" fill="${ringColor}" />
  </svg>
`;

const buildClubMarkerIcon = (color: string, clubName?: string, logoPath?: string) => {
  const safeLogo = logoPath ? `${LOGO_BASE}${logoPath.replace(/"/g, '&quot;')}` : '';
  const hasLogo = !!logoPath;
  const initial = (clubName || 'P').charAt(0).toUpperCase();

  return L.divIcon({
    className: 'padel-club-marker',
    html: `
      <div style="position:relative;width:58px;height:70px;">
        ${buildPinShellSvg(color)}
        <div style="position:absolute;left:4px;top:4px;width:50px;height:50px;border-radius:8px;display:flex;align-items:center;justify-content:center;z-index:2;">
          <div style="width:42px;height:42px;border-radius:6px;background:#fff;border:1.5px solid #ffffff;box-shadow:0 0 0 1px rgba(15,23,42,.12);display:flex;align-items:center;justify-content:center;overflow:hidden;">
          ${hasLogo
            ? `<img src="${safeLogo}" alt="${initial}" style="width:100%;height:100%;object-fit:cover;" />`
            : `<span style="font-size:13px;font-weight:700;color:${color};font-family:Arial,sans-serif;">${initial}</span>`
          }
          </div>
        </div>
      </div>
    `,
    iconSize: [58, 70],
    iconAnchor: [29, 66],
    popupAnchor: [0, -58],
  });
};

export { buildClubMarkerIcon, pickColor, MARKER_COLORS };