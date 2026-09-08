import { buildServer } from '../src/server.js';

let app: any;

export default async function handler(req: any, res: any) {
  try {
    if (!app) {
      app = await buildServer();
      await app.ready();
    }
    app.server.emit('request', req, res);
  } catch (err: any) {
    console.error('Vercel handler error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: 'Vercel handler initialization failed',
      message: err?.message,
      stack: err?.stack,
    }));
  }
}
