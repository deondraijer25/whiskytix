export interface Festival {
  id: 'all' | 'denhaag' | 'amsterdam' | 'gent';
  name: string;
  edition: string;
  location: string;
  dates: string;
  status: 'live' | 'earlybird' | 'soldout';
  statusLabel: string;
  revenueCents: number;
  ticketsSold: number;
  ticketsTotal: number;
  vipStatus: string;
  vipSold: number;
  vipTotal: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  city: 'denhaag' | 'amsterdam' | 'gent';
  cityName: string;
  itemsSummary: string;
  totalCents: number;
  status: 'paid' | 'pending' | 'refunded' | 'expired' | 'canceled';
  createdAt: string;
  environment?: 'test' | 'live';
  tickets: {
    code: string;
    type: string;
    session: string;
    attendeeName: string;
    status: 'valid' | 'checked_in' | 'cancelled';
  }[];
  items?: any[];
}

export interface SessionCapacity {
  id: string;
  city: 'denhaag' | 'amsterdam' | 'gent';
  name: string;
  day: string;
  time: string;
  sold: number;
  max: number;
  isSoldOut: boolean;
  category: 'regulier' | 'vip' | 'masterclass';
}

export interface Coupon {
  id: string;
  code: string;
  city: string;
  type: 'percentage' | 'fixed_amount';
  value: number; // percentage or cents
  usedCount: number;
  maxUses: number;
  totalDiscountGrantedCents: number;
  validUntil: string;
  isActive: boolean;
}

export interface ScanLog {
  id: string;
  ticketCode: string;
  attendeeName: string;
  sessionName: string;
  city: string;
  gate: string;
  volunteerName: string;
  scannedAt: string;
  status: 'valid' | 'duplicate' | 'wrong_session';
}

export const INITIAL_FESTIVALS: Festival[] = [
  {
    id: 'gent',
    name: 'Gents Whisky Festival',
    edition: '21e Editie',
    location: 'De Oude Vismijn Gent',
    dates: '2, 3 en 4 Okt 2026',
    status: 'live',
    statusLabel: 'KAARTVERKOOP LIVE',
    revenueCents: 0,
    ticketsSold: 0,
    ticketsTotal: 2360,
    vipStatus: 'Vroegboeking actief',
    vipSold: 0,
    vipTotal: 450,
  },
  {
    id: 'denhaag',
    name: 'International Whisky Festival Den Haag',
    edition: '25e Jubileum Editie',
    location: 'Grote Kerk Den Haag',
    dates: '13, 14 en 15 Nov 2026',
    status: 'earlybird',
    statusLabel: 'IN VOORBEREIDING',
    revenueCents: 0,
    ticketsSold: 0,
    ticketsTotal: 7663,
    vipStatus: 'Bij start verkoop',
    vipSold: 0,
    vipTotal: 850,
  },
  {
    id: 'amsterdam',
    name: 'Whisky Weekend Amsterdam',
    edition: '2e Editie',
    location: 'De Hallen Amsterdam',
    dates: '15, 16 en 17 Jan 2027',
    status: 'earlybird',
    statusLabel: 'IN VOORBEREIDING',
    revenueCents: 0,
    ticketsSold: 0,
    ticketsTotal: 2860,
    vipStatus: 'Bij start verkoop',
    vipSold: 0,
    vipTotal: 500,
  },
];

export const INITIAL_ORDERS: Order[] = [];

export const INITIAL_SESSIONS: SessionCapacity[] = [
  // Gent (Actief)
  {
    id: 'gent-vrijdag-vroeg',
    city: 'gent',
    name: 'Vrijdag Vroegboeking Sessie',
    day: 'Vrijdag 20 maart 2027',
    time: '13:00 - 17:00',
    sold: 0,
    max: 1000,
    isSoldOut: false,
    category: 'regulier',
  },
  {
    id: 'gent-zat-middag',
    city: 'gent',
    name: 'Zaterdagmiddag Sessie',
    day: 'Zaterdag 21 maart 2027',
    time: '13:00 - 17:00',
    sold: 0,
    max: 1250,
    isSoldOut: false,
    category: 'regulier',
  },
  {
    id: 'gent-zat-avond',
    city: 'gent',
    name: 'Zaterdagavond Sessie',
    day: 'Zaterdag 21 maart 2027',
    time: '18:30 - 22:30',
    sold: 0,
    max: 1250,
    isSoldOut: false,
    category: 'regulier',
  },

  // Den Haag (In voorbereiding)
  {
    id: 'dh-vrij-vip',
    city: 'denhaag',
    name: 'Exclusieve VIP Sessie — Vrijdag',
    day: 'Vrijdag 13 november 2026',
    time: '13:00 - 17:00',
    sold: 0,
    max: 850,
    isSoldOut: false,
    category: 'vip',
  },
  {
    id: 'dh-vrij-avond',
    city: 'denhaag',
    name: 'Vrijdagavond Regulier',
    day: 'Vrijdag 13 november 2026',
    time: '19:00 - 23:00',
    sold: 0,
    max: 1400,
    isSoldOut: false,
    category: 'regulier',
  },
  {
    id: 'dh-zat-middag',
    city: 'denhaag',
    name: 'Zaterdagmiddag Sessie',
    day: 'Zaterdag 14 november 2026',
    time: '13:00 - 17:00',
    sold: 0,
    max: 1800,
    isSoldOut: false,
    category: 'regulier',
  },
  {
    id: 'dh-zat-avond',
    city: 'denhaag',
    name: 'Zaterdagavond Sessie',
    day: 'Zaterdag 14 november 2026',
    time: '19:00 - 23:00',
    sold: 0,
    max: 1800,
    isSoldOut: false,
    category: 'regulier',
  },

  // Amsterdam (In voorbereiding)
  {
    id: 'ams-vrij-avond',
    city: 'amsterdam',
    name: 'Openingsavond Vrijdag',
    day: 'Vrijdag 2 oktober 2026',
    time: '18:30 - 22:30',
    sold: 0,
    max: 1400,
    isSoldOut: false,
    category: 'regulier',
  },
  {
    id: 'ams-zat-middag',
    city: 'amsterdam',
    name: 'Zaterdagmiddag Sessie',
    day: 'Zaterdag 3 oktober 2026',
    time: '13:00 - 17:00',
    sold: 0,
    max: 1400,
    isSoldOut: false,
    category: 'regulier',
  },
  {
    id: 'ams-zon-middag',
    city: 'amsterdam',
    name: 'Zondagmiddag Finale',
    day: 'Zondag 4 oktober 2026',
    time: '13:00 - 17:00',
    sold: 0,
    max: 1400,
    isSoldOut: false,
    category: 'regulier',
  },
];

export const INITIAL_COUPONS: Coupon[] = [];

export const INITIAL_SCAN_LOGS: ScanLog[] = [];
