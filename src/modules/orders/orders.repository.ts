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
  swappedToTicketCode?: string;
  replacedTicketCode?: string;
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
  shippingAddress?: {
    street: string;
    zip: string;
    city: string;
    country: string;
  };
  ageVerification?: {
    birthDate: string;
    idCheckAcknowledged: boolean;
    verifiedAt: string;
  };
  items: StoredOrderItem[];
  tickets: StoredIssuedTicket[];
  itemsSummary?: string;
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
   * Register or sync an order that was created from Mollie/external source
   */
  static registerSyncedOrder(order: StoredOrder) {
    if (!order || !order.orderNumber) return;
    const existing = memoryOrders.get(order.orderNumber) || memoryOrders.get(order.id);
    if (!existing) {
      memoryOrders.set(order.orderNumber, order);
      memoryOrders.set(order.id, order);
      saveLocalStore();
    }
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
   * Intelligente datum & tijd bepaling op basis van festivalstad en sessietitel
   */
  static resolveSessionDateTime(
    cityNameOrFestivalId: string,
    sessionTitle: string,
    explicitDate?: string,
    explicitTime?: string
  ): { dateStr: string; timeStr: string; cityName: string } {
    const cityLower = (cityNameOrFestivalId || 'gent').toLowerCase();
    const titleLower = sessionTitle.toLowerCase();

    let cityName = 'Gent';
    if (cityLower.includes('amsterdam')) cityName = 'Amsterdam';
    else if (cityLower.includes('denhaag') || cityLower.includes('haag')) cityName = 'Den Haag';

    let dateStr = explicitDate && explicitDate !== 'Festivaldag' ? explicitDate : '';
    let timeStr = explicitTime && explicitTime !== 'Regulier' ? explicitTime.replace(/–/g, '-') : '';

    if (cityName === 'Gent') {
      if (titleLower.includes('fuji')) {
        dateStr = dateStr || 'Zaterdag 3 oktober 2026';
        if (!timeStr) timeStr = '21:00 - 21:45 UUR';
      } else if (titleLower.includes('jura')) {
        dateStr = dateStr || 'Zondag 4 oktober 2026';
        if (!timeStr) timeStr = '12:15 - 13:00 UUR';
      } else if (titleLower.includes('laphroaig')) {
        dateStr = dateStr || 'Zondag 4 oktober 2026';
        if (!timeStr) timeStr = '13:30 - 14:15 UUR';
      } else if (titleLower.includes('boot') || titleLower.includes('bootje')) {
        dateStr = dateStr || 'Zaterdag 3 oktober 2026';
        if (!timeStr) timeStr = '12:00 - 13:00 UUR';
      } else if (titleLower.includes('rondleiding')) {
        if (titleLower.includes('vrijdag')) {
          dateStr = dateStr || 'Vrijdag 2 oktober 2026';
          if (!timeStr) timeStr = '18:00 - 19:30 UUR';
        } else {
          dateStr = dateStr || 'Zaterdag 3 oktober 2026';
          if (!timeStr) timeStr = '11:00 - 12:30 UUR';
        }
      } else if (titleLower.includes('botteling')) {
        dateStr = dateStr || 'Afhalen Festival (2-4 okt)';
        if (!timeStr) timeStr = 'Hele dag';
      } else if (titleLower.includes('cvh') || titleLower.includes('fettercairn') || titleLower.includes('bowmore') || titleLower.includes('bulleit')) {
        dateStr = dateStr || 'Zaterdag 3 oktober 2026';
        if (!timeStr) {
          if (titleLower.includes('cvh')) timeStr = '12:15 - 13:00 UUR';
          else if (titleLower.includes('fettercairn')) timeStr = '15:00 - 15:45 UUR';
          else if (titleLower.includes('bowmore')) timeStr = '19:30 - 20:15 UUR';
          else if (titleLower.includes('bulleit')) timeStr = '16:15 - 17:00 UUR';
        }
      } else if (titleLower.includes('belgian owl') || titleLower.includes('glenfiddich') || titleLower.includes('balvenie') || titleLower.includes('suntory')) {
        dateStr = dateStr || 'Zondag 4 oktober 2026';
        if (!timeStr) {
          if (titleLower.includes('belgian owl')) timeStr = '13:30 - 14:15 UUR';
          else if (titleLower.includes('glenfiddich') || titleLower.includes('balvenie')) timeStr = '15:00 - 15:45 UUR';
          else if (titleLower.includes('suntory')) timeStr = '15:00 - 15:45 UUR';
        }
      } else if (titleLower.includes('dada chapel')) {
        if (titleLower.includes('vrijdag')) {
          dateStr = dateStr || 'Vrijdag 2 oktober 2026';
          if (!timeStr) timeStr = '20:00 - 20:45 UUR';
        } else {
          dateStr = dateStr || 'Zaterdag 3 oktober 2026';
          if (!timeStr) timeStr = '13:45 - 14:30 UUR';
        }
      } else if (titleLower.includes('zaterdag')) {
        dateStr = dateStr || 'Zaterdag 3 oktober 2026';
        if (!timeStr) {
          timeStr = titleLower.includes('avond') ? '19:00 - 23:00 UUR' : '13:00 - 17:00 UUR';
        }
      } else if (titleLower.includes('zondag')) {
        dateStr = dateStr || 'Zondag 4 oktober 2026';
        if (!timeStr) timeStr = '13:00 - 17:00 UUR';
      } else if (titleLower.includes('vrijdag')) {
        dateStr = dateStr || 'Vrijdag 2 oktober 2026';
        if (!timeStr) timeStr = '19:00 - 23:00 UUR';
      } else {
        dateStr = dateStr || 'Vrijdag 2 oktober 2026';
        if (!timeStr) timeStr = '19:00 - 23:00 UUR';
      }
    } else if (cityName === 'Amsterdam') {
      dateStr = dateStr || 'Zaterdag 16 januari 2027';
      if (!timeStr) {
        timeStr = titleLower.includes('avond') ? '18:30 - 22:30 UUR' : '13:00 - 17:00 UUR';
      }
    } else {
      // Den Haag
      if (titleLower.includes('zaterdag')) {
        dateStr = dateStr || 'Zaterdag 14 november 2026';
        if (!timeStr) timeStr = titleLower.includes('avond') ? '18:30 - 22:30 UUR' : '13:00 - 17:00 UUR';
      } else if (titleLower.includes('zondag')) {
        dateStr = dateStr || 'Zondag 15 november 2026';
        if (!timeStr) timeStr = '13:00 - 17:00 UUR';
      } else {
        dateStr = dateStr || 'Vrijdag 13 november 2026';
        if (!timeStr) timeStr = titleLower.includes('vip') ? '13:00 - 17:00 UUR' : '18:30 - 22:30 UUR';
      }
    }

    if (!timeStr) {
      const timeMatch = sessionTitle.match(/\b\d{1,2}:\d{2}(?:\s*-\s*\d{1,2}:\d{2})?(?:\s*UUR)?/i);
      if (timeMatch) {
        timeStr = timeMatch[0].toUpperCase().replace(/–/g, '-');
        if (!timeStr.includes('UUR')) timeStr += ' UUR';
      } else {
        timeStr = '13:00 - 17:00 UUR';
      }
    }

    if (!timeStr.toUpperCase().includes('UUR')) timeStr += ' UUR';

    return { dateStr, timeStr, cityName };
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

          // Infer exact festival date and time via intelligent session resolver
          const resolved = OrdersRepository.resolveSessionDateTime(
            cityName,
            sessionTitle,
            item.date,
            item.timeslot || item.time
          );
          const inferredDate = resolved.dateStr;
          const inferredTime = resolved.timeStr;

          const signature = generateTicketSignature(ticketCode, cityName, sessionTitle, attendeeName);
          const cleanCode = ticketCode.replace('#', '');
          const pdfUrl = `/api/tickets/${encodeURIComponent(cleanCode)}/pdf?city=${cityName}&orderNumber=${cleanOrderNumber}&name=${encodeURIComponent(attendeeName)}&title=${encodeURIComponent(sessionTitle)}&time=${encodeURIComponent(inferredTime)}&date=${encodeURIComponent(inferredDate)}`;

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
   * Rebuild order.items and itemsSummary based on currently active tickets (status valid or checked_in)
   */
  static rebuildOrderItemsAndSummary(order: StoredOrder) {
    if (!order || !Array.isArray(order.tickets)) return;

    const activeTickets = order.tickets.filter((t) => t.status === 'valid' || t.status === 'checked_in');

    const countMap = new Map<string, { count: number; dateStr?: string; timeStr?: string; category: string }>();
    for (const t of activeTickets) {
      const title = t.sessionTitle || 'Entreeticket';
      const existing = countMap.get(title);
      const isMc = title.toLowerCase().includes('masterclass');
      if (existing) {
        existing.count += 1;
      } else {
        countMap.set(title, {
          count: 1,
          dateStr: t.dateStr,
          timeStr: t.timeStr,
          category: isMc ? 'masterclass' : 'entree',
        });
      }
    }

    const newItems: StoredOrderItem[] = [];
    countMap.forEach((val, title) => {
      newItems.push({
        id: crypto.randomUUID(),
        orderId: order.id,
        ticketTypeId: `${order.festivalId}-${val.category}`,
        title,
        quantity: val.count,
        unitPriceCents: 0,
        category: val.category,
        date: val.dateStr,
        time: val.timeStr,
      });
    });

    order.items = newItems;

    const summaryParts: string[] = [];
    countMap.forEach((val, title) => {
      summaryParts.push(`${val.count}x ${title}`);
    });
    order.itemsSummary = summaryParts.join(', ');
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

    // 2. Resolve city-specific date and time if not provided
    const { dateStr: resolvedDateStr, timeStr: resolvedTimeStr } = OrdersRepository.resolveSessionDateTime(
      oldTicket.cityName || order.festivalId || 'gent',
      params.newSessionTitle,
      params.newDateStr,
      params.newTimeStr
    );

    // 3. Generate new ticket code (e.g. #WF-2026-84387-1-R1)
    const baseCode = oldTicket.ticketCode.split('-R')[0];
    const swapVersion = (order.tickets.filter((t) => t.ticketCode.startsWith(baseCode)).length);
    const newTicketCode = `${baseCode}-R${swapVersion}`;

    const newTicketId = crypto.randomUUID();
    oldTicket.swappedToTicketId = newTicketId;
    oldTicket.swappedToTicketCode = newTicketCode;

    const qrPayload = buildQrPayload({
      ticketCode: newTicketCode,
      cityName: oldTicket.cityName,
      sessionTitle: params.newSessionTitle,
      attendeeName: oldTicket.attendeeName,
    });

    const signature = generateTicketSignature(newTicketCode, oldTicket.cityName, params.newSessionTitle, oldTicket.attendeeName);
    const cleanCode = newTicketCode.replace('#', '');
    const cleanOrderNumber = order.orderNumber.replace('#', '');
    const pdfUrl = `/api/tickets/${encodeURIComponent(cleanCode)}/pdf?city=${encodeURIComponent(oldTicket.cityName)}&orderNumber=${encodeURIComponent(cleanOrderNumber)}&name=${encodeURIComponent(oldTicket.attendeeName)}&title=${encodeURIComponent(params.newSessionTitle)}&date=${encodeURIComponent(resolvedDateStr)}&time=${encodeURIComponent(resolvedTimeStr)}`;

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
      dateStr: resolvedDateStr,
      timeStr: resolvedTimeStr,
      pdfUrl,
      replacedTicketCode: oldTicket.ticketCode,
      createdAt: nowIso,
    };

    order.tickets.push(newTicket);

    // Synchronize corresponding order item if found
    if (Array.isArray(order.items)) {
      const matchingItem = order.items.find((i) => i.title === oldSession);
      if (matchingItem) {
        matchingItem.title = params.newSessionTitle;
        matchingItem.date = resolvedDateStr;
        matchingItem.time = resolvedTimeStr;
      }
    }

    // Rebuild order.items & itemsSummary to match active tickets
    this.rebuildOrderItemsAndSummary(order);

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
    order?: StoredOrder;
  }> {
    const match = await this.findTicket(ticketCode);
    if (!match) {
      return { success: false, error: 'Ticket niet gevonden.' };
    }

    const { order, ticket } = match;
    ticket.status = 'cancelled';
    ticket.swapReason = reason;

    // Rebuild order.items & itemsSummary so cancelled tickets are removed from active order totals
    this.rebuildOrderItemsAndSummary(order);

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

    return { success: true, ticket, order };
  }

  /**
   * Handmatig een ticket of masterclass toevoegen aan een bestaande bestelling (€0,- cadeau / relatiegeschenk)
   */
  static async addTicketToOrder(params: {
    orderNumber: string;
    sessionTitle: string;
    attendeeName?: string;
    cityName?: string;
    dateStr?: string;
    timeStr?: string;
    reason?: string;
    adminEmail?: string;
    publicBaseUrl?: string;
  }): Promise<{
    success: boolean;
    error?: string;
    ticket?: StoredIssuedTicket;
    order?: StoredOrder;
  }> {
    const order = await this.findOrder(params.orderNumber);
    if (!order) {
      return { success: false, error: 'Bestelling niet gevonden in het systeem.' };
    }

    const { dateStr, timeStr, cityName } = OrdersRepository.resolveSessionDateTime(
      params.cityName || order.festivalId || 'gent',
      params.sessionTitle,
      params.dateStr,
      params.timeStr
    );

    const ticketIndex = (order.tickets?.length || 0) + 1;
    const cleanOrderNumber = order.orderNumber.replace('#', '');
    const ticketCode = `#${cleanOrderNumber}-${ticketIndex}`;
    const attendeeName = params.attendeeName?.trim() || order.customerName;

    const qrPayload = buildQrPayload({
      ticketCode,
      cityName,
      sessionTitle: params.sessionTitle,
      attendeeName,
    });

    const signature = generateTicketSignature(ticketCode, cityName, params.sessionTitle, attendeeName);
    const cleanCode = ticketCode.replace('#', '');
    const pdfUrl = `/api/tickets/${encodeURIComponent(cleanCode)}/pdf?city=${encodeURIComponent(cityName)}&orderNumber=${encodeURIComponent(cleanOrderNumber)}&name=${encodeURIComponent(attendeeName)}&title=${encodeURIComponent(params.sessionTitle)}&date=${encodeURIComponent(dateStr)}&time=${encodeURIComponent(timeStr)}`;

    const nowIso = new Date().toISOString();
    const newTicket: StoredIssuedTicket = {
      id: crypto.randomUUID(),
      orderId: order.id,
      ticketCode,
      qrPayload,
      qrPayloadHash: signature,
      attendeeName,
      status: 'valid',
      sessionTitle: params.sessionTitle,
      cityName,
      dateStr,
      timeStr,
      pdfUrl,
      swapReason: params.reason ? `Handmatig toegevoegd: ${params.reason}` : 'Handmatig toegevoegd (€0,- Cadeau / Comp)',
      createdAt: nowIso,
    };

    if (!Array.isArray(order.tickets)) {
      order.tickets = [];
    }
    order.tickets.push(newTicket);

    // Also add to order.items so order summaries & emails show the added ticket
    const isMasterclass = params.sessionTitle.toLowerCase().includes('masterclass');
    const newItem: StoredOrderItem = {
      id: crypto.randomUUID(),
      orderId: order.id,
      ticketTypeId: `comp-${Date.now()}`,
      title: params.sessionTitle,
      quantity: 1,
      unitPriceCents: 0,
      category: isMasterclass ? 'masterclass' : 'entree',
      date: dateStr,
      time: timeStr,
      delivery: params.reason ? `Cadeau: ${params.reason}` : 'Handmatig Cadeau (€0,-)',
    };
    if (!Array.isArray(order.items)) {
      order.items = [];
    }
    order.items.push(newItem);

    // Ensure order is marked paid
    if (order.status !== 'paid') {
      order.status = 'paid';
      order.paidAt = nowIso;
    }

    // Rebuild order.items & itemsSummary to match active tickets
    this.rebuildOrderItemsAndSummary(order);

    // Persist
    memoryOrders.set(order.orderNumber, order);
    memoryOrders.set(order.id, order);
    saveLocalStore();

    // Persist to DB if connected
    try {
      const dbStatus = await checkDbConnection();
      if (dbStatus.ok) {
        await db.insert(schema.issuedTickets).values({
          id: newTicket.id,
          orderItemId: newItem.id,
          orderId: order.id,
          ticketCode: newTicket.ticketCode,
          qrPayloadHash: newTicket.qrPayloadHash,
          attendeeName: newTicket.attendeeName,
          status: newTicket.status,
          pdfUrl: newTicket.pdfUrl,
          createdAt: new Date(nowIso),
        }).onConflictDoNothing();
      }
    } catch (e: any) {
      console.warn('Could not insert manually added ticket in DB:', e.message);
    }

    // Sync tag update to GHL in background
    const baseUrl = params.publicBaseUrl || 'https://whiskytix-r1qq.vercel.app';
    GhlSyncService.syncTicketSwap({
      customerEmail: order.customerEmail,
      orderNumber: order.orderNumber,
      oldSessionTitle: 'Handmatige Toevoeging',
      newSessionTitle: params.sessionTitle,
      newDownloadUrl: `${baseUrl}${pdfUrl}`,
    }).catch((err) => {
      console.warn('GHL ticket add sync error:', err.message);
    });

    return { success: true, ticket: newTicket, order };
  }

  /**
   * Volledig nieuwe bestelling / gastuitnodiging aanmaken (€0,- comp order)
   */
  static async createManualOrder(params: {
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    city: 'gent' | 'denhaag' | 'amsterdam';
    sessionTitle: string;
    quantity: number;
    reason: string;
    notes?: string;
    adminEmail?: string;
    dateStr?: string;
    timeStr?: string;
    publicBaseUrl?: string;
  }): Promise<{
    success: boolean;
    error?: string;
    order?: StoredOrder;
  }> {
    if (!params.customerName?.trim() || !params.customerEmail?.trim()) {
      return { success: false, error: 'Klantnaam en e-mailadres zijn verplicht.' };
    }
    if (!params.sessionTitle?.trim()) {
      return { success: false, error: 'Sessie of masterclass titel is verplicht.' };
    }

    const city = (params.city || 'gent') as 'gent' | 'denhaag' | 'amsterdam';
    const { dateStr, timeStr, cityName } = OrdersRepository.resolveSessionDateTime(
      city,
      params.sessionTitle,
      params.dateStr,
      params.timeStr
    );

    const randomDigits = Math.floor(10000 + Math.random() * 90000);
    const orderNumber = `#WF-2026-COMP-${randomDigits}`;
    const orderId = crypto.randomUUID();
    const nowIso = new Date().toISOString();
    const qty = Math.max(1, Math.min(Number(params.quantity) || 1, 50));
    const isMasterclass = params.sessionTitle.toLowerCase().includes('masterclass');

    const reasonText = params.reason || 'VIP / Gast';
    const noteText = params.notes?.trim() ? ` — Notitie: ${params.notes.trim()}` : '';

    const orderItem: StoredOrderItem = {
      id: crypto.randomUUID(),
      orderId,
      ticketTypeId: `comp-${city}-${Date.now()}`,
      title: params.sessionTitle,
      quantity: qty,
      unitPriceCents: 0,
      category: isMasterclass ? 'masterclass' : 'entree',
      date: dateStr,
      time: timeStr,
      delivery: `Uitnodiging: ${reasonText}${noteText}`,
    };

    const tickets: StoredIssuedTicket[] = [];
    const cleanOrderNumber = orderNumber.replace('#', '');

    for (let i = 1; i <= qty; i++) {
      const ticketCode = `${orderNumber}-${i}`;
      const attendeeName = qty > 1 ? `${params.customerName.trim()} (Gast ${i})` : params.customerName.trim();

      const qrPayload = buildQrPayload({
        ticketCode,
        cityName,
        sessionTitle: params.sessionTitle,
        attendeeName,
      });

      const signature = generateTicketSignature(ticketCode, cityName, params.sessionTitle, attendeeName);
      const cleanCode = ticketCode.replace('#', '');
      const pdfUrl = `/api/tickets/${encodeURIComponent(cleanCode)}/pdf?city=${encodeURIComponent(cityName)}&orderNumber=${encodeURIComponent(cleanOrderNumber)}&name=${encodeURIComponent(attendeeName)}&title=${encodeURIComponent(params.sessionTitle)}&date=${encodeURIComponent(dateStr)}&time=${encodeURIComponent(timeStr)}`;

      tickets.push({
        id: crypto.randomUUID(),
        orderId,
        ticketCode,
        qrPayload,
        qrPayloadHash: signature,
        attendeeName,
        status: 'valid',
        sessionTitle: params.sessionTitle,
        cityName,
        dateStr,
        timeStr,
        pdfUrl,
        swapReason: `Handmatige uitnodiging: ${reasonText}${noteText}`,
        createdAt: nowIso,
      });
    }

    const order: StoredOrder = {
      id: orderId,
      orderNumber,
      festivalId: city,
      customerName: params.customerName.trim(),
      customerEmail: params.customerEmail.trim().toLowerCase(),
      customerPhone: params.customerPhone?.trim() || undefined,
      subtotalCents: 0,
      discountCents: 0,
      totalCents: 0,
      status: 'paid',
      paymentMethod: `comp:${(params.reason || 'gastuitnodiging').toLowerCase()}`,
      createdAt: nowIso,
      paidAt: nowIso,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      items: [orderItem],
      tickets,
    };

    // Save locally
    memoryOrders.set(order.orderNumber, order);
    memoryOrders.set(order.id, order);
    saveLocalStore();

    // Persist to DB if connected
    try {
      const dbStatus = await checkDbConnection();
      if (dbStatus.ok) {
        await db.insert(schema.orders).values({
          id: order.id,
          orderNumber: order.orderNumber,
          festivalId: order.festivalId,
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          customerPhone: order.customerPhone || null,
          subtotalCents: 0,
          discountCents: 0,
          totalCents: 0,
          status: 'paid',
          paymentMethod: order.paymentMethod,
          createdAt: new Date(nowIso),
          expiresAt: new Date(order.expiresAt),
        }).onConflictDoNothing();

        await db.insert(schema.orderItems).values({
          id: orderItem.id,
          orderId: order.id,
          ticketTypeId: orderItem.ticketTypeId,
          quantity: orderItem.quantity,
          unitPriceCents: 0,
          metadata: JSON.stringify({
            title: orderItem.title,
            category: orderItem.category,
            date: orderItem.date,
            time: orderItem.time,
            delivery: orderItem.delivery,
          }),
        }).onConflictDoNothing();

        for (const t of tickets) {
          await db.insert(schema.issuedTickets).values({
            id: t.id,
            orderItemId: orderItem.id,
            orderId: order.id,
            ticketCode: t.ticketCode,
            qrPayloadHash: t.qrPayloadHash,
            attendeeName: t.attendeeName,
            status: t.status,
            pdfUrl: t.pdfUrl,
            createdAt: new Date(nowIso),
          }).onConflictDoNothing();
        }
      }
    } catch (e: any) {
      console.warn('Could not insert manual comp order in DB:', e.message);
    }

    return { success: true, order };
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

/**
 * Parses comma-separated itemsSummary string into structured items with quantities and clean titles
 * Example: "1x Entreeticket Zondagmiddag, 1x Masterclass • Dada Chapel Distillery, 1x Masterclass • The House of Suntory"
 */
export function parseItemsSummary(summary?: string): Array<{ quantity: number; title: string }> {
  if (!summary || !summary.trim()) {
    return [{ quantity: 1, title: 'Festival Entreeticket' }];
  }

  const parts = summary.split(',').map((p) => p.trim()).filter(Boolean);
  const items: Array<{ quantity: number; title: string }> = [];

  for (const part of parts) {
    const qtyMatch = part.match(/^(\d+)x\s*(.*)$/i);
    if (qtyMatch) {
      items.push({
        quantity: parseInt(qtyMatch[1], 10) || 1,
        title: qtyMatch[2].trim() || 'Festival Entreeticket',
      });
    } else {
      items.push({
        quantity: 1,
        title: part,
      });
    }
  }

  return items.length > 0 ? items : [{ quantity: 1, title: summary.trim() }];
}
