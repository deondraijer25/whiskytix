export interface ScanRecord {
  id: string;
  ticketCode: string;
  attendeeName: string;
  sessionTitle: string;
  scannedAt: string;
  status: 'valid' | 'duplicate' | 'wrong_session';
  detail: string;
  gate: string;
}

const STORAGE_KEY = 'whiskytix_scanner_history';

const INITIAL_SCANS: ScanRecord[] = [
  {
    id: 'scan-1',
    ticketCode: '#WF-2026-76464-1',
    attendeeName: 'Deon Draijer',
    sessionTitle: 'VIP Jubileum Vrijdag',
    scannedAt: '16:53',
    status: 'duplicate',
    detail: 'Dit ticket is al eerder ingecheckt bij Deur 1 (Scanner #3).',
    gate: 'Hoofdingang • Deur 1',
  },
  {
    id: 'scan-2',
    ticketCode: '#WF-2026-76464-1',
    attendeeName: 'Deon Draijer',
    sessionTitle: 'VIP Jubileum Vrijdag',
    scannedAt: '16:52',
    status: 'valid',
    detail: 'Entree Verleend • Welkomstglas inbegrepen',
    gate: 'Hoofdingang • Deur 1',
  },
  {
    id: 'scan-3',
    ticketCode: '#WF-2026-84388-2',
    attendeeName: 'Karel van Dongen',
    sessionTitle: 'VIP Jubileum Vrijdag',
    scannedAt: '16:48',
    status: 'valid',
    detail: 'Entree Verleend • Welkomstglas inbegrepen',
    gate: 'Hoofdingang • Deur 1',
  },
  {
    id: 'scan-4',
    ticketCode: '#WF-2026-84380-1',
    attendeeName: 'Sophie van Dam',
    sessionTitle: 'VIP Jubileum Vrijdag',
    scannedAt: '16:41',
    status: 'valid',
    detail: 'Entree Verleend',
    gate: 'Hoofdingang • Deur 1',
  },
  {
    id: 'scan-5',
    ticketCode: '#WF-2026-99120-1',
    attendeeName: 'Martijn Vos',
    sessionTitle: 'Zaterdagmiddag Sessie',
    scannedAt: '16:34',
    status: 'wrong_session',
    detail: 'Geldig voor ZATERDAG, niet voor huidige Vrijdagsessie.',
    gate: 'Hoofdingang • Deur 1',
  },
  {
    id: 'scan-6',
    ticketCode: '#WF-2026-84391-1',
    attendeeName: 'Robert-Jan Bakker',
    sessionTitle: 'VIP Jubileum Vrijdag',
    scannedAt: '16:29',
    status: 'valid',
    detail: 'Entree Verleend • Masterclass Voucher',
    gate: 'Hoofdingang • Deur 1',
  },
  {
    id: 'scan-7',
    ticketCode: '#WF-2027-84392-1',
    attendeeName: 'Pieter van Mechelen',
    sessionTitle: 'Regulier Vrijdag',
    scannedAt: '16:15',
    status: 'valid',
    detail: 'Entree Verleend',
    gate: 'Hoofdingang • Deur 1',
  },
];

export function getStoredScans(): ScanRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_SCANS));
      return INITIAL_SCANS;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.warn('Could not read scan history from localStorage:', e);
    return INITIAL_SCANS;
  }
}

export function saveStoredScans(scans: ScanRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scans.slice(0, 150)));
  } catch (e) {
    console.warn('Could not save scan history to localStorage:', e);
  }
}

export function addStoredScan(record: ScanRecord): ScanRecord[] {
  const current = getStoredScans();
  const updated = [record, ...current.filter((s) => s.id !== record.id)];
  saveStoredScans(updated);
  return updated;
}

export function clearStoredScans(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
  } catch (e) {
    console.warn('Could not clear scan history:', e);
  }
}
