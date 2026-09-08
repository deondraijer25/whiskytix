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

      // Strict password verification (default password: whisky2026)
      const isValidAdmin =
        email === 'beheer@whiskyfestival.nl' && password === 'whisky2026';

      if (!isValidAdmin) {
        return reply.status(401).send({ error: 'Onjuist e-mailadres of wachtwoord.' });
      }

      // Set secure session cookie
      reply.setCookie('whiskytix_session', 'session_token_' + Buffer.from(email).toString('base64'), {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 8, // 30 days or 8 hours
      });

      return reply.send({
        success: true,
        user: {
          name: 'Deon Draijer',
          email: 'beheer@whiskyfestival.nl',
          role: 'admin',
        },
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
    const sessionCookie = request.cookies.whiskytix_session;
    if (!sessionCookie) {
      return reply.status(401).send({ authenticated: false });
    }
    return reply.send({
      authenticated: true,
      user: {
        name: 'Deon Draijer',
        email: 'beheer@whiskyfestival.nl',
        role: 'admin',
      },
    });
  });

  // Official Vector A4 PDF E-Ticket Generator endpoint
  server.get('/api/tickets/:ticketCode/pdf', async (request, reply) => {
    const params = request.params as { ticketCode: string };
    const query = (request.query || {}) as Record<string, string>;

    const cleanCode = params.ticketCode ? decodeURIComponent(params.ticketCode) : 'WF-2026-84387-1';
    const formattedCode = cleanCode.startsWith('#') ? cleanCode : `#${cleanCode}`;

    const pdfBytes = await generateTicketPdf({
      ticketCode: formattedCode,
      orderNumber: query.orderNumber || 'WF1861',
      attendeeName: query.name || 'Deon Draijer',
      cityName: query.city || 'denhaag',
      sessionTitle:
        query.title ||
        (query.session === 'masterclass'
          ? 'ZONDAGMIDDAG + MASTERCLASS'
          : query.session === 'zaterdag_middag'
          ? 'ZATERDAGMIDDAG SESSIE'
          : 'VIP SESSIE — VRIJDAG'),
      dateStr:
        query.session === 'zaterdag_middag'
          ? 'Zaterdag 14 november 2026'
          : 'Vrijdag 13 november 2026',
      timeStr:
        query.time ||
        (query.session === 'vip_vrijdag'
          ? '13:00 - 17:00 UUR'
          : '13:30 - 17:30 UUR'),
      itemNumber: query.itemNumber || '1/1',
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

  // 6. Statische bestanden serveren indien client build aanwezig is
  const distPath = path.join(__dirname, '..', 'dist');
  if (fs.existsSync(distPath)) {
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
