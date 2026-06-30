export interface Location {
  id: string;
  name: string;
}

export interface Club {
  id: string;
  name: string;
  subName?: string;
  address?: string;
  email?: string;
  whatsapp?: string;
  instagram?: string;
  logoPath?: string;
  lat: number;
  lng: number;
  linkMap?: string;
  openingHours?: Record<string, any>;
  openingDate?: string;
  locationId: string;
  price?: number;
  courtCount?: number;
}

export interface Court {
  id: string;
  clubId: string;
  name: string;
}

export interface Booking {
  id: string;
  clubId: string;
  courtId: string;
  bookingTime: string;
  price?: number;
}

export interface Price {
  id: string;
  clubId: string;
  day: string;
  time: string;
  startPeriod: string;
  endPeriod?: string;
  price?: number;
}

export interface ClubOverviewItem {
  id: string;
  name: string;
  subName?: string;
  address?: string;
  lat?: number;
  lng?: number;
  locationId: string;
  logoPath?: string;
  price?: number;
  bookingCount: number;
  totalRevenue: number;
}

export interface ClubOverviewResult {
  items: ClubOverviewItem[];
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
}

export interface DashboardClubRow {
  club: Club;
  bookingCount: number;
  totalRevenue: number;
}