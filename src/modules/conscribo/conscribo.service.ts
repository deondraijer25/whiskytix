// src/modules/conscribo/conscribo.service.ts
// Live Conscribo REST API Service & Cross-Festival Free Ticket Claim Registry for IWS

import fs from 'fs';
import path from 'path';
import os from 'os';
import { queryClient, checkDbConnection } from '../../db/index.js';

export interface IwsFestivalClaim {
  lidnummer: string;
  festivalId: 'denhaag' | 'gent' | 'amsterdam';
  festivalName: string; // 'Den Haag' | 'Gent' | 'Amsterdam'
  orderNumber: string;
  discountCents: number;
  customerEmail?: string;
  customerName?: string;
  claimedAt: string;
}

export interface IwsConscriboMember {
  id: string;
  lidnummer: string;
  aanhef: string;
  voorletters: string;
  roepnaam: string;
  tussenvoegsel: string;
  achternaam: string;
  volledigeNaam: string;
  geboortedatum: string;
  straat: string;
  huisnummer: string;
  toevoeging: string;
  postcode: string;
  plaats: string;
  land: string;
  adresVolledig: string;
  email: string;
  telefoon: string;
  mobiel: string;
  bedrijfsnaam: string;
  typeLidmaatschap: string;
  lidSinds: string;
  eindDatum: string;
  lidmaatschapsperiode: number;
  status: 'actief' | 'verlopen';
  contributieBedrag: number;
  magazineBedrag: number;
  bottelingLuxeBedrag: number;
  glasLuxeBedrag: number;
  totaalBedrag: number;
  betaalwijze: string;
  factuurmaand: string;
  iban: string;
  bic: string;
  rekeninghouder: string;
  wcoc: boolean;
  nieuwsbrief: boolean;
  privacyAkkoord: boolean;
  iwf2026: string;
  iwf2025: string;
  iwf2024: string;
  iwf2023: string;
  bottelingLuxe2026: string;
  bottelingLuxe2025: string;
  bottelingLuxe2024: string;
  opmerkingen: string;
  isManual?: boolean;
  claim?: IwsFestivalClaim | null;
}

export interface IwsConscriboStats {
  totalMembers: number;
  activeMembers: number;
  expiredMembers: number;
  totalAnnualRevenue: number;
  averageAnnualAmount: number;
  iwf2026Count: number;
  wcocCount: number;
  claimedCount: number;
  claimedByFestival: {
    denhaag: number;
    gent: number;
    amsterdam: number;
  };
  byType: Record<string, number>;
  byPaymentMethod: Record<string, number>;
  lastSyncedAt: string;
}

const REQUESTED_FIELDS = [
  'code',
  'aanhef',
  'voornaam',
  'roepnaam',
  'tussenvoegsel',
  'naam',
  'weergavenaam',
  'selector',
  'geboortedatum',
  'straatnaam',
  'huisnr',
  'huisnr_toev',
  'postcode',
  'plaats',
  'land',
  'adres',
  'e_mailadres',
  'telefoonnummer',
  'mobielnummer',
  'bedrijfsnaam',
  'type_lidmaatschap',
  'start_lidmaatschap',
  'eind_lidmaatschap',
  'lidmaatschapsperiode',
  'contributiebedrag',
  'magazinebedrag',
  'botteling_luxe',
  'glas_luxe',
  'betaalwijze',
  'factuurmaand',
  'bankrekeningnummer',
  'wcoc',
  'nieuwsbrief',
  'akkoord_privacy_verklaring',
  'iwf_2026',
  'iwf_2025',
  'iwf_2024',
  'iwf_2023',
  'botteling_luxe_2026',
  'botteling_luxe_2025',
  'botteling_luxe_2024',
  'opmerkingen',
];

const isVercel = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined;
const DATA_DIR = isVercel ? path.join(os.tmpdir(), '.data') : path.join(process.cwd(), '.data');
const CLAIMS_FILE = path.join(DATA_DIR, 'iws-claims-store.json');
const MANUAL_MEMBERS_FILE = path.join(DATA_DIR, 'iws-manual-members.json');

const memoryClaims: Map<string, IwsFestivalClaim> = new Map();
const memoryManualMembers: Map<string, IwsConscriboMember> = new Map();
let claimsDbInitialized = false;

function parseAmount(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0;
  const num = parseFloat(String(val).replace(',', '.'));
  return Number.isFinite(num) ? Math.round(num * 100) / 100 : 0;
}

export function normalizeFestivalId(raw?: string): 'denhaag' | 'gent' | 'amsterdam' {
  const s = (raw || '').trim().toLowerCase().replace(/[\s_-]/g, '');
  if (s.includes('gent')) return 'gent';
  if (s.includes('amsterdam') || s === 'ams') return 'amsterdam';
  return 'denhaag';
}

export function getFestivalDisplayName(festivalId: 'denhaag' | 'gent' | 'amsterdam'): string {
  if (festivalId === 'gent') return 'Gent';
  if (festivalId === 'amsterdam') return 'Amsterdam';
  return 'Den Haag';
}

/**
 * Normalizes any IWS discount/member input ("271", "#271", "WS-271", "WS271", "IWS-271", "IWS271")
 * into the canonical numeric lidnummer string (e.g. "271").
 * Returns null if the input does not look like an IWS member number.
 */
export function normalizeIwsLidnummer(rawCode: string): string | null {
  const trimmed = (rawCode || '').trim().toUpperCase();
  if (!trimmed) return null;

  const match = trimmed.match(/^(?:IWS|WS|LID)?[\s#_-]*0*(\d{1,6})$/i);
  if (!match) return null;
  return match[1];
}

export function hasExplicitIwsPrefix(rawCode: string): boolean {
  const trimmed = (rawCode || '').trim().toUpperCase();
  return /^(?:IWS|WS|LID)[\s#_-]*\d{1,6}$/i.test(trimmed);
}

/**
 * Returns the festival-specific 1x free ticket discount in cents and EUR:
 * - Den Haag: € 55,00 (5500 cents)
 * - Gent:     € 39,50 (3950 cents)
 * - Amsterdam: € 39,95 (3995 cents)
 */
export function getIwsDiscountForFestival(rawFestivalId?: string): {
  festivalId: 'denhaag' | 'gent' | 'amsterdam';
  festivalName: string;
  discountCents: number;
  discountEur: number;
  discountFormatted: string;
} {
  const festivalId = normalizeFestivalId(rawFestivalId);
  if (festivalId === 'gent') {
    return {
      festivalId: 'gent',
      festivalName: 'Gent',
      discountCents: 3950,
      discountEur: 39.5,
      discountFormatted: '39,50',
    };
  }
  if (festivalId === 'amsterdam') {
    return {
      festivalId: 'amsterdam',
      festivalName: 'Amsterdam',
      discountCents: 3995,
      discountEur: 39.95,
      discountFormatted: '39,95',
    };
  }
  return {
    festivalId: 'denhaag',
    festivalName: 'Den Haag',
    discountCents: 5500,
    discountEur: 55,
    discountFormatted: '55,00',
  };
}

function ensureLocalStores() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(CLAIMS_FILE)) {
      fs.writeFileSync(CLAIMS_FILE, JSON.stringify({ claims: [] }, null, 2), 'utf8');
    }
    if (!fs.existsSync(MANUAL_MEMBERS_FILE)) {
      fs.writeFileSync(MANUAL_MEMBERS_FILE, JSON.stringify({ members: [] }, null, 2), 'utf8');
    }
  } catch (err) {
    console.warn('[ConscriboService] Could not initialize local store files:', err);
  }
}

function loadLocalStores() {
  ensureLocalStores();
  try {
    if (fs.existsSync(CLAIMS_FILE)) {
      const raw = fs.readFileSync(CLAIMS_FILE, 'utf8').replace(/^\uFEFF/, '').trim();
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.claims)) {
        memoryClaims.clear();
        for (const c of parsed.claims) {
          if (c && c.lidnummer) {
            const norm = normalizeIwsLidnummer(String(c.lidnummer)) || String(c.lidnummer).trim();
            memoryClaims.set(norm, {
              ...c,
              lidnummer: norm,
              festivalId: normalizeFestivalId(c.festivalId),
              festivalName: getFestivalDisplayName(normalizeFestivalId(c.festivalId)),
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn('[ConscriboService] Error loading claims store:', err);
  }

  try {
    if (fs.existsSync(MANUAL_MEMBERS_FILE)) {
      const raw = fs.readFileSync(MANUAL_MEMBERS_FILE, 'utf8').replace(/^\uFEFF/, '').trim();
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.members)) {
        memoryManualMembers.clear();
        for (const m of parsed.members) {
          if (m && m.lidnummer) {
            const norm = normalizeIwsLidnummer(String(m.lidnummer)) || String(m.lidnummer).trim();
            memoryManualMembers.set(norm, { ...m, lidnummer: norm, isManual: true });
          }
        }
      }
    }
  } catch (err) {
    console.warn('[ConscriboService] Error loading manual members store:', err);
  }
}

function saveClaimsStore() {
  try {
    ensureLocalStores();
    const claims = Array.from(memoryClaims.values());
    fs.writeFileSync(CLAIMS_FILE, JSON.stringify({ claims }, null, 2), 'utf8');
  } catch (err) {
    console.warn('[ConscriboService] Error saving claims store:', err);
  }
}

function saveManualMembersStore() {
  try {
    ensureLocalStores();
    const members = Array.from(memoryManualMembers.values());
    fs.writeFileSync(MANUAL_MEMBERS_FILE, JSON.stringify({ members }, null, 2), 'utf8');
  } catch (err) {
    console.warn('[ConscriboService] Error saving manual members store:', err);
  }
}

async function ensureClaimsDbReady(): Promise<boolean> {
  try {
    const status = await checkDbConnection();
    if (!status.ok) return false;
    if (!claimsDbInitialized) {
      await queryClient.unsafe(`
        CREATE TABLE IF NOT EXISTS iws_festival_claims (
          lidnummer text PRIMARY KEY,
          festival_id text NOT NULL,
          festival_name text NOT NULL,
          order_number text NOT NULL,
          discount_cents integer NOT NULL DEFAULT 0,
          customer_email text,
          customer_name text,
          claimed_at timestamptz NOT NULL DEFAULT now()
        );
      `);
      claimsDbInitialized = true;
    }
    return true;
  } catch {
    return false;
  }
}

loadLocalStores();

export class ConscriboService {
  private static sessionId: string | null = null;
  private static sessionExpiresAt = 0;

  private static cachedMembers: IwsConscriboMember[] | null = null;
  private static cachedStats: IwsConscriboStats | null = null;
  private static cacheExpiresAt = 0;
  private static readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  private static getConfig() {
    const accountName = process.env.CONSCRIBO_ACCOUNT_NAME || 'iws';
    const userName = process.env.CONSCRIBO_API_USER || 'LeadFab';
    const passPhrase = process.env.CONSCRIBO_API_PASSPHRASE || 'hUsve0-mizsyr-fozcit';
    const apiVersion = process.env.CONSCRIBO_API_VERSION || '1.20260414';
    const baseUrl = `https://api.secure.conscribo.nl/${accountName}`;
    return { accountName, userName, passPhrase, apiVersion, baseUrl };
  }

  private static async getSessionId(forceNew = false): Promise<string> {
    const now = Date.now();
    if (!forceNew && this.sessionId && now < this.sessionExpiresAt) {
      return this.sessionId;
    }

    const { baseUrl, userName, passPhrase, apiVersion } = this.getConfig();
    const res = await fetch(`${baseUrl}/sessions/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Conscribo-API-Version': apiVersion,
      },
      body: JSON.stringify({ userName, passPhrase }),
    });

    const data = (await res.json()) as any;
    if (!res.ok || !data?.sessionId) {
      const errMsg =
        data?.responseMessages?.error?.[0]?.message ||
        `Conscribo authenticatie mislukt (HTTP ${res.status})`;
      throw new Error(errMsg);
    }

    this.sessionId = data.sessionId;
    // Conscribo session lasts 30 mins by default; cache for 24 mins
    this.sessionExpiresAt = now + 24 * 60 * 1000;
    return this.sessionId!;
  }

  private static async fetchBatch(
    offset: number,
    limit: number,
    filters: Array<{ fieldName: string; operator: string; value: any }> = [],
    retryAuth = true
  ): Promise<{ resultCount: number; relations: Record<string, any> }> {
    const { baseUrl, apiVersion } = this.getConfig();
    const sessionId = await this.getSessionId();

    const res = await fetch(`${baseUrl}/relations/filters/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Conscribo-API-Version': apiVersion,
        'X-Conscribo-SessionId': sessionId,
      },
      body: JSON.stringify({
        entityType: 'persoon',
        requestedFields: REQUESTED_FIELDS,
        filters,
        limit,
        offset,
      }),
    });

    const data = (await res.json()) as any;
    const errCode = data?.responseMessages?.error?.[0]?.code;
    if ((res.status === 400 || res.status === 401) && errCode === 'API/NOT_AUTHENTICATED' && retryAuth) {
      await this.getSessionId(true);
      return this.fetchBatch(offset, limit, filters, false);
    }

    if (!res.ok || data?.status === 400) {
      const errMsg =
        data?.responseMessages?.error?.[0]?.message ||
        `Fout bij ophalen Conscribo relaties (HTTP ${res.status})`;
      throw new Error(errMsg);
    }

    return {
      resultCount: parseInt(String(data.resultCount || '0'), 10) || 0,
      relations: data.relations || {},
    };
  }

  private static mapRelation(entityId: string, raw: Record<string, any>, todayIso: string): IwsConscriboMember {
    const contributieBedrag = parseAmount(raw.contributiebedrag);
    const magazineBedrag = parseAmount(raw.magazinebedrag);
    const bottelingLuxeBedrag = parseAmount(raw.botteling_luxe);
    const glasLuxeBedrag = parseAmount(raw.glas_luxe);
    const totaalBedrag =
      Math.round((contributieBedrag + magazineBedrag + bottelingLuxeBedrag + glasLuxeBedrag) * 100) / 100;

    const eindDatum = raw.eind_lidmaatschap && raw.eind_lidmaatschap !== '0000-00-00'
      ? String(raw.eind_lidmaatschap).trim()
      : '';
    const lidSinds = raw.start_lidmaatschap && raw.start_lidmaatschap !== '0000-00-00'
      ? String(raw.start_lidmaatschap).trim()
      : '';

    const isActief = !eindDatum || eindDatum >= todayIso;
    const status: 'actief' | 'verlopen' = isActief ? 'actief' : 'verlopen';

    const straat = String(raw.straatnaam || '').trim();
    const huisnummer = String(raw.huisnr || '').trim();
    const toevoeging = String(raw.huisnr_toev || '').trim();
    const postcode = String(raw.postcode || '').trim();
    const plaats = String(raw.plaats || '').trim();
    const land = String(raw.land || 'Nederland').trim();

    const huisnrCompleet = [huisnummer, toevoeging].filter(Boolean).join(' ');
    const straatRegel = [straat, huisnrCompleet].filter(Boolean).join(' ');
    const plaatsRegel = [postcode, plaats].filter(Boolean).join(' ');
    const adresVolledig = [straatRegel, plaatsRegel].filter(Boolean).join(', ');

    const bank = raw.bankrekeningnummer && typeof raw.bankrekeningnummer === 'object'
      ? raw.bankrekeningnummer
      : {};

    const rawCode = String(raw.code || '').trim();
    const lidnummer = normalizeIwsLidnummer(rawCode) || rawCode;

    return {
      id: String(entityId),
      lidnummer,
      aanhef: String(raw.aanhef || '').trim(),
      voorletters: String(raw.voornaam || '').trim(),
      roepnaam: String(raw.roepnaam || '').trim(),
      tussenvoegsel: String(raw.tussenvoegsel || '').trim(),
      achternaam: String(raw.naam || '').trim(),
      volledigeNaam: String(raw.weergavenaam || '').trim(),
      geboortedatum: raw.geboortedatum && raw.geboortedatum !== '0000-00-00' ? String(raw.geboortedatum).trim() : '',
      straat,
      huisnummer,
      toevoeging,
      postcode,
      plaats,
      land,
      adresVolledig,
      email: String(raw.e_mailadres || '').trim(),
      telefoon: String(raw.telefoonnummer || '').trim(),
      mobiel: String(raw.mobielnummer || '').trim(),
      bedrijfsnaam: String(raw.bedrijfsnaam || '').trim(),
      typeLidmaatschap: String(raw.type_lidmaatschap || 'Onbekend').trim(),
      lidSinds,
      eindDatum,
      lidmaatschapsperiode: parseInt(String(raw.lidmaatschapsperiode || '12'), 10) || 12,
      status,
      contributieBedrag,
      magazineBedrag,
      bottelingLuxeBedrag,
      glasLuxeBedrag,
      totaalBedrag,
      betaalwijze: String(raw.betaalwijze || '').trim(),
      factuurmaand: String(raw.factuurmaand || '').trim(),
      iban: String(bank.iban || '').trim(),
      bic: String(bank.bic || '').trim(),
      rekeninghouder: String(bank.name || '').trim(),
      wcoc: Number(raw.wcoc) === 1,
      nieuwsbrief: Number(raw.nieuwsbrief) === 1,
      privacyAkkoord: Number(raw.akkoord_privacy_verklaring) === 1,
      iwf2026: String(raw.iwf_2026 || '').trim(),
      iwf2025: String(raw.iwf_2025 || '').trim(),
      iwf2024: String(raw.iwf_2024 || '').trim(),
      iwf2023: String(raw.iwf_2023 || '').trim(),
      bottelingLuxe2026: String(raw.botteling_luxe_2026 || '').trim(),
      bottelingLuxe2025: String(raw.botteling_luxe_2025 || '').trim(),
      bottelingLuxe2024: String(raw.botteling_luxe_2024 || '').trim(),
      opmerkingen: String(raw.opmerkingen || '').trim(),
    };
  }

  /**
   * Synchronize cross-festival claims from PostgreSQL/Supabase into memory & local disk
   */
  public static async syncClaimsFromDb(): Promise<void> {
    try {
      const ready = await ensureClaimsDbReady();
      if (!ready) return;

      const rows = await queryClient.unsafe('SELECT * FROM iws_festival_claims ORDER BY claimed_at DESC');
      if (Array.isArray(rows)) {
        for (const r of rows) {
          const norm = normalizeIwsLidnummer(String(r.lidnummer)) || String(r.lidnummer).trim();
          const festId = normalizeFestivalId(r.festival_id);
          memoryClaims.set(norm, {
            lidnummer: norm,
            festivalId: festId,
            festivalName: r.festival_name || getFestivalDisplayName(festId),
            orderNumber: String(r.order_number || ''),
            discountCents: Number(r.discount_cents) || 0,
            customerEmail: r.customer_email ? String(r.customer_email) : undefined,
            customerName: r.customer_name ? String(r.customer_name) : undefined,
            claimedAt: r.claimed_at ? new Date(r.claimed_at).toISOString() : new Date().toISOString(),
          });
        }
        saveClaimsStore();
      }
    } catch (err) {
      console.warn('[ConscriboService] DB syncClaims fallback to local store:', err);
    }
  }

  public static async getClaim(rawLidnummer: string): Promise<IwsFestivalClaim | null> {
    const lidnummer = normalizeIwsLidnummer(rawLidnummer);
    if (!lidnummer) return null;

    try {
      const ready = await ensureClaimsDbReady();
      if (ready) {
        const rows = await queryClient`
          SELECT * FROM iws_festival_claims WHERE lidnummer = ${lidnummer} LIMIT 1
        `;
        if (rows.length > 0) {
          const r = rows[0];
          const festId = normalizeFestivalId(r.festival_id);
          const claim: IwsFestivalClaim = {
            lidnummer,
            festivalId: festId,
            festivalName: r.festival_name || getFestivalDisplayName(festId),
            orderNumber: String(r.order_number || ''),
            discountCents: Number(r.discount_cents) || 0,
            customerEmail: r.customer_email ? String(r.customer_email) : undefined,
            customerName: r.customer_name ? String(r.customer_name) : undefined,
            claimedAt: r.claimed_at ? new Date(r.claimed_at).toISOString() : new Date().toISOString(),
          };
          memoryClaims.set(lidnummer, claim);
          return claim;
        }
      }
    } catch {
      // Fallback to memoryClaims
    }

    return memoryClaims.get(lidnummer) || null;
  }

  public static async recordClaim(input: {
    lidnummer: string;
    festivalId: string;
    orderNumber: string;
    discountCents?: number;
    customerEmail?: string;
    customerName?: string;
  }): Promise<IwsFestivalClaim> {
    const lidnummer = normalizeIwsLidnummer(input.lidnummer) || input.lidnummer.trim();
    const festInfo = getIwsDiscountForFestival(input.festivalId);
    const discountCents = input.discountCents ?? festInfo.discountCents;
    const claimedAt = new Date().toISOString();

    const claim: IwsFestivalClaim = {
      lidnummer,
      festivalId: festInfo.festivalId,
      festivalName: festInfo.festivalName,
      orderNumber: input.orderNumber || 'HANDMATIG',
      discountCents,
      customerEmail: input.customerEmail,
      customerName: input.customerName,
      claimedAt,
    };

    try {
      const ready = await ensureClaimsDbReady();
      if (ready) {
        await queryClient`
          INSERT INTO iws_festival_claims (
            lidnummer,
            festival_id,
            festival_name,
            order_number,
            discount_cents,
            customer_email,
            customer_name,
            claimed_at
          ) VALUES (
            ${claim.lidnummer},
            ${claim.festivalId},
            ${claim.festivalName},
            ${claim.orderNumber},
            ${claim.discountCents},
            ${claim.customerEmail || null},
            ${claim.customerName || null},
            ${claim.claimedAt}
          )
          ON CONFLICT (lidnummer) DO UPDATE SET
            festival_id = EXCLUDED.festival_id,
            festival_name = EXCLUDED.festival_name,
            order_number = EXCLUDED.order_number,
            discount_cents = EXCLUDED.discount_cents,
            customer_email = EXCLUDED.customer_email,
            customer_name = EXCLUDED.customer_name,
            claimed_at = EXCLUDED.claimed_at
        `;
      }
    } catch (err) {
      console.warn('[ConscriboService] DB recordClaim fallback:', err);
    }

    memoryClaims.set(lidnummer, claim);
    saveClaimsStore();
    return claim;
  }

  public static async releaseClaim(rawLidnummer: string): Promise<boolean> {
    const lidnummer = normalizeIwsLidnummer(rawLidnummer) || rawLidnummer.trim();
    if (!lidnummer) return false;

    let deleted = false;
    try {
      const ready = await ensureClaimsDbReady();
      if (ready) {
        const rows = await queryClient`
          DELETE FROM iws_festival_claims WHERE lidnummer = ${lidnummer} RETURNING lidnummer
        `;
        if (rows.length > 0) deleted = true;
      }
    } catch (err) {
      console.warn('[ConscriboService] DB releaseClaim fallback:', err);
    }

    if (memoryClaims.has(lidnummer)) {
      memoryClaims.delete(lidnummer);
      deleted = true;
    }
    if (deleted) {
      saveClaimsStore();
    }
    return deleted;
  }

  public static async releaseClaimByOrderNumber(orderNumber: string): Promise<boolean> {
    const cleanOrder = (orderNumber || '').trim();
    if (!cleanOrder) return false;

    let released = false;
    try {
      const ready = await ensureClaimsDbReady();
      if (ready) {
        const rows = await queryClient`
          DELETE FROM iws_festival_claims
          WHERE order_number = ${cleanOrder} OR order_number = ${cleanOrder.replace(/^#+/, '')}
          RETURNING lidnummer
        `;
        for (const r of rows) {
          memoryClaims.delete(String(r.lidnummer));
          released = true;
        }
      }
    } catch {
      // ignore
    }

    for (const [lidnr, claim] of memoryClaims.entries()) {
      if (
        claim.orderNumber === cleanOrder ||
        claim.orderNumber.replace(/^#+/, '') === cleanOrder.replace(/^#+/, '')
      ) {
        memoryClaims.delete(lidnr);
        released = true;
      }
    }

    if (released) {
      saveClaimsStore();
    }
    return released;
  }

  /**
   * Add a newly enrolled IWS member manually in Whiskytix (in case they just signed up and are not yet in Conscribo,
   * or to override an existing member's status).
   */
  public static async addManualMember(input: {
    lidnummer: string;
    volledigeNaam: string;
    email?: string;
    telefoon?: string;
    straat?: string;
    huisnummer?: string;
    postcode?: string;
    plaats?: string;
    land?: string;
    typeLidmaatschap?: string;
    totaalBedrag?: number;
    lidSinds?: string;
  }): Promise<IwsConscriboMember> {
    const lidnummer = normalizeIwsLidnummer(input.lidnummer) || input.lidnummer.trim();
    const todayIso = new Date().toISOString().slice(0, 10);
    const straat = (input.straat || '').trim();
    const huisnummer = (input.huisnummer || '').trim();
    const postcode = (input.postcode || '').trim();
    const plaats = (input.plaats || '').trim();
    const straatRegel = [straat, huisnummer].filter(Boolean).join(' ');
    const plaatsRegel = [postcode, plaats].filter(Boolean).join(' ');
    const adresVolledig = [straatRegel, plaatsRegel].filter(Boolean).join(', ');
    const totaalBedrag = typeof input.totaalBedrag === 'number' ? input.totaalBedrag : 67.5;

    const newMember: IwsConscriboMember = {
      id: `manual-${lidnummer}`,
      lidnummer,
      aanhef: '',
      voorletters: '',
      roepnaam: input.volledigeNaam.split(' ')[0] || '',
      tussenvoegsel: '',
      achternaam: input.volledigeNaam.split(' ').slice(1).join(' ') || input.volledigeNaam,
      volledigeNaam: input.volledigeNaam.trim(),
      geboortedatum: '',
      straat,
      huisnummer,
      toevoeging: '',
      postcode,
      plaats,
      land: (input.land || 'Nederland').trim(),
      adresVolledig,
      email: (input.email || '').trim(),
      telefoon: (input.telefoon || '').trim(),
      mobiel: '',
      bedrijfsnaam: '',
      typeLidmaatschap: (input.typeLidmaatschap || 'Basis').trim(),
      lidSinds: input.lidSinds || todayIso,
      eindDatum: '',
      lidmaatschapsperiode: 12,
      status: 'actief',
      contributieBedrag: totaalBedrag,
      magazineBedrag: 0,
      bottelingLuxeBedrag: 0,
      glasLuxeBedrag: 0,
      totaalBedrag,
      betaalwijze: 'handmatig',
      factuurmaand: '',
      iban: '',
      bic: '',
      rekeninghouder: input.volledigeNaam.trim(),
      wcoc: false,
      nieuwsbrief: true,
      privacyAkkoord: true,
      iwf2026: '',
      iwf2025: '',
      iwf2024: '',
      iwf2023: '',
      bottelingLuxe2026: '',
      bottelingLuxe2025: '',
      bottelingLuxe2024: '',
      opmerkingen: 'Handmatig toegevoegd via Whiskytix Admin',
      isManual: true,
      claim: memoryClaims.get(lidnummer) || null,
    };

    memoryManualMembers.set(lidnummer, newMember);
    saveManualMembersStore();
    // Force refresh stats on next fetch
    this.cacheExpiresAt = 0;
    return newMember;
  }

  /**
   * Finds an IWS member by lidnummer (e.g. "271", "WS-271", "IWS-271").
   * 1. Checks manual members first.
   * 2. Checks cached Conscribo members.
   * 3. If not found in cache, performs a LIVE lookup in Conscribo API for `code = lidnummer`
   *    so members who enrolled 1 minute ago in Conscribo are immediately recognized!
   */
  public static async findMemberByLidnummer(rawCode: string): Promise<IwsConscriboMember | null> {
    const lidnummer = normalizeIwsLidnummer(rawCode);
    if (!lidnummer) return null;

    // 1. Check manually added members first
    if (memoryManualMembers.has(lidnummer)) {
      const manual = memoryManualMembers.get(lidnummer)!;
      const claim = await this.getClaim(lidnummer);
      return { ...manual, claim };
    }

    // 2. Check cached Conscribo members (or populate cache if empty)
    const { members } = await this.getMembersAndStats(false);
    const foundInCache = members.find(
      (m) => (normalizeIwsLidnummer(m.lidnummer) || m.lidnummer) === lidnummer
    );
    if (foundInCache) {
      const claim = await this.getClaim(lidnummer);
      return { ...foundInCache, claim };
    }

    // 3. Live real-time query to Conscribo for newly registered members not yet in cache!
    try {
      const liveBatch = await this.fetchBatch(0, 10, [
        { fieldName: 'code', operator: '=', value: lidnummer },
      ]);
      const entries = Object.entries(liveBatch.relations || {});
      if (entries.length > 0) {
        const todayIso = new Date().toISOString().slice(0, 10);
        const [entityId, raw] = entries[0];
        const liveMember = this.mapRelation(entityId, raw, todayIso);
        if (this.cachedMembers) {
          this.cachedMembers.push(liveMember);
        }
        const claim = await this.getClaim(lidnummer);
        return { ...liveMember, claim };
      }
    } catch (err) {
      console.warn(`[ConscriboService] Live lookup for lidnummer ${lidnummer} failed:`, err);
    }

    return null;
  }

  public static async getMembersAndStats(forceRefresh = false): Promise<{
    members: IwsConscriboMember[];
    stats: IwsConscriboStats;
  }> {
    await this.syncClaimsFromDb();

    const now = Date.now();
    let baseMembers: IwsConscriboMember[];

    if (!forceRefresh && this.cachedMembers && now < this.cacheExpiresAt) {
      baseMembers = this.cachedMembers;
    } else {
      const batchSize = 1000;
      const firstBatch = await this.fetchBatch(0, batchSize);
      const totalCount = firstBatch.resultCount;

      const allEntries: Array<[string, any]> = Object.entries(firstBatch.relations);

      if (totalCount > batchSize) {
        for (let offset = batchSize; offset < totalCount; offset += batchSize) {
          const nextBatch = await this.fetchBatch(offset, batchSize);
          allEntries.push(...Object.entries(nextBatch.relations));
        }
      }

      const todayIso = new Date().toISOString().slice(0, 10);
      baseMembers = allEntries.map(([entityId, raw]) =>
        this.mapRelation(entityId, raw, todayIso)
      );
      this.cachedMembers = baseMembers;
      this.cacheExpiresAt = now + this.CACHE_TTL_MS;
    }

    // Merge Conscribo members with any manually added members
    const mergedMap = new Map<string, IwsConscriboMember>();
    for (const m of baseMembers) {
      const key = normalizeIwsLidnummer(m.lidnummer) || m.lidnummer;
      mergedMap.set(key, {
        ...m,
        claim: memoryClaims.get(key) || null,
      });
    }
    for (const [key, manual] of memoryManualMembers.entries()) {
      if (!mergedMap.has(key)) {
        mergedMap.set(key, {
          ...manual,
          claim: memoryClaims.get(key) || null,
        });
      }
    }

    const members = Array.from(mergedMap.values());

    // Sort numerically by lidnummer ascending by default
    members.sort((a, b) => {
      const numA = parseInt(a.lidnummer, 10);
      const numB = parseInt(b.lidnummer, 10);
      if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
        return numA - numB;
      }
      return a.lidnummer.localeCompare(b.lidnummer);
    });

    const byType: Record<string, number> = {};
    const byPaymentMethod: Record<string, number> = {};
    let activeMembers = 0;
    let expiredMembers = 0;
    let totalAnnualRevenue = 0;
    let iwf2026Count = 0;
    let wcocCount = 0;
    let claimedCount = 0;
    const claimedByFestival = {
      denhaag: 0,
      gent: 0,
      amsterdam: 0,
    };

    for (const m of members) {
      byType[m.typeLidmaatschap] = (byType[m.typeLidmaatschap] || 0) + 1;
      const pm = m.betaalwijze || 'onbekend';
      byPaymentMethod[pm] = (byPaymentMethod[pm] || 0) + 1;

      if (m.status === 'actief') {
        activeMembers++;
        totalAnnualRevenue += m.totaalBedrag;
      } else {
        expiredMembers++;
      }

      if (m.iwf2026) iwf2026Count++;
      if (m.wcoc) wcocCount++;

      if (m.claim) {
        claimedCount++;
        const fId = normalizeFestivalId(m.claim.festivalId);
        claimedByFestival[fId] = (claimedByFestival[fId] || 0) + 1;
      }
    }

    totalAnnualRevenue = Math.round(totalAnnualRevenue * 100) / 100;
    const averageAnnualAmount =
      activeMembers > 0 ? Math.round((totalAnnualRevenue / activeMembers) * 100) / 100 : 0;

    const stats: IwsConscriboStats = {
      totalMembers: members.length,
      activeMembers,
      expiredMembers,
      totalAnnualRevenue,
      averageAnnualAmount,
      iwf2026Count,
      wcocCount,
      claimedCount,
      claimedByFestival,
      byType,
      byPaymentMethod,
      lastSyncedAt: new Date().toISOString(),
    };

    this.cachedStats = stats;

    return { members, stats };
  }
}
