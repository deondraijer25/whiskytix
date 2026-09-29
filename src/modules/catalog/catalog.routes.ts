import { FastifyInstance } from 'fastify';
import { GhlCatalogService } from '../ghl/ghl.catalog.service.js';

export async function registerCatalogRoutes(server: FastifyInstance): Promise<void> {
  /**
   * 1. GET /api/catalog
   * Haalt de actuele ticketcatalogus op (gecachet of live uit GHL)
   */
  server.get('/api/catalog', async (request, reply) => {
    try {
      const query = (request.query || {}) as { city?: string; refresh?: string };
      const forceRefresh = query.refresh === 'true' || query.refresh === '1';
      const result = await GhlCatalogService.getCatalog(query.city, forceRefresh);
      return reply.send(result);
    } catch (err: any) {
      server.log.error(err);
      return reply.status(500).send({
        success: false,
        error: 'Fout bij ophalen ticketcatalogus: ' + err.message,
      });
    }
  });

  /**
   * 2. GET /api/catalog/stats
   * Haalt alleen de realtime capaciteiten en statistieken op per festivalstad
   */
  server.get('/api/catalog/stats', async (request, reply) => {
    try {
      const result = await GhlCatalogService.getCatalog('all');
      return reply.send({
        success: true,
        source: result.source,
        timestamp: result.timestamp,
        stats: result.stats,
      });
    } catch (err: any) {
      server.log.error(err);
      return reply.status(500).send({
        success: false,
        error: 'Fout bij ophalen catalogus statistieken: ' + err.message,
      });
    }
  });

  /**
   * 3. POST /api/catalog/refresh
   * Geforceerde herlaadbeurt vanuit GHL
   */
  server.post('/api/catalog/refresh', async (request, reply) => {
    try {
      GhlCatalogService.clearCache();
      const result = await GhlCatalogService.getCatalog('all', true);
      return reply.send({
        success: true,
        message: 'Catalogus succesvol ververst vanuit GoHighLevel',
        totalRecords: result.totalRecords,
        stats: result.stats,
      });
    } catch (err: any) {
      server.log.error(err);
      return reply.status(500).send({
        success: false,
        error: 'Fout bij verversen catalogus: ' + err.message,
      });
    }
  });
}
