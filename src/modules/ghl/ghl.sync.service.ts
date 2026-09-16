/**
 * GoHighLevel (GHL) Realtime Synchronization Service
 * Koppeling met de LeadConnector API v2 voor CRM, Multi-Channel notificaties en Custom Objects
 */

import { StoredOrder } from '../orders/orders.repository.js';

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_API_KEY = process.env.GHL_API_KEY || '';
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
  static async syncPaidOrder(order: StoredOrder, publicBaseUrl = 'https://tickets.whiskyfestival.nl'): Promise<GhlSyncResult> {
    if (!GHL_API_KEY) {
      console.info('[GHL Sync] GHL_API_KEY niet ingesteld. Sync overgeslagen (mock mode).');
      return { success: true, contactId: 'mock-ghl-contact' };
    }

    try {
      const cityName = order.festivalId === 'gent' ? 'Gent' : order.festivalId === 'amsterdam' ? 'Amsterdam' : 'Den Haag';
      const cleanOrderNumber = order.orderNumber.replace('#', '');
      const downloadUrl = `${publicBaseUrl}/api/tickets/${encodeURIComponent(cleanOrderNumber)}-1/pdf?city=${order.festivalId}&orderNumber=${cleanOrderNumber}`;

      // 1. Bouw relevante marketing- en organisatietags
      const tags: string[] = [
        'Klant',
        'Klant 2026',
        `Stad: ${cityName}`,
        `${cityName} 2026`,
        `${cityName}: Klant`,
      ];

      for (const item of order.items) {
        if (item.category === 'masterclass') {
          tags.push('Product: Masterclass');
        } else if (item.category === 'botteling') {
          tags.push('Product: Botteling');
        } else if (item.category === 'tram') {
          tags.push('Product: Whiskytram');
        }

        if (item.title) {
          if (item.title.toLowerCase().includes('vip')) {
            tags.push('Product: VIP Ticket');
            tags.push('Sessie: Vrijdag VIP');
          } else if (item.title.toLowerCase().includes('vrijdag')) {
            tags.push('Sessie: Vrijdag Avond');
          } else if (item.title.toLowerCase().includes('zaterdag') && item.title.toLowerCase().includes('middag')) {
            tags.push('Sessie: Zaterdag Middag');
          } else if (item.title.toLowerCase().includes('zaterdag') && item.title.toLowerCase().includes('avond')) {
            tags.push('Sessie: Zaterdag Avond');
          } else if (item.title.toLowerCase().includes('zondag')) {
            tags.push('Sessie: Zondag Middag');
          }
        }
      }

      // 2. Splits naam in voor- en achternaam
      const nameParts = (order.customerName || 'Bezoeker').trim().split(' ');
      const firstName = nameParts[0] || 'Bezoeker';
      const lastName = nameParts.slice(1).join(' ') || '';

      // 3. Upsert Contact in GHL
      const contactPayload = {
        locationId: GHL_LOCATION_ID,
        email: order.customerEmail,
        phone: order.customerPhone || undefined,
        firstName,
        lastName,
        name: order.customerName,
        tags: Array.from(new Set(tags)),
        customFields: [
          { key: 'ticket_order_number', field_value: order.orderNumber },
          { key: 'ticket_download_url', field_value: downloadUrl },
          { key: 'ticket_count', field_value: String(order.tickets.length || order.items.reduce((s, i) => s + i.quantity, 0)) },
          { key: 'ticket_festival_city', field_value: cityName },
          { key: 'ticket_total_amount_eur', field_value: (order.totalCents / 100).toFixed(2) },
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

      // 4. Update Custom Objects capaciteit tellers in GHL
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
