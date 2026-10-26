import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { queryClient, checkDbConnection } from '../../db/index.js';

export interface StoredCoupon {
  id: string;
  code: string;
  city: string; // 'Alle Festivals' | 'Gent' | 'Den Haag' | 'Amsterdam'
  type: 'percentage' | 'fixed_amount';
  value: number; // percentage (e.g. 10) or cents (e.g. 5000 for €50,00)
  usedCount: number;
  maxUses: number;
  totalDiscountGrantedCents: number;
  validUntil: string;
  isActive: boolean;
}

const isVercel = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined;
const DATA_DIR = isVercel ? path.join(os.tmpdir(), '.data') : path.join(process.cwd(), '.data');
const COUPONS_FILE = path.join(DATA_DIR, 'coupons-store.json');

const DEFAULT_COUPONS: StoredCoupon[] = [
  {
    id: 'coup-new10',
    code: 'NEW10',
    city: 'Alle Festivals',
    type: 'percentage',
    value: 10,
    usedCount: 0,
    maxUses: 1000,
    totalDiscountGrantedCents: 0,
    validUntil: '2027-12-31',
    isActive: true,
  },
];

const memoryCoupons: Map<string, StoredCoupon> = new Map();
let dbTableInitialized = false;

function normalizeCityDisplay(raw?: string): string {
  const s = (raw || '').trim().toLowerCase().replace(/[\s_-]/g, '');
  if (!s || s === 'all' || s === 'allefestivals') return 'Alle Festivals';
  if (s.includes('haag') || s === 'denhaag') return 'Den Haag';
  if (s.includes('gent')) return 'Gent';
  if (s.includes('amsterdam')) return 'Amsterdam';
  return raw!.trim();
}

function cityMatchesFestival(couponCity: string, festivalId?: string): boolean {
  if (!festivalId || festivalId === 'all') return true;
  const normFest = festivalId.toLowerCase().replace(/[\s_-]/g, '');
  if (!normFest || normFest === 'allefestivals') return true;

  const normCoupon = (couponCity || 'Alle Festivals').toLowerCase().replace(/[\s_-]/g, '');
  if (normCoupon === 'allefestivals' || normCoupon === 'all') return true;

  if (normFest.includes('haag') && normCoupon.includes('haag')) return true;
  if (normFest.includes('gent') && normCoupon.includes('gent')) return true;
  if (normFest.includes('amsterdam') && normCoupon.includes('amsterdam')) return true;

  return normCoupon.includes(normFest) || normFest.includes(normCoupon);
}

function mapDbRowToCoupon(row: any): StoredCoupon {
  let validUntilStr = '2027-12-31';
  if (row.valid_until) {
    const d = new Date(row.valid_until);
    if (!isNaN(d.getTime())) {
      validUntilStr = d.toISOString().slice(0, 10);
    }
  }
  return {
    id: String(row.id),
    code: String(row.code || '').toUpperCase().trim(),
    city: normalizeCityDisplay(row.festival_id),
    type: row.discount_type === 'fixed_amount' ? 'fixed_amount' : 'percentage',
    value: Number(row.discount_value) || 0,
    usedCount: Number(row.current_uses) || 0,
    maxUses: Number(row.max_uses) || 500,
    totalDiscountGrantedCents: Number(row.total_discount_granted_cents || row.min_order_cents) || 0,
    validUntil: validUntilStr,
    isActive: Boolean(row.is_active),
  };
}

async function ensureDbTableReady(): Promise<boolean> {
  try {
    const status = await checkDbConnection();
    if (!status.ok) return false;
    if (!dbTableInitialized) {
      await queryClient.unsafe(`
        ALTER TABLE discount_codes
        ADD COLUMN IF NOT EXISTS total_discount_granted_cents integer DEFAULT 0 NOT NULL;
      `);
      dbTableInitialized = true;
    }
    return true;
  } catch {
    return false;
  }
}

function ensureCouponsStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(COUPONS_FILE)) {
      fs.writeFileSync(COUPONS_FILE, JSON.stringify({ coupons: DEFAULT_COUPONS }, null, 2), 'utf8');
    }
  } catch (err) {
    console.warn('[CouponsRepository] Could not create coupons store file:', err);
  }
}

function loadCouponsStore() {
  memoryCoupons.clear();
  DEFAULT_COUPONS.forEach((c) => memoryCoupons.set(c.code.toUpperCase(), { ...c }));

  try {
    ensureCouponsStore();
    if (fs.existsSync(COUPONS_FILE)) {
      const raw = fs.readFileSync(COUPONS_FILE, 'utf8').replace(/^\uFEFF/, '').trim();
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.coupons)) {
        for (const c of parsed.coupons) {
          if (c && c.code) {
            const normalized: StoredCoupon = {
              ...c,
              code: String(c.code).toUpperCase().trim(),
              city: normalizeCityDisplay(c.city),
            };
            memoryCoupons.set(normalized.code, normalized);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[CouponsRepository] Error loading coupons store:', err);
  }
}

function saveCouponsStore() {
  try {
    ensureCouponsStore();
    const list = Array.from(memoryCoupons.values());
    fs.writeFileSync(COUPONS_FILE, JSON.stringify({ coupons: list }, null, 2), 'utf8');
  } catch (err) {
    console.warn('[CouponsRepository] Error saving coupons store:', err);
  }
}

loadCouponsStore();

export class CouponsRepository {
  /**
   * Synchronize in-memory cache from PostgreSQL/Supabase so all Vercel serverless instances
   * and external festival websites share the exact same live discount codes.
   */
  static async syncFromDb(): Promise<void> {
    try {
      const ready = await ensureDbTableReady();
      if (!ready) return;

      const rows = await queryClient.unsafe(
        'SELECT * FROM discount_codes ORDER BY valid_until ASC NULLS LAST, code ASC'
      );

      if (Array.isArray(rows)) {
        memoryCoupons.clear();
        for (const r of rows) {
          const mapped = mapDbRowToCoupon(r);
          if (mapped.code) {
            memoryCoupons.set(mapped.code, mapped);
          }
        }
        saveCouponsStore();
      }
    } catch (err) {
      console.warn('[CouponsRepository] DB sync fallback to local memory:', err);
    }
  }

  static async getAll(festivalId?: string): Promise<StoredCoupon[]> {
    await this.syncFromDb();
    const all = Array.from(memoryCoupons.values());
    if (!festivalId || festivalId === 'all') return all;
    return all.filter((c) => cityMatchesFestival(c.city, festivalId));
  }

  static async getByCode(code: string): Promise<StoredCoupon | undefined> {
    if (!code) return undefined;
    const clean = code.trim().toUpperCase();

    try {
      const ready = await ensureDbTableReady();
      if (ready) {
        const rows = await queryClient`
          SELECT * FROM discount_codes WHERE UPPER(code) = ${clean} LIMIT 1
        `;
        if (rows.length > 0) {
          const mapped = mapDbRowToCoupon(rows[0]);
          memoryCoupons.set(clean, mapped);
          return mapped;
        }
      }
    } catch {
      // Fallback to memoryCoupons
    }

    return memoryCoupons.get(clean);
  }

  static async create(input: {
    code: string;
    city?: string;
    type: 'percentage' | 'fixed_amount';
    value: number;
    maxUses?: number;
    validUntil?: string;
  }): Promise<StoredCoupon> {
    const cleanCode = input.code.trim().toUpperCase();
    const cityLabel = normalizeCityDisplay(input.city);
    const discountType = input.type === 'fixed_amount' ? 'fixed_amount' : 'percentage';
    const discountValue = Math.max(0, Math.round(Number(input.value) || 0));
    const maxUses = Math.max(1, Math.round(Number(input.maxUses) || 500));
    const validUntilStr = input.validUntil || '2027-12-31';
    const validUntilTimestamp = new Date(`${validUntilStr}T23:59:59Z`);

    try {
      const ready = await ensureDbTableReady();
      if (ready) {
        const rows = await queryClient`
          INSERT INTO discount_codes (
            code,
            festival_id,
            discount_type,
            discount_value,
            max_uses,
            current_uses,
            total_discount_granted_cents,
            valid_until,
            is_active
          )
          VALUES (
            ${cleanCode},
            ${cityLabel},
            ${discountType},
            ${discountValue},
            ${maxUses},
            0,
            0,
            ${isNaN(validUntilTimestamp.getTime()) ? new Date('2027-12-31T23:59:59Z') : validUntilTimestamp},
            true
          )
          ON CONFLICT (code) DO UPDATE SET
            festival_id = EXCLUDED.festival_id,
            discount_type = EXCLUDED.discount_type,
            discount_value = EXCLUDED.discount_value,
            max_uses = EXCLUDED.max_uses,
            valid_until = EXCLUDED.valid_until,
            is_active = true
          RETURNING *
        `;
        if (rows.length > 0) {
          const saved = mapDbRowToCoupon(rows[0]);
          memoryCoupons.set(cleanCode, saved);
          saveCouponsStore();
          return saved;
        }
      }
    } catch (err) {
      console.warn('[CouponsRepository] DB insert fallback to local store:', err);
    }

    const existing = memoryCoupons.get(cleanCode);
    const coupon: StoredCoupon = {
      id: existing?.id || crypto.randomUUID(),
      code: cleanCode,
      city: cityLabel,
      type: discountType,
      value: discountValue,
      usedCount: existing?.usedCount || 0,
      maxUses,
      totalDiscountGrantedCents: existing?.totalDiscountGrantedCents || 0,
      validUntil: validUntilStr,
      isActive: true,
    };

    memoryCoupons.set(cleanCode, coupon);
    saveCouponsStore();
    return coupon;
  }

  static async toggleActive(idOrCode: string, isActive: boolean): Promise<StoredCoupon | null> {
    const clean = (idOrCode || '').trim();
    if (!clean) return null;

    try {
      const ready = await ensureDbTableReady();
      if (ready) {
        const rows = await queryClient`
          UPDATE discount_codes
          SET is_active = ${Boolean(isActive)}
          WHERE id::text = ${clean} OR UPPER(code) = ${clean.toUpperCase()}
          RETURNING *
        `;
        if (rows.length > 0) {
          const updated = mapDbRowToCoupon(rows[0]);
          memoryCoupons.set(updated.code, updated);
          saveCouponsStore();
          return updated;
        }
      }
    } catch (err) {
      console.warn('[CouponsRepository] DB toggleActive fallback:', err);
    }

    for (const [key, val] of memoryCoupons.entries()) {
      if (val.id === clean || val.code === clean.toUpperCase()) {
        val.isActive = Boolean(isActive);
        memoryCoupons.set(key, val);
        saveCouponsStore();
        return val;
      }
    }
    return null;
  }

  static async deleteById(idOrCode: string): Promise<boolean> {
    const clean = (idOrCode || '').trim();
    if (!clean) return false;

    let deletedInDb = false;
    try {
      const ready = await ensureDbTableReady();
      if (ready) {
        const rows = await queryClient`
          DELETE FROM discount_codes
          WHERE id::text = ${clean} OR UPPER(code) = ${clean.toUpperCase()}
          RETURNING code
        `;
        if (rows.length > 0) {
          deletedInDb = true;
          for (const r of rows) {
            memoryCoupons.delete(String(r.code).toUpperCase());
          }
        }
      }
    } catch (err) {
      console.warn('[CouponsRepository] DB delete fallback:', err);
    }

    for (const [key, val] of memoryCoupons.entries()) {
      if (val.id === clean || val.code === clean.toUpperCase()) {
        memoryCoupons.delete(key);
        deletedInDb = true;
      }
    }

    if (deletedInDb) {
      saveCouponsStore();
    }
    return deletedInDb;
  }

  static async validate(
    rawCode: string,
    festivalId?: string
  ): Promise<{
    valid: boolean;
    code?: string;
    type?: 'percentage' | 'fixed_amount';
    value?: number; // percentage (e.g. 10) or EUR amount (e.g. 50)
    valueCents?: number;
    message: string;
  }> {
    const code = (rawCode || '').trim().toUpperCase();
    if (!code) {
      return { valid: false, message: 'Voer een kortingscode in.' };
    }

    // 1. Check PostgreSQL / Supabase database FIRST so any custom code created by the client
    // (including custom WS-... or updated NEW10 codes) always takes priority!
    const coupon = await this.getByCode(code);

    if (coupon) {
      if (!coupon.isActive) {
        return {
          valid: false,
          message: '✗ Deze kortingscode is momenteel gepauzeerd of niet meer actief.',
        };
      }

      if (!cityMatchesFestival(coupon.city, festivalId)) {
        return {
          valid: false,
          message: `✗ Deze kortingscode is alleen geldig voor ${coupon.city}.`,
        };
      }

      if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
        return {
          valid: false,
          message: '✗ Deze kortingscode heeft het maximale aantal gebruiksmomenten bereikt.',
        };
      }

      if (coupon.validUntil) {
        const expiry = new Date(coupon.validUntil + 'T23:59:59');
        if (!isNaN(expiry.getTime()) && new Date() > expiry) {
          return {
            valid: false,
            message: '✗ Deze kortingscode is verlopen.',
          };
        }
      }

      if (coupon.type === 'percentage') {
        return {
          valid: true,
          code: coupon.code,
          type: 'percentage',
          value: coupon.value,
          message: `✓ Kortingscode ${coupon.code} toegepast: ${coupon.value}% korting verwerkt.`,
        };
      } else {
        const eurAmount = coupon.value / 100;
        return {
          valid: true,
          code: coupon.code,
          type: 'fixed_amount',
          value: eurAmount,
          valueCents: coupon.value,
          message: `✓ Kortingscode ${coupon.code} toegepast: €${eurAmount.toFixed(2).replace('.', ',')} korting verwerkt.`,
        };
      }
    }

    // 2. Fallback to built-in IWS membership & gift voucher patterns if not an explicit coupon in DB
    if (code.startsWith('WS-') || code.startsWith('IWS')) {
      return {
        valid: true,
        code,
        type: 'fixed_amount',
        value: 5,
        valueCents: 500,
        message: 'IWS-lidmaatschap gevalideerd: €5,00 korting op 1 sessiekaart en €5,00 op de festivalbotteling.',
      };
    }

    if (code === 'GIFT-50' || code === 'CADEAU-50') {
      return {
        valid: true,
        code,
        type: 'fixed_amount',
        value: 50,
        valueCents: 5000,
        message: '✓ Cadeaubon toegepast: €50,00 korting verwerkt.',
      };
    }

    return { valid: false, message: '✗ Ongeldige code. Probeer het opnieuw.' };
  }

  static async recordRedemption(rawCode: string, discountGrantedCents: number): Promise<void> {
    const code = (rawCode || '').trim().toUpperCase();
    if (!code || discountGrantedCents <= 0) return;

    try {
      const ready = await ensureDbTableReady();
      if (ready) {
        const rows = await queryClient`
          UPDATE discount_codes
          SET
            current_uses = current_uses + 1,
            total_discount_granted_cents = COALESCE(total_discount_granted_cents, 0) + ${Math.round(discountGrantedCents)},
            is_active = CASE
              WHEN max_uses IS NOT NULL AND max_uses > 0 AND (current_uses + 1) >= max_uses THEN false
              ELSE is_active
            END
          WHERE UPPER(code) = ${code}
          RETURNING *
        `;
        if (rows.length > 0) {
          const updated = mapDbRowToCoupon(rows[0]);
          memoryCoupons.set(code, updated);
          saveCouponsStore();
          return;
        }
      }
    } catch (err) {
      console.warn('[CouponsRepository] DB recordRedemption fallback:', err);
    }

    const coupon = memoryCoupons.get(code);
    if (coupon) {
      coupon.usedCount = (coupon.usedCount || 0) + 1;
      coupon.totalDiscountGrantedCents = (coupon.totalDiscountGrantedCents || 0) + discountGrantedCents;
      if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
        coupon.isActive = false;
      }
      memoryCoupons.set(code, coupon);
      saveCouponsStore();
    }
  }
}
