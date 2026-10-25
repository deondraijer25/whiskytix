/**
 * Leadfabriek CRM (GHL / LeadConnector API v2) Realtime Synchronization Service
 * Uitgerust met Paced Concurrency Queue, Automatic Exponential Backoff Retry (429/5xx),
 * en Atomic Sold-Aggregator voor piekbelasting (Zondagnacht 00:00).
 */

import { StoredOrder } from '../orders/orders.repository.js';
import { GhlCatalogService } from './ghl.catalog.service.js';

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_API_KEY = process.env.GHL_API_KEY || 'pit-150d6114-ac2c-4cf7-9d5c-ffc20499c790';
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID || '1OZ9uxIBFoxwbheVC5iN';
const GHL_TICKETS_OBJECT_KEY = 'custom_objects.festival_tickets';

export interface GhlSyncResult {
  success: boolean;
  contactId?: string;
  error?: string;
  attempts?: number;
}

// --- 1. Paced Concurrency Limiter (voorkomt 429 burst-blokkades bij honderden orders om 00:00 uur) ---
const MAX_CONCURRENT_SYNCS = 3;
const MIN_START_INTERVAL_MS = 180;
let activeSyncWorkers = 0;
let lastTaskStartedAt = 0;
const syncWaitQueue: Array<() => void> = [];

async function acquireSyncSlot(): Promise<void> {
  if (activeSyncWorkers >= MAX_CONCURRENT_SYNCS) {
    await new Promise<void>((resolve) => syncWaitQueue.push(resolve));
  }
  activeSyncWorkers++;
  const now = Date.now();
  const elapsed = now - lastTaskStartedAt;
  if (elapsed < MIN_START_INTERVAL_MS) {
    const waitMs = MIN_START_INTERVAL_MS - elapsed;
    lastTaskStartedAt = now + waitMs;
    await new Promise((r) => setTimeout(r, waitMs));
  } else {
    lastTaskStartedAt = now;
  }
}

function releaseSyncSlot(): void {
  activeSyncWorkers = Math.max(0, activeSyncWorkers - 1);
  const next = syncWaitQueue.shift();
  if (next) next();
}

// --- 2. Atomic Per-Ticket Sold Accumulator (voorkomt dat gelijktijdige kopers elkaars voorraad overschrijven) ---
const inMemorySoldTotals = new Map<string, { sold: number; capacity: number }>();
const pendingSoldDeltas = new Map<string, number>();
const activeTicketUpdaters = new Set<string>();

export class GhlSyncService {
  private static getHeaders() {
    return {
      Authorization: `Bearer ${GHL_API_KEY}`,
      Version: '2021-07-28',
      'Content-Type': 'application/json',
    };
  }

  /**
   * Voert een HTTP request uit naar Leadfabriek CRM met automatische retry bij HTTP 429 of 5xx
   */
  private static async fetchWithRetry(
    url: string,
    init: RequestInit,
    maxAttempts = 4
  ): Promise<{ response: Response; attempts: number }> {
    let lastError: any;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch(url, init);
        if (response.status !== 429 && response.status < 500) {
          return { response, attempts: attempt };
        }

        // Bereken wachttijd bij 429 Too Many Requests of 5xx server drukte
        if (attempt < maxAttempts) {
          const retryAfterHeader = response.headers.get('retry-after');
          const retryAfterSec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : NaN;
          const backoffMs = !isNaN(retryAfterSec) && retryAfterSec > 0
            ? Math.min(retryAfterSec * 1000, 8000)
            : 900 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 250);
          console.warn(
            `[CRM Sync] Status ${response.status} op poging ${attempt}/${maxAttempts}. Automatische retry over ${backoffMs}ms...`
          );
          await new Promise((r) => setTimeout(r, backoffMs));
          continue;
        }
        return { response, attempts: attempt };
      } catch (networkErr: any) {
        lastError = networkErr;
        if (attempt < maxAttempts) {
          const backoffMs = 800 * Math.pow(2, attempt - 1);
          await new Promise((r) => setTimeout(r, backoffMs));
          continue;
        }
      }
    }
    throw lastError || new Error('CRM verbinding mislukt na meerdere pogingen.');
  }

  /**
   * Normaliseert telefoonnummers naar internationaal E.164 formaat (+31... of +32...)
   */
  static normalizePhoneNumber(rawPhone?: string, festivalId = 'denhaag'): string | undefined {
    if (!rawPhone || typeof rawPhone !== 'string') return undefined;
    const clean = rawPhone.replace(/[\s\-\(\)\.]/g, '').trim();
    if (!clean) return undefined;

    if (clean.startsWith('+')) return clean;
    if (clean.startsWith('00')) return `+${clean.slice(2)}`;

    if (
      clean.startsWith('06') ||
      (clean.startsWith('0') && (festivalId === 'denhaag' || festivalId === 'amsterdam'))
    ) {
      return `+31${clean.slice(1)}`;
    }

    if (clean.startsWith('04') || (clean.startsWith('0') && festivalId === 'gent')) {
      return `+32${clean.slice(1)}`;
    }

    if (clean.length === 9 && clean.startsWith('6')) {
      return `+31${clean}`;
    }

    if (festivalId === 'gent') {
      return clean.startsWith('0') ? `+32${clean.slice(1)}` : `+32${clean}`;
    } else {
      return clean.startsWith('0') ? `+31${clean.slice(1)}` : `+31${clean}`;
    }
  }

  /**
   * Synchroniseert een betaalde bestelling gedoseerd en met retry-garantie naar Leadfabriek CRM:
   * 1. Contactpersoon aanmaken of bijwerken met alle Custom Fields
   * 2. Trigger-tag 'nieuwe bestelling' zetten zodat de bevestigingsmail-workflow start
   * 3. Voorraadteller atomair en gebundeld ophogen zonder de catalogus-cache te wissen
   */
  static async syncPaidOrder(
    order: StoredOrder,
    publicBaseUrl = process.env.PUBLIC_API_URL || 'https://whiskytix-r1qq.vercel.app',
    options?: { skipInventoryIncrement?: boolean }
  ): Promise<GhlSyncResult> {
    if (!GHL_API_KEY) {
      return { success: true, contactId: 'mock-ghl-contact', attempts: 1 };
    }

    await acquireSyncSlot();
    try {
      const cityName =
        order.festivalId === 'gent'
          ? 'Gent'
          : order.festivalId === 'amsterdam'
          ? 'Amsterdam'
          : 'Den Haag';
      const cleanOrderNumber = order.orderNumber.replace('#', '');
      const downloadUrl = `${publicBaseUrl}/api/orders/${encodeURIComponent(cleanOrderNumber)}/pdf?city=${order.festivalId}`;
      const festivalYear = '2027';

      let portalBase = order.portalBaseUrl;
      if (
        !portalBase ||
        portalBase.includes('vercel.app') ||
        portalBase.includes('localhost') ||
        portalBase.includes('127.0.0.1')
      ) {
        if (order.festivalId === 'gent') {
          portalBase = process.env.PORTAL_BASE_URL_GENT || 'https://whiskyfestival.be';
        } else if (order.festivalId === 'amsterdam') {
          portalBase = process.env.PORTAL_BASE_URL_AMSTERDAM || 'https://whiskyfestival.nl';
        } else {
          portalBase = process.env.PORTAL_BASE_URL_DENHAAG || 'https://whiskyfestival.nl';
        }
      }
      portalBase = portalBase.replace(/\/+$/, '');
      const portalUrl = `${portalBase}/inloggen`;

      const firstName =
        order.firstName ||
        (order.customerName ? order.customerName.trim().split(' ')[0] : 'Bezoeker');
      const lastName =
        order.lastName ||
        (order.customerName ? order.customerName.trim().split(' ').slice(1).join(' ') : '');
      const fullName = (firstName + ' ' + lastName).trim() || order.customerName || 'Bezoeker';
      const normalizedPhone = this.normalizePhoneNumber(order.customerPhone, order.festivalId);

      const contactPayload = {
        locationId: GHL_LOCATION_ID,
        email: order.customerEmail,
        phone: normalizedPhone,
        firstName,
        lastName,
        name: fullName,
        tags: ['Klant'],
        customFields: [
          {
            id: 'rWdxHMB2McLAZWo1Fxwl',
            key: 'contact.ticket_order_number',
            field_value: order.orderNumber,
          },
          {
            id: '72haFPm6QoE9K24WA5Hw',
            key: 'contact.ticket_portaal_url',
            field_value: portalUrl,
          },
          {
            id: '8juF9GsuPlMFPajvm9Kk',
            key: 'contact.ticket_download_url',
            field_value: downloadUrl,
          },
          {
            id: 'wemZ8ghoJw3YPBkFoSyi',
            key: 'contact.ticket_festival_stad',
            field_value: cityName,
          },
          {
            id: 'TfG7IEMYBcuYDhoNlFR8',
            key: 'contact.aankoop_dossier_samenvatting',
            field_value: order.items.map((i) => `${i.quantity}x ${i.title}`).join(', '),
          },
          {
            id: 'q4nGpzmLvbZjm8HOVARZ',
            key: 'contact.totaal_aantal_tickets',
            field_value:
              order.tickets.length || order.items.reduce((s, i) => s + i.quantity, 0),
          },
          {
            id: 'eT6a9aXU8Cow0ksysTrO',
            key: 'contact.totale_omzet_eur',
            field_value: (order.totalCents / 100).toFixed(2),
          },
          {
            id: '3wg1nud85Z3AyqpZCAPl',
            key: 'contact.klantstatus',
            field_value: 'Betaald',
          },
          {
            id: 'oYqgbCgnbUC7iD7oiYCI',
            key: 'contact.laatste_besteldatum',
            field_value: new Date().toISOString().split('T')[0],
          },
          {
            id: 'Et1sgi7Z7bE8jcJGGS02',
            key: 'contact.meest_recente_editie',
            field_value: `${cityName} ${festivalYear}`,
          },
        ],
      };

      const { response, attempts } = await this.fetchWithRetry(`${GHL_API_BASE}/contacts/upsert`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(contactPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[CRM Sync] Fout bij upsert contact: ${response.status} - ${errorText}`);
        return { success: false, error: errorText, attempts };
      }

      const json: any = await response.json();
      const contactId = json?.contact?.id;
      const existingTags: string[] = Array.isArray(json?.contact?.tags)
        ? json.contact.tags.map((t: string) => String(t).toLowerCase())
        : [];

      // Trigger de workflow 'nieuwe bestelling': alleen DELETE uitvoeren als het contact de tag al had!
      if (contactId) {
        try {
          if (existingTags.includes('nieuwe bestelling')) {
            await this.fetchWithRetry(`${GHL_API_BASE}/contacts/${contactId}/tags`, {
              method: 'DELETE',
              headers: this.getHeaders(),
              body: JSON.stringify({ tags: ['nieuwe bestelling'] }),
            }).catch(() => {});
          }
          await this.fetchWithRetry(`${GHL_API_BASE}/contacts/${contactId}/tags`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ tags: ['nieuwe bestelling'] }),
          });
        } catch (tagErr: any) {
          console.warn('[CRM Sync] Fout bij toekennen trigger tag:', tagErr.message);
        }
      }

      // Werk voorraadtellers atomair bij (direct in-memory in de catalogus-cache + gebundeld naar CRM)
      if (!options?.skipInventoryIncrement) {
        for (const item of order.items) {
          if (item.ticketTypeId) {
            await this.incrementGhlCustomObjectSold(item.ticketTypeId, item.quantity);
          }
        }
      }

      console.info(
        `[CRM Sync] Bestelling ${order.orderNumber} succesvol gesynchroniseerd met contact ${contactId} (${attempts} poging(en))`
      );
      return { success: true, contactId, attempts };
    } catch (err: any) {
      console.error('[CRM Sync] Netwerkfout bij CRM sync:', err);
      return { success: false, error: err.message };
    } finally {
      releaseSyncSlot();
    }
  }

  /**
   * Hoogt de verkoopteller atomair en serieel op van het specifieke CRM Custom Object record
   * zonder dat gelijktijdige kopers om 00:00 uur elkaars aantal overschrijven!
   */
  static async incrementGhlCustomObjectSold(
    ticketRecordId: string,
    addedQty: number
  ): Promise<void> {
    if (!GHL_API_KEY || !ticketRecordId || addedQty <= 0) return;

    // 1. Werk direct onze snelle in-memory catalogus-cache bij (zodat de website meteen de nieuwe stand toont)
    const cachedUpdate = GhlCatalogService.incrementCachedSold(ticketRecordId, addedQty);
    if (cachedUpdate) {
      inMemorySoldTotals.set(ticketRecordId, {
        sold: cachedUpdate.newSold,
        capacity: cachedUpdate.capacity,
      });
    }

    // 2. Tel de delta atomair op bij eventuele andere gelijktijdige verkopen van dit exacte tickettype
    const currentDelta = pendingSoldDeltas.get(ticketRecordId) || 0;
    pendingSoldDeltas.set(ticketRecordId, currentDelta + addedQty);

    // Als er al een worker bezig is voor dit ticketRecordId, neemt die de opgetelde delta automatisch mee
    if (activeTicketUpdaters.has(ticketRecordId)) {
      return;
    }

    activeTicketUpdaters.add(ticketRecordId);
    try {
      while ((pendingSoldDeltas.get(ticketRecordId) || 0) > 0) {
        const deltaToApply = pendingSoldDeltas.get(ticketRecordId) || 0;
        pendingSoldDeltas.set(ticketRecordId, 0);

        const recordUrl = `${GHL_API_BASE}/objects/${GHL_TICKETS_OBJECT_KEY}/records/${ticketRecordId}`;
        let knownState = inMemorySoldTotals.get(ticketRecordId);

        // Alleen een GET doen als we dit tickettype nog niet in het geheugen kennen
        if (!knownState) {
          const cachedItem = GhlCatalogService.getCachedTicketItem(ticketRecordId);
          if (cachedItem && typeof cachedItem.sold === 'number') {
            knownState = {
              sold: cachedItem.sold,
              capacity: cachedItem.capacity || 0,
            };
          } else {
            const { response: getRes } = await this.fetchWithRetry(recordUrl, {
              method: 'GET',
              headers: this.getHeaders(),
            });
            if (!getRes.ok) break;
            const recordJson: any = await getRes.json();
            const currentProps =
              recordJson?.customObjectRecord?.properties || recordJson?.properties || {};
            const baseSold = parseInt(currentProps.sold, 10) || 0;
            const baseCap = parseInt(currentProps.capacity, 10) || 0;
            knownState = {
              sold: baseSold + deltaToApply,
              capacity: baseCap,
            };
          }
          inMemorySoldTotals.set(ticketRecordId, knownState);
        } else if (!cachedUpdate) {
          knownState.sold += deltaToApply;
        }

        const newSold = knownState.sold;
        const capacity = knownState.capacity;
        const isSoldOut = capacity > 0 && newSold >= capacity;

        const patchPayload = {
          properties: {
            sold: newSold,
            ...(isSoldOut ? { is_sold_out: true, status_badge: 'sold-out' } : {}),
          },
        };

        await this.fetchWithRetry(recordUrl, {
          method: 'PUT',
          headers: this.getHeaders(),
          body: JSON.stringify(patchPayload),
        });

        console.info(
          `[CRM Custom Object] Ticket ${ticketRecordId} sold atomair bijgewerkt naar ${newSold} (Uitverkocht: ${isSoldOut})`
        );
      }
    } catch (err: any) {
      console.warn(
        `[CRM Custom Object] Kon ticket ${ticketRecordId} niet bijwerken:`,
        err.message
      );
    } finally {
      activeTicketUpdaters.delete(ticketRecordId);
    }
  }

  /**
   * Synchroniseert een omruiling (Ticket Swap):
   * Past de tags aan (oude sessietag eraf, nieuwe erop) en update downloadlink
   */
  static async syncTicketSwap(params: {
    customerEmail: string;
    orderNumber: string;
    oldSessionTitle: string;
    newSessionTitle: string;
    newDownloadUrl: string;
  }): Promise<void> {
    if (!GHL_API_KEY) return;

    try {
      const { response: searchRes } = await this.fetchWithRetry(
        `${GHL_API_BASE}/contacts/search/duplicate`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            locationId: GHL_LOCATION_ID,
            email: params.customerEmail,
          }),
        }
      );

      if (!searchRes.ok) return;
      const searchJson: any = await searchRes.json();
      const contact = searchJson?.contact;
      if (!contact?.id) return;

      const existingTags: string[] = contact.tags || [];
      const cleanedTags = existingTags.filter(
        (t) => !t.toLowerCase().includes(params.oldSessionTitle.toLowerCase())
      );
      cleanedTags.push(`Sessie: ${params.newSessionTitle}`);
      cleanedTags.push('Status: Ticket Omgeruild');

      await this.fetchWithRetry(`${GHL_API_BASE}/contacts/${contact.id}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({
          tags: Array.from(new Set(cleanedTags)),
          customFields: [{ key: 'ticket_download_url', field_value: params.newDownloadUrl }],
        }),
      });

      console.info(`[CRM Sync] Contact ${contact.id} omruil-tags succesvol bijgewerkt`);
    } catch (err: any) {
      console.warn('[CRM Sync] Fout bij updaten ticket swap:', err.message);
    }
  }
}
