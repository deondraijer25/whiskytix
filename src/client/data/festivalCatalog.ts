import React, { useState, useEffect } from 'react';

export interface FestivalCatalogItem {
  id: string;
  city: 'gent' | 'denhaag' | 'amsterdam';
  category: 'entree' | 'masterclass' | 'special';
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
}

export const FESTIVAL_CATALOG: FestivalCatalogItem[] = [
  // =========================================================================
  // --- GENT (De Oude Vismijn • 2, 3 & 4 okt 2026) ---
  // =========================================================================

  // 1. Entrees
  {
    id: 'gent-entree-vrijdagavond',
    city: 'gent',
    category: 'entree',
    title: 'Entree Vrijdagavond',
    dateStr: 'Vrijdag 2 oktober 2026',
    timeStr: '19:00 - 23:00 uur',
    originalPriceEur: 42.50,
    location: 'De Oude Vismijn, Gent',
    capacity: 450,
    sold: 0,
    isSoldOut: false,
    description: 'Officiële opening van het Gents Whisky Festival met proefglas & gids.'
  },
  {
    id: 'gent-entree-zaterdagmiddag',
    city: 'gent',
    category: 'entree',
    title: 'Entree Zaterdagmiddag',
    dateStr: 'Zaterdag 3 oktober 2026',
    timeStr: '13:00 - 17:00 uur',
    originalPriceEur: 42.50,
    location: 'De Oude Vismijn, Gent',
    capacity: 450,
    sold: 450,
    isSoldOut: true,
    statusText: 'Uitverkocht',
    description: 'Populaire middagsessie in De Oude Vismijn Gent. Volledig uitverkocht voor publiek.'
  },
  {
    id: 'gent-entree-zaterdagavond',
    city: 'gent',
    category: 'entree',
    title: 'Entree Zaterdagavond',
    dateStr: 'Zaterdag 3 oktober 2026',
    timeStr: '19:00 - 23:00 uur',
    originalPriceEur: 42.50,
    location: 'De Oude Vismijn, Gent',
    capacity: 450,
    sold: 0,
    isSoldOut: false,
    description: 'Sfeervolle zaterdagavondproeverij met internationale en Belgische distilleerders.'
  },
  {
    id: 'gent-entree-zondagmiddag',
    city: 'gent',
    category: 'entree',
    title: 'Entree Zondagmiddag',
    dateStr: 'Zondag 4 oktober 2026',
    timeStr: '13:00 - 17:00 uur',
    originalPriceEur: 42.50,
    location: 'De Oude Vismijn, Gent',
    capacity: 450,
    sold: 0,
    isSoldOut: false,
    description: 'Ontspannen zondagmiddagsessie met zeldzame drams.'
  },

  // 2. Masterclasses Gent
  {
    id: 'gent-mc-dada-chapel-vrijdag',
    city: 'gent',
    category: 'masterclass',
    title: 'Dada Chapel Distillery Masterclass',
    dateStr: 'Vrijdag 2 oktober 2026',
    timeStr: '20:00 - 20:45 uur',
    originalPriceEur: 20.00,
    location: 'MC-Ruimte (De Oude Vismijn)',
    capacity: 35,
    sold: 0,
    isSoldOut: false,
    description: 'Lokale biologische distillatiekunst en experimentele vatmonsters.'
  },
  {
    id: 'gent-mc-cvh-whisky-zaterdag',
    city: 'gent',
    category: 'masterclass',
    title: 'CVH Whisky Masterclass',
    dateStr: 'Zaterdag 3 oktober 2026',
    timeStr: '12:15 - 13:00 uur',
    originalPriceEur: 20.00,
    location: 'MC-Ruimte (De Oude Vismijn)',
    capacity: 35,
    sold: 0,
    isSoldOut: false,
    description: 'Zeldzame Schotse single cask selecties met CVH specialist.'
  },
  {
    id: 'gent-mc-dada-chapel-zaterdag',
    city: 'gent',
    category: 'masterclass',
    title: 'Dada Chapel Distillery Masterclass (Middag)',
    dateStr: 'Zaterdag 3 oktober 2026',
    timeStr: '13:45 - 14:30 uur',
    originalPriceEur: 20.00,
    location: 'MC-Ruimte (De Oude Vismijn)',
    capacity: 35,
    sold: 0,
    isSoldOut: false,
    description: 'Middagsessie met Gentse distillatie-innovatie en proeverij.'
  },
  {
    id: 'gent-mc-fettercairn-zaterdag',
    city: 'gent',
    category: 'masterclass',
    title: 'Fettercairn Single Malt Masterclass',
    dateStr: 'Zaterdag 3 oktober 2026',
    timeStr: '15:00 - 15:45 uur',
    originalPriceEur: 20.00,
    location: 'MC-Ruimte (De Oude Vismijn)',
    capacity: 35,
    sold: 0,
    isSoldOut: false,
    description: 'Highland single malts en de unieke koperen koelring-techniek.'
  },
  {
    id: 'gent-mc-bowmore-zaterdag',
    city: 'gent',
    category: 'masterclass',
    title: 'Bowmore Islay Single Malt Masterclass',
    dateStr: 'Zaterdag 3 oktober 2026',
    timeStr: '19:30 - 20:15 uur',
    originalPriceEur: 20.00,
    location: 'MC-Ruimte (De Oude Vismijn)',
    capacity: 35,
    sold: 0,
    isSoldOut: false,
    extra: 'Teddy Joseph Global Brand Ambassador',
    description: 'Legendarische Islay turf & sherry cask drams uit No. 1 Vaults.'
  },
  {
    id: 'gent-mc-fuji-japan-zaterdag',
    city: 'gent',
    category: 'masterclass',
    title: 'Fuji Japanese Whisky Masterclass',
    dateStr: 'Zaterdag 3 oktober 2026',
    timeStr: '21:00 - 21:45 uur',
    originalPriceEur: 20.00,
    location: 'MC-Ruimte (De Oude Vismijn)',
    capacity: 35,
    sold: 0,
    isSoldOut: false,
    description: 'De elegantie van Japanse distillatie aan de voet van Mount Fuji.'
  },
  {
    id: 'gent-mc-jura-zondag',
    city: 'gent',
    category: 'masterclass',
    title: 'Jura Island Single Malt Masterclass',
    dateStr: 'Zondag 4 oktober 2026',
    timeStr: '12:15 - 13:00 uur',
    originalPriceEur: 20.00,
    location: 'MC-Ruimte (De Oude Vismijn)',
    capacity: 35,
    sold: 0,
    isSoldOut: false,
    description: 'Reis mee naar het afgelegen eiland Jura en proef 4 uitzonderlijke vatrijpingen.'
  },
  {
    id: 'gent-mc-laphroaig-zondag',
    city: 'gent',
    category: 'masterclass',
    title: 'Laphroaig Islay Masterclass',
    dateStr: 'Zondag 4 oktober 2026',
    timeStr: '13:30 - 14:15 uur',
    originalPriceEur: 20.00,
    location: 'MC-Ruimte (De Oude Vismijn)',
    capacity: 35,
    sold: 0,
    isSoldOut: false,
    extra: 'Teddy Joseph Global Brand Ambassador',
    description: 'De onmiskenbare turf- en medicinale tonen van Laphroaig met Teddy Joseph.'
  },
  {
    id: 'gent-mc-suntory-zondag',
    city: 'gent',
    category: 'masterclass',
    title: 'The House of Suntory Masterclass',
    dateStr: 'Zondag 4 oktober 2026',
    timeStr: '15:00 - 15:45 uur',
    originalPriceEur: 20.00,
    location: 'MC-Ruimte (De Oude Vismijn)',
    capacity: 35,
    sold: 0,
    isSoldOut: false,
    extra: 'Michael Yona Costa – Suntory Global Spirits',
    description: 'Meesterlijke Japanse blend- en distilleerkunst van The House of Suntory.'
  },
  {
    id: 'gent-mc-belgian-owl-zondag',
    city: 'gent',
    category: 'masterclass',
    title: 'Belgian Owl Distillery Masterclass',
    dateStr: 'Zondag 4 oktober 2026',
    timeStr: '13:30 - 14:15 uur',
    originalPriceEur: 20.00,
    location: 'MC-Ruimte (De Oude Vismijn)',
    capacity: 35,
    sold: 0,
    isSoldOut: false,
    description: 'Belgische terroir whisky van topniveau met Etienne Bouillon.'
  },
  {
    id: 'gent-mc-glenfiddich-zondag',
    city: 'gent',
    category: 'masterclass',
    title: 'Glenfiddich & The Balvenie Tasting',
    dateStr: 'Zondag 4 oktober 2026',
    timeStr: '15:00 - 15:45 uur',
    originalPriceEur: 20.00,
    location: 'MC-Ruimte (De Oude Vismijn)',
    capacity: 35,
    sold: 0,
    isSoldOut: false,
    description: 'Vergelijk twee iconische Dufftown zuster-distilleerderijen.'
  },

  // 3. Specials & Tours Gent (Inclusief uitverkochte items)
  {
    id: 'gent-special-bootje-zaterdag',
    city: 'gent',
    category: 'special',
    title: 'Rondvaart Gent - Whisky Bootje',
    dateStr: 'Zaterdag 3 oktober 2026',
    timeStr: '12:00 - 13:00 uur',
    originalPriceEur: 18.50,
    location: 'Entree-deur De Oude Vismijn',
    capacity: 50,
    sold: 50,
    isSoldOut: true,
    statusText: 'Uitverkocht',
    extra: 'Rondvaart over de Gentse grachten met proeverij',
    description: 'Exclusieve boottocht over de historische Gentse binnenwateren met 4 drams. Volledig uitverkocht voor publiek.'
  },
  {
    id: 'gent-special-dada-tour-vrijdag',
    city: 'gent',
    category: 'special',
    title: 'Rondleiding Dada Chapel Distilleerderij (Vrijdag)',
    dateStr: 'Vrijdag 2 oktober 2026',
    timeStr: '18:00 - 19:30 uur',
    originalPriceEur: 15.00,
    location: 'Entree-deur De Oude Vismijn',
    capacity: 15,
    sold: 15,
    isSoldOut: true,
    statusText: 'Uitverkocht',
    extra: 'Kijkje achter de schermen bij Dada Chapel',
    description: 'Wandel mee naar Dada Chapel voor een intieme rondleiding en vatmonsters. Volledig uitverkocht voor publiek.'
  },
  {
    id: 'gent-special-dada-tour-zaterdag',
    city: 'gent',
    category: 'special',
    title: 'Rondleiding Dada Chapel Distilleerderij (Zaterdag)',
    dateStr: 'Zaterdag 3 oktober 2026',
    timeStr: '11:00 - 12:30 uur',
    originalPriceEur: 15.00,
    location: 'Entree-deur De Oude Vismijn',
    capacity: 15,
    sold: 15,
    isSoldOut: true,
    statusText: 'Uitverkocht',
    extra: 'Ochtendrondleiding inclusief mini-tasting',
    description: 'Ochtendrondleiding bij Dada Chapel Distilleerderij inclusief mini-tasting. Volledig uitverkocht voor publiek.'
  },
  {
    id: 'gent-botteling-dada-chapel',
    city: 'gent',
    category: 'special',
    title: 'Festival Botteling: Dada Chapel Gentse Special',
    dateStr: 'Afhalen Festival (2-4 okt)',
    timeStr: 'Hele dag',
    originalPriceEur: 95.00,
    location: 'Festival Slijterij',
    capacity: 200,
    sold: 0,
    isSoldOut: false,
    extra: 'Single Cask 7Y Limousin Virgin Oak',
    description: 'Officiële exclusieve festivalbotteling van het Gents Whisky Festival 2026.'
  },

  // =========================================================================
  // --- DEN HAAG (Grote Kerk • 13, 14 & 15 nov 2026) ---
  // =========================================================================
  {
    id: 'dh-entree-vrijdag-vip',
    city: 'denhaag',
    category: 'special',
    title: 'VIP Sessie - Vrijdagmiddag',
    dateStr: 'Vrijdag 13 november 2026',
    timeStr: '13:00 - 17:00 uur',
    originalPriceEur: 79.50,
    location: 'Grote Kerk, Den Haag',
    capacity: 850,
    sold: 850,
    isSoldOut: true,
    statusText: 'Uitverkocht',
    description: 'Exclusieve openingssessie met zeldzame tastings en VIP lounge. Volledig uitverkocht.'
  },
  {
    id: 'dh-entree-vrijdagavond',
    city: 'denhaag',
    category: 'entree',
    title: 'Entree Vrijdagavond',
    dateStr: 'Vrijdag 13 november 2026',
    timeStr: '19:00 - 23:00 uur',
    originalPriceEur: 55.00,
    location: 'Grote Kerk, Den Haag',
    capacity: 1250,
    sold: 0,
    isSoldOut: false,
    description: 'Vrijdagavond festivaltoegang inclusief festivalglas en gids.'
  },
  {
    id: 'dh-entree-zaterdagmiddag',
    city: 'denhaag',
    category: 'entree',
    title: 'Entree Zaterdagmiddag',
    dateStr: 'Zaterdag 14 november 2026',
    timeStr: '13:00 - 17:00 uur',
    originalPriceEur: 55.00,
    location: 'Grote Kerk, Den Haag',
    capacity: 1250,
    sold: 1250,
    isSoldOut: true,
    statusText: 'Uitverkocht',
    description: 'De grote zaterdagmiddagproeverij in de historische Grote Kerk. Volledig uitverkocht.'
  },
  {
    id: 'dh-entree-zaterdagavond',
    city: 'denhaag',
    category: 'entree',
    title: 'Entree Zaterdagavond',
    dateStr: 'Zaterdag 14 november 2026',
    timeStr: '19:00 - 23:00 uur',
    originalPriceEur: 55.00,
    location: 'Grote Kerk, Den Haag',
    capacity: 1250,
    sold: 1250,
    isSoldOut: true,
    statusText: 'Uitverkocht',
    description: 'Avondsfeer, honderden whisky’s en live Schotse doedelzakken. Volledig uitverkocht.'
  },
  {
    id: 'dh-entree-zaterdag-vip',
    city: 'denhaag',
    category: 'special',
    title: 'VIP Toegang Zaterdag',
    dateStr: 'Zaterdag 14 november 2026',
    timeStr: '13:00 - 17:00 uur',
    originalPriceEur: 79.50,
    location: 'Grote Kerk, Den Haag',
    capacity: 500,
    sold: 500,
    isSoldOut: true,
    statusText: 'Uitverkocht',
    description: 'Zaterdag VIP arrangement met exclusieve pourings.'
  },
  {
    id: 'dh-entree-zondagmiddag',
    city: 'denhaag',
    category: 'entree',
    title: 'Entree Zondagmiddag',
    dateStr: 'Zondag 15 november 2026',
    timeStr: '13:00 - 17:00 uur',
    originalPriceEur: 55.00,
    location: 'Grote Kerk, Den Haag',
    capacity: 1250,
    sold: 0,
    isSoldOut: false,
    description: 'Gemoedelijke zondag met alle standhouders en tastings.'
  },
  {
    id: 'dh-mc-macallan-inc',
    city: 'denhaag',
    category: 'masterclass',
    title: 'The Macallan Exclusive (Inc. Torenklim)',
    dateStr: 'Zaterdag 14 november 2026',
    timeStr: '14:00 - 16:00 uur',
    originalPriceEur: 77.50,
    location: 'Grote Kerk Toren & Tasting Room',
    capacity: 20,
    sold: 0,
    isSoldOut: false,
    description: 'Sherry Cask Single Malts inclusief torenbeklimming.'
  },
  {
    id: 'dh-mc-macallan-ex',
    city: 'denhaag',
    category: 'masterclass',
    title: 'The Macallan Exclusive Tasting',
    dateStr: 'Zaterdag 14 november 2026',
    timeStr: '19:30 - 20:30 uur',
    originalPriceEur: 70.00,
    location: 'Grote Kerk Tasting Room',
    capacity: 25,
    sold: 0,
    isSoldOut: false,
    description: 'Zeldzame Macallan bottelingen in intieme setting.'
  },
  {
    id: 'dh-mc-teeling',
    city: 'denhaag',
    category: 'masterclass',
    title: 'Teeling Irish Whiskey Masterclass',
    dateStr: 'Vrijdag 13 november 2026',
    timeStr: '20:00 - 20:45 uur',
    originalPriceEur: 20.00,
    location: 'Grote Kerk Tasting Room',
    capacity: 35,
    sold: 0,
    isSoldOut: false,
    description: 'Dublin’s craft renaissance en bekroonde single pot still whiskeys.'
  },
  {
    id: 'dh-mc-intro',
    city: 'denhaag',
    category: 'masterclass',
    title: 'Whisky Introductie Tasting',
    dateStr: 'Zaterdag 14 november 2026',
    timeStr: '13:30 - 14:15 uur',
    originalPriceEur: 7.50,
    location: 'Nutshuis Spaarkamer',
    capacity: 40,
    sold: 0,
    isSoldOut: false,
    description: 'Basis nosing & tasting voor beginnende whiskyliefhebbers.'
  },
  {
    id: 'dh-special-tram',
    city: 'denhaag',
    category: 'special',
    title: 'Whiskytram Historische Rit & Tasting',
    dateStr: 'Zondag 15 november 2026',
    timeStr: '14:00 - 15:30 uur',
    originalPriceEur: 45.00,
    location: 'Historische Tram Den Haag',
    capacity: 36,
    sold: 36,
    isSoldOut: true,
    statusText: 'Uitverkocht',
    description: 'Rijdende whiskyproeverij door historisch Den Haag en Scheveningen.'
  },

  // =========================================================================
  // --- AMSTERDAM (De Hallen / Zuiderkerk • 16 jan 2027) ---
  // =========================================================================
  {
    id: 'ams-entree-zaterdagmiddag',
    city: 'amsterdam',
    category: 'entree',
    title: 'Weekend Entree Zaterdagmiddag',
    dateStr: 'Zaterdag 16 januari 2027',
    timeStr: '13:00 - 17:00 uur',
    originalPriceEur: 39.95,
    location: 'De Hallen Amsterdam',
    capacity: 575,
    sold: 0,
    isSoldOut: false,
    description: 'Opening van het Amsterdamse Whisky Festival in De Hallen.'
  },
  {
    id: 'ams-entree-zaterdagavond',
    city: 'amsterdam',
    category: 'entree',
    title: 'Weekend Entree Zaterdagavond',
    dateStr: 'Zaterdag 16 januari 2027',
    timeStr: '19:00 - 23:00 uur',
    originalPriceEur: 39.95,
    location: 'De Hallen Amsterdam',
    capacity: 575,
    sold: 0,
    isSoldOut: false,
    description: 'Zaterdagavondproeverij in De Hallen met sfeervolle muziek.'
  },
  {
    id: 'ams-entree-vip',
    city: 'amsterdam',
    category: 'special',
    title: 'VIP Exclusief Weekend Ticket',
    dateStr: 'Zaterdag 16 januari 2027',
    timeStr: '13:00 - 17:00 uur',
    originalPriceEur: 75.00,
    location: 'De Hallen Amsterdam',
    capacity: 100,
    sold: 0,
    isSoldOut: false,
    description: 'VIP toegang met exclusieve lounge en vintage tasting.'
  },
  {
    id: 'ams-mc-vintage',
    city: 'amsterdam',
    category: 'masterclass',
    title: 'Vintage & Rare Single Malts Masterclass',
    dateStr: 'Zaterdag 16 januari 2027',
    timeStr: '15:00 - 16:00 uur',
    originalPriceEur: 25.00,
    location: 'De Hallen Tasting Room',
    capacity: 30,
    sold: 0,
    isSoldOut: false,
    description: 'Exclusieve proeverij van oude en zeldzame vatgebottelde whisky’s.'
  },
  {
    id: 'ams-botteling-glen-scotia',
    city: 'amsterdam',
    category: 'special',
    title: 'Festival Botteling: Glen Scotia 5YO Oloroso',
    dateStr: 'Zaterdag 16 januari 2027',
    timeStr: 'Hele dag',
    originalPriceEur: 82.50,
    location: 'Festival Slijterij',
    capacity: 180,
    sold: 0,
    isSoldOut: false,
    description: 'Exclusieve single cask botteling 1st fill Oloroso Hogshead.'
  },
];

export interface CityCatalogStats {
  city: 'gent' | 'denhaag' | 'amsterdam';
  cityName: string;
  totalCapacity: number;
  totalSold: number;
  ticketTypesCount: number;
  soldPercentage: string;
}

// In-memory runtime cache voor client-side
let liveCatalogCache: FestivalCatalogItem[] | null = null;
let liveStatsCache: Record<'gent' | 'denhaag' | 'amsterdam', CityCatalogStats> | null = null;
let isFetchingCatalog = false;

/**
 * Haalt live tickets op uit de Whiskytix GHL Catalog API
 */
export async function fetchLiveCatalog(force = false): Promise<FestivalCatalogItem[]> {
  if (!force && liveCatalogCache && liveCatalogCache.length > 0) {
    return liveCatalogCache;
  }
  if (isFetchingCatalog) {
    return liveCatalogCache || FESTIVAL_CATALOG;
  }

  isFetchingCatalog = true;
  try {
    const res = await fetch(`/api/catalog${force ? '?refresh=true' : ''}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.items) && data.items.length > 0) {
        liveCatalogCache = data.items;
        if (data.stats) {
          liveStatsCache = data.stats;
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('whiskytix:catalog-updated', { detail: data }));
        }
        return data.items;
      }
    }
  } catch (err) {
    console.warn('[FestivalCatalog] Kon live catalogus niet ophalen:', err);
  } finally {
    isFetchingCatalog = false;
  }

  return liveCatalogCache || FESTIVAL_CATALOG;
}

export function getLiveStats(): Record<'gent' | 'denhaag' | 'amsterdam', CityCatalogStats> | null {
  return liveStatsCache;
}

export function getFestivalCatalog(city: 'gent' | 'denhaag' | 'amsterdam'): FestivalCatalogItem[] {
  if (liveCatalogCache && liveCatalogCache.length > 0) {
    const filtered = liveCatalogCache.filter((item) => item.city === city);
    if (filtered.length > 0) return filtered;
  }
  return FESTIVAL_CATALOG.filter((item) => item.city === city);
}

export function formatEuro(amount: number): string {
  return `€ ${amount.toFixed(2).replace('.', ',')}`;
}

/**
 * React Hook om overal in de cockpit live GHL tickets en capaciteiten te gebruiken
 */
export function useLiveCatalog(city?: 'gent' | 'denhaag' | 'amsterdam' | 'all') {
  const [items, setItems] = React.useState<FestivalCatalogItem[]>(() => {
    if (city && city !== 'all') {
      return getFestivalCatalog(city);
    }
    return liveCatalogCache || FESTIVAL_CATALOG;
  });
  const [stats, setStats] = React.useState<Record<'gent' | 'denhaag' | 'amsterdam', CityCatalogStats> | null>(liveStatsCache);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      const data = await fetchLiveCatalog();
      if (isMounted) {
        if (city && city !== 'all') {
          setItems(data.filter((i) => i.city === city));
        } else {
          setItems(data);
        }
        setStats(getLiveStats());
        setLoading(false);
      }
    };
    load();

    const handleUpdate = (e: any) => {
      if (!isMounted) return;
      const allItems = e.detail?.items || liveCatalogCache || [];
      if (city && city !== 'all') {
        setItems(allItems.filter((i: any) => i.city === city));
      } else {
        setItems(allItems);
      }
      setStats(e.detail?.stats || getLiveStats());
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('whiskytix:catalog-updated', handleUpdate);
    }
    return () => {
      isMounted = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('whiskytix:catalog-updated', handleUpdate);
      }
    };
  }, [city]);

  const refresh = async () => {
    setLoading(true);
    const data = await fetchLiveCatalog(true);
    if (city && city !== 'all') {
      setItems(data.filter((i) => i.city === city));
    } else {
      setItems(data);
    }
    setStats(getLiveStats());
    setLoading(false);
  };

  return { items, stats, loading, refresh };
}
