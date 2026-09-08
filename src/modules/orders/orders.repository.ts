import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { db, checkDbConnection } from '../../db/index.js';
import * as schema from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { buildQrPayload, generateTicketSignature } from '../tickets/qr.service.js';

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
  status: 'valid' | 'checked_in' | 'cancelled';
  sessionTitle: string;
  cityName: string;
  dateStr: string;
  timeStr: string;
  pdfUrl: string;
  checkedInAt?: string | null;
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
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
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
            dateStr: item.date || 'Festivaldag',
            timeStr: item.timeslot || item.time || 'Regulier',
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

    return order;
  }

  /**
   * Find ticket by code across all orders
   */
  static async findTicket(ticketCode: string): Promise<{ order: StoredOrder; ticket: StoredIssuedTicket } | null> {
    const normalized = ticketCode.startsWith('#') ? ticketCode : `#${ticketCode}`;
    for (const order of memoryOrders.values()) {
      const ticket = order.tickets.find((t) => t.ticketCode === normalized || t.ticketCode === ticketCode);
      if (ticket) {
        return { order, ticket };
      }
    }
    return null;
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

    if (ticket.status === 'cancelled') {
      return { success: false, ticket, error: 'TICKET GEANNULEERD!' };
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
}
