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

export interface VaultTicket {
  code: string;
  name: string;
  session: string;
  city: string;
  status: 'valid' | 'checked_in' | 'cancelled' | 'swapped';
  checkedInAt?: string;
  swapReason?: string;
}

export interface PendingSyncScan {
  ticketCode: string;
  festivalId: string;
  scannedAt: string;
  gate: string;
}

const STORAGE_KEY = 'whiskytix_scanner_history';
const VAULT_PREFIX = 'whiskytix_ticket_vault_';
const PENDING_SYNC_KEY = 'whiskytix_pending_sync_queue';

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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scans.slice(0, 250)));
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

/**
 * Local Ticket Vault (~150 KB for 3,000 tickets)
 * Enables <10ms offline validation when venue WiFi / 4G drops out.
 */
export function getTicketVault(city: string): VaultTicket[] {
  try {
    const raw = localStorage.getItem(`${VAULT_PREFIX}${city.toLowerCase()}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTicketVault(city: string, tickets: VaultTicket[]): void {
  try {
    localStorage.setItem(`${VAULT_PREFIX}${city.toLowerCase()}`, JSON.stringify(tickets));
  } catch (e) {
    console.warn('Could not save offline ticket vault:', e);
  }
}

export function updateVaultTicketStatus(
  city: string,
  ticketCode: string,
  status: VaultTicket['status'],
  checkedInAt?: string
): VaultTicket[] {
  const normCode = ticketCode.startsWith('#') ? ticketCode.toUpperCase() : `#${ticketCode.toUpperCase()}`;
  const current = getTicketVault(city);
  let found = false;
  const updated = current.map((t) => {
    const code = t.code.startsWith('#') ? t.code.toUpperCase() : `#${t.code.toUpperCase()}`;
    if (code === normCode) {
      found = true;
      return {
        ...t,
        status,
        checkedInAt: checkedInAt || t.checkedInAt || new Date().toISOString(),
      };
    }
    return t;
  });
  if (found) {
    saveTicketVault(city, updated);
  }
  return updated;
}

/**
 * Offline Pending Sync Queue
 * Queues door scans made while offline and flushes them in batch when connection returns.
 */
export function getPendingSyncScans(): PendingSyncScan[] {
  try {
    const raw = localStorage.getItem(PENDING_SYNC_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addPendingSyncScan(scan: PendingSyncScan): PendingSyncScan[] {
  try {
    const current = getPendingSyncScans();
    const normCode = scan.ticketCode.startsWith('#')
      ? scan.ticketCode.toUpperCase()
      : `#${scan.ticketCode.toUpperCase()}`;
    const deduplicated = current.filter(
      (s) => (s.ticketCode.startsWith('#') ? s.ticketCode.toUpperCase() : `#${s.ticketCode.toUpperCase()}`) !== normCode
    );
    const updated = [...deduplicated, { ...scan, ticketCode: normCode }];
    localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function removeSyncedPendingScans(syncedCodes: string[]): PendingSyncScan[] {
  try {
    const syncedSet = new Set(
      syncedCodes.map((c) => (c.startsWith('#') ? c.toUpperCase() : `#${c.toUpperCase()}`))
    );
    const remaining = getPendingSyncScans().filter((s) => {
      const code = s.ticketCode.startsWith('#') ? s.ticketCode.toUpperCase() : `#${s.ticketCode.toUpperCase()}`;
      return !syncedSet.has(code);
    });
    localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(remaining));
    return remaining;
  } catch {
    return [];
  }
}
