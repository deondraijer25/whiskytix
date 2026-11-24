import type { FastifyInstance } from 'fastify';

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_FIELD_OPTIN = 'retpT0hM1RLcpaj2qIKt';
const GHL_FIELD_CIJFER = 'QQ4JlPjIl1COFRw0Mvie';
const GHL_FIELD_VOORKEUR_FLES = '20z4rPP4tEpqPjFgLWeJ';

const MATRIX_LABELS: Record<string, string> = {
  matrix_locatie_sfeer: 'Locatie en sfeer',
  matrix_drukte_ingang: 'Drukte en doorloop ingang',
  matrix_drukte_kerk: 'Drukte en doorloop in de kerk',
  matrix_prijs_kwaliteit: 'Prijs-kwaliteitverhouding',
  matrix_eten_drinken: 'Eten en drinken naast de whisky',
  matrix_masterclasses: "Masterclasses en extra's",
  matrix_organisatie_vooraf: 'Organisatie & info (voorafgaand)',
  matrix_organisatie_tijdens: 'Organisatie & info (tijdens festival)',
};

export async function registerEnqueteRoutes(server: FastifyInstance) {
  server.post('/api/enquete', async (request, reply) => {
    const body = (request.body || {}) as Record<string, unknown>;
    const rawEmail = String(body.email || '').trim().toLowerCase();
    const firstName = String(body.first_name || '').trim();

    if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(rawEmail)) {
      return reply.status(400).send({ ok: false, error: 'Ongeldig e-mailadres' });
    }

    const ghlApiKey = process.env.GHL_API_KEY;
    const ghlLocationId = process.env.GHL_LOCATION_ID;

    if (!ghlApiKey || !ghlLocationId) {
      server.log.error('GHL_API_KEY of GHL_LOCATION_ID ontbreekt voor /api/enquete');
      return reply.status(500).send({ ok: false, error: 'CRM configuratie ontbreekt' });
    }

    const headers = {
      Authorization: `Bearer ${ghlApiKey}`,
      Version: '2021-07-28',
      'Content-Type': 'application/json',
    };

    const cijferNum = Number(body.algemeen_cijfer);
    const voorkeurFles = String(body.voorkeur_botteling || '').trim();
    const optinVal = String(body.nieuwsbrief_optin || 'Nee') === 'Ja' ? 'Ja' : 'Nee';

    const customFields: Array<{ id: string; field_value: string | number }> = [
      { id: GHL_FIELD_OPTIN, field_value: optinVal },
    ];
    if (!Number.isNaN(cijferNum) && cijferNum >= 1 && cijferNum <= 10) {
      customFields.push({ id: GHL_FIELD_CIJFER, field_value: cijferNum });
    }
    if (voorkeurFles) {
      customFields.push({ id: GHL_FIELD_VOORKEUR_FLES, field_value: voorkeurFles });
    }

    // 1. Upsert contact in GHL
    const upsertPayload: Record<string, unknown> = {
      locationId: ghlLocationId,
      email: rawEmail,
      tags: ['den-haag', 'enquete-2026-ingevuld'],
      customFields,
    };
    if (firstName) upsertPayload.firstName = firstName;

    const upsertRes = await fetch(`${GHL_API_BASE}/contacts/upsert`, {
      method: 'POST',
      headers,
      body: JSON.stringify(upsertPayload),
    });

    if (!upsertRes.ok) {
      const errTxt = await upsertRes.text();
      server.log.error({ status: upsertRes.status, errTxt }, 'GHL upsert failed for /api/enquete');
      return reply.status(502).send({ ok: false, error: 'Kon inzending niet opslaan in CRM' });
    }

    const upsertData = (await upsertRes.json()) as { contact?: { id?: string } };
    const contactId = upsertData.contact?.id;

    // 2. Save full survey answers as a structured Note on the contact
    if (contactId) {
      const matrixLines = Object.entries(MATRIX_LABELS)
        .map(([k, lbl]) => `- ${lbl}: ${body[k] ? `${body[k]}/5` : '-'}`)
        .join('\n');

      const noteBody = [
        `BEZOEKERSONDERZOEK DEN HAAG (${new Date().toISOString().slice(0, 10)})`,
        `==================================================`,
        `1. Algemeen cijfer: ${body.algemeen_cijfer || '-'}/10`,
        `2. NPS Aanbevelen: ${body.nps_aanbevelen ?? '-'}/10`,
        `3. Tevredenheid aanbod: ${body.aanbod_cijfer || '-'}/10`,
        ``,
        `4. Beoordeling onderdelen (1-5):`,
        matrixLines,
        ``,
        `5. Belangrijkste reden: ${body.belangrijkste_reden || '-'}`,
        `6. Bezoekfrequentie: ${body.bezoekfrequentie || '-'}`,
        `7. Gezelschap: ${body.gezelschap || '-'}`,
        `8. Leeftijdscategorie: ${body.leeftijd || '-'}`,
        `9. Hoe gehoord: ${body.hoe_gehoord || '-'}`,
        ``,
        `10. Nodig om vriend(in) mee te nemen: ${body.vriend_meenemen || '-'}`,
        `11. Gewenste whiskyregio's / merken: ${body.whisky_regios_merken || '-'}`,
        `12. Tips / opmerkingen: ${body.tips_opmerkingen || '-'}`,
        ``,
        `--- VERLOTING & OPT-IN ---`,
        `Voorkeur Lindores Abbey 2027: ${voorkeurFles || '-'}`,
        `Nieuwsbrief Opt-in: ${optinVal}`,
      ].join('\n');

      await fetch(`${GHL_API_BASE}/contacts/${contactId}/notes`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ body: noteBody }),
      }).catch((err) => {
        server.log.warn({ err }, 'Kon enquete-notitie niet opslaan in GHL');
      });
    }

    return reply.status(200).send({ ok: true, contactId: contactId || null });
  });
}
