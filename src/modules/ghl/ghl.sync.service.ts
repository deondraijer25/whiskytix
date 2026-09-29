/**
 * GoHighLevel (GHL) Realtime Synchronization Service
 * Koppeling met de LeadConnector API v2 voor CRM, Multi-Channel notificaties en Custom Objects
 */

import { StoredOrder } from '../orders/orders.repository.js';

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_API_KEY = process.env.GHL_API_KEY || 'pit-150d6114-ac2c-4cf7-9d5c-ffc20499c790';
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID || '1OZ9uxIBFoxwbheVC5iN';
const GHL_TICKETS_OBJECT_KEY = 'custom_objects.festival_tickets';

export interface GhlSyncResult {
  success: boolean;
  contactId?: string;
  error?: string;
}

export class GhlSyncService {
  private static getHeaders() {
    return {
      'Authorization': `Bearer ${GHL_API_KEY}`,
      'Version': '2021-07-28',
      'Content-Type': 'application/json',
    };
  }

  /**
   * Synchroniseert een betaalde bestelling direct naar GoHighLevel:
   * 1. Contactpersoon aanmaken of bijwerken
   * 2. Tags toekennen (Klant 2026, Stad, Sessies, Producten)
   * 3. Custom Fields vullen met downloadlinks en ordernummer
   * 4. GHL Custom Objects ticket-telling bijwerken
   */
  /**
   * Normaliseert telefoonnummers naar internationaal E.164 formaat (+31... of +32...)
   */
  static normalizePhoneNumber(rawPhone?: string, festivalId = 'denhaag'): string | undefined {
    if (!rawPhone || typeof rawPhone !== 'string') return undefined;
    let clean = rawPhone.replace(/[\s\-\(\)\.]/g, '').trim();
    if (!clean) return undefined;

    // Al E.164 formaat (+...)
    if (clean.startsWith('+')) return clean;

    // 00 prefix
    if (clean.startsWith('00')) return `+${clean.slice(2)}`;

    // Nederlands mobiel (06...) of vast (0...)
    if (clean.startsWith('06') || (clean.startsWith('0') && (festivalId === 'denhaag' || festivalId === 'amsterdam'))) {
      return `+31${clean.slice(1)}`;
    }

    // Belgisch mobiel (04...) of vast (0...)
    if (clean.startsWith('04') || (clean.startsWith('0') && festivalId === 'gent')) {
      return `+32${clean.slice(1)}`;
    }

    // Nummers zonder voorloopnul maar met 9 cijfers (bijv. 612345678)
    if (clean.length === 9 && clean.startsWith('6')) {
      return `+31${clean}`;
    }

    // Fallback op basis van festival stad
    if (festivalId === 'gent') {
      return clean.startsWith('0') ? `+32${clean.slice(1)}` : `+32${clean}`;
    } else {
      return clean.startsWith('0') ? `+31${clean.slice(1)}` : `+31${clean}`;
    }
  }

  /**
   * Synchroniseert een betaalde bestelling direct naar GoHighLevel:
   * 1. Contactpersoon aanmaken of bijwerken
   * 2. Maximaal 2 schone tags: 'Klant' en 'Nieuwe Bestelling' (trigger voor workflow)
   * 3. Custom Fields vullen met ordernummer, downloadlink én portaallink
   * 4. GHL Custom Objects ticket-telling bijwerken
   */
  static async syncPaidOrder(order: StoredOrder, publicBaseUrl = process.env.PUBLIC_API_URL || 'https://whiskytix-r1qq.vercel.app'): Promise<GhlSyncResult> {
    if (!GHL_API_KEY) {
      console.info('[GHL Sync] GHL_API_KEY niet ingesteld. Sync overgeslagen (mock mode).');
      return { success: true, contactId: 'mock-ghl-contact' };
    }

    try {
      const cityName = order.festivalId === 'gent' ? 'Gent' : order.festivalId === 'amsterdam' ? 'Amsterdam' : 'Den Haag';
      const cleanOrderNumber = order.orderNumber.replace('#', '');
      const downloadUrl = `${publicBaseUrl}/api/tickets/${encodeURIComponent(cleanOrderNumber)}-1/pdf?city=${order.festivalId}&orderNumber=${cleanOrderNumber}`;

      // Bepaal de dynamische portaallink (website domein / preview / live)
      let portalBase = order.portalBaseUrl;
      if (!portalBase) {
        if (order.festivalId === 'gent') {
          portalBase = process.env.PORTAL_BASE_URL_GENT || 'https://whisky-fest-gent.vercel.app';
        } else if (order.festivalId === 'amsterdam') {
          portalBase = process.env.PORTAL_BASE_URL_AMSTERDAM || 'https://whisky-fest-amsterdam.vercel.app';
        } else {
          portalBase = process.env.PORTAL_BASE_URL_DENHAAG || 'https://whisky-fest-den-haag.vercel.app';
        }
      }
      portalBase = portalBase.replace(/\/+$/, '');
      const portalUrl = `${portalBase}/inloggen?orderNumber=${encodeURIComponent(cleanOrderNumber)}&email=${encodeURIComponent(order.customerEmail)}`;

      // Maximaal 2 tags toekennen (geen tag-wildgroei!)
      const tags: string[] = [
        'Klant'
      ];

      // Bepaal voor- en achternaam
      const firstName = order.firstName || (order.customerName ? order.customerName.trim().split(' ')[0] : 'Bezoeker');
      const lastName = order.lastName || (order.customerName ? order.customerName.trim().split(' ').slice(1).join(' ') : '');
      const fullName = (firstName + ' ' + lastName).trim() || order.customerName || 'Bezoeker';
      const normalizedPhone = this.normalizePhoneNumber(order.customerPhone, order.festivalId);

      // Upsert Contact in GHL met exacte Custom Fields
      const contactPayload = {
        locationId: GHL_LOCATION_ID,
        email: order.customerEmail,
        phone: normalizedPhone,
        firstName,
        lastName,
        name: fullName,
        tags: tags,
        customFields: [
          { id: 'rWdxHMB2McLAZWo1Fxwl', key: 'contact.ticket_order_number', field_value: order.orderNumber },
          { id: '72haFPm6QoE9K24WA5Hw', key: 'contact.ticket_portaal_url', field_value: portalUrl },
          { id: '8juF9GsuPlMFPajvm9Kk', key: 'contact.ticket_download_url', field_value: downloadUrl },
          { id: 'wemZ8ghoJw3YPBkFoSyi', key: 'contact.ticket_festival_stad', field_value: cityName },
          { id: 'TfG7IEMYBcuYDhoNlFR8', key: 'contact.aankoop_dossier_samenvatting', field_value: order.items.map(i => `${i.quantity}x ${i.title}`).join(', ') },
          { id: 'q4nGpzmLvbZjm8HOVARZ', key: 'contact.totaal_aantal_tickets', field_value: order.tickets.length || order.items.reduce((s, i) => s + i.quantity, 0) },
          { id: 'eT6a9aXU8Cow0ksysTrO', key: 'contact.totale_omzet_eur', field_value: (order.totalCents / 100).toFixed(2) },
          { id: '3wg1nud85Z3AyqpZCAPl', key: 'contact.klantstatus', field_value: 'Betaald' },
          { id: 'oYqgbCgnbUC7iD7oiYCI', key: 'contact.laatste_besteldatum', field_value: new Date().toISOString().split('T')[0] },
          { id: 'Et1sgi7Z7bE8jcJGGS02', key: 'contact.meest_recente_editie', field_value: `${cityName} 2026` },
        ],
      };

      const response = await fetch(`${GHL_API_BASE}/contacts/upsert`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(contactPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[GHL Sync] Fout bij upsert contact in GHL: ${response.status} - ${errorText}`);
        return { success: false, error: errorText };
      }

      const json: any = await response.json();
      const contactId = json?.contact?.id;

      // 4. Garandeer dat de GHL workflow trigger 'Tag Contactpersoon: Tag toegevoegd' afgaat
      if (contactId) {
        try {
          await fetch(`${GHL_API_BASE}/contacts/${contactId}/tags`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ tags: ['nieuwe bestelling'] }),
          });
        } catch (tagErr: any) {
          console.warn('[GHL Sync] Fout bij expliciet toekennen trigger tag:', tagErr.message);
        }
      }

      // 5. Update Custom Objects capaciteit tellers in GHL
      for (const item of order.items) {
        if (item.ticketTypeId) {
          await this.incrementGhlCustomObjectSold(item.ticketTypeId, item.quantity);
        }
      }

      console.info(`[GHL Sync] Bestelling ${order.orderNumber} succesvol gesynchroniseerd met GHL contact ${contactId}`);
      return { success: true, contactId };
    } catch (err: any) {
      console.error('[GHL Sync] Netwerkfout bij GHL sync:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Hoogt de verkoopteller op van het specifieke GHL Custom Object record
   */
  static async incrementGhlCustomObjectSold(ticketRecordId: string, addedQty: number): Promise<void> {
    if (!GHL_API_KEY || !ticketRecordId) return;

    try {
      const getUrl = `${GHL_API_BASE}/objects/${GHL_TICKETS_OBJECT_KEY}/records/${ticketRecordId}`;
      const res = await fetch(getUrl, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!res.ok) return;

      const recordJson: any = await res.json();
      const currentProps = recordJson?.customObjectRecord?.properties || recordJson?.properties || {};
      const currentSold = parseInt(currentProps.sold, 10) || 0;
      const capacity = parseInt(currentProps.capacity, 10) || 0;
      const newSold = currentSold + addedQty;
      const isSoldOut = capacity > 0 && newSold >= capacity;

      const patchPayload = {
        properties: {
          sold: newSold,
          ...(isSoldOut ? { is_sold_out: true, status_badge: 'sold-out' } : {}),
        },
      };

      await fetch(getUrl, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(patchPayload),
      });

      console.info(`[GHL Custom Object] Ticket ${ticketRecordId} sold bijgewerkt naar ${newSold} (Uitverkocht: ${isSoldOut})`);
    } catch (err: any) {
      console.warn(`[GHL Custom Object] Kon ticket ${ticketRecordId} niet bijwerken in GHL:`, err.message);
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
      // Zoek contact op
      const searchRes = await fetch(`${GHL_API_BASE}/contacts/search/duplicate`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          locationId: GHL_LOCATION_ID,
          email: params.customerEmail,
        }),
      });

      if (!searchRes.ok) return;
      const searchJson: any = await searchRes.json();
      const contact = searchJson?.contact;
      if (!contact?.id) return;

      // Update tags en link
      const existingTags: string[] = contact.tags || [];
      const cleanedTags = existingTags.filter((t) => !t.toLowerCase().includes(params.oldSessionTitle.toLowerCase()));
      cleanedTags.push(`Sessie: ${params.newSessionTitle}`);
      cleanedTags.push('Status: Ticket Omgeruild');

      await fetch(`${GHL_API_BASE}/contacts/${contact.id}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({
          tags: Array.from(new Set(cleanedTags)),
          customFields: [
            { key: 'ticket_download_url', field_value: params.newDownloadUrl },
          ],
        }),
      });

      console.info(`[GHL Sync] Contact ${contact.id} omruil-tags succesvol bijgewerkt`);
    } catch (err: any) {
      console.warn('[GHL Sync] Fout bij updaten ticket swap in GHL:', err.message);
    }
  }
}
