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
      if (!forceRefresh) {
        reply.header('Cache-Control', 'public, s-maxage=8, stale-while-revalidate=25');
      }
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
        message: 'Catalogus succesvol ververst vanuit Leadfabriek CRM',
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

  /**
   * 4. PATCH /api/catalog/:id
   * Werkt capaciteit en/of uitverkocht-status van een GHL ticket direct bij
   */
  server.patch('/api/catalog/:id', async (request, reply) => {
    try {
      const params = request.params as { id: string };
      const body = (request.body || {}) as { capacity?: number; isSoldOut?: boolean };
      const result = await GhlCatalogService.updateTicketInGhl(params.id, {
        capacity: body.capacity !== undefined ? Number(body.capacity) : undefined,
        isSoldOut: body.isSoldOut !== undefined ? Boolean(body.isSoldOut) : undefined,
      });
      if (!result.success) {
        return reply.status(400).send(result);
      }
      return reply.send(result);
    } catch (err: any) {
      server.log.error(err);
      return reply.status(500).send({
        success: false,
        error: 'Fout bij bijwerken ticketcapaciteit in GHL: ' + err.message,
      });
    }
  });
}
