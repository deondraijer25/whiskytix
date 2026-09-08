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
  status: 'paid' | 'pending' | 'refunded' | 'expired';
  createdAt: string;
  tickets: {
    code: string;
    type: string;
    session: string;
    attendeeName: string;
    status: 'valid' | 'checked_in' | 'cancelled';
  }[];
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
    id: 'denhaag',
    name: 'International Whisky Festival Den Haag',
    edition: '25e Jubileum Editie',
    location: 'Grote Kerk Den Haag',
    dates: '13, 14 en 15 Nov 2026',
    status: 'live',
    statusLabel: 'KAARTVERKOOP LIVE',
    revenueCents: 28435000,
    ticketsSold: 4850,
    ticketsTotal: 5850,
    vipStatus: 'UITVERKOCHT (850/850)',
    vipSold: 850,
    vipTotal: 850,
  },
  {
    id: 'amsterdam',
    name: 'Whisky Weekend Amsterdam',
    edition: '2e Editie',
    location: 'Zuiderkerk Amsterdam',
    dates: '2, 3 en 4 Okt 2026',
    status: 'live',
    statusLabel: 'KAARTVERKOOP LIVE',
    revenueCents: 19580000,
    ticketsSold: 3400,
    ticketsTotal: 4200,
    vipStatus: 'Bijna vol (92%)',
    vipSold: 690,
    vipTotal: 750,
  },
  {
    id: 'gent',
    name: 'International Whisky Festival Gent',
    edition: '21e Editie',
    location: 'De Oude Vismijn Gent',
    dates: '20, 21 en 22 Mrt 2027',
    status: 'earlybird',
    statusLabel: 'VROEGBOEKING OPEN',
    revenueCents: 11240000,
    ticketsSold: 2100,
    ticketsTotal: 3500,
    vipStatus: '540 / 750 (72%)',
    vipSold: 540,
    vipTotal: 750,
  },
];

export const INITIAL_ORDERS: Order[] = [
  {
    id: 'ord-1',
    orderNumber: '#WF-84392',
    customerName: 'Pieter van Mechelen',
    customerEmail: 'pieter@gentwhisky.be',
    customerPhone: '+32 470 12 34 56',
    city: 'gent',
    cityName: 'Gent',
    itemsSummary: '2x Regulier Zondagsessie',
    totalCents: 11000,
    status: 'paid',
    createdAt: 'Vandaag, 21:14 uur',
    tickets: [
      {
        code: '#WF-2027-84392-1',
        type: 'Regulier Entree',
        session: 'Zondagsessie (13:00 - 17:00)',
        attendeeName: 'Pieter van Mechelen',
        status: 'valid',
      },
      {
        code: '#WF-2027-84392-2',
        type: 'Regulier Entree',
        session: 'Zondagsessie (13:00 - 17:00)',
        attendeeName: 'Annelies De Smet',
        status: 'valid',
      },
    ],
  },
  {
    id: 'ord-2',
    orderNumber: '#WF-84391',
    customerName: 'Robert-Jan Bakker',
    customerEmail: 'rj.bakker@kpnmail.nl',
    customerPhone: '+31 6 12345678',
    city: 'denhaag',
    cityName: 'Den Haag',
    itemsSummary: '2x VIP Vrijdag + Haagsche Whiskytram 14u',
    totalCents: 18800,
    status: 'paid',
    createdAt: 'Vandaag, 20:48 uur',
    tickets: [
      {
        code: '#WF-2026-84391-1',
        type: 'VIP Jubileum Vrijdag',
        session: 'Vrijdag VIP (13:30 - 18:30)',
        attendeeName: 'Robert-Jan Bakker',
        status: 'valid',
      },
      {
        code: '#WF-2026-84391-2',
        type: 'VIP Jubileum Vrijdag',
        session: 'Vrijdag VIP (13:30 - 18:30)',
        attendeeName: 'Karel van Dongen',
        status: 'valid',
      },
      {
        code: '#WF-2026-84391-3',
        type: 'Haagsche Whiskytram Rondrit',
        session: 'Vrijdag 14:00 uur',
        attendeeName: 'Robert-Jan Bakker',
        status: 'valid',
      },
    ],
  },
  {
    id: 'ord-3',
    orderNumber: '#WF-84390',
    customerName: 'Dennis Mulder',
    customerEmail: 'dennis.mulder@gmail.com',
    customerPhone: '+31 6 98765432',
    city: 'amsterdam',
    cityName: 'Amsterdam',
    itemsSummary: '4x Regulier Entree Vrijdag',
    totalCents: 22000,
    status: 'paid',
    createdAt: 'Vandaag, 19:35 uur',
    tickets: [
      {
        code: '#WF-2026-84390-1',
        type: 'Regulier Entree Vrijdag',
        session: 'Vrijdagavond (19:00 - 23:00)',
        attendeeName: 'Dennis Mulder',
        status: 'valid',
      },
      {
        code: '#WF-2026-84390-2',
        type: 'Regulier Entree Vrijdag',
        session: 'Vrijdagavond (19:00 - 23:00)',
        attendeeName: 'Lars Jansen',
        status: 'valid',
      },
      {
        code: '#WF-2026-84390-3',
        type: 'Regulier Entree Vrijdag',
        session: 'Vrijdagavond (19:00 - 23:00)',
        attendeeName: 'Thijs de Vries',
        status: 'valid',
      },
      {
        code: '#WF-2026-84390-4',
        type: 'Regulier Entree Vrijdag',
        session: 'Vrijdagavond (19:00 - 23:00)',
        attendeeName: 'Sander Bos',
        status: 'valid',
      },
    ],
  },
  {
    id: 'ord-4',
    orderNumber: '#WF-84389',
    customerName: 'Marc Kalse',
    customerEmail: 'marc.kalse@ziggo.nl',
    customerPhone: '+31 6 55443322',
    city: 'denhaag',
    cityName: 'Den Haag',
    itemsSummary: '1x Festivalfles 25 Jaar Single Cask',
    totalCents: 7950,
    status: 'pending',
    createdAt: 'Vandaag, 18:20 uur',
    tickets: [],
  },
  {
    id: 'ord-5',
    orderNumber: '#WF-84388',
    customerName: 'Saskia van der Linden',
    customerEmail: 'saskia.vdl@outlook.com',
    customerPhone: '+31 6 33221100',
    city: 'denhaag',
    cityName: 'Den Haag',
    itemsSummary: '2x Zaterdagmiddag + Masterclass Springbank',
    totalCents: 15500,
    status: 'paid',
    createdAt: 'Gisteren, 22:15 uur',
    tickets: [
      {
        code: '#WF-2026-84388-1',
        type: 'Regulier Zaterdagmiddag',
        session: 'Zaterdagmiddag (13:00 - 17:00)',
        attendeeName: 'Saskia van der Linden',
        status: 'valid',
      },
      {
        code: '#WF-2026-84388-2',
        type: 'Regulier Zaterdagmiddag',
        session: 'Zaterdagmiddag (13:00 - 17:00)',
        attendeeName: 'Bram Schipper',
        status: 'valid',
      },
      {
        code: '#WF-2026-84388-3',
        type: 'Masterclass Springbank Distillers',
        session: 'Zaterdag 14:30 Zaal B',
        attendeeName: 'Saskia van der Linden',
        status: 'valid',
      },
    ],
  },
];

export const INITIAL_SESSIONS: SessionCapacity[] = [
  {
    id: 'sess-dh-1',
    city: 'denhaag',
    name: 'VIP Sessie Vrijdag (Inclusief Jubileum Glas)',
    day: 'Vrijdag 13 Nov 2026',
    time: '13:30 - 18:30',
    sold: 850,
    max: 850,
    isSoldOut: true,
    category: 'vip',
  },
  {
    id: 'sess-dh-2',
    city: 'denhaag',
    name: 'Entree Vrijdagavond',
    day: 'Vrijdag 13 Nov 2026',
    time: '19:00 - 23:00',
    sold: 1120,
    max: 1350,
    isSoldOut: false,
    category: 'regulier',
  },
  {
    id: 'sess-dh-3',
    city: 'denhaag',
    name: 'Entree Zaterdagmiddag',
    day: 'Zaterdag 14 Nov 2026',
    time: '13:00 - 17:00',
    sold: 1350,
    max: 1350,
    isSoldOut: true,
    category: 'regulier',
  },
  {
    id: 'sess-dh-4',
    city: 'denhaag',
    name: 'Entree Zaterdagavond',
    day: 'Zaterdag 14 Nov 2026',
    time: '19:00 - 23:00',
    sold: 980,
    max: 1350,
    isSoldOut: false,
    category: 'regulier',
  },
  {
    id: 'sess-dh-5',
    city: 'denhaag',
    name: 'Entree Zondag (Festival Finale)',
    day: 'Zondag 15 Nov 2026',
    time: '13:00 - 17:00',
    sold: 550,
    max: 950,
    isSoldOut: false,
    category: 'regulier',
  },
  {
    id: 'sess-dh-mc1',
    city: 'denhaag',
    name: 'Masterclass: Rare & Old Highland Single Malts (Zaal A)',
    day: 'Zaterdag 14 Nov 2026',
    time: '14:00 - 15:15',
    sold: 28,
    max: 28,
    isSoldOut: true,
    category: 'masterclass',
  },
  {
    id: 'sess-dh-mc2',
    city: 'denhaag',
    name: 'Masterclass: Islay Peat Exploration (Zaal B)',
    day: 'Zaterdag 14 Nov 2026',
    time: '15:45 - 17:00',
    sold: 24,
    max: 28,
    isSoldOut: false,
    category: 'masterclass',
  },
];

export const INITIAL_COUPONS: Coupon[] = [
  {
    id: 'coup-1',
    code: 'WS-LID-2026',
    city: 'Alle Festivals',
    type: 'percentage',
    value: 10,
    usedCount: 142,
    maxUses: 250,
    totalDiscountGrantedCents: 184500,
    validUntil: '31 Dec 2026',
    isActive: true,
  },
  {
    id: 'coup-2',
    code: 'EARLYBIRD-DH',
    city: 'Den Haag',
    type: 'fixed_amount',
    value: 500,
    usedCount: 200,
    maxUses: 200,
    totalDiscountGrantedCents: 100000,
    validUntil: '1 Aug 2026',
    isActive: false,
  },
  {
    id: 'coup-3',
    code: 'WHISKYTRAM-COMBO',
    city: 'Den Haag',
    type: 'fixed_amount',
    value: 750,
    usedCount: 45,
    maxUses: 100,
    totalDiscountGrantedCents: 33750,
    validUntil: '10 Nov 2026',
    isActive: true,
  },
];

export const INITIAL_SCAN_LOGS: ScanLog[] = [
  {
    id: 'scan-1',
    ticketCode: '#WF-2026-84391-1',
    attendeeName: 'Robert-Jan Bakker',
    sessionName: 'VIP Jubileum Vrijdag',
    city: 'Den Haag',
    gate: 'Deur 1 (Hoofdingang)',
    volunteerName: 'Daan (Vrijwilliger)',
    scannedAt: '13:14:22',
    status: 'valid',
  },
  {
    id: 'scan-2',
    ticketCode: '#WF-2026-84391-2',
    attendeeName: 'Karel van Dongen',
    sessionName: 'VIP Jubileum Vrijdag',
    city: 'Den Haag',
    gate: 'Deur 1 (Hoofdingang)',
    volunteerName: 'Daan (Vrijwilliger)',
    scannedAt: '13:14:48',
    status: 'valid',
  },
  {
    id: 'scan-3',
    ticketCode: '#WF-2026-84388-1',
    attendeeName: 'Saskia van der Linden',
    sessionName: 'VIP Jubileum Vrijdag',
    city: 'Den Haag',
    gate: 'Deur 2 (Zijportaal)',
    volunteerName: 'Sophie (Vrijwilliger)',
    scannedAt: '13:16:05',
    status: 'valid',
  },
];
