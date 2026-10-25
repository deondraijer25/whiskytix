import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

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
            memoryCoupons.set(String(c.code).toUpperCase().trim(), c);
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
  static getAll(festivalId?: string): StoredCoupon[] {
    const all = Array.from(memoryCoupons.values());
    if (!festivalId || festivalId === 'all') return all;

    const norm = festivalId.toLowerCase().replace(/[\s_-]/g, '');
    return all.filter((c) => {
      const cCity = (c.city || 'Alle Festivals').toLowerCase().replace(/[\s_-]/g, '');
      return (
        cCity === 'allefestivals' ||
        cCity === 'all' ||
        cCity.includes(norm) ||
        norm.includes(cCity)
      );
    });
  }

  static getByCode(code: string): StoredCoupon | undefined {
    if (!code) return undefined;
    return memoryCoupons.get(code.trim().toUpperCase());
  }

  static create(input: {
    code: string;
    city?: string;
    type: 'percentage' | 'fixed_amount';
    value: number;
    maxUses?: number;
    validUntil?: string;
  }): StoredCoupon {
    const cleanCode = input.code.trim().toUpperCase();
    const existing = memoryCoupons.get(cleanCode);
    const coupon: StoredCoupon = {
      id: existing?.id || `coup-${crypto.randomUUID().slice(0, 8)}`,
      code: cleanCode,
      city: input.city || 'Alle Festivals',
      type: input.type === 'fixed_amount' ? 'fixed_amount' : 'percentage',
      value: Number(input.value) || 0,
      usedCount: existing?.usedCount || 0,
      maxUses: Number(input.maxUses) || 500,
      totalDiscountGrantedCents: existing?.totalDiscountGrantedCents || 0,
      validUntil: input.validUntil || '2027-12-31',
      isActive: true,
    };

    memoryCoupons.set(cleanCode, coupon);
    saveCouponsStore();
    return coupon;
  }

  static deleteById(id: string): boolean {
    for (const [key, val] of memoryCoupons.entries()) {
      if (val.id === id || val.code === id.toUpperCase()) {
        memoryCoupons.delete(key);
        saveCouponsStore();
        return true;
      }
    }
    return false;
  }

  static validate(
    rawCode: string,
    festivalId?: string
  ): {
    valid: boolean;
    code?: string;
    type?: 'percentage' | 'fixed_amount';
    value?: number; // percentage (e.g. 10) or EUR amount (e.g. 50)
    valueCents?: number;
    message: string;
  } {
    const code = (rawCode || '').trim().toUpperCase();
    if (!code) {
      return { valid: false, message: 'Voer een kortingscode in.' };
    }

    // Built-in IWS membership & gift voucher patterns
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

    const coupon = memoryCoupons.get(code);
    if (!coupon || !coupon.isActive) {
      return { valid: false, message: '✗ Ongeldige code. Probeer het opnieuw.' };
    }

    // Check city scope
    if (festivalId && festivalId !== 'all') {
      const normFest = festivalId.toLowerCase().replace(/[\s_-]/g, '');
      const normCouponCity = (coupon.city || 'Alle Festivals').toLowerCase().replace(/[\s_-]/g, '');
      const cityMatches =
        normCouponCity === 'allefestivals' ||
        normCouponCity === 'all' ||
        normCouponCity.includes(normFest) ||
        normFest.includes(normCouponCity);

      if (!cityMatches) {
        return {
          valid: false,
          message: `✗ Deze kortingscode is alleen geldig voor ${coupon.city}.`,
        };
      }
    }

    // Check max uses
    if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
      return {
        valid: false,
        message: '✗ Deze kortingscode heeft het maximale aantal gebruiksmomenten bereikt.',
      };
    }

    // Check expiry date
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

  static recordRedemption(rawCode: string, discountGrantedCents: number): void {
    const code = (rawCode || '').trim().toUpperCase();
    if (!code || discountGrantedCents <= 0) return;

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
