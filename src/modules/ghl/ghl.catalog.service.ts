/**
 * GoHighLevel (GHL) Festival Catalog Service
 * Realtime ophalen en synchroniseren van festival tickets, zaalcapaciteiten en sessies uit GHL Custom Objects
 * Met In-Flight Request Deduplicatie & In-Memory Atomic Sold Updates voor piekbelasting (Zondagnacht 00:00).
 */

export interface LiveCatalogItem {
  id: string;
  city: 'gent' | 'denhaag' | 'amsterdam';
  category: 'entree' | 'masterclass' | 'special';
  rawCategory?: string;
  title: string;
  dateStr: string;
  timeStr: string;
  originalPriceEur: number;
  location: string;
  description?: string;
  isSoldOut?: boolean;
  capacity?: number;
  sold?: number;
  statusText?: string;
  extra?: string;
  bookingType?: string;
  day?: string;
  daypart?: string;
  ambassadorName?: string;
  ambassadorTitle?: string;
  tastingLineup?: string[];
}

export interface CityCatalogStats {
  city: 'gent' | 'denhaag' | 'amsterdam';
  cityName: string;
  totalCapacity: number;
  totalSold: number;
  ticketTypesCount: number;
  soldPercentage: string;
}

export interface CatalogResponse {
  success: boolean;
  source: 'ghl_live' | 'cache' | 'fallback';
  timestamp: string;
  totalRecords: number;
  stats: Record<'gent' | 'denhaag' | 'amsterdam', CityCatalogStats>;
  items: LiveCatalogItem[];
}

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_API_KEY = process.env.GHL_API_KEY || 'pit-150d6114-ac2c-4cf7-9d5c-ffc20499c790';
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID || '1OZ9uxIBFoxwbheVC5iN';
const GHL_TICKETS_OBJECT_KEY = process.env.GHL_TICKETS_SCHEMA_ID || 'custom_objects.festival_tickets';

const CACHE_TTL_MS = 60 * 1000; // 1 minuut in-memory cache

let inMemoryCache: {
  timestamp: number;
  items: LiveCatalogItem[];
  stats: Record<'gent' | 'denhaag' | 'amsterdam', CityCatalogStats>;
} | null = null;

// Deduplicatie van gelijktijdige catalogus-aanvragen tijdens piekbelasting (bijv. 500 bezoekers om 00:00 uur)
let inFlightCatalogPromise: Promise<{
  items: LiveCatalogItem[];
  stats: Record<'gent' | 'denhaag' | 'amsterdam', CityCatalogStats>;
  timestamp: number;
}> | null = null;

function parseGhlBoolean(val: any): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    return s === 'ja' || s === 'true' || s === '1' || s === 'yes';
  }
  return Boolean(val);
}

function resolveCity(rawCity: string): 'gent' | 'denhaag' | 'amsterdam' {
  const c = (rawCity || '').toLowerCase().trim();
  if (c.includes('haag') || c.includes('den_haag') || c.includes('den-haag')) return 'denhaag';
  if (c.includes('amsterdam') || c.includes('adam')) return 'amsterdam';
  return 'gent';
}

function resolveCategory(rawCategory: string): 'entree' | 'masterclass' | 'special' {
  const c = (rawCategory || '').toLowerCase().trim();
  if (c === 'entree') return 'entree';
  if (c === 'masterclass') return 'masterclass';
  return 'special';
}

function calculateCityStats(
  items: LiveCatalogItem[]
): Record<'gent' | 'denhaag' | 'amsterdam', CityCatalogStats> {
  const cities: ('gent' | 'denhaag' | 'amsterdam')[] = ['gent', 'denhaag', 'amsterdam'];
  const cityNames = {
    gent: 'Gents Whisky Festival',
    denhaag: 'International Whisky Festival Den Haag',
    amsterdam: 'Whisky Weekend Amsterdam',
  };

  const result = {} as Record<'gent' | 'denhaag' | 'amsterdam', CityCatalogStats>;

  for (const city of cities) {
    const cityItems = items.filter((i) => i.city === city);
    const totalCapacity = cityItems.reduce((acc, i) => acc + (i.capacity || 0), 0);
    const totalSold = cityItems.reduce((acc, i) => acc + (i.sold || 0), 0);
    const pct = totalCapacity > 0 ? ((totalSold / totalCapacity) * 100).toFixed(1) : '0.0';

    result[city] = {
      city,
      cityName: cityNames[city],
      totalCapacity,
      totalSold,
      ticketTypesCount: cityItems.length,
      soldPercentage: pct,
    };
  }

  return result;
}

export class GhlCatalogService {
  /**
   * Haalt de live tickets en capaciteiten op uit GoHighLevel Custom Objects
   * met In-Flight Request Deduplicatie zodat honderden gelijktijdige bezoekers
   * slechts 1 achterliggende CRM-call veroorzaken.
   */
  static async getCatalog(cityFilter?: string, forceRefresh = false): Promise<CatalogResponse> {
    const now = Date.now();

    // 1. Direct uit geheugen serveren als cache vers is (< 60s)
    if (!forceRefresh && inMemoryCache && now - inMemoryCache.timestamp < CACHE_TTL_MS) {
      return this.formatCatalogResponse(inMemoryCache.items, inMemoryCache.stats, inMemoryCache.timestamp, 'cache', cityFilter);
    }

    // 2. Stale-While-Revalidate bij lopend verzoek: als er al een refresh bezig is, wacht op diezelfde belofte
    try {
      if (!inFlightCatalogPromise) {
        inFlightCatalogPromise = this.fetchLiveCatalogFromGhl().finally(() => {
          inFlightCatalogPromise = null;
        });
      }

      const fresh = await inFlightCatalogPromise;
      return this.formatCatalogResponse(fresh.items, fresh.stats, fresh.timestamp, 'ghl_live', cityFilter);
    } catch (err: any) {
      console.warn('[GHL Catalog] Kon live tickets niet ophalen uit GHL, gebruik cache of fallback:', err.message);

      if (inMemoryCache) {
        return this.formatCatalogResponse(
          inMemoryCache.items,
          inMemoryCache.stats,
          inMemoryCache.timestamp,
          'cache',
          cityFilter
        );
      }

      return {
        success: false,
        source: 'fallback',
        timestamp: new Date().toISOString(),
        totalRecords: 0,
        stats: {
          gent: {
            city: 'gent',
            cityName: 'Gents Whisky Festival',
            totalCapacity: 2360,
            totalSold: 0,
            ticketTypesCount: 16,
            soldPercentage: '0.0',
          },
          denhaag: {
            city: 'denhaag',
            cityName: 'International Whisky Festival Den Haag',
            totalCapacity: 7663,
            totalSold: 0,
            ticketTypesCount: 118,
            soldPercentage: '0.0',
          },
          amsterdam: {
            city: 'amsterdam',
            cityName: 'Whisky Weekend Amsterdam',
            totalCapacity: 2860,
            totalSold: 0,
            ticketTypesCount: 22,
            soldPercentage: '0.0',
          },
        },
        items: [],
      };
    }
  }

  private static formatCatalogResponse(
    items: LiveCatalogItem[],
    stats: Record<'gent' | 'denhaag' | 'amsterdam', CityCatalogStats>,
    timestamp: number,
    source: 'ghl_live' | 'cache',
    cityFilter?: string
  ): CatalogResponse {
    let filtered = items;
    if (cityFilter && cityFilter !== 'all') {
      const resolved = resolveCity(cityFilter);
      filtered = filtered.filter((i) => i.city === resolved);
    }
    return {
      success: true,
      source,
      timestamp: new Date(timestamp).toISOString(),
      totalRecords: filtered.length,
      stats,
      items: filtered,
    };
  }

  private static async fetchLiveCatalogFromGhl(): Promise<{
    items: LiveCatalogItem[];
    stats: Record<'gent' | 'denhaag' | 'amsterdam', CityCatalogStats>;
    timestamp: number;
  }> {
    const url = `${GHL_API_BASE}/objects/${GHL_TICKETS_OBJECT_KEY}/records/search`;
    const records: any[] = [];
    let page = 1;
    while (page <= 5) {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${GHL_API_KEY}`,
          Version: '2021-07-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          locationId: GHL_LOCATION_ID,
          page,
          pageLimit: 100,
          searchAfter: [],
        }),
      });

      if (!response.ok) {
        throw new Error(`GHL Search endpoint status ${response.status} ${response.statusText}`);
      }

      const json = (await response.json()) as any;
      const pageRecs = json.customObjectRecords || json.records || [];
      records.push(...pageRecs);
      if (pageRecs.length < 100 || records.length >= (json.total || 0)) break;
      page++;
    }

    if (!Array.isArray(records) || records.length === 0) {
      throw new Error('Geen records ontvangen uit GHL Custom Objects');
    }

    const parsedItems: LiveCatalogItem[] = records.map((r: any) => {
      const p = r.properties || r;
      const capacity = parseInt(p.capacity, 10) || 0;
      const sold = parseInt(p.sold, 10) || 0;
      const isSoldOut = parseGhlBoolean(p.is_sold_out) || (capacity > 0 && sold >= capacity);

      const rawCity = p.festival_city || p.festival_slug || p.city || 'gent';
      const city = resolveCity(rawCity);
      const category = resolveCategory(p.category);

      const cleanTitle = (p.title || 'Ticket')
        .replace(/\s*(?:1[0-9]|2[0-3]):[0-5][0-9]\s*[-–—]\s*(?:1[0-9]|2[0-3]):[0-5][0-9]\s*(?:uur)?/gi, '')
        .trim();

      const price =
        typeof p.price === 'number'
          ? p.price
          : parseFloat(p.price) || parseFloat(p.ticket_price) || 0;

      let tastingLineup: string[] | undefined = undefined;
      if (p.tasting_lineup) {
        tastingLineup = Array.isArray(p.tasting_lineup)
          ? p.tasting_lineup
          : String(p.tasting_lineup)
              .split(/[\n,]+/)
              .map((s: string) => s.trim())
              .filter(Boolean);
      }

      return {
        id: r.id || `ghl-tix-${Math.random().toString(36).substring(2, 9)}`,
        city,
        category,
        rawCategory: p.category,
        title: cleanTitle,
        dateStr: p.date_label || 'Datum volgt',
        timeStr: p.time_label || 'Tijd volgt',
        originalPriceEur: price,
        location:
          p.location ||
          (city === 'gent'
            ? 'De Oude Vismijn, Gent'
            : city === 'denhaag'
            ? 'Grote Kerk Den Haag'
            : 'De Hallen, Amsterdam'),
        description: p.ticket_description || p.description || '',
        extra: p.ticket_description || p.description || '',
        capacity,
        sold,
        isSoldOut,
        statusText: isSoldOut
          ? 'Uitverkocht'
          : p.status_badge === 'hidden'
          ? 'Concept (Verborgen)'
          : p.status_badge || undefined,
        bookingType: p.booking_type || 'vrij_te_boeken',
        day: p.day || 'all',
        daypart: p.daypart || 'all',
        ambassadorName: p.ambassador_name || undefined,
        ambassadorTitle: p.ambassador_title || undefined,
        tastingLineup,
      };
    });

    const stats = calculateCityStats(parsedItems);
    const now = Date.now();

    inMemoryCache = {
      timestamp: now,
      items: parsedItems,
      stats,
    };

    console.info(
      `[GHL Catalog] Succesvol ${parsedItems.length} live tickets ingeladen uit GHL (Gent: ${stats.gent.totalCapacity}, DH: ${stats.denhaag.totalCapacity}, Ams: ${stats.amsterdam.totalCapacity})`
    );

    return inMemoryCache;
  }

  /**
   * Geeft een gecachet catalogus-item terug (indien aanwezig) om extra CRM GET-calls te besparen
   */
  static getCachedTicketItem(ticketRecordId: string): LiveCatalogItem | undefined {
    if (!inMemoryCache || !ticketRecordId) return undefined;
    return inMemoryCache.items.find((it) => it.id === ticketRecordId);
  }

  /**
   * Werkt de verkoopteller van een specifiek ticket direct in-memory bij zonder de hele cache te wissen!
   * Hierdoor blijft /api/catalog bij 500 gelijktijdige kopers altijd < 10ms snel.
   */
  static incrementCachedSold(
    ticketRecordId: string,
    addedQty: number
  ): { newSold: number; capacity: number; isSoldOut: boolean } | null {
    if (!inMemoryCache || !ticketRecordId) return null;
    const item = inMemoryCache.items.find((it) => it.id === ticketRecordId);
    if (!item) return null;

    const currentSold = item.sold || 0;
    const capacity = item.capacity || 0;
    const newSold = currentSold + addedQty;
    const isSoldOut = capacity > 0 && newSold >= capacity;

    item.sold = newSold;
    item.isSoldOut = isSoldOut;
    if (isSoldOut) {
      item.statusText = 'Uitverkocht';
    }

    inMemoryCache.stats = calculateCityStats(inMemoryCache.items);
    return { newSold, capacity, isSoldOut };
  }

  /**
   * Leegt de catalogus cache (alleen bij handmatige admin refresh)
   */
  static clearCache() {
    inMemoryCache = null;
  }
}
