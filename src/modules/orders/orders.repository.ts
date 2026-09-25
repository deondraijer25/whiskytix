import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { db, checkDbConnection } from '../../db/index.js';
import * as schema from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { buildQrPayload, generateTicketSignature } from '../tickets/qr.service.js';
import { GhlSyncService } from '../ghl/ghl.sync.service.js';

export interface StoredOrderItem {
  id: string;
  orderId: string;
  ticketTypeId: string;
  title: string;
  quantity: number;
  unitPriceCents: number;
  category?: string;
  timeslot?: string;
  delivery?: string;
  date?: string;
  time?: string;
}

export interface StoredIssuedTicket {
  id: string;
  orderId: string;
  ticketCode: string;
  qrPayload: string;
  qrPayloadHash: string;
  attendeeName: string;
  status: 'valid' | 'checked_in' | 'cancelled' | 'swapped';
  sessionTitle: string;
  cityName: string;
  dateStr: string;
  timeStr: string;
  pdfUrl: string;
  checkedInAt?: string | null;
  swappedToTicketId?: string;
  swapReason?: string;
  swappedAt?: string;
  createdAt: string;
}

export interface StoredOrder {
  id: string;
  orderNumber: string;
  festivalId: 'gent' | 'denhaag' | 'amsterdam';
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  status: 'pending' | 'paid' | 'expired' | 'failed' | 'refunded';
  molliePaymentId?: string | null;
  paymentMethod?: string | null;
  createdAt: string;
  paidAt?: string | null;
  expiresAt: string;
  items: StoredOrderItem[];
  tickets: StoredIssuedTicket[];
}

import os from 'os';

const isVercel = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined;
const DATA_DIR = isVercel ? path.join(os.tmpdir(), '.data') : path.join(process.cwd(), '.data');
const STORE_FILE = path.join(DATA_DIR, 'orders-store.json');

// Memory cache
const memoryOrders: Map<string, StoredOrder> = new Map();

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(STORE_FILE)) {
    fs.writeFileSync(STORE_FILE, JSON.stringify({ orders: [] }, null, 2), 'utf8');
  }
}

function loadLocalStore() {
  try {
    ensureDataFile();
    let raw = fs.readFileSync(STORE_FILE, 'utf8');
    raw = raw.replace(/^\uFEFF/, '').trim();
    const parsed = JSON.parse(raw);
    memoryOrders.clear();
    if (Array.isArray(parsed.orders)) {
      parsed.orders.forEach((o: StoredOrder) => {
        memoryOrders.set(o.orderNumber, o);
        memoryOrders.set(o.id, o);
      });
    }
  } catch (err) {
    console.warn('Could not load local orders store:', err);
  }
}

function saveLocalStore() {
  try {
    ensureDataFile();
    const uniqueOrders = Array.from(
      new Map(Array.from(memoryOrders.values()).map((o) => [o.orderNumber, o])).values()
    );
    fs.writeFileSync(STORE_FILE, JSON.stringify({ orders: uniqueOrders }, null, 2), 'utf8');
  } catch (err) {
    console.warn('Could not save local orders store:', err);
  }
}

// Initial load
loadLocalStore();

export class OrdersRepository {
  /**
   * Reload from disk into memory
   */
  static reloadStore() {
    loadLocalStore();
  }

  /**
   * Clears all stored orders
   */
  static clearOrders() {
    memoryOrders.clear();
    saveLocalStore();
  }
  /**
   * Generates next clean Order Number like #WF-2026-84387
   */
  static generateOrderNumber(): string {
    const randomDigits = Math.floor(10000 + Math.random() * 90000);
    return `#WF-2026-${randomDigits}`;
  }

  /**
   * Save a newly created order
   */
  static async createOrder(order: Omit<StoredOrder, 'tickets'>): Promise<StoredOrder> {
    const fullOrder: StoredOrder = {
      ...order,
      tickets: [],
    };

    // Store in local memory and file
    memoryOrders.set(fullOrder.orderNumber, fullOrder);
    memoryOrders.set(fullOrder.id, fullOrder);
    saveLocalStore();

    // Attempt DB write if available
    try {
      const dbStatus = await checkDbConnection();
      if (dbStatus.ok) {
        await db.insert(schema.orders).values({
          id: fullOrder.id,
          orderNumber: fullOrder.orderNumber,
          festivalId: fullOrder.festivalId,
          customerName: fullOrder.customerName,
          customerEmail: fullOrder.customerEmail,
          customerPhone: fullOrder.customerPhone || null,
          subtotalCents: fullOrder.subtotalCents,
          discountCents: fullOrder.discountCents,
          totalCents: fullOrder.totalCents,
          status: fullOrder.status,
          molliePaymentId: fullOrder.molliePaymentId || null,
          paymentMethod: fullOrder.paymentMethod || null,
          createdAt: new Date(fullOrder.createdAt),
          expiresAt: new Date(fullOrder.expiresAt),
        });

        for (const item of fullOrder.items) {
          // Auto-provision ticket type if dynamically generated or passed from GHL
          await db.insert(schema.ticketTypes).values({
            id: item.ticketTypeId,
            festivalId: fullOrder.festivalId,
            category: item.category || 'entree',
            title: item.title || 'Festival Entreeticket',
            priceCents: item.unitPriceCents,
            totalAvailable: 5000,
            totalSold: 0,
          }).onConflictDoNothing();

          await db.insert(schema.orderItems).values({
            id: item.id,
            orderId: fullOrder.id,
            ticketTypeId: item.ticketTypeId,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            metadata: JSON.stringify({
              title: item.title,
              category: item.category,
              timeslot: item.timeslot,
              delivery: item.delivery,
            }),
          });
        }
      }
    } catch (err: any) {
      console.warn('Database write bypassed, stored in local file store:', err.message);
    }

    return fullOrder;
  }

  /**
   * Find order by order number or ID
   */
  static async findOrder(identifier: string): Promise<StoredOrder | null> {
    const normalized = identifier.startsWith('#') ? identifier : `#${identifier}`;
    let order = memoryOrders.get(normalized) || memoryOrders.get(identifier);
    if (order) return order;

    try {
      const dbStatus = await checkDbConnection();
      if (dbStatus.ok) {
        const rows = await db
          .select()
          .from(schema.orders)
          .where(eq(schema.orders.orderNumber, normalized));
        if (rows.length > 0) {
          const row = rows[0];
          const items = await db
            .select()
            .from(schema.orderItems)
            .where(eq(schema.orderItems.orderId, row.id));
          const tickets = await db
            .select()
            .from(schema.issuedTickets)
            .where(eq(schema.issuedTickets.orderId, row.id));

          return {
            id: row.id,
            orderNumber: row.orderNumber,
            festivalId: row.festivalId as any,
            customerName: row.customerName,
            customerEmail: row.customerEmail,
            customerPhone: row.customerPhone || undefined,
            subtotalCents: row.subtotalCents,
            discountCents: row.discountCents,
            totalCents: row.totalCents,
            status: row.status as any,
            molliePaymentId: row.molliePaymentId,
            paymentMethod: row.paymentMethod,
            createdAt: row.createdAt.toISOString(),
            paidAt: row.paidAt ? row.paidAt.toISOString() : null,
            expiresAt: row.expiresAt.toISOString(),
            items: items.map((i) => ({
              id: i.id,
              orderId: i.orderId,
              ticketTypeId: i.ticketTypeId,
              title: i.ticketTypeId,
              quantity: i.quantity,
              unitPriceCents: i.unitPriceCents,
            })),
            tickets: tickets.map((t) => ({
              id: t.id,
              orderId: t.orderId,
              ticketCode: t.ticketCode,
              qrPayload: '',
              qrPayloadHash: t.qrPayloadHash,
              attendeeName: t.attendeeName,
              status: t.status as any,
              sessionTitle: '',
              cityName: row.festivalId,
              dateStr: '',
              timeStr: '',
              pdfUrl: t.pdfUrl || `/api/tickets/${t.ticketCode.replace('#', '')}/pdf?city=${row.festivalId}`,
              createdAt: t.createdAt.toISOString(),
            })),
          };
        }
      }
    } catch (e) {
      // ignore
    }

    return null;
  }

  /**
   * Find order by Mollie Payment ID
   */
  static async findOrderByMollieId(molliePaymentId: string): Promise<StoredOrder | null> {
    for (const o of memoryOrders.values()) {
      if (o.molliePaymentId === molliePaymentId) return o;
    }
    return null;
  }

  /**
   * Mark order paid and issue tickets with cryptographic HMAC QR codes
   */
  static async markOrderPaid(orderNumber: string, paymentDetails?: { paymentMethod?: string }): Promise<StoredOrder | null> {
    const order = await this.findOrder(orderNumber);
    if (!order) return null;

    order.status = 'paid';
    order.paidAt = new Date().toISOString();
    if (paymentDetails?.paymentMethod) {
      order.paymentMethod = paymentDetails.paymentMethod;
    }

    // Generate individual tickets if not yet issued
    if (order.tickets.length === 0) {
      let ticketCounter = 1;
      const cleanOrderNumber = order.orderNumber.replace('#', '');

      for (const item of order.items) {
        for (let q = 0; q < item.quantity; q++) {
          const ticketCode = `#${cleanOrderNumber}-${ticketCounter}`;
          ticketCounter++;

          const sessionTitle = item.title || 'ENTREE SESSIE';
          const cityName = order.festivalId;
          const attendeeName = order.customerName;

          const qrPayload = buildQrPayload({
            ticketCode,
            cityName,
            sessionTitle,
            attendeeName,
          });

          const signature = generateTicketSignature(ticketCode, cityName, sessionTitle, attendeeName);
          const cleanCode = ticketCode.replace('#', '');
          const pdfUrl = `/api/tickets/${encodeURIComponent(cleanCode)}/pdf?city=${cityName}&orderNumber=${cleanOrderNumber}&name=${encodeURIComponent(attendeeName)}&title=${encodeURIComponent(sessionTitle)}`;

          // Infer exact festival date and time if generic or unspecified
          let inferredDate = item.date;
          let inferredTime = item.timeslot || item.time;
          const sLower = sessionTitle.toLowerCase();

          if (!inferredDate || inferredDate === 'Festivaldag') {
            if (cityName === 'gent') {
              inferredDate = sLower.includes('zaterdag') ? 'Zaterdag 3 oktober 2026' : sLower.includes('zondag') ? 'Zondag 4 oktober 2026' : 'Vrijdag 2 oktober 2026';
            } else if (cityName === 'amsterdam') {
              inferredDate = 'Zaterdag 16 januari 2027';
            } else {
              inferredDate = sLower.includes('zaterdag') ? 'Zaterdag 14 november 2026' : sLower.includes('zondag') ? 'Zondag 15 november 2026' : 'Vrijdag 13 november 2026';
            }
          }

          if (!inferredTime || inferredTime === 'Regulier') {
            inferredTime = sLower.includes('avond') ? '19:00 - 23:00 UUR' : '13:00 - 17:00 UUR';
          }

          const ticket: StoredIssuedTicket = {
            id: crypto.randomUUID(),
            orderId: order.id,
            ticketCode,
            qrPayload,
            qrPayloadHash: signature,
            attendeeName,
            status: 'valid',
            sessionTitle,
            cityName,
            dateStr: inferredDate,
            timeStr: inferredTime,
            pdfUrl,
            createdAt: new Date().toISOString(),
          };

          order.tickets.push(ticket);

          // Save to DB if available
          try {
            const dbStatus = await checkDbConnection();
            if (dbStatus.ok) {
              await db.insert(schema.issuedTickets).values({
                id: ticket.id,
                orderItemId: item.id,
                orderId: order.id,
                ticketCode: ticket.ticketCode,
                qrPayloadHash: ticket.qrPayloadHash,
                attendeeName: ticket.attendeeName,
                status: ticket.status,
                pdfUrl: ticket.pdfUrl,
                createdAt: new Date(ticket.createdAt),
              });
            }
          } catch (err: any) {
            // local store fallback handled
          }
        }
      }
    }

    memoryOrders.set(order.orderNumber, order);
    memoryOrders.set(order.id, order);
    saveLocalStore();

    // Trigger realtime sync to GoHighLevel in background
    GhlSyncService.syncPaidOrder(order).catch((err) => {
      console.warn('[GHL Sync] Fout bij achtergrond sync van order:', err.message);
    });

    return order;
  }

  /**
   * Find ticket by code across all orders
   */
  static async findTicket(ticketCode: string): Promise<{ order: StoredOrder; ticket: StoredIssuedTicket } | null> {
    const normalized = ticketCode.startsWith('#') ? ticketCode : `#${ticketCode}`;
    const clean = ticketCode.replace(/^#/, '');

    // 1. Search in memory cache
    for (const order of memoryOrders.values()) {
      const ticket = order.tickets.find((t) => t.ticketCode === normalized || t.ticketCode === clean || t.ticketCode.replace(/^#/, '') === clean);
      if (ticket) {
        return { order, ticket };
      }
    }

    // 2. Try parsing order number from ticket code (e.g. WF-2026-84387-1 -> #WF-2026-84387)
    const orderNumberPart = clean.replace(/-\d+$/, '');
    const matchedOrder = await this.findOrder(orderNumberPart);
    if (matchedOrder) {
      if (matchedOrder.tickets.length === 0 && matchedOrder.status === 'paid') {
        await this.markOrderPaid(matchedOrder.orderNumber);
      }
      let ticket = matchedOrder.tickets.find((t) => t.ticketCode === normalized || t.ticketCode === clean || t.ticketCode.replace(/^#/, '') === clean);
      if (!ticket && matchedOrder.tickets.length > 0) {
        ticket = matchedOrder.tickets[0];
      }
      if (ticket) {
        return { order: matchedOrder, ticket };
      }
    }

    // 3. Fallback to database check
    try {
      const dbStatus = await checkDbConnection();
      if (dbStatus.ok) {
        const rows = await db
          .select()
          .from(schema.issuedTickets)
          .where(eq(schema.issuedTickets.ticketCode, normalized));
        if (rows.length > 0) {
          const tRow = rows[0];
          const dbOrder = await this.findOrder(tRow.orderId);
          if (dbOrder) {
            const ticket: StoredIssuedTicket = {
              id: tRow.id,
              orderId: tRow.orderId,
              ticketCode: tRow.ticketCode,
              qrPayload: '',
              qrPayloadHash: tRow.qrPayloadHash,
              attendeeName: tRow.attendeeName,
              status: tRow.status as any,
              sessionTitle: '',
              cityName: dbOrder.festivalId,
              dateStr: '',
              timeStr: '',
              pdfUrl: tRow.pdfUrl || `/api/tickets/${tRow.ticketCode.replace('#', '')}/pdf?city=${dbOrder.festivalId}`,
              createdAt: tRow.createdAt.toISOString(),
            };
            return { order: dbOrder, ticket };
          }
        }
      }
    } catch (e) {
      // ignore
    }

    return null;
  }

  /**
   * Inruilen / Wijzigen van een ticket (Ticket Swap Engine)
   * 1. Merkt oud ticket als 'swapped' met reden
   * 2. Genereert nieuw ticket met frisse cryptografische HMAC QR-code
   * 3. Schiet update door naar GoHighLevel
   */
  static async swapTicket(params: {
    ticketCode: string;
    newSessionTitle: string;
    newDateStr?: string;
    newTimeStr?: string;
    adminEmail: string;
    reason: string;
    priceDiffCents?: number;
    publicBaseUrl?: string;
  }): Promise<{
    success: boolean;
    error?: string;
    oldTicket?: StoredIssuedTicket;
    newTicket?: StoredIssuedTicket;
    order?: StoredOrder;
  }> {
    const match = await this.findTicket(params.ticketCode);
    if (!match) {
      return { success: false, error: 'Oorspronkelijk ticket niet gevonden.' };
    }

    const { order, ticket: oldTicket } = match;

    if (oldTicket.status === 'checked_in') {
      return { success: false, error: 'Dit ticket is al ingecheckt bij de deur en kan niet meer omgeruild worden.' };
    }

    if (oldTicket.status === 'swapped') {
      return { success: false, error: 'Dit ticket is al eerder omgeruild naar een andere sessie.' };
    }

    if (oldTicket.status === 'cancelled') {
      return { success: false, error: 'Dit ticket is geannuleerd en kan niet worden omgeruild.' };
    }

    // 1. Mark old ticket swapped
    const nowIso = new Date().toISOString();
    const oldSession = oldTicket.sessionTitle;
    oldTicket.status = 'swapped';
    oldTicket.swapReason = `Omgeruild naar "${params.newSessionTitle}" door ${params.adminEmail}: ${params.reason}`;
    oldTicket.swappedAt = nowIso;

    // 2. Generate new ticket code (e.g. #WF-2026-84387-1-R1)
    const baseCode = oldTicket.ticketCode.split('-R')[0];
    const swapVersion = (order.tickets.filter((t) => t.ticketCode.startsWith(baseCode)).length);
    const newTicketCode = `${baseCode}-R${swapVersion}`;

    const newTicketId = crypto.randomUUID();
    oldTicket.swappedToTicketId = newTicketId;

    const qrPayload = buildQrPayload({
      ticketCode: newTicketCode,
      cityName: oldTicket.cityName,
      sessionTitle: params.newSessionTitle,
      attendeeName: oldTicket.attendeeName,
    });

    const signature = generateTicketSignature(newTicketCode, oldTicket.cityName, params.newSessionTitle, oldTicket.attendeeName);
    const cleanCode = newTicketCode.replace('#', '');
    const cleanOrderNumber = order.orderNumber.replace('#', '');
    const pdfUrl = `/api/tickets/${encodeURIComponent(cleanCode)}/pdf?city=${oldTicket.cityName}&orderNumber=${cleanOrderNumber}&name=${encodeURIComponent(oldTicket.attendeeName)}&title=${encodeURIComponent(params.newSessionTitle)}`;

    const newTicket: StoredIssuedTicket = {
      id: newTicketId,
      orderId: order.id,
      ticketCode: newTicketCode,
      qrPayload,
      qrPayloadHash: signature,
      attendeeName: oldTicket.attendeeName,
      status: 'valid',
      sessionTitle: params.newSessionTitle,
      cityName: oldTicket.cityName,
      dateStr: params.newDateStr || oldTicket.dateStr,
      timeStr: params.newTimeStr || oldTicket.timeStr,
      pdfUrl,
      createdAt: nowIso,
    };

    order.tickets.push(newTicket);

    // Save state
    memoryOrders.set(order.orderNumber, order);
    memoryOrders.set(order.id, order);
    saveLocalStore();

    // 3. Save swap audit trail in DB if available
    try {
      const dbStatus = await checkDbConnection();
      if (dbStatus.ok) {
        await db.update(schema.issuedTickets)
          .set({
            status: 'swapped',
            swappedToTicketId: newTicketId,
            swapReason: oldTicket.swapReason,
            swappedAt: new Date(nowIso),
          })
          .where(eq(schema.issuedTickets.ticketCode, oldTicket.ticketCode));

        await db.insert(schema.issuedTickets).values({
          id: newTicket.id,
          orderItemId: order.items[0]?.id || oldTicket.id,
          orderId: order.id,
          ticketCode: newTicket.ticketCode,
          qrPayloadHash: newTicket.qrPayloadHash,
          attendeeName: newTicket.attendeeName,
          status: newTicket.status,
          pdfUrl: newTicket.pdfUrl,
          createdAt: new Date(nowIso),
        });

        await db.insert(schema.ticketSwaps).values({
          id: crypto.randomUUID(),
          orderId: order.id,
          originalTicketCode: oldTicket.ticketCode,
          newTicketCode: newTicket.ticketCode,
          oldSessionTitle: oldSession,
          newSessionTitle: params.newSessionTitle,
          adminEmail: params.adminEmail,
          reason: params.reason,
          priceDiffCents: params.priceDiffCents || 0,
        });
      }
    } catch (e: any) {
      console.warn('Could not save swap audit to DB:', e.message);
    }

    // 4. Sync tag update to GoHighLevel in background
    const baseUrl = params.publicBaseUrl || 'https://tickets.whiskyfestival.nl';
    GhlSyncService.syncTicketSwap({
      customerEmail: order.customerEmail,
      orderNumber: order.orderNumber,
      oldSessionTitle: oldSession,
      newSessionTitle: params.newSessionTitle,
      newDownloadUrl: `${baseUrl}${pdfUrl}`,
    }).catch((err) => {
      console.warn('GHL ticket swap sync error:', err.message);
    });

    return {
      success: true,
      oldTicket,
      newTicket,
      order,
    };
  }

  /**
   * Annuleren van een individueel ticket
   */
  static async cancelTicket(ticketCode: string, reason = 'Geannuleerd door beheerder'): Promise<{
    success: boolean;
    error?: string;
    ticket?: StoredIssuedTicket;
  }> {
    const match = await this.findTicket(ticketCode);
    if (!match) {
      return { success: false, error: 'Ticket niet gevonden.' };
    }

    const { order, ticket } = match;
    ticket.status = 'cancelled';
    ticket.swapReason = reason;

    memoryOrders.set(order.orderNumber, order);
    memoryOrders.set(order.id, order);
    saveLocalStore();

    try {
      const dbStatus = await checkDbConnection();
      if (dbStatus.ok) {
        await db.update(schema.issuedTickets)
          .set({ status: 'cancelled', swapReason: reason })
          .where(eq(schema.issuedTickets.ticketCode, ticket.ticketCode));
      }
    } catch (e: any) {
      console.warn('Could not update cancelled ticket in DB:', e.message);
    }

    return { success: true, ticket };
  }

  /**
   * Check in a ticket (scanner verification)
   */
  static async checkInTicket(ticketCode: string): Promise<{
    success: boolean;
    ticket?: StoredIssuedTicket;
    error?: string;
  }> {
    const match = await this.findTicket(ticketCode);
    if (!match) {
      return { success: false, error: 'Ticket niet gevonden in systeem.' };
    }

    const { order, ticket } = match;

    if (ticket.status === 'checked_in') {
      return {
        success: false,
        ticket,
        error: `AL GESCAND! Dit ticket is al ingecheckt op ${ticket.checkedInAt || 'eerder moment'}.`,
      };
    }

    if (ticket.status === 'swapped') {
      return {
        success: false,
        ticket,
        error: `TICKET VERVALLEN! Dit ticket is omgeruild (${ticket.swapReason || 'Niet meer geldig'}).`,
      };
    }

    if (ticket.status === 'cancelled') {
      return { success: false, ticket, error: 'TICKET GEANNULEERD! Dit ticket is ongeldig gemaakt.' };
    }

    ticket.status = 'checked_in';
    ticket.checkedInAt = new Date().toISOString();
    saveLocalStore();

    return { success: true, ticket };
  }

  /**
   * List all stored orders
   */
  static listOrders(): StoredOrder[] {
    return Array.from(new Map(Array.from(memoryOrders.values()).map((o) => [o.orderNumber, o])).values());
  }

  /**
   * List all issued tickets flattened across all orders (for Ticket & QR Monitor page)
   */
  static listAllTickets(): Array<StoredIssuedTicket & {
    orderNumber: string;
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    festivalId: string;
  }> {
    const allOrders = this.listOrders();
    const result: Array<StoredIssuedTicket & {
      orderNumber: string;
      customerName: string;
      customerEmail: string;
      customerPhone?: string;
      festivalId: string;
    }> = [];

    for (const o of allOrders) {
      for (const t of o.tickets) {
        result.push({
          ...t,
          orderNumber: o.orderNumber,
          customerName: o.customerName,
          customerEmail: o.customerEmail,
          customerPhone: o.customerPhone,
          festivalId: o.festivalId,
        });
      }
    }

    // Sort newest first
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}
