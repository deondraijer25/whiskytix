import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, ShoppingBag, CheckCircle2, Clock, X, ChevronRight, Download, Mail, RefreshCw, Plus, Ticket, UserCheck, CheckCircle, Calendar, Check } from 'lucide-react';
import { INITIAL_FESTIVALS, Order } from '../data/mockData';
import { OrderDetailDrawer } from '../components/OrderDetailDrawer';
import { getFestivalCatalog, FestivalCatalogItem, formatEuro } from '../data/festivalCatalog';
import { useEnvironment } from '../context/EnvironmentContext';
import { MollieEnvToggle } from '../components/MollieEnvToggle';

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
  btnBg: string;
  btnHover: string;
}> = {
  gent: {
    primary: '#1E3A8A',
    textPrimary: 'text-[#1E3A8A]',
    badgeBg: 'bg-[#EBF3FB]',
    badgeText: 'text-[#1E3A8A]',
    badgeBorder: 'border-[#BFDBFE]',
    focusRing: 'focus:ring-[#1E3A8A]',
    btnBg: 'bg-[#1E3A8A]',
    btnHover: 'hover:bg-[#172554]',
  },
  denhaag: {
    primary: '#006448',
    textPrimary: 'text-[#006448]',
    badgeBg: 'bg-[#d8e7e2]',
    badgeText: 'text-[#006448]',
    badgeBorder: 'border-[#8ba198]',
    focusRing: 'focus:ring-[#006448]',
    btnBg: 'bg-[#006448]',
    btnHover: 'hover:bg-[#005039]',
  },
  amsterdam: {
    primary: '#8C0223',
    textPrimary: 'text-[#8C0223]',
    badgeBg: 'bg-[#FCE8EC]',
    badgeText: 'text-[#8C0223]',
    badgeBorder: 'border-[#F5B7C2]',
    focusRing: 'focus:ring-[#8C0223]',
    btnBg: 'bg-[#8C0223]',
    btnHover: 'hover:bg-[#70021c]',
  },
};


export const OrdersPage: React.FC = () => {
  const { cityId } = useParams<{ cityId?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const openOrderParam = searchParams.get('openOrder');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState(cityId || 'all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { env: mollieEnv } = useEnvironment();

  const activeFestival = cityId ? INITIAL_FESTIVALS.find((f) => f.id === cityId) : null;
  const effectiveCity = cityId || selectedCity;
  const theme = CITY_THEMES[effectiveCity] || CITY_THEMES.denhaag;

  const fetchOrders = async (targetEnv?: 'test' | 'live') => {
    setIsLoading(true);
    const activeEnv = targetEnv || mollieEnv;
    try {
      const cityQuery = effectiveCity && effectiveCity !== 'all' ? `city=${effectiveCity}&` : '';
      const res = await fetch(`/api/admin/orders?${cityQuery}env=${activeEnv}`);
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.orders)) {
          setOrders(data.orders);
          setSelectedOrder((prev) => {
            if (prev) {
              const fresh = data.orders.find(
                (o: Order) =>
                  Boolean(o.orderNumber && prev.orderNumber && (
                    o.orderNumber === prev.orderNumber ||
                    o.orderNumber.replace('#', '') === prev.orderNumber.replace('#', '')
                  ))
              );
              return fresh || prev;
            }
            if (openOrderParam) {
              const found = data.orders.find(
                (o: Order) =>
                  Boolean(o.orderNumber && (
                    o.orderNumber === openOrderParam ||
                    o.orderNumber.replace('#', '') === openOrderParam.replace('#', '')
                  ))
              );
              return found || null;
            }
            return null;
          });
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
    fetchOrders(mollieEnv);
  }, [effectiveCity, openOrderParam, mollieEnv]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        (o.orderNumber || '').toLowerCase().includes(q) ||
        (o.customerName || '').toLowerCase().includes(q) ||
        (o.customerEmail || '').toLowerCase().includes(q) ||
        (o.customerPhone ? o.customerPhone.toLowerCase().includes(q) : false);

      const matchesCity = effectiveCity === 'all' || o.city === effectiveCity;
      const matchesStatus = selectedStatus === 'all' || o.status === selectedStatus;

      return matchesSearch && matchesCity && matchesStatus;
    });
  }, [orders, searchQuery, effectiveCity, selectedStatus]);

  const totalRevenueCents = useMemo(() => {
    return filteredOrders
      .filter((o) => o.status === 'paid')
      .reduce((acc, o) => acc + (o.totalCents || 0), 0);
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
            <span
              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                mollieEnv === 'live'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-amber-100 text-amber-800 border-amber-300'
              }`}
            >
              {mollieEnv === 'live' ? 'Mollie Live Modus' : 'Mollie Testmodus'}
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
          {/* Mollie Test / Live Mode Schakelaar */}
          <MollieEnvToggle onEnvChange={(newEnv) => fetchOrders(newEnv)} />

          <button
            onClick={() => {
              const defaultCity = (effectiveCity === 'amsterdam' || effectiveCity === 'denhaag') ? effectiveCity : 'gent';
              if (cityId) {
                navigate(`/admin/festival/${cityId}/invitations/new`);
              } else {
                navigate(`/admin/festival/${defaultCity}/invitations/new`);
              }
            }}
            className={`px-3.5 py-2 rounded border-2 border-[#1D1C1A] ${theme.btnBg} text-white ${theme.btnHover} shadow-[2px_2px_0px_rgba(29,28,26,0.9)] text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all shrink-0`}
            title="Maak een officiële gastuitnodiging of comp bestelling aan"
          >
            <Plus className="w-4 h-4" />
            <span>Nieuwe Gastuitnodiging</span>
          </button>

          <button
            onClick={() => fetchOrders(mollieEnv)}
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
            Omzet: <strong>€ {((totalRevenueCents || 0) / 100).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
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
              : mollieEnv === 'live'
              ? 'Nog geen live bestellingen gevonden via Mollie Live.'
              : 'Geen testbestellingen gevonden die voldoen aan de zoekcriteria.'}
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
              : mollieEnv === 'live'
              ? 'Nog geen live bestellingen gevonden via Mollie Live.'
              : 'Geen testbestellingen gevonden die voldoen aan de zoekcriteria.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#FAF7F2] border-b-2 border-[#1D1C1A] text-[#4c5752] font-extrabold uppercase tracking-wider">
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Klantnaam & Contact</th>
                  <th className="py-3 px-4">Editie</th>
                  <th className="py-3 px-4 text-center">Items</th>
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
                    <td className="py-3 px-4 text-center">
                      <span className="font-mono font-extrabold text-xs bg-[#FAF7F2] border border-[#c1d4ce] px-2.5 py-0.5 rounded text-[#1D1C1A]">
                        {(() => {
                          const ticketCount = order.tickets ? order.tickets.length : 0;
                          const summaryCount = order.itemsSummary
                            ? order.itemsSummary.split(',').reduce((sum, p) => {
                                const m = p.match(/(\d+)x/i);
                                return sum + (m ? parseInt(m[1], 10) : 1);
                              }, 0)
                            : 0;
                          const itemsCount = Array.isArray(order.items)
                            ? order.items.reduce((sum, it) => sum + (Number(it.quantity || it.qty) || 1), 0)
                            : 0;
                          return Math.max(ticketCount, summaryCount, itemsCount, 1);
                        })()}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-extrabold text-[#1D1C1A]">
                      € {((order.totalCents || 0) / 100).toFixed(2).replace('.', ',')}
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
        onOrderUpdated={() => fetchOrders(mollieEnv)}
      />
    </div>
  );
};
