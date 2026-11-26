import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import postgres from 'postgres';

dotenv.config();

const args = new Set(process.argv.slice(2));
const isCommit = args.has('--commit');
const skipEmptyOrderStatus = args.has('--skip-empty-order-status');

const EXPORTS_DIR = path.resolve(process.cwd(), 'exports');

const SOURCES = [
  {
    file: 'amsterdam_middag_4439.csv',
    wpProductId: '4439',
    ticketTypeId: 'ams-entree-zaterdagmiddag',
    category: 'entree',
    title: 'Weekend Entree Zaterdagmiddag',
    dateStr: 'Zaterdag 16 januari 2027',
    timeStr: '13:00 - 17:00 uur',
    defaultPriceCents: 3995,
    totalAvailable: 594, // 432 verkocht + 162 beschikbaar in FooEvents
  },
  {
    file: 'amsterdam_avond_4440.csv',
    wpProductId: '4440',
    ticketTypeId: 'ams-entree-zaterdagavond',
    category: 'entree',
    title: 'Weekend Entree Zaterdagavond',
    dateStr: 'Zaterdag 16 januari 2027',
    timeStr: '19:00 - 23:00 uur',
    defaultPriceCents: 3995,
    totalAvailable: 598, // 258 verkocht + 340 beschikbaar in FooEvents
  },
  {
    file: 'amsterdam_genodigden_2127.csv',
    wpProductId: '2127',
    ticketTypeId: 'ams-entree-genodigden',
    category: 'special',
    title: 'Genodigden Gehele Dag',
    dateStr: 'Zaterdag 16 januari 2027',
    timeStr: '13:00 - 23:00 uur',
    defaultPriceCents: 0,
    totalAvailable: 40,
  },
];

function deterministicUuid(seed) {
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    '4' + hash.slice(13, 16),
    '8' + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join('-');
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQ = false;
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQ = true;
      } else if (c === ',') {
        row.push(field);
        field = '';
      } else if (c === '\n') {
        row.push(field.replace(/\r$/, ''));
        if (row.some((x) => x !== '')) rows.push(row);
        row = [];
        field = '';
      } else {
        field += c;
      }
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field.replace(/\r$/, ''));
    if (row.some((x) => x !== '')) rows.push(row);
  }
  const headers = rows[0] || [];
  return rows.slice(1).map((r) => Object.fromEntries(headers.map((h, idx) => [h, (r[idx] || '').trim()])));
}

function parseEuroToCents(raw, fallback) {
  if (!raw) return fallback;
  const cleaned = raw.replace(/[^0-9.,-]/g, '').replace(',', '.');
  const num = Number(cleaned);
  return Number.isFinite(num) ? Math.round(num * 100) : fallback;
}

function parseWpDate(raw) {
  if (!raw) return new Date();
  const iso = raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function mapTicketStatus(rawStatus) {
  const s = (rawStatus || '').toLowerCase();
  if (s === 'canceled' || s === 'cancelled') return 'cancelled';
  if (s === 'checked in' || s === 'checked_in') return 'checked_in';
  return 'valid';
}

function buildImportPlan() {
  const ordersMap = new Map();
  const seenTicketCodes = new Set();
  const stats = {
    perSource: {},
    totalOrders: 0,
    totalTickets: 0,
    validTickets: 0,
    cancelledTickets: 0,
    checkedInTickets: 0,
    skippedEmptyOrderStatus: [],
  };

  for (const src of SOURCES) {
    const filePath = path.join(EXPORTS_DIR, src.file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Exportbestand niet gevonden: ${filePath}`);
    }
    const rows = parseCsv(fs.readFileSync(filePath, 'utf8'));
    let srcValid = 0;
    let srcCancelled = 0;
    let srcSkipped = 0;

    for (const r of rows) {
      const rawTicketId = r['TicketID'] || '';
      const cleanCode = rawTicketId.replace(/^#+/, '').trim();
      if (!cleanCode) continue;
      const ticketCode = `#${cleanCode}`;

      if (seenTicketCodes.has(ticketCode)) {
        continue;
      }

      const wpOrderId = r['Bestelnummer'] || `UNKNOWN-${cleanCode}`;
      const orderStatus = r['Bestelstatus'] || '';
      const ticketStatus = mapTicketStatus(r['Ticket Status']);

      const attendeeFirst = r['Voornaam deelnemer'] || r['Voornaam koper'] || '';
      const attendeeLast = r['Naam van de deelnemer'] || r['Achternaam koper'] || '';
      const attendeeName = `${attendeeFirst} ${attendeeLast}`.trim() || 'Bezoeker';

      const buyerFirst = r['Voornaam koper'] || attendeeFirst;
      const buyerLast = r['Achternaam koper'] || attendeeLast;
      const buyerName = `${buyerFirst} ${buyerLast}`.trim() || attendeeName;
      const buyerEmail = (r['Koper E-mail'] || r['E-mail van de deelnemer'] || '').toLowerCase();
      const buyerPhone = r['Telefoonnummer van de koper'] || r['Telefoonnummer deelnemer'] || null;

      if (!orderStatus && skipEmptyOrderStatus) {
        stats.skippedEmptyOrderStatus.push({ ticketCode, wpOrderId, buyerName, buyerEmail, source: src.title });
        srcSkipped++;
        continue;
      }

      seenTicketCodes.add(ticketCode);

      const orderNumber = `#WP-${wpOrderId}`;
      const unitPriceCents = parseEuroToCents(r['Ticket Prijs Betaald'] || r['Ticket Prijs'], src.defaultPriceCents);
      const createdAt = parseWpDate(r['Besteldatum']);

      if (!ordersMap.has(orderNumber)) {
        ordersMap.set(orderNumber, {
          id: deterministicUuid(`amsterdam-wp-order:${orderNumber}`),
          orderNumber,
          festivalId: 'amsterdam',
          customerName: buyerName,
          customerEmail: buyerEmail || 'onbekend@whiskyfest.nl',
          customerPhone: buyerPhone,
          paymentMethod: r['Betaalmethode'] || 'fooevents_import',
          status: 'paid',
          createdAt,
          paidAt: createdAt,
          expiresAt: new Date(createdAt.getTime() + 3600 * 1000),
          itemsByType: new Map(),
          tickets: [],
        });
      }

      const order = ordersMap.get(orderNumber);

      if (!order.itemsByType.has(src.ticketTypeId)) {
        order.itemsByType.set(src.ticketTypeId, {
          id: deterministicUuid(`amsterdam-wp-item:${orderNumber}:${src.ticketTypeId}`),
          orderId: order.id,
          ticketTypeId: src.ticketTypeId,
          title: src.title,
          category: src.category,
          dateStr: src.dateStr,
          timeStr: src.timeStr,
          quantity: 0,
          unitPriceCents,
        });
      }

      const item = order.itemsByType.get(src.ticketTypeId);
      item.quantity += 1;

      const qrPayloadHash = crypto.createHash('sha256').update(cleanCode).digest('hex');

      order.tickets.push({
        id: deterministicUuid(`amsterdam-wp-ticket:${ticketCode}`),
        orderItemId: item.id,
        orderId: order.id,
        ticketCode,
        qrPayloadHash,
        attendeeName,
        status: ticketStatus,
        swapReason: ticketStatus === 'cancelled' ? 'Geannuleerd in FooEvents (WP)' : null,
        createdAt,
      });

      stats.totalTickets++;
      if (ticketStatus === 'cancelled') {
        stats.cancelledTickets++;
        srcCancelled++;
      } else if (ticketStatus === 'checked_in') {
        stats.checkedInTickets++;
        srcValid++;
      } else {
        stats.validTickets++;
        srcValid++;
      }
    }

    stats.perSource[src.ticketTypeId] = {
      title: src.title,
      csvRows: rows.length,
      valid: srcValid,
      cancelled: srcCancelled,
      skipped: srcSkipped,
    };
  }

  stats.totalOrders = ordersMap.size;
  return { orders: Array.from(ordersMap.values()), stats };
}

async function main() {
  console.log(`\n=== Whisky Fest Amsterdam (FooEvents -> Whiskytix) ===`);
  console.log(`Modus: ${isCommit ? 'LIVE COMMIT (schrijft naar database)' : 'DRY-RUN (alleen lezen/controleren)'}`);
  if (skipEmptyOrderStatus) {
    console.log('Optie actief: --skip-empty-order-status (tickets zonder WP bestelstatus worden overgeslagen)');
  }

  const { orders, stats } = buildImportPlan();

  console.log('\nOverzicht te importeren data:');
  console.log(JSON.stringify(stats, null, 2));

  const sampleOrder = orders[0];
  if (sampleOrder) {
    console.log('\nVoorbeeld order + ticket:');
    console.log(
      JSON.stringify(
        {
          orderNumber: sampleOrder.orderNumber,
          customerName: sampleOrder.customerName,
          customerEmail: sampleOrder.customerEmail,
          items: Array.from(sampleOrder.itemsByType.values()),
          sampleTicket: sampleOrder.tickets[0],
        },
        null,
        2
      )
    );
  }

  if (!isCommit) {
    console.log('\nDry-run voltooid. Geen wijzigingen geschreven. Gebruik --commit om daadwerkelijk te importeren.');
    return;
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL ontbreekt in .env');
  }

  const sql = postgres(dbUrl, { max: 5, prepare: false });
  try {
    // 1. Zorg dat festival 'amsterdam' bestaat
    await sql`
      INSERT INTO festivals (id, name, city, currency, support_email)
      VALUES ('amsterdam', 'Whisky Fest Amsterdam', 'Amsterdam', 'EUR', 'info@whiskyfest.nl')
      ON CONFLICT (id) DO NOTHING
    `;

    // 2. Zorg dat de 3 ticket_types bestaan
    for (const src of SOURCES) {
      await sql`
        INSERT INTO ticket_types (id, festival_id, category, title, subtitle, price_cents, vat_rate, total_available, total_sold, max_per_order, is_addon)
        VALUES (${src.ticketTypeId}, 'amsterdam', ${src.category}, ${src.title}, ${`${src.dateStr} · ${src.timeStr}`}, ${src.defaultPriceCents}, 21, ${src.totalAvailable}, 0, 10, false)
        ON CONFLICT (id) DO NOTHING
      `;
    }

    // 3. Importeer orders, order_items en issued_tickets (100% idempotent)
    let insertedOrders = 0;
    let insertedTickets = 0;

    for (const order of orders) {
      const items = Array.from(order.itemsByType.values());
      const subtotalCents = items.reduce((sum, it) => sum + it.quantity * it.unitPriceCents, 0);

      const orderRes = await sql`
        INSERT INTO orders (
          id, order_number, festival_id, customer_name, customer_email, customer_phone,
          subtotal_cents, discount_cents, total_cents, status, payment_method,
          created_at, paid_at, expires_at
        )
        VALUES (
          ${order.id}, ${order.orderNumber}, 'amsterdam', ${order.customerName}, ${order.customerEmail}, ${order.customerPhone},
          ${subtotalCents}, 0, ${subtotalCents}, 'paid', ${order.paymentMethod},
          ${order.createdAt}, ${order.paidAt}, ${order.expiresAt}
        )
        ON CONFLICT (order_number) DO NOTHING
        RETURNING id
      `;
      if (orderRes.length > 0) insertedOrders++;

      for (const item of items) {
        const meta = JSON.stringify({
          title: item.title,
          category: item.category,
          date: item.dateStr,
          time: item.timeStr,
          timeslot: item.timeStr,
          source: 'fooevents_wp_import',
        });

        await sql`
          INSERT INTO order_items (id, order_id, ticket_type_id, quantity, unit_price_cents, metadata)
          VALUES (${item.id}, ${order.id}, ${item.ticketTypeId}, ${item.quantity}, ${item.unitPriceCents}, ${meta})
          ON CONFLICT (id) DO NOTHING
        `;
      }

      for (const t of order.tickets) {
        const tRes = await sql`
          INSERT INTO issued_tickets (
            id, order_item_id, order_id, ticket_code, qr_payload_hash,
            attendee_name, status, swap_reason, created_at
          )
          VALUES (
            ${t.id}, ${t.orderItemId}, ${t.orderId}, ${t.ticketCode}, ${t.qrPayloadHash},
            ${t.attendeeName}, ${t.status}, ${t.swapReason}, ${t.createdAt}
          )
          ON CONFLICT (ticket_code) DO NOTHING
          RETURNING id
        `;
        if (tRes.length > 0) insertedTickets++;
      }
    }

    // 4. Werk total_sold op ticket_types bij op basis van actuele niet-geannuleerde tickets in DB
    for (const src of SOURCES) {
      await sql`
        UPDATE ticket_types tt
        SET total_sold = COALESCE((
          SELECT COUNT(*)::int
          FROM issued_tickets it
          JOIN order_items oi ON oi.id = it.order_item_id
          WHERE oi.ticket_type_id = ${src.ticketTypeId}
            AND it.status IN ('valid', 'checked_in')
        ), 0)
        WHERE tt.id = ${src.ticketTypeId}
      `;
    }

    console.log(`\nImport afgerond! Nieuw toegevoegd: ${insertedOrders} orders, ${insertedTickets} tickets.`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error('Fout tijdens import:', err);
  process.exit(1);
});
