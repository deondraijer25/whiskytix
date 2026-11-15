import { buildServer } from '../src/server.js';

let appPromise: Promise<any> | null = null;

export default async function handler(req: any, res: any) {
  try {
    if (!appPromise) {
      appPromise = (async () => {
        const instance = await buildServer();
        await instance.ready();
        return instance;
      })();
    }
    const app = await appPromise;

    await new Promise<void>((resolve) => {
      res.once('finish', resolve);
      res.once('close', resolve);
      app.server.emit('request', req, res);
    });
  } catch (err: any) {
    appPromise = null;
    console.error('Vercel handler error:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          error: 'Vercel handler initialization failed',
          message: err?.message,
        })
      );
    }
  }
}
