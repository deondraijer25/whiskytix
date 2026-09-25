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

const INITIAL_SCANS: ScanRecord[] = [];

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
