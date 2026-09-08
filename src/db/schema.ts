import { pgTable, text, timestamp, integer, boolean, uuid, index, pgEnum } from 'drizzle-orm/pg-core';

export const festivalIdEnum = pgEnum('festival_id', ['denhaag', 'gent', 'amsterdam']);
export const orderStatusEnum = pgEnum('order_status', ['pending', 'paid', 'expired', 'failed', 'refunded']);
export const ticketStatusEnum = pgEnum('ticket_status', ['valid', 'checked_in', 'cancelled']);
export const discountTypeEnum = pgEnum('discount_type', ['percentage', 'fixed_amount']);
export const userRoleEnum = pgEnum('user_role', ['admin', 'organizer', 'scanner']);

// 1. Festivals (Multi-City Tenancy)
export const festivals = pgTable('festivals', {
  id: festivalIdEnum('id').primaryKey(),
  name: text('name').notNull(),
  city: text('city').notNull(),
  currency: text('currency').default('EUR').notNull(),
  mollieProfileId: text('mollie_profile_id'),
  mollieApiKey: text('mollie_api_key'),
  supportEmail: text('support_email').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 2. Festival Sessies
export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  festivalId: festivalIdEnum('festival_id').references(() => festivals.id).notNull(),
  name: text('name').notNull(),
  date: text('date').notNull(), // ISO YYYY-MM-DD
  startTime: text('start_time').notNull(), // HH:mm
  endTime: text('end_time').notNull(), // HH:mm
  capacityMax: integer('capacity_max').notNull(),
  capacitySold: integer('capacity_sold').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
}, (table) => ({
  festivalIdx: index('session_festival_idx').on(table.festivalId),
}));

// 3. Ticket Types & Add-ons
export const ticketTypes = pgTable('ticket_types', {
  id: text('id').primaryKey(),
  festivalId: festivalIdEnum('festival_id').references(() => festivals.id).notNull(),
  sessionId: uuid('session_id').references(() => sessions.id),
  category: text('category').notNull(),
  title: text('title').notNull(),
  subtitle: text('subtitle'),
  priceCents: integer('price_cents').notNull(),
  vatRate: integer('vat_rate').default(21).notNull(),
  totalAvailable: integer('total_available').notNull(),
  totalSold: integer('total_sold').default(0).notNull(),
  maxPerOrder: integer('max_per_order').default(10).notNull(),
  isAddon: boolean('is_addon').default(false).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
}, (table) => ({
  festivalCatIdx: index('ticket_festival_cat_idx').on(table.festivalId, table.category),
}));

// 4. Kortingscodes & Vouchers
export const discountCodes = pgTable('discount_codes', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').unique().notNull(),
  festivalId: text('festival_id').default('all').notNull(),
  discountType: discountTypeEnum('discount_type').notNull(),
  discountValue: integer('discount_value').notNull(),
  minOrderCents: integer('min_order_cents').default(0).notNull(),
  maxUses: integer('max_uses'),
  currentUses: integer('current_uses').default(0).notNull(),
  validFrom: timestamp('valid_from'),
  validUntil: timestamp('valid_until'),
  isActive: boolean('is_active').default(true).notNull(),
});

// 5. Bestellingen (#WF-XXXXX reeks)
export const orders = pgTable('orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderNumber: text('order_number').unique().notNull(),
  festivalId: festivalIdEnum('festival_id').references(() => festivals.id).notNull(),
  customerName: text('customer_name').notNull(),
  customerEmail: text('customer_email').notNull(),
  customerPhone: text('customer_phone'),
  subtotalCents: integer('subtotal_cents').notNull(),
  discountCents: integer('discount_cents').default(0).notNull(),
  totalCents: integer('total_cents').notNull(),
  discountCodeId: uuid('discount_code_id').references(() => discountCodes.id),
  molliePaymentId: text('mollie_payment_id').unique(),
  status: orderStatusEnum('status').default('pending').notNull(),
  paymentMethod: text('payment_method'),
  ghlContactId: text('ghl_contact_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  paidAt: timestamp('paid_at'),
  expiresAt: timestamp('expires_at').notNull(),
}, (table) => ({
  emailIdx: index('orders_email_idx').on(table.customerEmail),
  mollieIdx: index('orders_mollie_idx').on(table.molliePaymentId),
}));

// 6. Bestelde Items
export const orderItems = pgTable('order_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id').references(() => orders.id).notNull(),
  ticketTypeId: text('ticket_type_id').references(() => ticketTypes.id).notNull(),
  quantity: integer('quantity').notNull(),
  unitPriceCents: integer('unit_price_cents').notNull(),
  metadata: text('metadata'),
});

// 7. Uitgegeven Individuele E-Tickets
export const issuedTickets = pgTable('issued_tickets', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderItemId: uuid('order_item_id').references(() => orderItems.id).notNull(),
  orderId: uuid('order_id').references(() => orders.id).notNull(),
  ticketCode: text('ticket_code').unique().notNull(),
  qrPayloadHash: text('qr_payload_hash').notNull(),
  attendeeName: text('attendee_name').notNull(),
  status: ticketStatusEnum('status').default('valid').notNull(),
  checkedInAt: timestamp('checked_in_at'),
  pdfUrl: text('pdf_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  qrHashIdx: index('ticket_qr_hash_idx').on(table.qrPayloadHash),
  orderIdx: index('ticket_order_idx').on(table.orderId),
}));

// 8. Scan Logs & Audit Trail
export const scanLogs = pgTable('scan_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  ticketId: uuid('ticket_id').references(() => issuedTickets.id).notNull(),
  scannedByUserId: uuid('scanned_by_user_id'),
  scannerDevice: text('scanner_device'),
  entranceGate: text('entrance_gate').notNull(),
  scannedAt: timestamp('scanned_at').notNull(),
  isOfflineSync: boolean('is_offline_sync').default(false).notNull(),
  syncedAt: timestamp('synced_at').defaultNow().notNull(),
});

// 9. Systeemgebruikers (Admins & Scanners)
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull(),
  pinCode: text('pin_code'),
  assignedFestivalId: festivalIdEnum('assigned_festival_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
