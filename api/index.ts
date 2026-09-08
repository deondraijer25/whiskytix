import { buildServer } from '../src/server.js';

let app: any;

export default async function handler(req: any, res: any) {
  if (!app) {
    app = await buildServer();
    await app.ready();
  }
  app.server.emit('request', req, res);
}
