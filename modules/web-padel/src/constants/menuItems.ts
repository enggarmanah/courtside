export interface MenuItem {
  label: string;
  icon: string;
  path: string;
}

export const menuItems: MenuItem[] = [
  { label: 'Home', icon: 'home', path: '/dashboard' },
  { label: 'Analytics', icon: 'chart-bar', path: '/analytics' },
  { label: 'Clubs', icon: 'building', path: '/clubs' },
  { label: 'Bookings', icon: 'calendar', path: '/bookings' },
  { label: 'Settings', icon: 'settings', path: '/settings' },
];