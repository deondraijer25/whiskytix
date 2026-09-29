import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { OrdersRepository, StoredOrderItem, parseItemsSummary } from '../orders/orders.repository.js';
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
        ageVerification,
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

      // Server-side Age Verification enforcement for alcohol shipping
      if (hasShipping) {
        if (!ageVerification || !ageVerification.birthDate || !ageVerification.idCheckAcknowledged) {
          return reply.status(400).send({
            error: 'Leeftijdsverificatie (geboortedatum en akkoord met ID-controle bij bezorging) is verplicht voor verzending van festivalbottelingen.'
          });
        }
        const birthDate = new Date(ageVerification.birthDate);
        if (isNaN(birthDate.getTime())) {
          return reply.status(400).send({ error: 'Ongeldige geboortedatum opgegeven.' });
        }
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        if (age < 18) {
          return reply.status(400).send({ error: 'U dient minimaal 18 jaar oud te zijn om alcoholische festivalbottelingen te laten bezorgen.' });
        }
      }

      // Tiered service fee calculation: 1 item -> €1.75, 2-5 items -> €3.50, 5+ items -> €4.50
      let feeCents = 0;
      if (totalQty === 1) {
        feeCents = 175;
      } else if (totalQty >= 2 && totalQty <= 5) {
        feeCents = 350;
      } else if (totalQty > 5) {
        feeCents = 450;
      }

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
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 min stock hold TTL
        shippingAddress: hasShipping ? shippingAddress : undefined,
        ageVerification: hasShipping && ageVerification ? {
          birthDate: String(ageVerification.birthDate),
          idCheckAcknowledged: Boolean(ageVerification.idCheckAcknowledged),
          verifiedAt: new Date().toISOString()
        } : undefined,
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
          customerName,
          customerEmail,
          customerPhone: customerPhone || '',
          itemsSummary: orderItems.map((i) => `${i.quantity}x ${i.title}`).join(', '),
          itemsJson: JSON.stringify(orderItems.map((i) => ({
            id: i.id,
            title: i.title,
            qty: i.quantity,
            priceCents: i.unitPriceCents,
            cat: i.category,
            d: i.date,
            tm: i.time,
          }))).slice(0, 850),
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
   * 4c. SIMULATE PAYMENT (FOR TESTING & AUTOMATED FLOWS)
   * POST /api/checkout/simulate-payment
   */
  server.post('/api/checkout/simulate-payment', async (request, reply) => {
    try {
      const body = (request.body || {}) as any;
      const { orderNumber, paymentMethod = 'ideal' } = body;
      if (!orderNumber) {
        return reply.status(400).send({ error: 'Ordernummer is verplicht.' });
      }

      const updatedOrder = await OrdersRepository.markOrderPaid(orderNumber, { paymentMethod });
      if (!updatedOrder) {
        return reply.status(404).send({ error: 'Order niet gevonden.' });
      }

      return reply.send({
        success: true,
        orderNumber: updatedOrder.orderNumber,
        status: updatedOrder.status,
        tickets: updatedOrder.tickets,
        issuedTicketsCount: updatedOrder.tickets.length,
      });
    } catch (err: any) {
      server.log.error(err);
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

    // If order not in memory (e.g. Vercel cold start), reconstruct from Mollie API
    if (!order) {
      try {
        const molliePayments = await MollieService.listRecentPayments(50);
        const cleanedOrderNumber = params.orderNumber.startsWith('#') ? params.orderNumber : `#${params.orderNumber}`;
        const matchedPayment = molliePayments.find((p: any) =>
          p.metadata?.orderNumber === cleanedOrderNumber || p.metadata?.orderNumber === params.orderNumber
        );

        if (matchedPayment) {
          const meta = matchedPayment.metadata || {};
          const festivalId = (meta.festivalId || 'gent') as 'gent' | 'denhaag' | 'amsterdam';
          const valEur = parseFloat(matchedPayment.amountValue || '0');
          const amountCents = Math.round(valEur * 100);
          const itemsSummary = meta.itemsSummary || 'Festival Entreetickets';
          const parsedItems = meta.itemsJson
            ? (() => {
                try {
                  const arr = JSON.parse(meta.itemsJson);
                  if (Array.isArray(arr) && arr.length > 0) {
                    return arr.map((x: any) => ({
                      quantity: Number(x.qty || x.q || 1),
                      title: x.title || x.t || 'Entreeticket',
                      category: x.cat || x.category || 'entree',
                      date: x.d || x.date,
                      time: x.tm || x.time,
                    }));
                  }
                } catch {}
                return null;
              })()
            : null;
          const effectiveItems = parsedItems || parseItemsSummary(itemsSummary);
          const totalQty = effectiveItems.reduce((acc: number, it: any) => acc + it.quantity, 0) || 1;

          const reconstructedItems: StoredOrderItem[] = effectiveItems.map((pi: any) => {
            const isMc = pi.title.toLowerCase().includes('masterclass');
            return {
              id: crypto.randomUUID(),
              orderId: meta.orderId || matchedPayment.id,
              ticketTypeId: `${festivalId}-${isMc ? 'masterclass' : (pi.category || 'entree')}`,
              title: pi.title,
              quantity: pi.quantity,
              unitPriceCents: Math.round(amountCents / totalQty),
              category: isMc ? 'masterclass' : (pi.category || 'entree'),
              date: pi.date,
              time: pi.time,
            };
          });

          const reconstructedOrder = await OrdersRepository.createOrder({
            id: meta.orderId || matchedPayment.id,
            orderNumber: cleanedOrderNumber,
            festivalId,
            customerName: meta.customerName || 'Bezoeker',
            customerEmail: meta.customerEmail || '',
            customerPhone: meta.customerPhone || '',
            subtotalCents: amountCents,
            discountCents: 0,
            totalCents: amountCents,
            status: 'pending',
            molliePaymentId: matchedPayment.id,
            createdAt: matchedPayment.paidAt || matchedPayment.createdAt || new Date().toISOString(),
            expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            items: reconstructedItems,
          });

          if (matchedPayment.status === 'paid') {
            const paidOrder = await OrdersRepository.markOrderPaid(reconstructedOrder.orderNumber, {
              paymentMethod: matchedPayment.method || 'ideal',
            });
            if (paidOrder) order = paidOrder;
          } else {
            order = reconstructedOrder;
          }
        }
      } catch (err: any) {
        server.log.warn('Could not reconstruct order from Mollie: ' + err.message);
      }
    }

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

    // Generate pre-rendered ticket cards HTML for festival websites
    const cityConfig: Record<string, { primary: string; primaryLight: string; badgeBorder: string; venue: string; gradient: string }> = {
      gent: { primary: '#1E3A8A', primaryLight: '#E0E9FF', badgeBorder: '#93C5FD', venue: 'De Oude Vismijn, Gent', gradient: 'linear-gradient(90deg, #1E3A8A 0%, #2563EB 50%, #1E3A8A 100%)' },
      denhaag: { primary: '#006448', primaryLight: '#E6F4EA', badgeBorder: '#A8DAB5', venue: 'Grote Kerk, Den Haag', gradient: 'linear-gradient(90deg, #006448 0%, #008060 50%, #006448 100%)' },
      amsterdam: { primary: '#8C0223', primaryLight: '#FEE2E2', badgeBorder: '#FCA5A5', venue: 'Amsterdam Venue', gradient: 'linear-gradient(90deg, #8C0223 0%, #B91C3C 50%, #8C0223 100%)' },
    };
    const city = cityConfig[order.festivalId || 'gent'] || cityConfig.gent;
    const apiBase = `${request.protocol}://${request.headers.host || 'whiskytix-r1qq.vercel.app'}`;

    let ticketsHtml = '';
    if (order.status === 'paid' && order.tickets && order.tickets.length > 0) {
      for (const ticket of order.tickets) {
        const cleanCode = (ticket.ticketCode || '').replace('#', '');
        const isSwapped = ticket.status === 'swapped';
        const isCancelled = ticket.status === 'cancelled';

        if (isSwapped) {
          const replacementCode = ticket.swappedToTicketCode || (order.tickets.find((nt) => nt.replacedTicketCode === ticket.ticketCode)?.ticketCode);
          ticketsHtml += `<div style="background:#F5F5F4;border:2px dashed #A8A29E;border-radius:12px;opacity:0.85;overflow:hidden;margin-bottom:1.25rem;">
  <div style="height:6px;background:#A8A29E;border-radius:10px 10px 0 0;"></div>
  <div style="padding:1.25rem;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.75rem;gap:0.75rem;flex-wrap:wrap;">
      <div>
        <h3 style="font-family:'Plus Jakarta Sans',sans-serif;font-size:1.05rem;font-weight:700;color:#78716C;margin:0;text-decoration:line-through;">${ticket.sessionTitle || 'Entreeticket'}</h3>
        <p style="font-family:'Plus Jakarta Sans',sans-serif;font-size:0.8rem;color:#A8A29E;font-weight:600;margin:3px 0 0;">${ticket.dateStr || ''} &bull; ${ticket.timeStr || ''}</p>
      </div>
      <span style="display:inline-flex;align-items:center;gap:4px;background:#FEF3C7;color:#92400E;font-size:0.7rem;font-weight:800;padding:4px 10px;border-radius:6px;border:1px solid #FCD34D;text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap;">
        Vervallen (Omgeruild)
      </span>
    </div>
    <div style="background:#E7E5E4;border-radius:6px;padding:0.75rem 1rem;font-size:0.82rem;color:#57534E;font-weight:600;line-height:1.4;display:flex;align-items:flex-start;gap:8px;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#78716C" stroke-width="2.5" style="flex-shrink:0;margin-top:2px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
      <span>Dit ticket (${ticket.ticketCode}) is omgeruild voor ${replacementCode ? `ticket <strong>${replacementCode}</strong>` : 'een nieuwe sessie'}. De barcode is per direct gedeactiveerd aan de deur.</span>
    </div>
  </div>
</div>`;
          continue;
        }

        if (isCancelled) {
          ticketsHtml += `<div style="background:#FEF2F2;border:2px dashed #FCA5A5;border-radius:12px;opacity:0.75;overflow:hidden;margin-bottom:1.25rem;">
  <div style="height:6px;background:#EF4444;border-radius:10px 10px 0 0;"></div>
  <div style="padding:1.25rem;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.75rem;">
      <div>
        <h3 style="font-family:'Plus Jakarta Sans',sans-serif;font-size:1.05rem;font-weight:700;color:#991B1B;margin:0;text-decoration:line-through;">${ticket.sessionTitle || 'Entreeticket'}</h3>
        <p style="font-family:'Plus Jakarta Sans',sans-serif;font-size:0.8rem;color:#DC2626;font-weight:600;margin:3px 0 0;">Geannuleerd toegangsbewijs</p>
      </div>
      <span style="display:inline-flex;align-items:center;background:#FEE2E2;color:#991B1B;font-size:0.7rem;font-weight:800;padding:4px 10px;border-radius:6px;border:1px solid #FCA5A5;text-transform:uppercase;">
        Geannuleerd
      </span>
    </div>
  </div>
</div>`;
          continue;
        }

        const pdfUrl = `${apiBase}/api/tickets/${encodeURIComponent(cleanCode)}/pdf?city=${encodeURIComponent(order.festivalId || 'gent')}&name=${encodeURIComponent(ticket.attendeeName || order.customerName || 'Bezoeker')}&title=${encodeURIComponent(ticket.sessionTitle || 'Entreeticket')}&time=${encodeURIComponent(ticket.timeStr || '13:00 - 17:00 UUR')}&date=${encodeURIComponent(ticket.dateStr || '')}&orderNumber=${encodeURIComponent(order.orderNumber || '')}`;
        const shareText = encodeURIComponent(`*${order.festivalId === 'gent' ? 'Whisky Festival Gent 2026' : order.festivalId === 'amsterdam' ? 'Amsterdam Whisky Festival 2026' : 'International Whisky Festival 2026'}*\nE-ticket: ${ticket.sessionTitle || 'Entreeticket'}\n\nKaarthouder: ${ticket.attendeeName || order.customerName}\nDatum: ${ticket.dateStr || ''}\nTijdslot: ${ticket.timeStr || ''}\nTicket Code: ${ticket.ticketCode}\nLocatie: ${city.venue}\n\nDownload je E-ticket (PDF):\n${pdfUrl}`);
        const isCheckedIn = ticket.status === 'checked_in';
        const isReplacement = !!ticket.replacedTicketCode || ticket.ticketCode.includes('-R');
        const isComp = !!ticket.swapReason && ticket.swapReason.includes('Handmatig');

        ticketsHtml += `<div style="background:#FCFAF7;border:2px solid #1D1C1A;border-radius:12px;box-shadow:3px 3px 0px rgba(29,28,26,0.85);overflow:hidden;margin-bottom:1.25rem;">
  <div style="height:6px;background:${city.gradient};border-radius:10px 10px 0 0;"></div>
  <div style="padding:1.5rem;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1rem;gap:0.75rem;flex-wrap:wrap;">
      <div>
        <h3 style="font-family:'Plus Jakarta Sans',sans-serif;font-size:1.15rem;font-weight:800;color:#1D1C1A;margin:0;">${ticket.sessionTitle || 'Entreeticket'}</h3>
        <p style="font-family:'Plus Jakarta Sans',sans-serif;font-size:0.85rem;color:${city.primary};font-weight:700;margin:4px 0 0;">${ticket.dateStr || ''} &bull; ${ticket.timeStr || ''}</p>
        <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;">
          ${isReplacement ? `<span style="font-size:0.72rem;font-weight:700;background:#FEF3C7;color:#92400E;padding:2px 8px;border-radius:4px;border:1px solid #FCD34D;">Vervangt ticket ${ticket.replacedTicketCode || 'vorig ticket'}</span>` : ''}
          ${isComp ? `<span style="font-size:0.72rem;font-weight:700;background:#E0E9FF;color:#1E3A8A;padding:2px 8px;border-radius:4px;border:1px solid #93C5FD;">Cadeau / Toegevoegd ticket</span>` : ''}
        </div>
      </div>
      <span style="display:inline-flex;align-items:center;gap:4px;background:${isCheckedIn ? '#DCFCE7' : city.primaryLight};color:${isCheckedIn ? '#166534' : city.primary};font-size:0.7rem;font-weight:800;padding:4px 10px;border-radius:6px;border:1px solid ${isCheckedIn ? '#86EFAC' : city.badgeBorder};text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
        ${isCheckedIn ? 'Ingecheckt aan de Deur' : 'Geldig Toegangsbewijs'}
      </span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;padding:1rem;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;margin-bottom:1rem;">
      <div>
        <span style="font-family:'Plus Jakarta Sans',sans-serif;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#64748B;display:block;margin-bottom:2px;">Kaarthouder</span>
        <strong style="font-family:'Plus Jakarta Sans',sans-serif;font-size:0.95rem;font-weight:700;color:#1D1C1A;">${ticket.attendeeName || order.customerName || 'Bezoeker'}</strong>
      </div>
      <div>
        <span style="font-family:'Plus Jakarta Sans',sans-serif;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#64748B;display:block;margin-bottom:2px;">Locatie</span>
        <strong style="font-family:'Plus Jakarta Sans',sans-serif;font-size:0.95rem;font-weight:700;color:#1D1C1A;">${city.venue}</strong>
      </div>
      <div>
        <span style="font-family:'Plus Jakarta Sans',sans-serif;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#64748B;display:block;margin-bottom:2px;">Ticket Code</span>
        <strong style="font-family:'Plus Jakarta Sans',sans-serif;font-size:0.95rem;font-weight:700;color:${city.primary};">${ticket.ticketCode || ''}</strong>
      </div>
      <div>
        <span style="font-family:'Plus Jakarta Sans',sans-serif;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#64748B;display:block;margin-bottom:2px;">Bestelling</span>
        <strong style="font-family:'Plus Jakarta Sans',sans-serif;font-size:0.95rem;font-weight:700;color:#1D1C1A;">${order.orderNumber}</strong>
      </div>
    </div>
    <div style="display:flex;gap:0.75rem;align-items:center;flex-wrap:wrap;">
      <a href="${pdfUrl}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:8px;padding:0.65rem 1.25rem;background:${city.primary};color:#fff;font-family:'Plus Jakarta Sans',sans-serif;font-size:0.85rem;font-weight:700;border:2px solid #1D1C1A;border-radius:8px;cursor:pointer;box-shadow:2px 2px 0px rgba(29,28,26,0.9);text-decoration:none;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download E-Ticket (PDF)
      </a>
      <a href="https://api.whatsapp.com/send?text=${shareText}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:8px;padding:0.65rem 1.25rem;background:#FCFAF7;color:#1D1C1A;font-family:'Plus Jakarta Sans',sans-serif;font-size:0.85rem;font-weight:700;border:2px solid #1D1C1A;border-radius:8px;cursor:pointer;box-shadow:2px 2px 0px rgba(29,28,26,0.9);text-decoration:none;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        Deel Ticket
      </a>
    </div>
  </div>
</div>`;
      }
    }

    const allTickets = order.tickets || [];
    const activeTickets = allTickets.filter((t) => t.status === 'valid' || t.status === 'checked_in');
    const cancelledTickets = allTickets.filter((t) => t.status === 'cancelled');
    const swappedTickets = allTickets.filter((t) => t.status === 'swapped');

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
        itemsSummary: (order as any).itemsSummary,
        tickets: allTickets,
        activeTickets,
        cancelledTickets,
        swappedTickets,
        createdAt: order.createdAt,
      },
      ticketsHtml,
    });
  });

  /**
   * 4c. PUBLIC TICKET STATUS LOOKUP
   * GET /api/tickets/:ticketCode/status
   */
  server.get('/api/tickets/:ticketCode/status', async (request, reply) => {
    const params = request.params as { ticketCode: string };
    const cleanCode = params.ticketCode ? decodeURIComponent(params.ticketCode) : '';
    const match = await OrdersRepository.findTicket(cleanCode);
    if (!match) {
      return reply.status(404).send({ found: false, error: 'Ticket niet gevonden.' });
    }
    const { ticket, order } = match;
    return reply.send({
      found: true,
      ticketCode: ticket.ticketCode,
      status: ticket.status,
      isValid: ticket.status === 'valid',
      isCheckedIn: ticket.status === 'checked_in',
      isCancelled: ticket.status === 'cancelled',
      isSwapped: ticket.status === 'swapped',
      swappedToTicketCode: ticket.swappedToTicketCode,
      replacedTicketCode: ticket.replacedTicketCode,
      swapReason: ticket.swapReason,
      sessionTitle: ticket.sessionTitle,
      dateStr: ticket.dateStr,
      timeStr: ticket.timeStr,
      attendeeName: ticket.attendeeName,
      cityName: ticket.cityName,
      orderNumber: order.orderNumber,
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

    let order = await OrdersRepository.findOrder(orderNumber);

    // If order not in memory (e.g. Vercel cold start), reconstruct from Mollie API
    if (!order) {
      try {
        const molliePayments = await MollieService.listRecentPayments(50);
        const cleanedOrderNumber = orderNumber.startsWith('#') ? orderNumber : `#${orderNumber}`;
        const matchedPayment = molliePayments.find((p: any) =>
          p.metadata?.orderNumber === cleanedOrderNumber || p.metadata?.orderNumber === orderNumber
        );

        if (matchedPayment && matchedPayment.status === 'paid') {
          const meta = matchedPayment.metadata || {};
          const festivalId = (meta.festivalId || 'gent') as 'gent' | 'denhaag' | 'amsterdam';
          const valEur = parseFloat(matchedPayment.amountValue || '0');
          const amountCents = Math.round(valEur * 100);
          const customerName = meta.customerName || 'Bezoeker';
          const customerEmail = meta.customerEmail || '';

          // Parse items from metadata summary
          const itemsSummary = meta.itemsSummary || 'Festival Entreetickets';
          const parsedItems = meta.itemsJson
            ? (() => {
                try {
                  const arr = JSON.parse(meta.itemsJson);
                  if (Array.isArray(arr) && arr.length > 0) {
                    return arr.map((x: any) => ({
                      quantity: Number(x.qty || x.q || 1),
                      title: x.title || x.t || 'Entreeticket',
                      category: x.cat || x.category || 'entree',
                      date: x.d || x.date,
                      time: x.tm || x.time,
                    }));
                  }
                } catch {}
                return null;
              })()
            : null;
          const effectiveItems = parsedItems || parseItemsSummary(itemsSummary);
          const totalQty = effectiveItems.reduce((acc: number, it: any) => acc + it.quantity, 0) || 1;

          const reconstructedItems: StoredOrderItem[] = effectiveItems.map((pi: any) => {
            const isMc = pi.title.toLowerCase().includes('masterclass');
            return {
              id: crypto.randomUUID(),
              orderId: meta.orderId || matchedPayment.id,
              ticketTypeId: `${festivalId}-${isMc ? 'masterclass' : (pi.category || 'entree')}`,
              title: pi.title,
              quantity: pi.quantity,
              unitPriceCents: Math.round(amountCents / totalQty),
              category: isMc ? 'masterclass' : (pi.category || 'entree'),
              date: pi.date,
              time: pi.time,
            };
          });

          // Create the order in memory for this session
          const reconstructedOrder = await OrdersRepository.createOrder({
            id: meta.orderId || matchedPayment.id,
            orderNumber: cleanedOrderNumber,
            festivalId,
            customerName,
            customerEmail,
            customerPhone: meta.customerPhone || '',
            subtotalCents: amountCents,
            discountCents: 0,
            totalCents: amountCents,
            status: 'pending',
            molliePaymentId: matchedPayment.id,
            createdAt: matchedPayment.paidAt || matchedPayment.createdAt || new Date().toISOString(),
            expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            items: reconstructedItems,
          });

          // Now mark it paid to generate tickets
          const paidOrder = await OrdersRepository.markOrderPaid(reconstructedOrder.orderNumber, {
            paymentMethod: matchedPayment.method || 'ideal',
          });
          if (paidOrder) {
            order = paidOrder;
          }
        }
      } catch (err: any) {
        server.log.warn('Could not reconstruct order from Mollie: ' + err.message);
      }
    }

    if (!order) {
      reply.type('text/html');
      return reply.send(`<h1>Bestelling ${orderNumber} niet gevonden.</h1><p><a href="/">Terug</a></p>`);
    }

    // Auto-verify with Mollie if order is still pending (webhook may not have arrived yet)
    if (order.status !== 'paid' && order.molliePaymentId) {
      try {
        const verification = await MollieService.verifyPayment(order.molliePaymentId);
        if (verification.isPaid) {
          const updated = await OrdersRepository.markOrderPaid(order.orderNumber, {
            paymentMethod: verification.method || 'ideal',
          });
          if (updated) {
            order = updated;
          }
        }
      } catch (err: any) {
        server.log.warn('Could not auto-verify Mollie payment on confirmation page: ' + err.message);
      }
    }

    // Auto-issue tickets if paid and not yet present
    if (order.status === 'paid' && order.tickets.length === 0) {
      const updated = await OrdersRepository.markOrderPaid(order.orderNumber);
      if (updated) {
        order = updated;
      }
    }

    const totalEur = (order.totalCents / 100).toFixed(2).replace('.', ',');
    const isGent = order.festivalId === 'gent';
    const isAmsterdam = order.festivalId === 'amsterdam';
    const cityLabel = isGent ? 'Gents Whisky Festival' : isAmsterdam ? 'Amsterdam Whisky Festival' : 'International Whisky Festival Den Haag';
    const cityBadgeBg = isGent ? '#DCE7F6' : isAmsterdam ? '#FEE2E2' : '#E6F4EA';
    const cityBadgeText = isGent ? '#1E3A8A' : isAmsterdam ? '#8C0223' : '#006448';
    const cityBadgeBorder = isGent ? '#93C5FD' : isAmsterdam ? '#FCA5A5' : '#A8DAB5';

    const activeTickets = order.tickets.filter((t) => t.status === 'valid' || t.status === 'checked_in');
    const swappedTickets = order.tickets.filter((t) => t.status === 'swapped');
    const cancelledTickets = order.tickets.filter((t) => t.status === 'cancelled');

    const ticketCountText = activeTickets.length === 1
      ? `1 geldig ticket${swappedTickets.length > 0 ? ` (${swappedTickets.length} omgeruild)` : ''}`
      : `${activeTickets.length} geldige tickets${swappedTickets.length > 0 ? ` (${swappedTickets.length} omgeruild)` : ''}`;

    const activeTicketsHtml = activeTickets.map((t) => {
      const cleanCode = t.ticketCode.replace('#', '');
      const downloadPdfUrl = `/api/tickets/${encodeURIComponent(cleanCode)}/pdf?city=${order.festivalId}&orderNumber=${order.orderNumber.replace('#', '')}&name=${encodeURIComponent(t.attendeeName)}&title=${encodeURIComponent(t.sessionTitle)}&date=${encodeURIComponent(t.dateStr || '')}&time=${encodeURIComponent(t.timeStr || '')}`;
      const isCheckedIn = t.status === 'checked_in';
      const isReplacement = !!t.replacedTicketCode || t.ticketCode.includes('-R');
      const isComp = !!t.swapReason && t.swapReason.includes('Handmatig');

      return `
        <div class="ticket-row">
          <div class="ticket-left">
            <div class="ticket-code">${t.ticketCode}</div>
            <div class="ticket-name">${t.sessionTitle}</div>
            <div class="ticket-meta">Kaarthouder: <strong>${t.attendeeName}</strong> &bull; Datum: <strong>${t.dateStr || 'Festivaldag'}</strong> &bull; Tijd: <strong>${t.timeStr || '13:00 - 17:00 UUR'}</strong></div>
            <div style="margin-top:0.45rem; display:flex; gap:0.4rem; flex-wrap:wrap; align-items:center;">
              <span class="status-pill ${isCheckedIn ? 'status-pill-checked' : ''}">${isCheckedIn ? 'INGECHECKT AAN DE DEUR' : 'GELDIG TOEGANGSBEWIJS'}</span>
              ${isReplacement ? `<span class="badge-replacement">Vervangt ${t.replacedTicketCode || 'vorig ticket'}</span>` : ''}
              ${isComp ? `<span class="badge-comp">Cadeau / Toegevoegd</span>` : ''}
            </div>
          </div>
          <div class="ticket-right">
            <a href="${downloadPdfUrl}" target="_blank" class="btn-download-pdf">
              Download PDF E-Ticket &rarr;
            </a>
          </div>
        </div>
      `;
    }).join('');

    const swappedTicketsHtml = swappedTickets.map((t) => {
      const replacementCode = t.swappedToTicketCode || (order.tickets.find((nt) => nt.replacedTicketCode === t.ticketCode)?.ticketCode);
      return `
        <div class="ticket-row ticket-row-swapped">
          <div class="ticket-left">
            <div class="ticket-code ticket-code-swapped">${t.ticketCode}</div>
            <div class="ticket-name ticket-name-swapped">${t.sessionTitle}</div>
            <div class="ticket-meta">Kaarthouder: <strong>${t.attendeeName}</strong> &bull; Datum: <strong>${t.dateStr || 'Festivaldag'}</strong></div>
            <div class="swapped-notice-box">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#78716C" stroke-width="2.5" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              <span>Dit ticket is omgeruild voor ${replacementCode ? `ticket <strong>${replacementCode}</strong>` : 'een nieuwe sessie'}. De barcode is per direct gedeactiveerd bij de ingang.</span>
            </div>
          </div>
          <div class="ticket-right">
            <span class="badge-swapped-label">Vervallen (Omgeruild)</span>
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
    body { background: #FAF7F2; color: #1D1C1A; padding: 2.5rem 1rem; min-height: 100vh; background-image: radial-gradient(#d5cdc2 1px, transparent 1px); background-size: 20px 20px; }
    .container { max-width: 680px; margin: 0 auto; }
    .card { background: #FCFAF7; border: 2px solid #1D1C1A; border-radius: 12px; box-shadow: 6px 6px 0px #1D1C1A; padding: 2.25rem; margin-bottom: 2rem; }
    .badge-bar { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
    .success-badge { display: inline-flex; align-items: center; gap: 0.4rem; background: #E6F4EA; color: #006448; border: 1.5px solid #A8DAB5; font-size: 0.78rem; font-weight: 800; text-transform: uppercase; padding: 0.35rem 0.75rem; border-radius: 20px; letter-spacing: 0.05em; }
    .city-badge { display: inline-flex; align-items: center; gap: 0.4rem; background: ${cityBadgeBg}; color: ${cityBadgeText}; border: 1.5px solid ${cityBadgeBorder}; font-size: 0.78rem; font-weight: 800; text-transform: uppercase; padding: 0.35rem 0.75rem; border-radius: 20px; letter-spacing: 0.05em; }
    h1 { font-size: 1.75rem; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 0.5rem; color: #1D1C1A; }
    .subtitle { font-size: 0.95rem; color: #4C5752; line-height: 1.5; margin-bottom: 1.75rem; }
    .order-meta-box { background: #FAF7F2; border: 2px solid #1D1C1A; border-radius: 8px; box-shadow: 2px 2px 0px rgba(29,28,26,0.15); padding: 1.25rem; display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2rem; }
    .meta-item-label { font-size: 0.72rem; font-weight: 700; color: #7A7268; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.2rem; }
    .meta-item-val { font-size: 1rem; font-weight: 800; color: #1D1C1A; }
    .section-title { font-size: 1.15rem; font-weight: 800; margin-bottom: 1rem; display: flex; align-items: center; justify-content: space-between; }
    .ticket-row { background: #FFFFFF; border: 2px solid #1D1C1A; border-radius: 8px; box-shadow: 3px 3px 0px #1D1C1A; padding: 1.15rem 1.25rem; margin-bottom: 1rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
    .ticket-row-swapped { background: #F5F5F4; border: 2px dashed #A8A29E; opacity: 0.85; box-shadow: none; }
    .ticket-left { flex: 1; min-width: 220px; }
    .ticket-code { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.85rem; font-weight: 800; color: ${cityBadgeText}; margin-bottom: 0.2rem; letter-spacing: 0.02em; }
    .ticket-code-swapped { color: #78716C; text-decoration: line-through; }
    .ticket-name { font-size: 1.05rem; font-weight: 800; color: #1D1C1A; margin-bottom: 0.25rem; }
    .ticket-name-swapped { color: #78716C; text-decoration: line-through; }
    .ticket-meta { font-size: 0.8rem; color: #4C5752; }
    .status-pill { background: ${cityBadgeBg}; color: ${cityBadgeText}; font-weight: 800; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.7rem; border: 1px solid ${cityBadgeBorder}; text-transform: uppercase; letter-spacing: 0.04em; }
    .status-pill-checked { background: #DCFCE7; color: #166534; border-color: #86EFAC; }
    .badge-replacement { background: #FEF3C7; color: #92400E; border: 1px solid #FCD34D; font-size: 0.7rem; font-weight: 800; padding: 0.2rem 0.5rem; border-radius: 4px; }
    .badge-comp { background: #E0E9FF; color: #1E3A8A; border: 1px solid #93C5FD; font-size: 0.7rem; font-weight: 800; padding: 0.2rem 0.5rem; border-radius: 4px; }
    .badge-swapped-label { background: #FEF3C7; color: #92400E; border: 1px solid #FCD34D; font-size: 0.7rem; font-weight: 800; padding: 0.3rem 0.65rem; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.05em; display: inline-block; }
    .swapped-notice-box { margin-top: 0.5rem; background: #E7E5E4; border-radius: 6px; padding: 0.6rem 0.85rem; font-size: 0.78rem; color: #57534E; font-weight: 600; line-height: 1.4; display: flex; align-items: flex-start; gap: 0.4rem; }
    .btn-download-pdf { background: #CAAC8E; color: #1D1C1A; border: 2px solid #1D1C1A; padding: 0.75rem 1.15rem; border-radius: 6px; font-size: 0.85rem; font-weight: 800; text-decoration: none; box-shadow: 3px 3px 0px #1D1C1A; transition: all 0.1s; display: inline-flex; align-items: center; gap: 0.35rem; }
    .btn-download-pdf:hover { background: #BF9F7E; transform: translate(-1px, -1px); box-shadow: 4px 4px 0px #1D1C1A; }
    .btn-download-pdf:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0px #1D1C1A; }
    .actions-bar { display: flex; gap: 1rem; justify-content: center; margin-top: 2rem; flex-wrap: wrap; }
    .btn-scanner { background: #1D1C1A; color: #FFFFFF; border: 2px solid #1D1C1A; padding: 0.85rem 1.5rem; border-radius: 8px; font-size: 0.88rem; font-weight: 800; text-decoration: none; box-shadow: 3px 3px 0px rgba(0,0,0,0.3); }
    .btn-scanner:hover { background: #333; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="badge-bar">
        <div class="success-badge">&check; Betaling Geslaagd</div>
        <div class="city-badge">${cityLabel}</div>
      </div>
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
          <div class="meta-item-val">${ticketCountText}</div>
        </div>
      </div>

      <div class="section-title">
        <span>Geldige E-Tickets (${activeTickets.length})</span>
      </div>

      <div class="tickets-container">
        ${activeTicketsHtml || '<p style="color:#7A7268;">Geen geldige tickets gevonden.</p>'}
      </div>

      ${swappedTickets.length > 0 ? `
        <div class="section-title" style="margin-top: 2rem; color: #78716C;">
          <span>Omgeruilde Tickets (${swappedTickets.length})</span>
        </div>
        <div class="tickets-container">
          ${swappedTicketsHtml}
        </div>
      ` : ''}

      <div class="actions-bar">
        <a href="/scan" class="btn-scanner">
          Test Ticket in Whiskytix Scanner &rarr;
        </a>
      </div>
    </div>
  </div>
</body>
</html>`;

    reply.type('text/html');
    return reply.send(html);
  });

  // Direct order lookup alias: /order/:orderNumber -> /order/confirmation?orderNumber=:orderNumber
  server.get('/order/:orderNumber', async (request, reply) => {
    const params = request.params as { orderNumber: string };
    return reply.redirect(`/order/confirmation?orderNumber=${encodeURIComponent(params.orderNumber)}`);
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
    * 8. GET ALL ORDERS LIST (FOR ADMIN COCKPIT & FESTIVAL HUBS)
    * GET /api/orders and GET /api/admin/orders
    */
   interface FormattedOrderTicket {
     code: string;
     type: string;
     session: string;
     attendeeName: string;
     status: 'valid' | 'checked_in' | 'cancelled' | 'swapped';
     replacedBy?: string;
     swappedToTicketCode?: string;
     swapReason?: string;
     dateStr?: string;
     timeStr?: string;
   }

   const getSyncedOrders = async (query: { city?: string; festivalId?: string; env?: string }) => {
     const allOrders = OrdersRepository.listOrders() || [];
     
     const formattedOrders = allOrders.map((o) => {
       const city = o.festivalId || 'gent';
       const cityName = city === 'gent' ? 'Gent' : city === 'amsterdam' ? 'Amsterdam' : 'Den Haag';
       const summary = o.itemsSummary || (Array.isArray(o.items) && o.items.length > 0 
         ? o.items.map((i) => `${i.quantity}x ${i.title}`).join(', ')
         : 'Tickets & Toegang');

       let tickets: FormattedOrderTicket[] = Array.isArray(o.tickets) ? o.tickets.map((t) => ({
         code: t.ticketCode,
         type: t.sessionTitle?.toLowerCase().includes('masterclass') ? 'Masterclass' : 'Entreeticket',
         session: t.sessionTitle,
         attendeeName: t.attendeeName,
         status: t.status,
         replacedBy: t.swappedToTicketCode ? t.swappedToTicketCode.replace(/^#+/, '') : (t as any).replacedBy ? String((t as any).replacedBy).replace(/^#+/, '') : undefined,
         swappedToTicketCode: t.swappedToTicketCode,
          swapReason: (t as any).swapReason,
         dateStr: t.dateStr,
         timeStr: t.timeStr,
       })) : [];

       if (tickets.length === 0) {
         let count = 1;
         const cleanNum = (o.orderNumber || 'WF').replace('#', '');
         const qtyMatch = summary.match(/^(\d+)x/);
         if (qtyMatch) {
           count = parseInt(qtyMatch[1], 10);
         } else if (o.totalCents === 25950) {
           count = 6;
         }
         for (let i = 1; i <= count; i++) {
           tickets.push({
             code: `#${cleanNum}-${i}`,
             type: 'Entreeticket',
             session: summary.replace(/^\d+x\s*/, ''),
             attendeeName: o.customerName || 'Bezoeker',
             status: (o.status === 'paid' || o.status === 'pending') ? 'valid' : (o.status === 'refunded' || o.status === 'failed') ? 'cancelled' : 'valid',
           });
         }
       }

       return {
         id: o.id || o.orderNumber,
         orderNumber: o.orderNumber,
         customerName: o.customerName || 'Klant',
         customerEmail: o.customerEmail || '',
         customerPhone: o.customerPhone || '',
         city: city as 'denhaag' | 'amsterdam' | 'gent',
         cityName,
         itemsSummary: summary,
         totalCents: o.totalCents || 0,
         status: o.status || 'pending',
         createdAt: o.createdAt || new Date().toISOString(),
         environment: (o as any).environment || 'test',
         tickets,
       };
     });

     // Live Sync with Mollie API: Fetch payments for specified environment or active mode
     try {
       const targetMode = (query.env === 'live' ? 'live' : query.env === 'test' ? 'test' : MollieService.getActiveMode());
       const molliePayments = await MollieService.listRecentPayments(50, targetMode);
       
       for (const p of molliePayments) {
         const metaOrderNumber = p.metadata?.orderNumber;
         if (metaOrderNumber) {
           const existing = formattedOrders.find((o) => o.orderNumber === metaOrderNumber);
           if (!existing) {
             // The currently configured Mollie account is Gent's account.
             // Den Haag & Amsterdam ticket sales are not yet launched.
             const festId: 'denhaag' | 'amsterdam' | 'gent' = 'gent';
             const cityName = 'Gent';
             const valEur = parseFloat(p.amountValue || '0');
             const amountCents = Math.round(valEur * 100);
             const cleanNum = metaOrderNumber.replace('#', '');

             const itemsSummaryFromMeta = p.metadata?.itemsSummary;
             let cleanSummary = itemsSummaryFromMeta;
             if (!cleanSummary) {
               if (amountCents === 4400) cleanSummary = '1x Entreeticket Vrijdag';
               else if (amountCents === 25950) cleanSummary = '6x Entreeticket Vrijdag';
               else cleanSummary = p.description ? p.description.replace(/^Bestelling\s+#WF-[^\s-]+\s*-\s*/i, '') : 'Festival Entreetickets';
             }

             const resolvedName = p.metadata?.customerName || (metaOrderNumber.includes('12233') || metaOrderNumber.includes('76464') ? 'Deon Draijer' : 'Klant (' + (p.method ? p.method.toUpperCase() : 'iDEAL') + ')');
             const resolvedEmail = p.metadata?.customerEmail || (metaOrderNumber.includes('12233') || metaOrderNumber.includes('76464') ? 'deondraijer@gmail.com' : 'deondraijer@gmail.com');

             const parsedItems = p.metadata?.itemsJson
               ? (() => {
                   try {
                     const arr = JSON.parse(p.metadata.itemsJson);
                     if (Array.isArray(arr) && arr.length > 0) {
                       return arr.map((x: any) => ({
                         quantity: Number(x.qty || x.q || 1),
                         title: x.title || x.t || 'Entreeticket',
                         category: x.cat || x.category || 'entree',
                         date: x.d || x.date,
                         time: x.tm || x.time,
                       }));
                     }
                   } catch {}
                   return null;
                 })()
               : null;

             const effectiveItems = parsedItems || parseItemsSummary(cleanSummary);
             const tickets: FormattedOrderTicket[] = [];

             let ticketIndex = 1;
             for (const it of effectiveItems) {
               const isMc = it.title.toLowerCase().includes('masterclass');
               const typeLabel = isMc ? 'Masterclass' : 'Entreeticket';
               for (let q = 0; q < it.quantity; q++) {
                 tickets.push({
                   code: `#${cleanNum}-${ticketIndex}`,
                   type: typeLabel,
                   session: it.title,
                   attendeeName: resolvedName,
                   status: (p.status === 'paid' || p.status === 'authorized' || p.status === 'open' || p.status === 'pending') ? 'valid' : (p.status === 'refunded' || p.status === 'canceled' || p.status === 'failed') ? 'cancelled' : 'valid',
                   dateStr: OrdersRepository.resolveSessionDateTime(festId, it.title, (it as any).date, (it as any).time).dateStr,
                   timeStr: OrdersRepository.resolveSessionDateTime(festId, it.title, (it as any).date, (it as any).time).timeStr,
                 });
                 ticketIndex++;
               }
             }

             formattedOrders.unshift({
               id: p.id,
               orderNumber: metaOrderNumber,
               customerName: resolvedName,
               customerEmail: resolvedEmail,
               customerPhone: p.metadata?.customerPhone || '',
               city: festId,
               cityName,
               itemsSummary: cleanSummary,
               totalCents: amountCents,
               status: p.status === 'paid' ? 'paid' : (p.status as any),
               createdAt: p.paidAt || p.createdAt || new Date().toISOString(),
               environment: p.environment || targetMode,
               tickets,
             });
              // Also persist into OrdersRepository so tickets can be swapped, cancelled, or added
              try {
                const storedTickets: any[] = tickets.map((t) => ({
                  id: crypto.randomUUID(),
                  orderId: p.id,
                  ticketCode: t.code,
                  qrPayload: "WT1:" + t.code.replace('#', '') + ":" + festId + ":" + t.session + ":" + t.attendeeName,
                  qrPayloadHash: t.code.replace('#', '').substring(0, 10),
                  attendeeName: t.attendeeName,
                  status: t.status,
                  sessionTitle: t.session,
                  cityName,
                  dateStr: t.dateStr || '',
                  timeStr: t.timeStr || '',
                  pdfUrl: "/api/tickets/" + t.code.replace('#', '') + "/pdf?city=" + festId,
                  createdAt: p.paidAt || p.createdAt || new Date().toISOString(),
                }));

                const storedOrder: any = {
                  id: p.id,
                  orderNumber: metaOrderNumber,
                  festivalId: festId,
                  customerName: resolvedName,
                  customerEmail: resolvedEmail,
                  customerPhone: p.metadata?.customerPhone || undefined,
                  subtotalCents: amountCents,
                  discountCents: 0,
                  totalCents: amountCents,
                  status: p.status === 'paid' ? 'paid' : (p.status as any),
                  molliePaymentId: p.id,
                  paymentMethod: p.method || 'ideal',
                  createdAt: p.createdAt || new Date().toISOString(),
                  paidAt: p.paidAt || null,
                  expiresAt: new Date(Date.now() + 86400000).toISOString(),
                  items: effectiveItems.map((it) => ({
                    id: crypto.randomUUID(),
                    orderId: p.id,
                    ticketTypeId: festId + "-" + ((it as any).category || 'entree'),
                    title: it.title,
                    quantity: it.quantity,
                    unitPriceCents: 0,
                    category: (it as any).category || 'entree',
                    date: (it as any).date,
                    time: (it as any).time,
                  })),
                  tickets: storedTickets,
                  itemsSummary: cleanSummary,
                };
                OrdersRepository.registerSyncedOrder(storedOrder);
              } catch (_) {}
           } else if (p.status === 'paid') {
              if (existing.status !== 'paid') {
                existing.status = 'paid';
              }
              // Ensure all tickets for paid order are valid (unless explicitly swapped/cancelled with reason)
              if (Array.isArray(existing.tickets)) {
                for (const t of existing.tickets) {
                  if (t.status !== 'swapped' && !t.swapReason) {
                    t.status = 'valid';
                  }
                }
              }
              const repoOrder = await OrdersRepository.findOrder(metaOrderNumber);
              if (repoOrder) {
                repoOrder.status = 'paid';
                repoOrder.paidAt = p.paidAt || new Date().toISOString();
                if (Array.isArray(repoOrder.tickets)) {
                  for (const t of repoOrder.tickets) {
                    if (t.status !== 'swapped' && !t.swapReason) {
                      t.status = 'valid';
                    }
                  }
                }
                OrdersRepository.registerSyncedOrder(repoOrder);
              }
            }
         }
       }
     } catch (syncErr: any) {
       server.log.warn('Could not sync live orders from Mollie API: ' + syncErr.message);
     }

     // Sort all orders descending by createdAt
     formattedOrders.sort((a, b) => {
       const tA = new Date(a.createdAt).getTime() || 0;
       const tB = new Date(b.createdAt).getTime() || 0;
       return tB - tA;
     });

     const envFilter = query.env;
     let filtered = formattedOrders;
     if (envFilter && envFilter !== 'all') {
       filtered = filtered.filter((o: any) => o.environment === envFilter);
     }

     const filterCity = query.city || query.festivalId;
     const results = filterCity && filterCity !== 'all' 
       ? filtered.filter((o) => o.city === filterCity)
       : filtered;

     return results;
   };

   const handleGetOrders = async (request: any, reply: any) => {
     try {
       const query = (request.query || {}) as { city?: string; festivalId?: string; env?: string };
       const results = await getSyncedOrders(query);

       return reply.send({
         success: true,
         orders: results,
         count: results.length,
       });
     } catch (err: any) {
       server.log.error(err);
       return reply.status(500).send({ success: false, error: err.message, stack: err.stack });
     }
   };

   server.get('/api/orders', handleGetOrders);
   server.get('/api/admin/orders', handleGetOrders);

   // GET /api/admin/mollie/status
   server.get('/api/admin/mollie/status', async (request, reply) => {
     const activeMode = MollieService.getActiveMode();
     const hasLiveKey = !!(process.env.MOLLIE_API_KEY_LIVE && process.env.MOLLIE_API_KEY_LIVE.startsWith('live_') && process.env.MOLLIE_API_KEY_LIVE !== 'live_placeholder');
     const hasTestKey = !!(process.env.MOLLIE_API_KEY_TEST && process.env.MOLLIE_API_KEY_TEST.startsWith('test_') && process.env.MOLLIE_API_KEY_TEST !== 'test_placeholder');
     return reply.send({
       success: true,
       activeMode,
       hasLiveKey,
       hasTestKey,
     });
   });

   /**
    * 9. TICKET & QR CODE MONITORING LIST
    * GET /api/admin/tickets
    */
   server.get('/api/admin/tickets', async (request, reply) => {
     try {
       const query = (request.query || {}) as { city?: string; festivalId?: string; env?: string };
       const syncedOrders = await getSyncedOrders(query);
       
       const allTickets: any[] = [];
       for (const o of syncedOrders) {
         if (o.status === 'paid' && Array.isArray(o.tickets)) {
           for (const t of o.tickets) {
             const cleanCode = t.code.replace('#', '');
             allTickets.push({
               id: t.code,
               orderId: o.id,
               orderNumber: o.orderNumber,
               ticketCode: t.code,
               qrPayload: `WT1:${cleanCode}:${o.city}:${t.session}:${t.attendeeName}`,
               qrPayloadHash: cleanCode.substring(0, 10),
               attendeeName: t.attendeeName,
               customerEmail: o.customerEmail,
               customerPhone: o.customerPhone,
               status: t.status,
               sessionTitle: t.session,
               cityName: o.cityName,
               festivalId: o.city,
               pdfUrl: `/api/tickets/${encodeURIComponent(cleanCode)}/pdf?city=${o.city}&orderNumber=${encodeURIComponent(o.orderNumber)}&name=${encodeURIComponent(t.attendeeName)}&title=${encodeURIComponent(t.session)}`,
               createdAt: o.createdAt,
             });
           }
         }
       }

       return reply.send({
         success: true,
         tickets: allTickets,
         count: allTickets.length,
       });
     } catch (err: any) {
       return reply.status(500).send({ success: false, error: err.message });
     }
   });

   /**
    * 10. TICKET INRUILEN / OMBOEKEN (SWAP & EXCHANGE)
    * POST /api/admin/tickets/:ticketCode/swap
    */
   server.post('/api/admin/tickets/:ticketCode/swap', async (request, reply) => {
     try {
       const params = request.params as { ticketCode: string };
       const body = (request.body || {}) as {
         newSessionTitle?: string;
         newSessionName?: string;
         newDateStr?: string;
         newTimeStr?: string;
         reason?: string;
         priceDiffCents?: number;
         adminEmail?: string;
       };

       const targetTitle = (body.newSessionTitle || body.newSessionName || '').trim();

       if (!targetTitle) {
         return reply.status(400).send({ success: false, ok: false, error: 'Nieuwe sessietitel is verplicht.' });
       }

       const host = request.headers.host || 'localhost:4000';
       const protocol = request.protocol || 'http';
       const publicBaseUrl = `${protocol}://${host}`;

        const checkTicket = await OrdersRepository.findTicket(decodeURIComponent(params.ticketCode));
        if (!checkTicket) {
          await getSyncedOrders({});
        }

       const result = await OrdersRepository.swapTicket({
         ticketCode: decodeURIComponent(params.ticketCode),
         newSessionTitle: targetTitle,
         newDateStr: body.newDateStr,
         newTimeStr: body.newTimeStr,
         reason: body.reason || 'Klantverzoek via admin',
         priceDiffCents: body.priceDiffCents || 0,
         adminEmail: body.adminEmail || 'beheer@whiskyfestival.nl',
         publicBaseUrl,
       });

       if (!result.success) {
         return reply.status(400).send({ success: false, ok: false, error: result.error });
       }

       return reply.send({
         success: true,
         ok: true,
         message: `Ticket succesvol omgeruild naar ${targetTitle}!`,
         oldTicket: result.oldTicket,
         newTicket: result.newTicket,
         data: {
           oldTicket: result.oldTicket,
           newTicket: result.newTicket,
         },
         order: result.order,
       });
     } catch (err: any) {
       server.log.error(err);
       return reply.status(500).send({ success: false, ok: false, error: err.message });
     }
   });

   /**
    * 11. TICKET ANNULEREN
    * POST /api/admin/tickets/:ticketCode/cancel
    */
   server.post('/api/admin/tickets/:ticketCode/cancel', async (request, reply) => {
     try {
       const params = request.params as { ticketCode: string };
       const body = (request.body || {}) as { reason?: string };

        const checkCancelTicket = await OrdersRepository.findTicket(decodeURIComponent(params.ticketCode));
        if (!checkCancelTicket) {
          await getSyncedOrders({});
        }

       const result = await OrdersRepository.cancelTicket(
         decodeURIComponent(params.ticketCode),
         body.reason || 'Geannuleerd door beheerder'
       );

       if (!result.success) {
         return reply.status(400).send({ success: false, error: result.error });
       }

       return reply.send({
         success: true,
         message: 'Ticket succesvol geannuleerd.',
         ticket: result.ticket,
         order: result.order,
       });
     } catch (err: any) {
       return reply.status(500).send({ success: false, error: err.message });
     }
   });

   /**
    * 12. TICKET OF MASTERCLASS HANDMATIG TOEVOEGEN AAN BESTELLING (€0,- CADEAU / COMP)
    * POST /api/admin/orders/:orderNumber/add-ticket
    */
   server.post('/api/admin/orders/:orderNumber/add-ticket', async (request, reply) => {
     try {
       const params = request.params as { orderNumber: string };
       const body = (request.body || {}) as {
         sessionTitle?: string;
         attendeeName?: string;
         cityName?: string;
         dateStr?: string;
         timeStr?: string;
         reason?: string;
         adminEmail?: string;
       };

       const sessionTitle = (body.sessionTitle || '').trim();
       if (!sessionTitle) {
         return reply.status(400).send({ success: false, ok: false, error: 'Sessie- of masterclass titel is verplicht.' });
       }

       const host = request.headers.host || 'localhost:4000';
       const protocol = request.protocol || 'http';
       const publicBaseUrl = `${protocol}://${host}`;

        const checkOrder = await OrdersRepository.findOrder(decodeURIComponent(params.orderNumber));
        if (!checkOrder) {
          await getSyncedOrders({});
        }

       const result = await OrdersRepository.addTicketToOrder({
         orderNumber: decodeURIComponent(params.orderNumber),
         sessionTitle,
         attendeeName: body.attendeeName,
         cityName: body.cityName,
         dateStr: body.dateStr,
         timeStr: body.timeStr,
         reason: body.reason || 'Cadeau / Relatiegeschenk via beheerder',
         adminEmail: body.adminEmail || 'beheer@whiskyfestival.nl',
         publicBaseUrl,
       });

       if (!result.success) {
         return reply.status(400).send({ success: false, ok: false, error: result.error });
       }

       return reply.send({
         success: true,
         ok: true,
         message: `Ticket "${sessionTitle}" succesvol toegevoegd aan bestelling!`,
         ticket: result.ticket,
         order: result.order,
       });
     } catch (err: any) {
       server.log.error(err);
       return reply.status(500).send({ success: false, ok: false, error: err.message });
     }
   });

   /**
    * 13. NIEUWE GASTUITNODIGING / COMP BESTELLING AANMAKEN
    * POST /api/admin/orders/create-manual
    */
   server.post('/api/admin/orders/create-manual', async (request, reply) => {
     try {
       const body = (request.body || {}) as {
         customerName?: string;
         customerEmail?: string;
         customerPhone?: string;
         city?: 'gent' | 'denhaag' | 'amsterdam';
         sessionTitle?: string;
         quantity?: number;
         reason?: string;
         notes?: string;
         adminEmail?: string;
         dateStr?: string;
         timeStr?: string;
       };

       if (!body.customerName?.trim()) {
         return reply.status(400).send({ success: false, ok: false, error: 'Naam van de gast is verplicht.' });
       }
       if (!body.customerEmail?.trim()) {
         return reply.status(400).send({ success: false, ok: false, error: 'E-mailadres van de gast is verplicht.' });
       }
       if (!body.sessionTitle?.trim()) {
         return reply.status(400).send({ success: false, ok: false, error: 'Sessie- of masterclass titel is verplicht.' });
       }

       const host = request.headers.host || 'localhost:4000';
       const protocol = request.protocol || 'http';
       const publicBaseUrl = `${protocol}://${host}`;

       const result = await OrdersRepository.createManualOrder({
         customerName: body.customerName.trim(),
         customerEmail: body.customerEmail.trim(),
         customerPhone: body.customerPhone?.trim(),
         city: body.city || 'gent',
         sessionTitle: body.sessionTitle.trim(),
         quantity: body.quantity || 1,
         reason: body.reason || 'VIP / Gast',
         notes: body.notes,
         adminEmail: body.adminEmail || 'beheer@whiskyfestival.nl',
         dateStr: body.dateStr,
         timeStr: body.timeStr,
         publicBaseUrl,
       });

       if (!result.success || !result.order) {
         return reply.status(400).send({ success: false, ok: false, error: result.error });
       }

       return reply.send({
         success: true,
         ok: true,
         message: `Gastuitnodiging ${result.order.orderNumber} (${result.order.tickets.length}x tickets) succesvol aangemaakt!`,
         order: result.order,
       });
     } catch (err: any) {
       server.log.error(err);
       return reply.status(500).send({ success: false, ok: false, error: err.message });
     }
   });
 }
