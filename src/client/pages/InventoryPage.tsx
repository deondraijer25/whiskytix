import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  Edit3,
  Lock,
  Unlock,
  Save,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Users,
} from 'lucide-react';
import { INITIAL_FESTIVALS } from '../data/mockData';
import { useEnvironment } from '../context/EnvironmentContext';
import { MollieEnvToggle } from '../components/MollieEnvToggle';

interface CatalogItem {
  id: string;
  city: string;
  category: string;
  rawCategory?: string;
  title: string;
  dateStr?: string;
  timeStr?: string;
  location?: string;
  capacity?: number;
  sold?: number;
  isSoldOut?: boolean;
  day?: string;
}

interface BookingEntry {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  quantity: number;
  createdAt: string;
}

interface InventoryCardItem {
  id: string;
  city: string;
  sectionKey: string;
  title: string;
  dateStr: string;
  timeStr: string;
  location: string;
  sold: number;
  reserved: number;
  max: number;
  isSoldOut: boolean;
  bookings: BookingEntry[];
}

interface SectionConfig {
  key: string;
  label: string;
  dotColor: string;
  unitLabel: string;
}

const SECTION_CONFIGS: SectionConfig[] = [
  { key: 'entree', label: 'Entree & Festival Sessies', dotColor: '#006448', unitLabel: 'kaarten' },
  { key: 'masterclass', label: 'Masterclasses', dotColor: '#CAAC8E', unitLabel: 'plaatsen' },
  { key: 'botteling', label: 'Festival Bottelingen', dotColor: '#8A6831', unitLabel: 'flessen' },
  { key: 'tram', label: 'Whiskytram', dotColor: '#2563EB', unitLabel: 'plaatsen' },
  { key: 'warehouse', label: 'Warehouse Tastings', dotColor: '#7C3AED', unitLabel: 'plaatsen' },
  { key: 'trail', label: 'Whiskytrail', dotColor: '#0F766E', unitLabel: 'plaatsen' },
  { key: 'vatenmaken', label: 'Workshops & Vatenmaken', dotColor: '#B45309', unitLabel: 'plaatsen' },
  { key: 'special', label: 'Overige Specials', dotColor: '#4C5752', unitLabel: 'tickets' },
];

function resolveSectionKey(item: CatalogItem): string {
  const raw = (item.rawCategory || item.category || '').toLowerCase().trim();
  const titleLower = (item.title || '').toLowerCase();

  if (raw === 'entree' || raw === 'ticket' || titleLower.startsWith('entree ') || titleLower.includes('vip ticket')) {
    return 'entree';
  }
  if (raw === 'masterclass' || titleLower.includes('masterclass') || titleLower.includes('torentasting')) {
    return 'masterclass';
  }
  if (raw === 'botteling' || titleLower.includes('botteling') || titleLower.includes('bottle')) {
    return 'botteling';
  }
  if (raw === 'tram' || titleLower.includes('tram')) {
    return 'tram';
  }
  if (raw === 'warehouse' || titleLower.includes('warehouse')) {
    return 'warehouse';
  }
  if (raw === 'trail' || titleLower.includes('trail')) {
    return 'trail';
  }
  if (raw === 'vatenmaken' || titleLower.includes('vaten') || titleLower.includes('workshop')) {
    return 'vatenmaken';
  }
  return 'special';
}

function normalizeTitle(str: string): string {
  return (str || '')
    .replace(/\s*\[(verzenden|ophalen)\]\s*/gi, ' ')
    .replace(/\s*(?:[01]?\d|2[0-3])[:.][0-5]\d\s*[-–—]\s*(?:[01]?\d|2[0-3])[:.][0-5]\d\s*(?:uur)?/gi, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function extractWeekday(str: string): string {
  const s = (str || '').toLowerCase();
  if (s.includes('vrijdag')) return 'vrijdag';
  if (s.includes('zaterdag')) return 'zaterdag';
  if (s.includes('zondag')) return 'zondag';
  return '';
}

function extractStartTime(str: string): string {
  const m = (str || '').match(/(\d{1,2})[:.](\d{2})/);
  if (!m) return '';
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

function matchTicketToItem(
  ticket: { session?: string; dateStr?: string; timeStr?: string },
  items: InventoryCardItem[]
): InventoryCardItem | null {
  const tRaw = (ticket.session || '').trim();
  if (!tRaw) return null;

  const tNorm = normalizeTitle(tRaw);
  const tDay = extractWeekday(`${ticket.dateStr || ''} ${tRaw}`);
  const tStart = extractStartTime(`${ticket.timeStr || ''} ${tRaw}`);
  const tLower = tRaw.toLowerCase();

  let bestItem: InventoryCardItem | null = null;
  let bestScore = 0;

  for (const item of items) {
    const iNorm = normalizeTitle(item.title);
    const iDay = extractWeekday(`${item.dateStr} ${item.title}`);
    const iStart = extractStartTime(`${item.timeStr} ${item.title}`);
    const iLower = item.title.toLowerCase();

    let titleScore = 0;
    if (tNorm && iNorm && tNorm === iNorm) {
      titleScore = 100;
    } else if (tNorm.length >= 10 && iNorm.startsWith(tNorm)) {
      titleScore = 85;
    } else if (iNorm.length >= 10 && tNorm.startsWith(iNorm)) {
      titleScore = 80;
    } else if (tNorm.length >= 12 && (iNorm.includes(tNorm) || tNorm.includes(iNorm))) {
      titleScore = 65;
    } else if (item.sectionKey === 'entree') {
      const dayparts = ['vrijdagmiddag', 'vrijdagavond', 'zaterdagmiddag', 'zaterdagavond', 'zondagmiddag'];
      const matchedPart = dayparts.find((dp) => tLower.includes(dp) && iLower.includes(dp));
      if (matchedPart) {
        const tIsVip = tLower.includes('vip');
        const iIsVip = iLower.includes('vip');
        if (tIsVip === iIsVip) {
          titleScore = 75;
        }
      } else if (tLower.includes('vip') && iLower.includes('vip') && (!tDay || !iDay || tDay === iDay)) {
        titleScore = 70;
      }
    }

    if (titleScore === 0) continue;

    // Disqualify explicit day mismatch
    if (tDay && iDay && tDay !== iDay) continue;
    // Disqualify explicit start-time mismatch
    if (tStart && iStart && tStart !== iStart) continue;

    let score = titleScore;
    if (tDay && iDay && tDay === iDay) score += 15;
    if (tStart && iStart && tStart === iStart) score += 25;

    if (score > bestScore) {
      bestScore = score;
      bestItem = item;
    }
  }

  return bestItem;
}

export const InventoryPage: React.FC = () => {
  const { cityId } = useParams<{ cityId?: string }>();
  const [items, setItems] = useState<InventoryCardItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedCity, setSelectedCity] = useState<'denhaag' | 'amsterdam' | 'gent'>(
    (cityId as any) || 'denhaag'
  );
  const [activeSectionFilter, setActiveSectionFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlyWithBookings, setOnlyWithBookings] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempCapacity, setTempCapacity] = useState<number>(0);
  const [expandedBookingsId, setExpandedBookingsId] = useState<string | null>(null);
  const [capacityOverrides, setCapacityOverrides] = useState<Record<string, number>>({});
  const [soldOutOverrides, setSoldOutOverrides] = useState<Record<string, boolean>>({});
  const { env: mollieEnv } = useEnvironment();

  const effectiveCity = (cityId as any) || selectedCity;
  const activeFestival = INITIAL_FESTIVALS.find((f: any) => f.id === effectiveCity);

  const fetchLiveInventory = async (targetEnv?: 'test' | 'live') => {
    const activeEnv = targetEnv || mollieEnv;
    setLoading(true);
    try {
      const [catalogRes, ordersRes] = await Promise.all([
        fetch(`/api/catalog?city=${effectiveCity}`),
        fetch(`/api/admin/orders?city=${effectiveCity}&env=${activeEnv}`),
      ]);

      const catalogData = catalogRes.ok ? await catalogRes.json() : { items: [] };
      const ordersData = ordersRes.ok ? await ordersRes.json() : { orders: [] };

      const rawItems: CatalogItem[] = Array.isArray(catalogData?.items) ? catalogData.items : [];
      const orders: any[] = Array.isArray(ordersData?.orders) ? ordersData.orders : [];

      const built: InventoryCardItem[] = rawItems.map((ci) => {
        const sectionKey = resolveSectionKey(ci);
        const cap = Number(ci.capacity) || 0;
        return {
          id: ci.id,
          city: effectiveCity,
          sectionKey,
          title: ci.title || 'Onbekend item',
          dateStr: ci.dateStr || 'Datum volgt',
          timeStr: ci.timeStr || '',
          location: ci.location || '',
          sold: 0,
          reserved: 0,
          max: cap,
          isSoldOut: Boolean(ci.isSoldOut),
          bookings: [],
        };
      });

      const nowMs = Date.now();
      const paidOrders = orders.filter((o) => o.status === 'paid');
      const pendingOrders = orders.filter((o) => {
        if (o.status !== 'pending') return false;
        if (o.expiresAt && new Date(o.expiresAt).getTime() < nowMs) return false;
        return true;
      });

      // Count paid tickets + collect buyer bookings per item
      for (const order of paidOrders) {
        const tickets = Array.isArray(order.tickets) ? order.tickets : [];
        const perItemCount = new Map<string, number>();

        for (const t of tickets) {
          let matched = matchTicketToItem(t, built);
          if (!matched && t.session) {
            const fallbackTitle = String(t.session).replace(/\s*\[(verzenden|ophalen)\]\s*/gi, '').trim();
            const fallbackKey = `unlisted::${normalizeTitle(fallbackTitle)}::${extractWeekday(t.dateStr || '')}::${extractStartTime(t.timeStr || '')}`;
            matched = built.find((b) => b.id === fallbackKey) || null;
            if (!matched) {
              matched = {
                id: fallbackKey,
                city: effectiveCity,
                sectionKey: resolveSectionKey({ id: fallbackKey, city: effectiveCity, category: t.type || '', title: fallbackTitle }),
                title: fallbackTitle,
                dateStr: t.dateStr || 'Datum onbekend',
                timeStr: t.timeStr || '',
                location: 'Uit bestellingen (niet in actieve catalogus)',
                sold: 0,
                reserved: 0,
                max: 0,
                isSoldOut: false,
                bookings: [],
              };
              built.push(matched);
            }
          }
          if (matched) {
            matched.sold += 1;
            perItemCount.set(matched.id, (perItemCount.get(matched.id) || 0) + 1);
          }
        }

        for (const [itemId, qty] of perItemCount.entries()) {
          const target = built.find((b) => b.id === itemId);
          if (target) {
            target.bookings.push({
              orderNumber: order.orderNumber || '-',
              customerName: order.customerName || 'Onbekend',
              customerEmail: order.customerEmail || '',
              quantity: qty,
              createdAt: order.createdAt || '',
            });
          }
        }
      }

      // Count active pending cart-lock reservations
      for (const order of pendingOrders) {
        const tickets = Array.isArray(order.tickets) ? order.tickets : [];
        for (const t of tickets) {
          const matched = matchTicketToItem(t, built);
          if (matched) {
            matched.reserved += 1;
          }
        }
      }

      // Sort within each section: Entree by day/time, other sections by sold DESC then day/title
      const dayOrder: Record<string, number> = { vrijdag: 1, zaterdag: 2, zondag: 3 };
      built.sort((a, b) => {
        if (a.sectionKey !== b.sectionKey) return 0;
        if (a.sectionKey === 'entree') {
          const da = dayOrder[extractWeekday(`${a.dateStr} ${a.title}`)] || 9;
          const db = dayOrder[extractWeekday(`${b.dateStr} ${b.title}`)] || 9;
          if (da !== db) return da - db;
          return extractStartTime(a.timeStr).localeCompare(extractStartTime(b.timeStr));
        }
        if (b.sold !== a.sold) return b.sold - a.sold;
        const da = dayOrder[extractWeekday(`${a.dateStr} ${a.title}`)] || 9;
        const db = dayOrder[extractWeekday(`${b.dateStr} ${b.title}`)] || 9;
        if (da !== db) return da - db;
        return a.title.localeCompare(b.title);
      });

      setItems(built);
    } catch (err) {
      console.error('Kon live capaciteit niet ophalen:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setActiveSectionFilter('all');
    setSearchQuery('');
    setExpandedBookingsId(null);
    fetchLiveInventory(mollieEnv);
  }, [effectiveCity, mollieEnv]);

  const enrichedItems = useMemo(() => {
    return items.map((item) => {
      const max = capacityOverrides[item.id] !== undefined ? capacityOverrides[item.id] : item.max;
      const isSoldOut =
        soldOutOverrides[item.id] !== undefined
          ? soldOutOverrides[item.id]
          : item.isSoldOut || (max > 0 && item.sold >= max);
      return { ...item, max, isSoldOut };
    });
  }, [items, capacityOverrides, soldOutOverrides]);

  const availableSections = useMemo(() => {
    return SECTION_CONFIGS.map((cfg) => {
      const sectionItems = enrichedItems.filter((i) => i.sectionKey === cfg.key);
      const totalSold = sectionItems.reduce((acc, i) => acc + i.sold, 0);
      const totalCap = sectionItems.reduce((acc, i) => acc + i.max, 0);
      return {
        ...cfg,
        items: sectionItems,
        totalSold,
        totalCap,
      };
    }).filter((s) => s.items.length > 0);
  }, [enrichedItems]);

  const visibleSections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return availableSections
      .filter((sec) => activeSectionFilter === 'all' || sec.key === activeSectionFilter)
      .map((sec) => {
        const filtered = sec.items.filter((item) => {
          if (onlyWithBookings && item.sold <= 0) return false;
          if (!q) return true;
          return (
            item.title.toLowerCase().includes(q) ||
            item.dateStr.toLowerCase().includes(q) ||
            item.timeStr.toLowerCase().includes(q) ||
            item.location.toLowerCase().includes(q)
          );
        });
        return { ...sec, filteredItems: filtered };
      })
      .filter((sec) => sec.filteredItems.length > 0);
  }, [availableSections, activeSectionFilter, searchQuery, onlyWithBookings]);

  const toggleSoldOut = async (item: InventoryCardItem) => {
    const nextSoldOut = !item.isSoldOut;
    setSoldOutOverrides((prev) => ({
      ...prev,
      [item.id]: nextSoldOut,
    }));
    if (!item.id.startsWith('unlisted::')) {
      try {
        await fetch(`/api/catalog/${encodeURIComponent(item.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isSoldOut: nextSoldOut }),
        });
      } catch (err) {
        console.error('Kon uitverkocht-status niet opslaan in GHL:', err);
      }
    }
  };

  const startEdit = (item: InventoryCardItem) => {
    setEditingId(item.id);
    setTempCapacity(item.max);
  };

  const saveCapacity = async (id: string) => {
    const nextCap = Math.max(0, tempCapacity);
    setCapacityOverrides((prev) => ({
      ...prev,
      [id]: nextCap,
    }));
    setEditingId(null);
    if (!id.startsWith('unlisted::')) {
      try {
        await fetch(`/api/catalog/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ capacity: nextCap }),
        });
      } catch (err) {
        console.error('Kon capaciteit niet opslaan in GHL:', err);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-6 shadow-[5px_5px_0px_rgba(29,28,26,0.9)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-extrabold uppercase tracking-widest text-[#006448] bg-[#d8e7e2] px-2 py-0.5 rounded border border-[#8ba198]">
              {activeFestival ? `${activeFestival.edition} • Capaciteit` : 'Voorraad & Toegangscontrole'}
            </span>
            <span
              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                mollieEnv === 'live'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-amber-100 text-amber-800 border-amber-300'
              }`}
            >
              {mollieEnv === 'live' ? 'Mollie Live Modus' : 'Mollie Testmodus'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1D1C1A] tracking-tight">
            {activeFestival ? `Zaalcapaciteit: ${activeFestival.name}` : 'Sessies & Zaalcapaciteit'}
          </h1>
          <p className="text-xs sm:text-sm text-[#4c5752] mt-0.5 font-medium">
            Realtime verkochte kaarten en bezetting per onderdeel: entree, masterclasses, bottelingen, whiskytram en tastings.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => fetchLiveInventory(mollieEnv)}
            disabled={loading}
            className="px-3 py-1.5 rounded border-2 border-[#1D1C1A] bg-[#FAF7F2] hover:bg-[#EFE9DF] text-xs font-extrabold text-[#1D1C1A] flex items-center gap-1.5 shadow-[2px_2px_0px_rgba(29,28,26,0.9)] disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Verversen
          </button>

          <MollieEnvToggle onEnvChange={(newEnv) => fetchLiveInventory(newEnv)} />

          {!cityId && (
            <div className="flex items-center gap-1 bg-[#FAF7F2] p-1.5 rounded border-2 border-[#1D1C1A] w-full sm:w-auto overflow-x-auto">
              {[
                { id: 'denhaag', label: 'Den Haag' },
                { id: 'amsterdam', label: 'Amsterdam' },
                { id: 'gent', label: 'Gent' },
              ].map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCity(c.id as any)}
                  className={`flex-1 sm:flex-initial px-3 py-1.5 rounded text-xs font-extrabold uppercase tracking-wider transition-all text-center ${
                    selectedCity === c.id
                      ? 'bg-[#006448] text-white shadow-[2px_2px_0px_rgba(29,28,26,0.9)]'
                      : 'text-[#4c5752] hover:text-[#1D1C1A]'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Category Filter Pills & Search Bar */}
      <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-4 shadow-[4px_4px_0px_rgba(29,28,26,0.9)] space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveSectionFilter('all')}
            className={`px-3 py-1.5 rounded text-xs font-extrabold uppercase tracking-wider border-2 transition-all ${
              activeSectionFilter === 'all'
                ? 'bg-[#006448] text-white border-[#1D1C1A] shadow-[2px_2px_0px_rgba(29,28,26,0.9)]'
                : 'bg-[#FAF7F2] text-[#4c5752] border-[#c1d4ce] hover:border-[#1D1C1A]'
            }`}
          >
            Alle onderdelen ({enrichedItems.reduce((acc, i) => acc + i.sold, 0)})
          </button>
          {availableSections.map((sec) => (
            <button
              key={sec.key}
              onClick={() => setActiveSectionFilter(sec.key)}
              className={`px-3 py-1.5 rounded text-xs font-extrabold uppercase tracking-wider border-2 transition-all flex items-center gap-1.5 ${
                activeSectionFilter === sec.key
                  ? 'bg-[#006448] text-white border-[#1D1C1A] shadow-[2px_2px_0px_rgba(29,28,26,0.9)]'
                  : 'bg-[#FAF7F2] text-[#4c5752] border-[#c1d4ce] hover:border-[#1D1C1A]'
              }`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: activeSectionFilter === sec.key ? '#FAF7F2' : sec.dotColor }}
              />
              <span>{sec.label}</span>
              <span className="opacity-80">({sec.totalSold})</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#4c5752] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Zoek op masterclass, botteling, tram, dag of tijd..."
              className="w-full pl-9 pr-3 py-2 bg-white border-2 border-[#1D1C1A] rounded text-xs font-semibold text-[#1D1C1A] placeholder:text-[#7a8580]"
            />
          </div>

          <label className="inline-flex items-center gap-2 text-xs font-extrabold text-[#1D1C1A] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyWithBookings}
              onChange={(e) => setOnlyWithBookings(e.target.checked)}
              className="w-4 h-4 accent-[#006448] rounded border-2 border-[#1D1C1A]"
            />
            <span>Alleen onderdelen met boekingen (&gt; 0 verkocht)</span>
          </label>
        </div>
      </div>

      {/* Loading State */}
      {loading && items.length === 0 && (
        <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-10 text-center shadow-[4px_4px_0px_rgba(29,28,26,0.9)]">
          <RefreshCw className="w-6 h-6 animate-spin text-[#006448] mx-auto mb-2" />
          <p className="text-sm font-extrabold text-[#1D1C1A]">Live zaalcapaciteit &amp; bestellingen laden...</p>
        </div>
      )}

      {/* Empty Filter Result */}
      {!loading && visibleSections.length === 0 && (
        <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-8 text-center shadow-[4px_4px_0px_rgba(29,28,26,0.9)]">
          <p className="text-sm font-extrabold text-[#1D1C1A]">Geen onderdelen gevonden voor dit filter.</p>
          <p className="text-xs text-[#4c5752] mt-1">Pas je zoekterm aan of schakel "Alleen met boekingen" uit.</p>
        </div>
      )}

      {/* Per-Category Sections (Identical Card Grid Layout) */}
      {visibleSections.map((section) => (
        <div key={section.key} className="space-y-4 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-[#1D1C1A] flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: section.dotColor }}
              ></span>
              <span>{section.label}</span>
            </h2>
            <span className="text-xs font-extrabold text-[#4c5752] bg-[#FAF7F2] px-2.5 py-1 rounded border border-[#c1d4ce]">
              {section.totalSold.toLocaleString('nl-NL')}
              {section.totalCap > 0 ? ` / ${section.totalCap.toLocaleString('nl-NL')}` : ''} {section.unitLabel} verkocht • {section.filteredItems.length} {section.filteredItems.length === 1 ? 'onderdeel' : 'onderdelen'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {section.filteredItems.map((s) => {
              const hasCapacity = s.max > 0;
              const pct = hasCapacity ? Math.min(100, Math.round((s.sold / s.max) * 100)) : 0;
              const isFull = s.isSoldOut || (hasCapacity && s.sold >= s.max);
              const isExpanded = expandedBookingsId === s.id;

              return (
                <div
                  key={s.id}
                  className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-4 sm:p-5 shadow-[4px_4px_0px_rgba(29,28,26,0.9)] space-y-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#006448] bg-[#d8e7e2] px-2 py-0.5 rounded border border-[#8ba198] inline-block">
                        {s.dateStr}
                      </span>
                      <h3 className="font-extrabold text-sm sm:text-base text-[#1D1C1A] mt-1 leading-snug">
                        {s.title}
                      </h3>
                      {(s.timeStr || s.location) && (
                        <p className="text-xs text-[#4c5752] font-semibold mt-0.5">
                          {[s.timeStr, s.location].filter(Boolean).join(' • ')}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => toggleSoldOut(s)}
                      className={`px-2.5 py-1 rounded text-xs font-extrabold uppercase tracking-wider border-2 transition-all flex items-center gap-1 shrink-0 ${
                        isFull
                          ? 'bg-red-800 text-white border-[#1D1C1A] shadow-[2px_2px_0px_rgba(29,28,26,0.9)]'
                          : 'bg-emerald-100 text-[#006448] border-[#006448]'
                      }`}
                    >
                      {isFull ? (
                        <>
                          <Lock className="w-3.5 h-3.5" /> UITVERKOCHT
                        </>
                      ) : (
                        <>
                          <Unlock className="w-3.5 h-3.5" /> BESCHIKBAAR
                        </>
                      )}
                    </button>
                  </div>

                  {/* Progress Bar & Numbers */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-extrabold">
                      <span className="text-[#1D1C1A]">
                        {hasCapacity
                          ? `${s.sold.toLocaleString('nl-NL')} / ${s.max.toLocaleString('nl-NL')} ${section.unitLabel}`
                          : `${s.sold.toLocaleString('nl-NL')} ${section.unitLabel} verkocht`}
                      </span>
                      <span className={pct >= 90 ? 'text-red-700' : 'text-[#006448]'}>
                        {hasCapacity ? `${pct}% bezet` : 'Geen limiet'}
                      </span>
                    </div>

                    <div className="w-full bg-[#c1d4ce] h-2.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          pct >= 100
                            ? 'bg-red-800'
                            : pct >= 80
                            ? 'bg-amber-600'
                            : 'bg-[#006448]'
                        }`}
                        style={{ width: hasCapacity ? `${pct}%` : s.sold > 0 ? '100%' : '0%' }}
                      ></div>
                    </div>
                  </div>

                  {/* Footer: Cart lock, Bookings expand & Edit Capacity */}
                  <div className="pt-2 border-t border-[#c1d4ce] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    {editingId === s.id ? (
                      <div className="flex flex-wrap items-center gap-2 w-full">
                        <span className="text-xs font-bold text-[#4c5752]">Max:</span>
                        <input
                          type="number"
                          value={tempCapacity}
                          onChange={(e) => setTempCapacity(parseInt(e.target.value, 10) || 0)}
                          className="w-24 px-2 py-1.5 bg-white border-2 border-[#1D1C1A] rounded text-base sm:text-xs font-extrabold"
                        />
                        <button
                          onClick={() => saveCapacity(s.id)}
                          className="btn-letterpress py-1.5 px-3 rounded text-xs font-extrabold flex items-center gap-1"
                        >
                          <Save className="w-3.5 h-3.5" /> Opslaan
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-xs font-bold text-[#4c5752] hover:text-[#1D1C1A] py-1.5 px-2"
                        >
                          Annuleer
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-xs text-[#4c5752] font-semibold">
                            Cart lock: <strong>{s.reserved}</strong>
                          </span>
                          {s.bookings.length > 0 && (
                            <button
                              onClick={() => setExpandedBookingsId(isExpanded ? null : s.id)}
                              className="text-xs font-extrabold text-[#1D1C1A] bg-[#FAF7F2] hover:bg-[#EFE9DF] border border-[#1D1C1A] px-2 py-0.5 rounded flex items-center gap-1"
                            >
                              <Users className="w-3 h-3 text-[#006448]" />
                              <span>
                                {s.bookings.length} {s.bookings.length === 1 ? 'boeking' : 'boekingen'}
                              </span>
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          )}
                        </div>

                        <button
                          onClick={() => startEdit(s)}
                          className="text-xs font-extrabold text-[#006448] hover:underline flex items-center gap-1 self-start sm:self-auto"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Capaciteit Wijzigen</span>
                        </button>
                      </>
                    )}
                  </div>

                  {/* Expandable Bookings List */}
                  {isExpanded && s.bookings.length > 0 && (
                    <div className="pt-2 border-t border-dashed border-[#c1d4ce] space-y-1.5 max-h-56 overflow-y-auto">
                      {s.bookings.map((b, idx) => (
                        <div
                          key={`${b.orderNumber}-${idx}`}
                          className="flex items-center justify-between gap-2 text-xs bg-[#FAF7F2] px-2.5 py-1.5 rounded border border-[#e5ded2]"
                        >
                          <div className="min-w-0">
                            <span className="font-extrabold text-[#1D1C1A]">{b.customerName}</span>
                            <span className="text-[#4c5752] ml-2 font-mono text-[11px]">{b.orderNumber}</span>
                          </div>
                          <span className="font-extrabold text-[#006448] shrink-0">
                            {b.quantity}x
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
