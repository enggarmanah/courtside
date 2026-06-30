import { Club, Court, Booking, Price, Location } from '../types/padel';

export const mockLocations: Location[] = [
  { id: 'loc-1', name: 'Jakarta Selatan' },
  { id: 'loc-2', name: 'Jakarta Pusat' },
  { id: 'loc-3', name: 'Jakarta Barat' },
  { id: 'loc-4', name: 'Tangerang' },
];

export const mockClubs: Club[] = [
  {
    id: 'club-1',
    name: 'Padel Arena Senayan',
    address: 'Jl. Gatot Subroto No.1, Senayan',
    lat: -6.2222,
    lng: 106.8031,
    locationId: 'loc-1',
    whatsapp: '62811223344',
    price: 250000,
  },
  {
    id: 'club-2',
    name: 'Padel Club Kemang',
    address: 'Jl. Kemang Raya No.8, Kemang',
    lat: -6.2598,
    lng: 106.8195,
    locationId: 'loc-1',
    price: 200000,
  },
  {
    id: 'club-3',
    name: 'Padel Sports Center',
    address: 'Jl. MH Thamrin No.10, Menteng',
    lat: -6.1887,
    lng: 106.8233,
    locationId: 'loc-2',
    price: 300000,
  },
  {
    id: 'club-4',
    name: 'West Padel Studio',
    address: 'Jl. Raya Kebon Jeruk No.15',
    lat: -6.2052,
    lng: 106.7632,
    locationId: 'loc-3',
    price: 180000,
  },
  {
    id: 'club-5',
    name: 'BSD Padel Court',
    address: 'Jl. BSD Grand Boulevard, Serpong',
    lat: -6.3031,
    lng: 106.6550,
    locationId: 'loc-4',
    price: 220000,
  },
  {
    id: 'club-6',
    name: 'Padel House Kuningan',
    address: 'Jl. HR Rasuna Said, Kuningan',
    lat: -6.2389,
    lng: 106.8281,
    locationId: 'loc-1',
    price: 275000,
  },
];

export const mockCourts: Court[] = [
  { id: 'court-1', clubId: 'club-1', name: 'Court A' },
  { id: 'court-2', clubId: 'club-1', name: 'Court B' },
  { id: 'court-3', clubId: 'club-2', name: 'Main Court' },
  { id: 'court-4', clubId: 'club-2', name: 'Practice Court' },
  { id: 'court-5', clubId: 'club-3', name: 'Center Court' },
  { id: 'court-6', clubId: 'club-3', name: 'Side Court' },
  { id: 'court-7', clubId: 'club-3', name: 'Court 3' },
  { id: 'court-8', clubId: 'club-4', name: 'Court A' },
  { id: 'court-9', clubId: 'club-5', name: 'Court 1' },
  { id: 'court-10', clubId: 'club-5', name: 'Court 2' },
  { id: 'court-11', clubId: 'club-6', name: 'Indoor Court' },
  { id: 'court-12', clubId: 'club-6', name: 'Outdoor Court' },
];

const generateBookings = (): Booking[] => {
  const bookings: Booking[] = [];
  const courts = mockCourts;
  const clubs = mockClubs;

  const startDate = new Date('2026-06-01');
  const endDate = new Date('2026-06-30');

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    courts.forEach((court) => {
      const sessions = Math.floor(Math.random() * 3);
      for (let s = 0; s < sessions; s++) {
        const hour = 8 + Math.floor(Math.random() * 10);
        const minute = Math.random() > 0.5 ? '00' : '30';
        const clubPrice = clubs.find((c) => c.id === court.clubId)?.price || 200000;
        const priceVariance = 0.9 + Math.random() * 0.2;
        bookings.push({
          id: `booking-${bookings.length + 1}`,
          clubId: court.clubId,
          courtId: court.id,
          bookingTime: `${d.toISOString().split('T')[0]}T${String(hour).padStart(2, '0')}:${minute}:00`,
          price: Math.round(clubPrice * priceVariance),
        });
      }
    });
  }

  return bookings;
};

export const mockBookings: Booking[] = generateBookings();

export const mockPrices: Price[] = mockClubs.flatMap((club) =>
  ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => ({
    id: `price-${club.id}-${day}`,
    clubId: club.id,
    day,
    time: '08:00',
    startPeriod: '2026-01-01T00:00:00Z',
    endPeriod: undefined,
    price: club.price,
  }))
);

export const mockAdminCredentials = {
  email: 'admin@padelitics.com',
  password: 'password123',
  name: 'Admin Padelitics',
};