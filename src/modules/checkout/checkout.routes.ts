import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { OrdersRepository, StoredOrderItem } from '../orders/orders.repository.js';
import { MollieService, sandboxPayments } from '../payments/mollie.service.js';
import { verifyQrPayload } from '../tickets/qr.service.js';

export async function registerCheckoutRoutes(server: FastifyInstance): Promise<void> {
  /**
   * 1. CREATE ORDER & INITIALIZE PAYMENT
   * POST /api/checkout/create-order
   */
  server.post('/api/checkout/create-order', async (request, reply) => {
    try {
      const body = request.body as any;
      const {
        festivalId = 'gent',
        customerName = 'Gast Bezoeker',
        customerEmail,
        customerPhone = '',
        items = [],
        discountCents = 0,
        shippingAddress,
      } = body || {};

      if (!customerEmail) {
        return reply.status(400).send({ error: 'E-mailadres is verplicht voor het ontvangen van tickets.' });
      }

      if (!Array.isArray(items) || items.length === 0) {
        return reply.status(400).send({ error: 'Winkelwagen is leeg.' });
      }

      const orderNumber = OrdersRepository.generateOrderNumber();
      const orderId = crypto.randomUUID();

      // Compute total amount
      let subtotalCents = 0;
      let totalQty = 0;
      let hasShipping = false;

      const orderItems: StoredOrderItem[] = items.map((item: any) => {
        const qty = Number(item.quantity || item.qty || 1);
        const priceCents = Math.round(Number(item.price || item.priceCents || 0) * (item.priceCents ? 1 : 100));
        subtotalCents += priceCents * qty;
        totalQty += qty;

        if (item.category === 'botteling' && item.delivery === 'shipping') {
          hasShipping = true;
        }

        return {
          id: crypto.randomUUID(),
          orderId,
          ticketTypeId: item.ticketTypeId || item.id || 'ticket-general',
          title: item.title || 'Toegangsbewijs',
          quantity: qty,
          unitPriceCents: priceCents,
          category: item.category,
          timeslot: item.timeslot,
          delivery: item.delivery,
          date: item.date,
          time: item.time,
        };
      });

      const feeCents = totalQty > 0 ? 150 : 0; // €1,50 service fee
      const shippingCents = hasShipping ? 1250 : 0; // €12,50 shipping fee
      const finalDiscountCents = Number(discountCents) || 0;
      const totalCents = Math.max(0, subtotalCents + feeCents + shippingCents - finalDiscountCents);

      // Create Pending Order
      const storedOrder = await OrdersRepository.createOrder({
        id: orderId,
        orderNumber,
        festivalId: (festivalId as any) || 'gent',
        customerName,
        customerEmail,
        customerPhone,
        subtotalCents,
        discountCents: finalDiscountCents,
        totalCents,
        status: 'pending',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min TTL
        items: orderItems,
      });

      // Initialize Payment via Mollie
      const host = request.headers.host || 'localhost:4000';
      const protocol = request.protocol || 'http';
      const baseUrl = `${protocol}://${host}`;

      const clientReturnUrl = body?.returnUrl || body?.redirectUrl;
      const redirectUrl = clientReturnUrl 
        ? `${clientReturnUrl}${clientReturnUrl.includes('?') ? '&' : '?'}orderNumber=${encodeURIComponent(orderNumber)}&status=success`
        : `${baseUrl}/order/confirmation?orderNumber=${encodeURIComponent(orderNumber)}`;
      const webhookUrl = `${baseUrl}/api/payments/webhook`;

      const payment = await MollieService.createPayment({
        orderNumber,
        amountCents: totalCents,
        description: `Bestelling ${orderNumber} - ${festivalId.toUpperCase()} Whisky Fest`,
        redirectUrl,
        webhookUrl,
        customerEmail,
        customerName,
        metadata: {
          orderNumber,
          orderId,
          festivalId,
        },
      });

      // Update order with Mollie payment ID
      storedOrder.molliePaymentId = payment.paymentId;

      return reply.send({
        success: true,
        orderNumber,
        orderId,
        totalCents,
        checkoutUrl: payment.checkoutUrl,
        isSandboxSimulator: payment.isSandboxSimulator,
      });
    } catch (err: any) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Fout bij aanmaken bestelling: ' + err.message });
    }
  });

  /**
   * 2. MOLLIE WEBHOOK HANDLER
   * POST /api/payments/webhook
   */
  server.post('/api/payments/webhook', async (request, reply) => {
    try {
      const body = (request.body || {}) as any;
      const query = (request.query || {}) as any;
      const paymentId = body.id || query.id;

      if (!paymentId) {
        return reply.status(400).send({ error: 'Geen payment id ontvangen.' });
      }

      const verification = await MollieService.verifyPayment(paymentId);
      if (!verification.isPaid) {
        return reply.send({ status: 'not_paid', paymentId });
      }

      // Resolve order number
      let orderNumber = verification.orderNumber;
      if (!orderNumber) {
        const order = await OrdersRepository.findOrderByMollieId(paymentId);
        if (order) orderNumber = order.orderNumber;
      }

      if (!orderNumber) {
        return reply.status(404).send({ error: 'Ordernummer niet gevonden bij deze betaling.' });
      }

      // Mark order paid and issue tickets with HMAC QR codes!
      const updatedOrder = await OrdersRepository.markOrderPaid(orderNumber, {
        paymentMethod: verification.method || 'ideal',
      });

      return reply.send({
        success: true,
        orderNumber,
        status: updatedOrder?.status,
        issuedTicketsCount: updatedOrder?.tickets.length || 0,
      });
    } catch (err: any) {
      server.log.error(err);
      return reply.status(500).send({ error: err.message });
    }
  });

  /**
   * 3. INTERACTIVE MOLLIE SANDBOX SIMULATOR UI
   * GET /mollie-sandbox/:paymentId
   */
  server.get('/mollie-sandbox/:paymentId', async (request, reply) => {
    const params = request.params as { paymentId: string };
    const payment = sandboxPayments.get(params.paymentId);

    if (!payment) {
      reply.type('text/html');
      return reply.send(`<h1>Betaalsessie niet gevonden of verlopen.</h1><p><a href="/">Terug</a></p>`);
    }

    const amountEur = (payment.amountCents / 100).toFixed(2).replace('.', ',');

    const html = `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mollie Test Betaalomgeving — Whiskytix</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; }
    body { background: #F4F3F0; color: #1D1C1A; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 1.5rem; }
    .card { background: #FFFFFF; border: 2px solid #1D1C1A; border-radius: 12px; box-shadow: 6px 6px 0px #1D1C1A; max-width: 480px; width: 100%; padding: 2rem; }
    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #F4F3F0; padding-bottom: 1.25rem; margin-bottom: 1.5rem; }
    .badge { background: #EBF3FB; color: #1E3A8A; font-size: 0.75rem; font-weight: 800; padding: 0.35rem 0.75rem; border-radius: 20px; border: 1px solid #BFDBFE; }
    .mollie-brand { font-weight: 800; font-size: 1.15rem; color: #1D1C1A; display: flex; align-items: center; gap: 0.5rem; }
    .mollie-dot { width: 10px; height: 10px; border-radius: 50%; background: #0066FF; }
    .amount-box { background: #FAF7F2; border: 1.5px solid #E2D9CC; border-radius: 8px; padding: 1.25rem; text-align: center; margin-bottom: 1.5rem; }
    .amount-label { font-size: 0.8rem; font-weight: 700; color: #7A7268; text-transform: uppercase; letter-spacing: 0.05em; }
    .amount-val { font-size: 2.25rem; font-weight: 800; color: #1D1C1A; margin-top: 0.25rem; }
    .methods { display: flex; flex-direction: column; gap: 0.65rem; margin-bottom: 1.5rem; }
    .method-item { display: flex; align-items: center; gap: 0.85rem; padding: 0.85rem 1rem; border: 1.5px solid #E2D9CC; border-radius: 8px; cursor: pointer; transition: all 0.15s; background: #FFFFFF; }
    .method-item:hover, .method-item.selected { border-color: #1E3A8A; background: #F8FAFC; }
    .method-item input { accent-color: #1E3A8A; width: 18px; height: 18px; }
    .method-info { flex: 1; }
    .method-name { font-size: 0.9rem; font-weight: 700; color: #1D1C1A; }
    .btn-pay { width: 100%; background: #1E3A8A; color: #FFFFFF; border: 2px solid #1D1C1A; padding: 1rem; border-radius: 8px; font-size: 0.95rem; font-weight: 800; cursor: pointer; box-shadow: 3px 3px 0px #1D1C1A; transition: transform 0.1s; display: block; text-align: center; text-decoration: none; }
    .btn-pay:hover { background: #172554; }
    .btn-pay:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0px #1D1C1A; }
    .notice { font-size: 0.75rem; color: #7A7268; text-align: center; margin-top: 1rem; line-height: 1.4; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="mollie-brand">
        <div class="mollie-dot"></div>
        <span>mollie test gateway</span>
      </div>
      <span class="badge">SANDBOX TEST MODUS</span>
    </div>

    <div class="amount-box">
      <div class="amount-label">${payment.description}</div>
      <div class="amount-val">&euro; ${amountEur}</div>
      <div style="font-size: 0.75rem; color: #4C5752; font-weight: 600; margin-top: 0.35rem;">Bestelling ${payment.orderNumber}</div>
    </div>

    <div class="methods">
      <label class="method-item selected">
        <input type="radio" name="payment_method" value="ideal" checked>
        <div class="method-info">
          <div class="method-name">iDEAL (Testbank)</div>
        </div>
      </label>
      <label class="method-item">
        <input type="radio" name="payment_method" value="bancontact">
        <div class="method-info">
          <div class="method-name">Bancontact</div>
        </div>
      </label>
      <label class="method-item">
        <input type="radio" name="payment_method" value="creditcard">
        <div class="method-info">
          <div class="method-name">Creditcard (Visa / Mastercard)</div>
        </div>
      </label>
    </div>

    <button id="btn-submit-pay" class="btn-pay">
      &check; Betaal &euro; ${amountEur} (Test Betaling)
    </button>

    <p class="notice">
      Dit is de lokale test sandbox van Whiskytix.<br>
      Er wordt <strong>geen echt geld</strong> afgeschreven. Bij klikken wordt de webhook automatisch getriggerd en worden de offici&euml;le tickets gegenereerd.
    </p>
  </div>

  <script>
    document.getElementById('btn-submit-pay').addEventListener('click', async function() {
      this.disabled = true;
      this.textContent = 'Betaling verwerken in Whiskytix...';

      const selectedMethod = document.querySelector('input[name="payment_method"]:checked')?.value || 'ideal';

      try {
        const res = await fetch('/api/payments/sandbox-complete/${params.paymentId}', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentMethod: selectedMethod })
        });
        const data = await res.json();
        if (data.redirectUrl) {
          window.location.href = data.redirectUrl;
        } else {
          alert('Fout: ' + (data.error || 'Onbekende fout'));
        }
      } catch (err) {
        alert('Netwerkfout: ' + err.message);
      }
    });
  </script>
</body>
</html>`;

    reply.type('text/html');
    return reply.send(html);
  });

  /**
   * 4. COMPLETE SANDBOX PAYMENT
   * POST /api/payments/sandbox-complete/:paymentId
   */
  server.post('/api/payments/sandbox-complete/:paymentId', async (request, reply) => {
    const params = request.params as { paymentId: string };
    const body = (request.body || {}) as any;
    const paymentMethod = body.paymentMethod || 'ideal';

    try {
      const result = await MollieService.completeSandboxPayment(params.paymentId, paymentMethod);

      // Trigger internal issuance immediately
      await OrdersRepository.markOrderPaid(result.orderNumber, { paymentMethod });

      return reply.send({
        success: true,
        orderNumber: result.orderNumber,
        redirectUrl: result.redirectUrl,
      });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  /**
   * 4b. GET ORDER DETAILS (JSON API)
   * GET /api/checkout/order/:orderNumber
   */
  server.get('/api/checkout/order/:orderNumber', async (request, reply) => {
    const params = request.params as { orderNumber: string };
    let order = await OrdersRepository.findOrder(params.orderNumber);
    if (!order) {
      return reply.status(404).send({ error: 'Bestelling niet gevonden.' });
    }

    // Auto-verify with Mollie if pending
    if (order.status !== 'paid' && order.molliePaymentId) {
      try {
        const verification = await MollieService.verifyPayment(order.molliePaymentId);
        if (verification.isPaid) {
          const updated = await OrdersRepository.markOrderPaid(order.orderNumber, {
            paymentMethod: verification.method || 'ideal'
          });
          if (updated) {
            order = updated;
          }
        }
      } catch (err: any) {
        server.log.warn('Could not verify payment on return: ' + err.message);
      }
    }

    if (!order) {
      return reply.status(404).send({ error: 'Bestelling niet gevonden.' });
    }
    return reply.send({
      success: true,
      order: {
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        totalCents: order.totalCents,
        discountCents: order.discountCents,
        status: order.status,
        items: order.items,
        tickets: order.tickets,
        createdAt: order.createdAt,
      }
    });
  });

  /**
   * 4c. LIST ALL ORDERS (ADMIN API)
   * GET /api/admin/orders
   */
  server.get('/api/admin/orders', async (request, reply) => {
    const query = (request.query || {}) as { city?: string; festivalId?: string };
    const allOrders = OrdersRepository.listOrders();
    
    const formattedOrders = allOrders.map((o) => {
      const city = o.festivalId || 'gent';
      const cityName = city === 'gent' ? 'Gent' : city === 'amsterdam' ? 'Amsterdam' : 'Den Haag';
      const summary = o.items.map((i) => `${i.quantity}x ${i.title}`).join(', ');

      return {
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        customerEmail: o.customerEmail,
        customerPhone: o.customerPhone || '',
        city: city as 'denhaag' | 'amsterdam' | 'gent',
        cityName,
        itemsSummary: summary || 'Tickets & Masterclasses',
        totalCents: o.totalCents,
        status: o.status,
        createdAt: o.createdAt,
        tickets: o.tickets.map((t) => ({
          code: t.ticketCode,
          type: t.sessionTitle || 'Toegangsbewijs',
          session: t.sessionTitle,
          attendeeName: t.attendeeName,
          status: t.status,
        })),
      };
    });

    const filterCity = query.city || query.festivalId;
    const results = filterCity && filterCity !== 'all' 
      ? formattedOrders.filter((o) => o.city === filterCity)
      : formattedOrders;

    return reply.send({
      success: true,
      orders: results,
      count: results.length,
    });
  });

  /**
   * 5. ORDER CONFIRMATION & DOWNLOAD UI
   * GET /order/confirmation?orderNumber=...
   */
  server.get('/order/confirmation', async (request, reply) => {
    const query = (request.query || {}) as Record<string, string>;
    const orderNumber = query.orderNumber || query.order;

    if (!orderNumber) {
      reply.type('text/html');
      return reply.send(`<h1>Geen ordernummer opgegeven.</h1><p><a href="/">Terug naar home</a></p>`);
    }

    const order = await OrdersRepository.findOrder(orderNumber);
    if (!order) {
      reply.type('text/html');
      return reply.send(`<h1>Bestelling ${orderNumber} niet gevonden.</h1><p><a href="/">Terug</a></p>`);
    }

    // Auto-issue tickets if paid and not yet present
    if (order.status === 'paid' && order.tickets.length === 0) {
      await OrdersRepository.markOrderPaid(order.orderNumber);
    }

    const totalEur = (order.totalCents / 100).toFixed(2).replace('.', ',');
    const cityLabel = order.festivalId === 'gent' ? 'Gents Whisky Festival' : order.festivalId === 'amsterdam' ? 'Amsterdam Whisky Festival' : 'International Whisky Festival Den Haag';

    const ticketsHtml = order.tickets.map((t, idx) => {
      const cleanCode = t.ticketCode.replace('#', '');
      const downloadPdfUrl = `/api/tickets/${encodeURIComponent(cleanCode)}/pdf?city=${order.festivalId}&orderNumber=${order.orderNumber.replace('#', '')}&name=${encodeURIComponent(t.attendeeName)}&title=${encodeURIComponent(t.sessionTitle)}`;

      return `
        <div class="ticket-row">
          <div class="ticket-left">
            <div class="ticket-code">${t.ticketCode}</div>
            <div class="ticket-name">${t.sessionTitle}</div>
            <div class="ticket-meta">Kaarthouder: <strong>${t.attendeeName}</strong> &bull; Status: <span class="status-pill">${t.status.toUpperCase()}</span></div>
          </div>
          <div class="ticket-right">
            <a href="${downloadPdfUrl}" target="_blank" class="btn-download-pdf">
              📄 Download PDF E-Ticket &rarr;
            </a>
          </div>
        </div>
      `;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bestelling Bevestigd — ${order.orderNumber}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; }
    body { background: #FAF7F2; color: #1D1C1A; padding: 2rem 1rem; min-height: 100vh; }
    .container { max-width: 680px; margin: 0 auto; }
    .card { background: #FFFFFF; border: 2px solid #1D1C1A; border-radius: 12px; box-shadow: 6px 6px 0px #1D1C1A; padding: 2.25rem; margin-bottom: 2rem; }
    .success-badge { display: inline-flex; align-items: center; gap: 0.4rem; background: #E6F4EA; color: #006448; border: 1.5px solid #A8DAB5; font-size: 0.78rem; font-weight: 800; text-transform: uppercase; padding: 0.35rem 0.75rem; border-radius: 20px; letter-spacing: 0.05em; margin-bottom: 1rem; }
    h1 { font-size: 1.75rem; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 0.5rem; color: #1D1C1A; }
    .subtitle { font-size: 0.95rem; color: #4C5752; line-height: 1.5; margin-bottom: 1.75rem; }
    .order-meta-box { background: #FAF7F2; border: 1.5px solid #E2D9CC; border-radius: 8px; padding: 1.25rem; display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2rem; }
    .meta-item-label { font-size: 0.72rem; font-weight: 700; color: #7A7268; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.2rem; }
    .meta-item-val { font-size: 1rem; font-weight: 800; color: #1D1C1A; }
    .section-title { font-size: 1.15rem; font-weight: 800; margin-bottom: 1rem; display: flex; align-items: center; justify-content: space-between; }
    .ticket-row { background: #FFFFFF; border: 2px solid #1D1C1A; border-radius: 8px; box-shadow: 3px 3px 0px #1D1C1A; padding: 1.15rem 1.25rem; margin-bottom: 1rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
    .ticket-left { flex: 1; min-width: 220px; }
    .ticket-code { font-family: monospace; font-size: 0.85rem; font-weight: 800; color: #1E3A8A; margin-bottom: 0.2rem; }
    .ticket-name { font-size: 1.05rem; font-weight: 800; color: #1D1C1A; margin-bottom: 0.25rem; }
    .ticket-meta { font-size: 0.8rem; color: #4C5752; }
    .status-pill { background: #EBF3FB; color: #1E3A8A; font-weight: 800; padding: 0.15rem 0.45rem; border-radius: 4px; font-size: 0.72rem; }
    .btn-download-pdf { background: #CAAC8E; color: #1D1C1A; border: 2px solid #1D1C1A; padding: 0.75rem 1.15rem; border-radius: 6px; font-size: 0.85rem; font-weight: 800; text-decoration: none; box-shadow: 2px 2px 0px #1D1C1A; transition: all 0.1s; display: inline-flex; align-items: center; gap: 0.35rem; }
    .btn-download-pdf:hover { background: #B99979; }
    .btn-download-pdf:active { transform: translate(1px, 1px); box-shadow: 1px 1px 0px #1D1C1A; }
    .actions-bar { display: flex; gap: 1rem; justify-content: center; margin-top: 2rem; flex-wrap: wrap; }
    .btn-scanner { background: #1D1C1A; color: #FFFFFF; border: 2px solid #1D1C1A; padding: 0.85rem 1.5rem; border-radius: 8px; font-size: 0.88rem; font-weight: 800; text-decoration: none; box-shadow: 3px 3px 0px rgba(0,0,0,0.3); }
    .btn-scanner:hover { background: #333; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="success-badge">&check; Betaling Geslaagd &bull; Officieel Uitgegeven</div>
      <h1>Bedankt voor je bestelling, ${order.customerName}!</h1>
      <p class="subtitle">
        Je tickets voor het <strong>${cityLabel}</strong> zijn direct aangemaakt en beveiligd met een cryptografische HMAC-SHA256 QR-code.
        We hebben ook een bevestiging verzonden naar <strong>${order.customerEmail}</strong>.
      </p>

      <div class="order-meta-box">
        <div>
          <div class="meta-item-label">Bestelnummer</div>
          <div class="meta-item-val">${order.orderNumber}</div>
        </div>
        <div>
          <div class="meta-item-label">Totaalbedrag</div>
          <div class="meta-item-val">&euro; ${totalEur}</div>
        </div>
        <div>
          <div class="meta-item-label">Betaalmethode</div>
          <div class="meta-item-val">${(order.paymentMethod || 'iDEAL').toUpperCase()}</div>
        </div>
        <div>
          <div class="meta-item-label">Aantal Tickets</div>
          <div class="meta-item-val">${order.tickets.length} ${order.tickets.length === 1 ? 'ticket' : 'tickets'}</div>
        </div>
      </div>

      <div class="section-title">
        <span>Jouw E-Tickets (${order.tickets.length})</span>
      </div>

      <div class="tickets-container">
        ${ticketsHtml || '<p style="color:#7A7268;">Geen tickets gevonden.</p>'}
      </div>

      <div class="actions-bar">
        <a href="/scanner" class="btn-scanner">
          📱 Test Ticket in Whiskytix Scanner &rarr;
        </a>
      </div>
    </div>
  </div>
</body>
</html>`;

    reply.type('text/html');
    return reply.send(html);
  });

  /**
   * 6. SCANNER VERIFICATION API
   * POST /api/scanner/verify
   */
  server.post('/api/scanner/verify', async (request, reply) => {
    try {
      const body = (request.body || {}) as any;
      const rawPayload = body.qrPayload || body.code || body.payload;

      if (!rawPayload) {
        return reply.status(400).send({ valid: false, error: 'Geen QR payload ontvangen.' });
      }

      let ticketCode = rawPayload;

      // If full QR payload (WT1:...), verify cryptographic signature first!
      if (rawPayload.startsWith('WT1:')) {
        const verification = verifyQrPayload(rawPayload);
        if (!verification.valid || !verification.ticketCode) {
          return reply.status(400).send({
            valid: false,
            error: verification.error || 'Digitale handtekening ongeldig! Mogelijk vervalst ticket.',
          });
        }
        ticketCode = verification.ticketCode;
      }

      // Check-in ticket in database/store
      const checkInResult = await OrdersRepository.checkInTicket(ticketCode);

      if (!checkInResult.success) {
        const isDuplicate = checkInResult.error?.includes('AL GESCAND');
        return reply.status(isDuplicate ? 409 : 400).send({
          valid: false,
          alreadyScanned: isDuplicate,
          ticketCode,
          error: checkInResult.error,
        });
      }

      const ticket = checkInResult.ticket!;
      return reply.send({
        valid: true,
        alreadyScanned: false,
        ticketCode: ticket.ticketCode,
        attendeeName: ticket.attendeeName,
        sessionTitle: ticket.sessionTitle,
        cityName: ticket.cityName,
        checkedInAt: ticket.checkedInAt,
        message: `Entree verleend aan ${ticket.attendeeName} voor ${ticket.sessionTitle}!`,
      });
    } catch (err: any) {
      return reply.status(500).send({ valid: false, error: err.message });
    }
  });

  /**
   * 7. GET ORDER DETAILS API
   * GET /api/orders/:orderNumber
   */
  server.get('/api/orders/:orderNumber', async (request, reply) => {
    const params = request.params as { orderNumber: string };
    const order = await OrdersRepository.findOrder(params.orderNumber);
    if (!order) {
      return reply.status(404).send({ error: 'Order niet gevonden.' });
    }
    return reply.send(order);
  });

  /**
   * 8. GET ALL ORDERS LIST (FOR ADMIN COCKPIT)
   * GET /api/orders and GET /api/admin/orders
   */
  const handleGetOrders = async (request: any, reply: any) => {
    const query = (request.query || {}) as { city?: string; festivalId?: string };
    const allOrders = OrdersRepository.listOrders();
    
    const formattedOrders = allOrders.map((o) => {
      const city = o.festivalId || 'gent';
      const cityName = city === 'gent' ? 'Gent' : city === 'amsterdam' ? 'Amsterdam' : 'Den Haag';
      const summary = o.items && o.items.length > 0 
        ? o.items.map((i) => `${i.quantity}x ${i.title}`).join(', ')
        : 'Tickets & Toegang';

      return {
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        customerEmail: o.customerEmail,
        customerPhone: o.customerPhone || '',
        city: city as 'denhaag' | 'amsterdam' | 'gent',
        cityName,
        itemsSummary: summary,
        totalCents: o.totalCents,
        status: o.status,
        createdAt: o.createdAt,
        tickets: (o.tickets || []).map((t) => ({
          code: t.ticketCode,
          type: t.sessionTitle || 'Toegangsbewijs',
          session: t.sessionTitle,
          attendeeName: t.attendeeName,
          status: t.status,
        })),
      };
    });

    const filterCity = query.city || query.festivalId;
    const results = filterCity && filterCity !== 'all' 
      ? formattedOrders.filter((o) => o.city === filterCity)
      : formattedOrders;

    return reply.send({
      success: true,
      orders: results,
      count: results.length,
    });
  };

  server.get('/api/orders', handleGetOrders);
  server.get('/api/admin/orders', handleGetOrders);
}
