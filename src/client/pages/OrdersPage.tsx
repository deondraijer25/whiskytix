import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Search, ShoppingBag, CheckCircle2, Clock, X, ChevronRight, Download, Mail, RefreshCw, Plus, Gift, CheckCircle } from 'lucide-react';
import { INITIAL_FESTIVALS, Order } from '../data/mockData';
import { OrderDetailDrawer } from '../components/OrderDetailDrawer';

function formatOrderDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const isToday = new Date().toDateString() === d.toDateString();
    const timeStr = d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) + ' uur';
    if (isToday) {
      return `Vandaag, ${timeStr}`;
    }
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) + ', ' + timeStr;
  } catch {
    return dateStr;
  }
}

const CITY_THEMES: Record<string, {
  primary: string;
  textPrimary: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  focusRing: string;
}> = {
  gent: {
    primary: '#1E3A8A',
    textPrimary: 'text-[#1E3A8A]',
    badgeBg: 'bg-[#EBF3FB]',
    badgeText: 'text-[#1E3A8A]',
    badgeBorder: 'border-[#BFDBFE]',
    focusRing: 'focus:ring-[#1E3A8A]',
  },
  denhaag: {
    primary: '#006448',
    textPrimary: 'text-[#006448]',
    badgeBg: 'bg-[#d8e7e2]',
    badgeText: 'text-[#006448]',
    badgeBorder: 'border-[#8ba198]',
    focusRing: 'focus:ring-[#006448]',
  },
  amsterdam: {
    primary: '#8C0223',
    textPrimary: 'text-[#8C0223]',
    badgeBg: 'bg-[#FCE8EC]',
    badgeText: 'text-[#8C0223]',
    badgeBorder: 'border-[#F5B7C2]',
    focusRing: 'focus:ring-[#8C0223]',
  },
};

const GUEST_CITY_SESSIONS: Record<string, string[]> = {
  gent: [
    'Vrijdagavond Entree (19:00 - 23:00)',
    'VIP Toegang Vrijdag (13:00 - 17:00)',
    'Zaterdagmiddag Sessie (13:00 - 17:00)',
    'Zaterdagavond Sessie (19:00 - 23:00)',
    'Zondagmiddag Sessie (13:00 - 17:00)',
    'Masterclass: Glenfarclas Vintage Tasting - Vrijdag',
    'Masterclass: Macallan Rare Cask - Zaterdag',
    'Masterclass: Peat & Smoke Experience - Zondag',
  ],
  denhaag: [
    'Vrijdagavond 19:00 - 23:00',
    'VIP Toegang Vrijdag (Exclusief)',
    'Zaterdagmiddag 13:00 - 17:00',
    'Zaterdagavond 18:30 - 22:30',
    'VIP Toegang Zaterdag (Exclusief)',
    'Zondagmiddag 13:00 - 17:00',
    'Masterclass: Glenfarclas Vintage Tasting',
    'Masterclass: Islay Peat Exploration',
    'Masterclass: Sherry Cask Secrets',
  ],
  amsterdam: [
    'Zaterdagmiddag 13:00 - 17:00',
    'Zaterdagavond 18:30 - 22:30',
    'VIP Toegang Zaterdag',
    'Masterclass: Vintage & Rare Whiskies',
  ],
};

export const OrdersPage: React.FC = () => {
  const { cityId } = useParams<{ cityId?: string }>();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState(cityId || 'all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // New Guest Comp Order Modal States
  const [showCreateGuestModal, setShowCreateGuestModal] = useState<boolean>(false);
  const [guestName, setGuestName] = useState<string>('');
  const [guestEmail, setGuestEmail] = useState<string>('');
  const [guestPhone, setGuestPhone] = useState<string>('');
  const [guestCity, setGuestCity] = useState<'gent' | 'denhaag' | 'amsterdam'>('gent');
  const [guestSession, setGuestSession] = useState<string>('Vrijdagavond Entree (19:00 - 23:00)');
  const [guestIsCustomSession, setGuestIsCustomSession] = useState<boolean>(false);
  const [guestCustomSession, setGuestCustomSession] = useState<string>('');
  const [guestQuantity, setGuestQuantity] = useState<number>(1);
  const [guestReason, setGuestReason] = useState<string>('VIP / Zakenrelatie');
  const [guestNotes, setGuestNotes] = useState<string>('');
  const [isSubmittingGuest, setIsSubmittingGuest] = useState<boolean>(false);

  const activeFestival = cityId ? INITIAL_FESTIVALS.find((f) => f.id === cityId) : null;
  const effectiveCity = cityId || selectedCity;
  const theme = CITY_THEMES[effectiveCity] || CITY_THEMES.denhaag;

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const cityQuery = effectiveCity && effectiveCity !== 'all' ? `?city=${effectiveCity}` : '';
      const res = await fetch(`/api/admin/orders${cityQuery}`);
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.orders)) {
          setOrders(data.orders);
        } else {
          setOrders([]);
        }
      }
    } catch (err) {
      console.error('Kon bestellingen niet ophalen:', err);
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [effectiveCity]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchesSearch =
        o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.customerEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (o.customerPhone && o.customerPhone.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCity = effectiveCity === 'all' || o.city === effectiveCity;
      const matchesStatus = selectedStatus === 'all' || o.status === selectedStatus;

      return matchesSearch && matchesCity && matchesStatus;
    });
  }, [orders, searchQuery, effectiveCity, selectedStatus]);

  const totalRevenueCents = useMemo(() => {
    return filteredOrders
      .filter((o) => o.status === 'paid')
      .reduce((acc, o) => acc + o.totalCents, 0);
  }, [filteredOrders]);

  const isPrelaunch = effectiveCity === 'denhaag' || effectiveCity === 'amsterdam';

  const handleCreateGuestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalSession = guestIsCustomSession ? guestCustomSession.trim() : guestSession;
    if (!guestName.trim() || !guestEmail.trim() || !finalSession) {
      alert('Vul alstublieft minimaal naam, e-mailadres en gewenste sessie in.');
      return;
    }

    setIsSubmittingGuest(true);
    try {
      const res = await fetch('/api/admin/orders/create-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: guestName.trim(),
          customerEmail: guestEmail.trim(),
          customerPhone: guestPhone.trim() || undefined,
          city: guestCity,
          sessionTitle: finalSession,
          quantity: guestQuantity,
          reason: guestReason,
          notes: guestNotes,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setShowCreateGuestModal(false);
        setGuestName('');
        setGuestEmail('');
        setGuestPhone('');
        setGuestQuantity(1);
        setGuestNotes('');
        setGuestIsCustomSession(false);
        setGuestCustomSession('');
        await fetchOrders();
        if (data.order) {
          const createdOrder: Order = {
            id: data.order.id,
            orderNumber: data.order.orderNumber,
            customerName: data.order.customerName,
            customerEmail: data.order.customerEmail,
            customerPhone: data.order.customerPhone || '',
            city: data.order.festivalId,
            cityName: data.order.festivalId === 'gent' ? 'Gent' : data.order.festivalId === 'amsterdam' ? 'Amsterdam' : 'Den Haag',
            itemsSummary: `${data.order.tickets.length}x ${finalSession}`,
            totalCents: 0,
            status: 'paid',
            createdAt: data.order.createdAt,
            environment: 'live',
            tickets: data.order.tickets.map((t: any) => ({
              code: t.ticketCode,
              type: t.sessionTitle.toLowerCase().includes('masterclass') ? 'Masterclass' : 'Entreeticket',
              session: t.sessionTitle,
              attendeeName: t.attendeeName,
              status: t.status,
            })),
          };
          setSelectedOrder(createdOrder);
        }
      } else {
        alert(`⚠️ Fout bij aanmaken: ${data.error || 'Onbekende fout'}`);
      }
    } catch (err: any) {
      alert(`⚠️ Fout bij aanmaken: ${err.message}`);
    } finally {
      setIsSubmittingGuest(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 font-sans">
      {/* Page Title & Stats */}
      <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-4 sm:p-6 shadow-[4px_4px_0px_rgba(29,28,26,0.9)] flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-[10px] sm:text-xs font-extrabold uppercase tracking-widest px-2 py-0.5 rounded border ${theme.badgeBg} ${theme.badgeText} ${theme.badgeBorder}`}>
              {activeFestival ? `${activeFestival.edition} • Klantenbeheer` : 'Klanten & Bestellingen'}
            </span>
            <span className="text-xs text-[#4c5752] font-semibold">
              • Realtime Mollie Transacties
            </span>
          </div>
          <h1 className="text-xl sm:text-3xl font-extrabold text-[#1D1C1A] tracking-tight">
            {activeFestival ? `Bestellingen ${activeFestival.name}` : 'Bestellingen Beheer'}
          </h1>
          <p className="text-xs sm:text-sm text-[#4c5752] mt-0.5 font-medium">
            Zoek op klantnaam, e-mail of #WF-ordernummer om kaartvragen direct op te lossen.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-bold text-[#4c5752] w-full md:w-auto justify-between md:justify-end flex-wrap">
          <button
            onClick={() => {
              const defaultCity = (effectiveCity === 'amsterdam' || effectiveCity === 'denhaag') ? effectiveCity : 'gent';
              setGuestCity(defaultCity as any);
              setGuestSession(GUEST_CITY_SESSIONS[defaultCity][0]);
              setShowCreateGuestModal(true);
            }}
            className="px-3.5 py-2 rounded border-2 border-[#1D1C1A] bg-[#006448] text-white hover:bg-[#005039] shadow-[2px_2px_0px_rgba(29,28,26,0.9)] text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all shrink-0"
            title="Maak handmatig een gastuitnodiging of comp bestelling aan"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nieuwe Gastuitnodiging</span>
          </button>

          <button
            onClick={fetchOrders}
            disabled={isLoading}
            className="p-2 rounded border-2 border-[#1D1C1A] bg-[#FAF7F2] text-[#1D1C1A] hover:bg-[#d8e7e2] shadow-[2px_2px_0px_rgba(29,28,26,0.8)] cursor-pointer disabled:opacity-50"
            title="Ververs bestellingen"
          >
            <RefreshCw className={`w-4 h-4 ${theme.textPrimary} ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <span className="bg-[#FAF7F2] border border-[#c1d4ce] px-3 py-1.5 rounded">
            Aantal: <strong className={theme.textPrimary}>{filteredOrders.length}</strong> orders
          </span>
          <span className={`border px-3 py-1.5 rounded ${theme.badgeBg} ${theme.badgeBorder} ${theme.badgeText}`}>
            Omzet: <strong>€ {(totalRevenueCents / 100).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          </span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-3 sm:p-4 shadow-[3px_3px_0px_rgba(29,28,26,0.9)] space-y-2.5 sm:space-y-0 sm:flex sm:gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className={`w-4 h-4 ${theme.textPrimary} absolute left-3 top-1/2 -translate-y-1/2`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Typ naam, e-mail of #WF code..."
            className={`w-full pl-9 pr-8 py-2 bg-white border-2 border-[#1D1C1A] rounded text-base sm:text-xs text-[#1D1C1A] font-semibold focus:outline-none focus:ring-2 ${theme.focusRing}`}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filters Row */}
        <div className="flex gap-2">
          {!cityId && (
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="bg-white border-2 border-[#1D1C1A] rounded px-3 py-2 text-xs font-bold text-[#1D1C1A] focus:outline-none cursor-pointer"
            >
              <option value="all">Alle Steden</option>
              <option value="gent">Gent (Actief)</option>
              <option value="denhaag">Den Haag (Prep)</option>
              <option value="amsterdam">Amsterdam (Prep)</option>
            </select>
          )}

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-white border-2 border-[#1D1C1A] rounded px-3 py-2 text-xs font-bold text-[#1D1C1A] focus:outline-none cursor-pointer"
          >
            <option value="all">Alle Statussen</option>
            <option value="paid">Betaald</option>
            <option value="pending">In afwachting</option>
            <option value="canceled">Geannuleerd</option>
          </select>
        </div>
      </div>

      {/* MOBILE ORDER CARDS STREAM (< 768px) */}
      <div className="block md:hidden space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-8 text-center text-[#4c5752] font-medium text-xs shadow-[3px_3px_0px_rgba(29,28,26,0.9)]">
            {isPrelaunch
              ? 'Nog geen bestellingen voor deze editie. De kaartverkoop start binnenkort.'
              : 'Geen bestellingen gevonden die voldoen aan de zoekcriteria.'}
          </div>
        ) : (
          filteredOrders.map((order) => (
            <div
              key={order.id}
              onClick={() => setSelectedOrder(order)}
              className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-4 shadow-[3px_3px_0px_rgba(29,28,26,0.9)] space-y-2.5 active:bg-[#FAF7F2] cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-extrabold text-[#006448] bg-[#d8e7e2] px-2 py-0.5 rounded border border-[#8ba198]">
                  {order.orderNumber}
                </span>
                <span className="bg-[#FAF7F2] text-[#4c5752] border border-[#c1d4ce] text-[10px] font-extrabold px-2 py-0.5 rounded uppercase">
                  {order.cityName}
                </span>
              </div>

              <div>
                <div className="text-sm font-extrabold text-[#1D1C1A]">{order.customerName}</div>
                <div className="text-xs text-[#4c5752] font-medium">{order.itemsSummary}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">{order.customerEmail}</div>
              </div>

              <div className="pt-2 border-t border-[#c1d4ce] flex items-center justify-between text-xs">
                <div>
                  <span className="font-extrabold text-sm text-[#1D1C1A]">
                    € {(order.totalCents / 100).toFixed(2).replace('.', ',')}
                  </span>
                  <div className="text-[10px] text-gray-500 font-medium">
                    {formatOrderDate(order.createdAt)}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {order.status === 'paid' ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                      <CheckCircle2 className="w-3 h-3" /> Betaald
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                      <Clock className="w-3 h-3" /> In afw.
                    </span>
                  )}
                  <ChevronRight className={`w-4 h-4 ${theme.textPrimary}`} />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* DESKTOP ORDERS TABLE (>= 768px) */}
      <div className="hidden md:block bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg shadow-[4px_4px_0px_rgba(29,28,26,0.9)] overflow-hidden">
        {filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-[#4c5752] font-medium text-xs">
            {isPrelaunch
              ? 'Nog geen bestellingen voor deze editie. De kaartverkoop start binnenkort.'
              : 'Geen bestellingen gevonden die voldoen aan de zoekcriteria.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#FAF7F2] border-b-2 border-[#1D1C1A] text-[#4c5752] font-extrabold uppercase tracking-wider">
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Klantnaam & Contact</th>
                  <th className="py-3 px-4">Editie</th>
                  <th className="py-3 px-4">Bestelde Kaarten</th>
                  <th className="py-3 px-4">Bedrag</th>
                  <th className="py-3 px-4">Datum</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actie</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c1d4ce]">
                {filteredOrders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className="hover:bg-[#FAF7F2] transition-colors cursor-pointer"
                  >
                    <td className={`py-3 px-4 font-mono font-extrabold ${theme.textPrimary}`}>
                      {order.orderNumber}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-[#1D1C1A]">{order.customerName}</div>
                      <div className="text-[11px] text-[#4c5752] font-normal">{order.customerEmail}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded font-extrabold text-[10px] border uppercase ${
                        order.city === 'gent' || (order.cityName || '').toLowerCase().includes('gent')
                          ? 'bg-[#EBF3FB] text-[#1E3A8A] border-[#BFDBFE]'
                          : order.city === 'amsterdam' || (order.cityName || '').toLowerCase().includes('amsterdam')
                          ? 'bg-[#FCE8EC] text-[#8C0223] border-[#F5B7C2]'
                          : 'bg-[#d8e7e2] text-[#006448] border-[#8ba198]'
                      }`}>
                        {order.cityName}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-[#1D1C1A] max-w-[200px] truncate">
                      {order.itemsSummary}
                    </td>
                    <td className="py-3 px-4 font-extrabold text-[#1D1C1A]">
                      € {(order.totalCents / 100).toFixed(2).replace('.', ',')}
                    </td>
                    <td className="py-3 px-4 text-[#4c5752] whitespace-nowrap">
                      {formatOrderDate(order.createdAt)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {order.status === 'paid' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                          <CheckCircle2 className="w-3 h-3" /> Betaald
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                          <Clock className="w-3 h-3" /> In afwachting
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOrder(order);
                        }}
                        className="btn-letterpress-gold px-2.5 py-1 rounded text-[11px] font-extrabold cursor-pointer"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Nieuwe Gastuitnodiging / Handmatige Bestelling Aanmaken */}
      {showCreateGuestModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#FCFAF7] border-3 border-[#1D1C1A] rounded-lg shadow-[6px_6px_0px_rgba(29,28,26,0.9)] max-w-xl w-full p-5 sm:p-6 animate-in zoom-in-95 duration-150 my-8">
            <div className="flex items-center justify-between pb-3 border-b-2 border-[#1D1C1A] mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded bg-[#006448] border border-[#1D1C1A] flex items-center justify-center text-white">
                  <Gift className="w-4 h-4 text-[#FAF7F2]" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#1D1C1A]">Nieuwe Gastuitnodiging / Comp Bestelling</h3>
                  <p className="text-xs text-[#4c5752]">Officiële €0,- bestelling met geldige HMAC-SHA256 QR-codes</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateGuestModal(false)}
                className="p-1 text-gray-500 hover:text-black rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGuestSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Festival Stad Keuze */}
                <div>
                  <label className="block text-xs font-extrabold uppercase text-[#1D1C1A] mb-1">
                    Festival Stad:
                  </label>
                  <select
                    value={guestCity}
                    onChange={(e) => {
                      const c = e.target.value as 'gent' | 'denhaag' | 'amsterdam';
                      setGuestCity(c);
                      setGuestSession(GUEST_CITY_SESSIONS[c][0]);
                    }}
                    className="w-full p-2.5 bg-white border-2 border-[#1D1C1A] rounded text-xs font-bold text-[#1D1C1A] focus:outline-none focus:ring-2 focus:ring-[#006448]"
                  >
                    <option value="gent">Gent (2, 3 & 4 okt 2026)</option>
                    <option value="denhaag">Den Haag (13, 14 & 15 nov 2026)</option>
                    <option value="amsterdam">Amsterdam (16 jan 2027)</option>
                  </select>
                </div>

                {/* Type Gast / Reden */}
                <div>
                  <label className="block text-xs font-extrabold uppercase text-[#1D1C1A] mb-1">
                    Type Gast / Reden:
                  </label>
                  <select
                    value={guestReason}
                    onChange={(e) => setGuestReason(e.target.value)}
                    className="w-full p-2.5 bg-white border-2 border-[#1D1C1A] rounded text-xs font-bold text-[#1D1C1A] focus:outline-none focus:ring-2 focus:ring-[#006448]"
                  >
                    <option value="VIP / Zakenrelatie">VIP / Zakenrelatie</option>
                    <option value="Spreker / Masterclass Host">Spreker / Masterclass Host</option>
                    <option value="Pers & Media">Pers & Media</option>
                    <option value="Organisatie & Crew">Organisatie & Crew</option>
                    <option value="Vrijkaart / Winactie">Vrijkaart / Winactie</option>
                    <option value="Comp Ticket">Comp Ticket</option>
                  </select>
                </div>
              </div>

              {/* Sessie of Masterclass Keuze */}
              <div>
                <label className="block text-xs font-extrabold uppercase text-[#1D1C1A] mb-1">
                  Sessie of Masterclass:
                </label>
                {!guestIsCustomSession ? (
                  <select
                    value={guestSession}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setGuestIsCustomSession(true);
                        setGuestCustomSession('');
                      } else {
                        setGuestSession(e.target.value);
                      }
                    }}
                    className="w-full p-2.5 bg-white border-2 border-[#1D1C1A] rounded text-xs font-bold text-[#1D1C1A] focus:outline-none focus:ring-2 focus:ring-[#006448]"
                  >
                    {(GUEST_CITY_SESSIONS[guestCity] || GUEST_CITY_SESSIONS.gent).map((sess) => (
                      <option key={sess} value={sess}>
                        {sess}
                      </option>
                    ))}
                    <option value="__custom__">➕ Aangepaste Masterclass / Sessie intypen...</option>
                  </select>
                ) : (
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      value={guestCustomSession}
                      onChange={(e) => setGuestCustomSession(e.target.value)}
                      placeholder="Bijv. Exclusieve VIP Masterclass Dalmore 25yo"
                      autoFocus
                      className="w-full p-2.5 bg-white border-2 border-[#1D1C1A] rounded text-xs font-bold text-[#1D1C1A] focus:outline-none focus:ring-2 focus:ring-[#006448]"
                    />
                    <button
                      type="button"
                      onClick={() => setGuestIsCustomSession(false)}
                      className="text-[11px] font-bold text-[#006448] hover:underline cursor-pointer"
                    >
                      ← Terug naar lijst met standaardsessies
                    </button>
                  </div>
                )}
              </div>

              {/* Aantal tickets */}
              <div>
                <label className="block text-xs font-extrabold uppercase text-[#1D1C1A] mb-1">
                  Aantal Tickets:
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setGuestQuantity(num)}
                      className={`px-3 py-1.5 rounded border-2 border-[#1D1C1A] text-xs font-black transition-all cursor-pointer ${
                        guestQuantity === num
                          ? 'bg-[#006448] text-white shadow-[2px_2px_0px_rgba(29,28,26,0.9)]'
                          : 'bg-white text-[#1D1C1A] hover:bg-[#FAF7F2]'
                      }`}
                    >
                      {num} {num === 1 ? 'ticket' : 'tickets'}
                    </button>
                  ))}
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={guestQuantity}
                    onChange={(e) => setGuestQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-16 p-1.5 text-center bg-white border-2 border-[#1D1C1A] rounded text-xs font-black text-[#1D1C1A]"
                  />
                </div>
              </div>

              {/* Klant/Gast Gegevens */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#c1d4ce]">
                <div>
                  <label className="block text-xs font-extrabold uppercase text-[#1D1C1A] mb-1">
                    Naam Gast / Contactpersoon: <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Bijv. Jan de Vries"
                    className="w-full p-2.5 bg-white border-2 border-[#1D1C1A] rounded text-xs font-medium text-[#1D1C1A] focus:outline-none focus:ring-2 focus:ring-[#006448]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase text-[#1D1C1A] mb-1">
                    E-mailadres Gast: <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="gast@bedrijf.nl"
                    className="w-full p-2.5 bg-white border-2 border-[#1D1C1A] rounded text-xs font-medium text-[#1D1C1A] focus:outline-none focus:ring-2 focus:ring-[#006448]"
                  />
                  <p className="text-[10px] text-[#4c5752] mt-0.5">Kan hiermee inloggen op het online portaal.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-extrabold uppercase text-[#1D1C1A] mb-1">
                    Telefoonnummer (Optioneel):
                  </label>
                  <input
                    type="tel"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder="+31 6 12345678"
                    className="w-full p-2.5 bg-white border-2 border-[#1D1C1A] rounded text-xs font-medium text-[#1D1C1A] focus:outline-none focus:ring-2 focus:ring-[#006448]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase text-[#1D1C1A] mb-1">
                    Interne Notitie (Optioneel):
                  </label>
                  <input
                    type="text"
                    value={guestNotes}
                    onChange={(e) => setGuestNotes(e.target.value)}
                    placeholder="Bijv. Uitgenodigd via directie"
                    className="w-full p-2.5 bg-white border-2 border-[#1D1C1A] rounded text-xs font-medium text-[#1D1C1A] focus:outline-none focus:ring-2 focus:ring-[#006448]"
                  />
                </div>
              </div>

              {/* Info banner */}
              <div className="p-3 bg-[#FAF7F2] border-2 border-[#1D1C1A] rounded-lg text-[11px] text-[#4c5752] space-y-1 shadow-[2px_2px_0px_rgba(29,28,26,0.3)]">
                <div className="font-extrabold text-[#1D1C1A] flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-[#006448]" />
                  Directe Levering & Incheck-Garantie:
                </div>
                <div>• Genereert bestelnummer <strong>#WF-2026-COMP-XXXXX</strong> met status Betaald (€0,00).</div>
                <div>• {guestQuantity}x ticket(s) met individuele HMAC-SHA256 QR-codes direct scanbaar aan de ingang.</div>
                <div>• Direct downloadbare A4 PDF e-tickets beschikbaar.</div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateGuestModal(false)}
                  className="flex-1 py-2.5 rounded border-2 border-[#1D1C1A] bg-white text-xs font-extrabold text-[#1D1C1A] hover:bg-gray-100 shadow-[2px_2px_0px_rgba(29,28,26,0.8)] cursor-pointer"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingGuest}
                  className="flex-1 py-2.5 rounded border-2 border-[#1D1C1A] bg-[#006448] text-white hover:bg-[#005039] text-xs font-black shadow-[2px_2px_0px_rgba(29,28,26,0.9)] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingGuest ? 'Aanmaken...' : '🎁 Gastuitnodiging Aanmaken & Tickets Genereren'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Slide-out Order Detail Drawer */}
      <OrderDetailDrawer
        order={selectedOrder}
        cityId={cityId || (effectiveCity !== 'all' ? effectiveCity : undefined)}
        onClose={() => setSelectedOrder(null)}
        onOrderUpdated={fetchOrders}
      />
    </div>
  );
};
