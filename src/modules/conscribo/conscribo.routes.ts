// src/modules/conscribo/conscribo.routes.ts
import { FastifyInstance } from 'fastify';
import { ConscriboService } from './conscribo.service.js';

export async function registerConscriboRoutes(server: FastifyInstance): Promise<void> {
  server.get('/api/admin/iws-members', async (request, reply) => {
    try {
      const query = (request.query || {}) as { refresh?: string };
      const forceRefresh = query.refresh === 'true' || query.refresh === '1';

      const { members, stats } = await ConscriboService.getMembersAndStats(forceRefresh);

      return reply.send({
        success: true,
        stats,
        members,
      });
    } catch (err: any) {
      server.log.error(err, 'Conscribo IWS members fetch error');
      return reply.status(500).send({
        success: false,
        error: err?.message || 'Kon IWS ledenbestand niet ophalen uit Conscribo.',
      });
    }
  });

  server.post('/api/admin/iws-members', async (request, reply) => {
    try {
      const body = (request.body || {}) as any;
      if (!body.lidnummer || !body.volledigeNaam) {
        return reply.status(400).send({
          success: false,
          error: 'Lidnummer en volledige naam zijn verplicht.',
        });
      }

      const member = await ConscriboService.addManualMember({
        lidnummer: String(body.lidnummer),
        volledigeNaam: String(body.volledigeNaam),
        email: body.email ? String(body.email) : undefined,
        telefoon: body.telefoon ? String(body.telefoon) : undefined,
        straat: body.straat ? String(body.straat) : undefined,
        huisnummer: body.huisnummer ? String(body.huisnummer) : undefined,
        postcode: body.postcode ? String(body.postcode) : undefined,
        plaats: body.plaats ? String(body.plaats) : undefined,
        land: body.land ? String(body.land) : 'Nederland',
        typeLidmaatschap: body.typeLidmaatschap ? String(body.typeLidmaatschap) : 'Basis',
        totaalBedrag: body.totaalBedrag !== undefined ? Number(body.totaalBedrag) : 67.5,
        lidSinds: body.lidSinds ? String(body.lidSinds) : undefined,
      });

      return reply.send({
        success: true,
        member,
      });
    } catch (err: any) {
      server.log.error(err, 'Conscribo add manual member error');
      return reply.status(500).send({
        success: false,
        error: err?.message || 'Kon nieuw IWS-lid niet toevoegen.',
      });
    }
  });

  server.post('/api/admin/iws-members/claim', async (request, reply) => {
    try {
      const body = (request.body || {}) as {
        lidnummer?: string;
        festivalId?: string;
        orderNumber?: string;
        customerEmail?: string;
        customerName?: string;
      };
      if (!body.lidnummer || !body.festivalId) {
        return reply.status(400).send({
          success: false,
          error: 'Lidnummer en festival zijn verplicht.',
        });
      }

      const claim = await ConscriboService.recordClaim({
        lidnummer: body.lidnummer,
        festivalId: body.festivalId,
        orderNumber: body.orderNumber || 'HANDMATIG',
        customerEmail: body.customerEmail,
        customerName: body.customerName,
      });

      return reply.send({
        success: true,
        claim,
      });
    } catch (err: any) {
      server.log.error(err, 'Conscribo record claim error');
      return reply.status(500).send({
        success: false,
        error: err?.message || 'Kon IWS festival-claim niet opslaan.',
      });
    }
  });

  server.delete('/api/admin/iws-members/claim/:lidnummer', async (request, reply) => {
    try {
      const params = request.params as { lidnummer: string };
      const released = await ConscriboService.releaseClaim(params.lidnummer);
      return reply.send({
        success: true,
        released,
      });
    } catch (err: any) {
      server.log.error(err, 'Conscribo release claim error');
      return reply.status(500).send({
        success: false,
        error: err?.message || 'Kon IWS festival-claim niet vrijgeven.',
      });
    }
  });
}
