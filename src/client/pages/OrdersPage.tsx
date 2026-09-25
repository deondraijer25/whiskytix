import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Search, ShoppingBag, CheckCircle2, Clock, X, ChevronRight, Download, Mail, RefreshCw } from 'lucide-react';
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

export const OrdersPage: React.FC = () => {
  const { cityId } = useParams<{ cityId?: string }>();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState(cityId || 'all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

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

        <div className="flex items-center gap-2 text-xs font-bold text-[#4c5752] w-full md:w-auto justify-between md:justify-end">
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
