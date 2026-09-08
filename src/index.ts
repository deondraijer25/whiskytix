import dotenv from 'dotenv';
import { buildServer } from './server.js';

dotenv.config();

const PORT = parseInt(process.env.PORT || '4000', 10);
const HOST = '0.0.0.0';

async function start() {
  try {
    const server = await buildServer();
    await server.listen({ port: PORT, host: HOST });
    console.log(`🥃 Whiskytix Fastify Engine draait op: http://localhost:${PORT}`);
  } catch (err) {
    console.error('Fout bij starten van Whiskytix:', err);
    process.exit(1);
  }
}

start();
