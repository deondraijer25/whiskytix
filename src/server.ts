import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { checkDbConnection } from './db/index.js';
import { generateTicketPdf } from './modules/tickets/pdf.service.js';
import { registerCheckoutRoutes } from './modules/checkout/checkout.routes.js';
import { startStockCleanupWorker } from './modules/orders/stock-cleanup.worker.js';
import { UsersRepository } from './modules/auth/users.repository.js';
import { OrdersRepository } from './modules/orders/orders.repository.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function buildServer(): Promise<FastifyInstance> {
  const server = Fastify({
    logger: true,
  });

  // 1. CORS plugin
  await server.register(cors, {
    origin: true,
    credentials: true,
  });

  // 2. Cookie plugin for secure HttpOnly session tokens
  await server.register(cookie, {
    secret: process.env.SCANNER_HMAC_SECRET || 'whiskytix_cookie_secret_2026',
    parseOptions: {},
  });

  // 3. Rate-limiting plugin (Brute-force protection)
  await server.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // 4. API Endpoints
  // Health check
  server.get('/api/health', async (request, reply) => {
    const dbStatus = await checkDbConnection();
    return {
      status: 'ok',
      service: 'whiskytix',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      database: dbStatus,
    };
  });

  // Helper to extract authenticated user from cookie
  const getAuthenticatedUser = (request: any) => {
    const sessionCookie = request.cookies.whiskytix_session;
    if (!sessionCookie || !sessionCookie.startsWith('session_token_')) return null;
    try {
      const emailBase64 = sessionCookie.replace('session_token_', '');
      const email = Buffer.from(emailBase64, 'base64').toString('utf8');
      const user = UsersRepository.getByEmail(email);
      if (user) {
        const { passwordHash, ...safe } = user;
        return safe;
      }
      return { email, name: 'Beheerder', role: 'admin' };
    } catch {
      return null;
    }
  };

  // Rate-limited Auth endpoint (max 5 requests per minute per IP)
  server.post(
    '/api/auth/login',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const body = request.body as any;
      const { email, password, rememberMe } = body || {};

      if (!email || !password) {
        return reply.status(400).send({ error: 'E-mailadres en wachtwoord zijn verplicht.' });
      }

      // Verify credentials against UsersRepository (bcrypt hash + storage)
      const verifiedUser = await UsersRepository.verifyCredentials(email, password);

      if (!verifiedUser) {
        return reply.status(401).send({ error: 'Onjuist e-mailadres of wachtwoord.' });
      }

      // Set secure session cookie
      reply.setCookie('whiskytix_session', 'session_token_' + Buffer.from(verifiedUser.email).toString('base64'), {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 8, // 30 days or 8 hours
      });

      return reply.send({
        success: true,
        user: verifiedUser,
      });
    }
  );

  // Logout endpoint
  server.post('/api/auth/logout', async (request, reply) => {
    reply.clearCookie('whiskytix_session', { path: '/' });
    return reply.send({ success: true });
  });

  // Current user endpoint
  server.get('/api/auth/me', async (request, reply) => {
    const user = getAuthenticatedUser(request);
    if (!user) {
      return reply.status(401).send({ authenticated: false });
    }
    return reply.send({
      authenticated: true,
      user,
    });
  });

  // --- Admin Users & Team Management Endpoints ---

  // GET /api/admin/users - List all users
  server.get('/api/admin/users', async (request, reply) => {
    const users = UsersRepository.getAll();
    return reply.send({ success: true, users });
  });

  // POST /api/admin/users - Create new administrator or scanner
  server.post('/api/admin/users', async (request, reply) => {
    const body = request.body as any;
    const { name, email, password, role, pinCode, assignedFestivalId } = body || {};

    if (!name || !email || !password) {
      return reply.status(400).send({ error: 'Naam, e-mailadres en wachtwoord zijn verplicht.' });
    }

    if (password.length < 6) {
      return reply.status(400).send({ error: 'Het wachtwoord moet minimaal 6 tekens lang zijn.' });
    }

    try {
      const newUser = await UsersRepository.create({
        name,
        email,
        password,
        role: role || 'admin',
        pinCode: pinCode || '2026',
        assignedFestivalId: assignedFestivalId || 'all',
      });
      return reply.status(201).send({ success: true, user: newUser });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // PUT /api/admin/users/:id - Update user details, role, password or PIN
  server.put('/api/admin/users/:id', async (request, reply) => {
    const params = request.params as { id: string };
    const body = request.body as any;

    try {
      const updatedUser = await UsersRepository.update(params.id, body);
      return reply.send({ success: true, user: updatedUser });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // DELETE /api/admin/users/:id - Delete a user
  server.delete('/api/admin/users/:id', async (request, reply) => {
    const params = request.params as { id: string };
    const currentUser = getAuthenticatedUser(request);

    try {
      const success = await UsersRepository.delete(params.id, currentUser?.email);
      if (!success) {
        return reply.status(404).send({ error: 'Gebruiker niet gevonden.' });
      }
      return reply.send({ success: true, message: 'Gebruiker succesvol verwijderd.' });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // Official Vector A4 PDF E-Ticket Generator endpoint
  server.get('/api/tickets/:ticketCode/pdf', async (request, reply) => {
    const params = request.params as { ticketCode: string };
    const query = (request.query || {}) as Record<string, string>;

    const cleanCode = params.ticketCode ? decodeURIComponent(params.ticketCode) : 'WF-2026-84387-1';
    const formattedCode = cleanCode.startsWith('#') ? cleanCode : `#${cleanCode}`;

    // Lookup existing ticket / order in repository if available
    const matched = await OrdersRepository.findTicket(cleanCode);
    const order = matched?.order;
    const ticket = matched?.ticket;

    const resolvedCity = (query.city || ticket?.cityName || order?.festivalId || 'denhaag').toLowerCase();
    const resolvedOrderNumber = (query.orderNumber || order?.orderNumber || 'WF1861').replace(/^#+/, '');
    const resolvedAttendeeName = query.name || ticket?.attendeeName || order?.customerName || 'Deon Draijer';

    const rawSessionTitle = query.title || ticket?.sessionTitle || (order?.items && order.items[0]?.title) ||
      (query.session === 'masterclass'
        ? 'ZONDAGMIDDAG + MASTERCLASS'
        : query.session === 'zaterdag_middag'
        ? 'ZATERDAGMIDDAG SESSIE'
        : 'VIP SESSIE — VRIJDAG');

    const titleLower = rawSessionTitle.toLowerCase();
    const cleanSessionTitle = rawSessionTitle.replace(/\s*(?:1[0-9]|2[0-3]):[0-5][0-9]\s*-\s*(?:1[0-9]|2[0-3]):[0-5][0-9]\s*(?:uur)?/gi, '').trim();

    const timeStr = query.time || ticket?.timeStr || (order?.items && (order.items[0]?.timeslot || order.items[0]?.time)) ||
      (titleLower.includes('avond') || (query.session && query.session.includes('avond'))
        ? '19:00 - 23:00 UUR'
        : (query.session === 'vip_vrijdag'
        ? '13:00 - 17:00 UUR'
        : '13:00 - 17:00 UUR'));

    const dateStr = query.date || ticket?.dateStr || (order?.items && order.items[0]?.date) || (
      resolvedCity.includes('gent')
        ? (titleLower.includes('zaterdag') ? 'Zaterdag 3 oktober 2026' : titleLower.includes('zondag') ? 'Zondag 4 oktober 2026' : 'Vrijdag 2 oktober 2026')
        : resolvedCity.includes('amsterdam')
        ? 'Zaterdag 16 januari 2027'
        : (query.session === 'zaterdag_middag' || titleLower.includes('zaterdag') ? 'Zaterdag 14 november 2026' : titleLower.includes('zondag') ? 'Zondag 15 november 2026' : 'Vrijdag 13 november 2026')
    );

    // Calculate itemNumber if multiple tickets in order
    let itemNumber = query.itemNumber;
    if (!itemNumber && order && order.tickets.length > 0) {
      const idx = order.tickets.findIndex((t) => t.ticketCode === formattedCode || t.ticketCode.replace(/^#/, '') === cleanCode.replace(/^#/, ''));
      if (idx !== -1) {
        itemNumber = `${idx + 1}/${order.tickets.length}`;
      } else {
        itemNumber = `1/${order.tickets.length}`;
      }
    }
    if (!itemNumber) itemNumber = '1/1';

    const pdfBytes = await generateTicketPdf({
      ticketCode: formattedCode,
      orderNumber: resolvedOrderNumber,
      attendeeName: resolvedAttendeeName,
      cityName: resolvedCity,
      sessionTitle: cleanSessionTitle,
      dateStr,
      timeStr,
      itemNumber,
    });

    reply.header('Content-Type', 'application/pdf');
    reply.header(
      'Content-Disposition',
      `inline; filename="E-Ticket-${cleanCode.replace('#', '')}.pdf"`
    );
    return reply.send(Buffer.from(pdfBytes));
  });

  // Direct redirect from /ticket to the PDF stream
  server.get('/ticket', async (request, reply) => {
    const query = (request.query || {}) as Record<string, string>;
    const code = query.code || query.id || 'WF-2026-84387-1';
    const cleanCode = code.replace('#', '');
    const queryString = new URLSearchParams(query).toString();
    return reply.redirect(`/api/tickets/${encodeURIComponent(cleanCode)}/pdf${queryString ? `?${queryString}` : ''}`);
  });

  server.get('/ticket/:ticketCode', async (request, reply) => {
    const params = request.params as { ticketCode: string };
    const query = (request.query || {}) as Record<string, string>;
    const cleanCode = (params.ticketCode || 'WF-2026-84387-1').replace('#', '');
    const queryString = new URLSearchParams(query).toString();
    return reply.redirect(`/api/tickets/${encodeURIComponent(cleanCode)}/pdf${queryString ? `?${queryString}` : ''}`);
  });

  // 5. Checkout & Payment Routes
  await registerCheckoutRoutes(server);

  // Start background 15-minute stock hold cleanup
  startStockCleanupWorker();

  // 6. Statische bestanden serveren indien client build aanwezig is
  const possibleDistPaths = [
    path.join(process.cwd(), 'dist'),
    path.join(__dirname, '..', 'dist'),
    path.join(__dirname, 'dist'),
  ];
  const distPath = possibleDistPaths.find((p) => fs.existsSync(p) && fs.existsSync(path.join(p, 'index.html')));

  if (distPath) {
    await server.register(fastifyStatic, {
      root: distPath,
      prefix: '/',
    });

    // SPA fallback route
    server.setNotFoundHandler((request, reply) => {
      if (request.raw.url && request.raw.url.startsWith('/api')) {
        return reply.status(404).send({ error: 'API endpoint niet gevonden' });
      }
      return reply.sendFile('index.html');
    });
  }

  return server;
}
