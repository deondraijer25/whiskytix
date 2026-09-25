import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Ticket,
  ShoppingBag,
  CreditCard,
  Receipt,
  Calendar,
  MapPin,
  ChevronRight,
  ArrowRight,
  CheckCircle2,
  Clock,
  RefreshCw,
  Building2,
} from 'lucide-react';
import { Order } from '../data/mockData';
import { OrderDetailDrawer } from '../components/OrderDetailDrawer';

interface AdminDashboardPageProps {
  selectedCity: string;
  onCityChange: (city: string) => void;
}

interface MollieStatus {
  activeMode: 'test' | 'live';
  hasLiveKey: boolean;
  hasTestKey: boolean;
}

const CITY_THEMES: Record<string, {
  primary: string;
  gradientClass: string;
  progressBar: string;
}> = {
  gent: {
    primary: '#1E3A8A',
    gradientClass: 'bg-gradient-to-br from-[#172554] via-[#1E3A8A] to-[#1D4ED8]',
    progressBar: 'bg-[#1E3A8A]',
  },
  denhaag: {
    primary: '#006448',
    gradientClass: 'bg-gradient-to-br from-[#003B2A] via-[#006448] to-[#047857]',
    progressBar: 'bg-[#006448]',
  },
  amsterdam: {
    primary: '#8C0223',
    gradientClass: 'bg-gradient-to-br from-[#5C0117] via-[#8C0223] to-[#B91C1C]',
    progressBar: 'bg-[#8C0223]',
  },
};

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({
  selectedCity,
  onCityChange,
}) => {
  const navigate = useNavigate();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [mollieEnv, setMollieEnv] = useState<'test' | 'live'>('test');
  const [mollieStatus, setMollieStatus] = useState<MollieStatus | null>(null);

  // Fetch real orders from API based on active environment (test vs live)
  const fetchOrders = async (env: 'test' | 'live') => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/orders?env=${env}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.orders)) {
        setOrders(data.orders);
      } else {
        setOrders([]);
      }
    } catch (err) {
      console.error('Fout bij ophalen van orders:', err);
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch Mollie credentials status
  const fetchMollieStatus = async () => {
    try {
      const res = await fetch('/api/admin/mollie/status');
      const data = await res.json();
      if (data.success) {
        setMollieStatus(data);
      }
    } catch (err) {
      console.error('Fout bij ophalen Mollie status:', err);
    }
  };

  useEffect(() => {
    fetchOrders(mollieEnv);
    fetchMollieStatus();
  }, [mollieEnv]);

  // Filter orders based on active city selector
  const displayedOrders = useMemo(() => {
    if (selectedCity === 'all') return orders;
    return orders.filter((o) => o.city === selectedCity);
  }, [orders, selectedCity]);

  // Aggregated KPIs from real paid orders
  const paidOrders = useMemo(() => {
    return displayedOrders.filter((o) => o.status === 'paid');
  }, [displayedOrders]);

  const totalRevenueCents = useMemo(() => {
    return paidOrders.reduce((acc, o) => acc + (o.totalCents || 0), 0);
  }, [paidOrders]);

  const totalTicketsSold = useMemo(() => {
    return paidOrders.reduce((acc, o) => acc + (o.tickets?.length || 1), 0);
  }, [paidOrders]);

  const totalOrdersCount = paidOrders.length;

  const averageOrderValueCents = useMemo(() => {
    return totalOrdersCount > 0 ? Math.round(totalRevenueCents / totalOrdersCount) : 0;
  }, [totalRevenueCents, totalOrdersCount]);

  // Festival specific real metrics
  const festivalsData = useMemo(() => {
    // Gent: Connected with Mollie
    const gentPaid = orders.filter((o) => o.city === 'gent' && o.status === 'paid');
    const gentRevCents = gentPaid.reduce((acc, o) => acc + (o.totalCents || 0), 0);
    const gentTickets = gentPaid.reduce((acc, o) => acc + (o.tickets?.length || 1), 0);
    const gentTotal = 3500;
    const gentPct = ((gentTickets / gentTotal) * 100).toFixed(1);

    // Den Haag: Empty / Pre-launch
    const dhPaid = orders.filter((o) => o.city === 'denhaag' && o.status === 'paid');
    const dhRevCents = dhPaid.reduce((acc, o) => acc + (o.totalCents || 0), 0);
    const dhTickets = dhPaid.reduce((acc, o) => acc + (o.tickets?.length || 1), 0);
    const dhTotal = 5850;
    const dhPct = ((dhTickets / dhTotal) * 100).toFixed(1);

    // Amsterdam: Empty / Pre-launch
    const amsPaid = orders.filter((o) => o.city === 'amsterdam' && o.status === 'paid');
    const amsRevCents = amsPaid.reduce((acc, o) => acc + (o.totalCents || 0), 0);
    const amsTickets = amsPaid.reduce((acc, o) => acc + (o.tickets?.length || 1), 0);
    const amsTotal = 4200;
    const amsPct = ((amsTickets / amsTotal) * 100).toFixed(1);

    return [
      {
        id: 'gent',
        name: 'International Whisky Festival Gent',
        edition: '21e Editie',
        location: 'De Oude Vismijn Gent',
        dates: '20, 21 en 22 Mrt 2027',
        isLive: true,
        accountInfo: 'Eigen Mollie Account (Gent)',
        statusLabel: mollieEnv === 'live' ? 'Mollie Live Actief' : 'Mollie Testmodus',
        statusType: mollieEnv === 'live' ? 'live' : 'test',
        revenueCents: gentRevCents,
        ticketsSold: gentTickets,
        ticketsTotal: gentTotal,
        pct: gentPct,
        vipNote: 'Vroegboeking actief',
      },
      {
        id: 'denhaag',
        name: 'International Whisky Festival Den Haag',
        edition: '25e Jubileum Editie',
        location: 'Grote Kerk Den Haag',
        dates: '13, 14 en 15 Nov 2026',
        isLive: false,
        accountInfo: 'Gezamenlijk Account (NL)',
        statusLabel: 'In Voorbereiding',
        statusType: 'prep',
        revenueCents: dhRevCents,
        ticketsSold: dhTickets,
        ticketsTotal: dhTotal,
        pct: dhPct,
        vipNote: 'Beschikbaar bij start verkoop',
      },
      {
        id: 'amsterdam',
        name: 'Whisky Weekend Amsterdam',
        edition: '2e Editie',
        location: 'Zuiderkerk Amsterdam',
        dates: '2, 3 en 4 Okt 2026',
        isLive: false,
        accountInfo: 'Gezamenlijk Account (NL)',
        statusLabel: 'In Voorbereiding',
        statusType: 'prep',
        revenueCents: amsRevCents,
        ticketsSold: amsTickets,
        ticketsTotal: amsTotal,
        pct: amsPct,
        vipNote: 'Beschikbaar bij start verkoop',
      },
    ];
  }, [orders, mollieEnv]);

  const displayedFestivals = useMemo(() => {
    if (selectedCity === 'all') return festivalsData;
    return festivalsData.filter((f) => f.id === selectedCity);
  }, [festivalsData, selectedCity]);

  // Overall max tickets across displayed festivals
  const totalTicketsMax = useMemo(() => {
    return displayedFestivals.reduce((acc, f) => acc + f.ticketsTotal, 0);
  }, [displayedFestivals]);

  const soldPercentage = totalTicketsMax > 0 
    ? ((totalTicketsSold / totalTicketsMax) * 100).toFixed(1) 
    : '0.0';

  return (
    <div className="space-y-6 sm:space-y-8 font-sans">
      {/* 1. Header & Live Mode Switcher */}
      <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-4 sm:p-6 shadow-[4px_4px_0px_rgba(29,28,26,0.9)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-widest text-[#006448] bg-[#d8e7e2] px-2 py-0.5 rounded border border-[#8ba198]">
              Centrale Festival Cockpit
            </span>
            <span className="text-xs text-[#4c5752] font-semibold">
              • Realtime transacties via Mollie
            </span>
          </div>
          <h1 className="text-xl sm:text-3xl font-extrabold text-[#1D1C1A] tracking-tight">
            3-Steden Festival Cockpit
          </h1>
          <p className="text-xs sm:text-sm text-[#4c5752] mt-0.5 font-medium">
            Overkoepelend inzicht in omzet en transacties. Momenteel gekoppeld met Mollie (Gent actief).
          </p>
        </div>

        {/* Mollie Test / Live Mode Schakelaar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
          <div className="flex items-center bg-[#FAF7F2] border-2 border-[#1D1C1A] p-1 rounded-lg shadow-[2px_2px_0px_rgba(29,28,26,0.9)]">
            <button
              type="button"
              onClick={() => setMollieEnv('test')}
              className={`px-3 py-1.5 rounded text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                mollieEnv === 'test'
                  ? 'bg-[#caac8e] text-[#1D1C1A] border-2 border-[#1D1C1A] shadow-[1px_1px_0px_rgba(29,28,26,0.9)]'
                  : 'text-[#4c5752] hover:text-[#1D1C1A]'
              }`}
              title="Bekijk de testorders en proefbetalingen"
            >
              Mollie Test
            </button>
            <button
              type="button"
              onClick={() => setMollieEnv('live')}
              className={`px-3 py-1.5 rounded text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                mollieEnv === 'live'
                  ? 'bg-[#006448] text-white border-2 border-[#1D1C1A] shadow-[1px_1px_0px_rgba(29,28,26,0.9)]'
                  : 'text-[#4c5752] hover:text-[#1D1C1A]'
              }`}
              title="Schakel naar de echte live verkoopomgeving"
            >
              Mollie Live
            </button>
          </div>

          <button
            onClick={() => fetchOrders(mollieEnv)}
            disabled={isLoading}
            className="p-2 rounded border-2 border-[#1D1C1A] bg-[#FAF7F2] text-[#1D1C1A] hover:bg-[#d8e7e2] shadow-[2px_2px_0px_rgba(29,28,26,0.8)] cursor-pointer disabled:opacity-50"
            title="Ververs live gegevens"
          >
            <RefreshCw className={`w-4 h-4 text-[#006448] ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. FINANCIEEL OVERZICHT (4 kolommen met echte Mollie data) */}
      <div>
        <div className="flex items-center justify-between mb-2.5 sm:mb-3">
          <h2 className="text-xs font-extrabold uppercase tracking-widest text-[#1D1C1A] flex items-center gap-1.5 sm:gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#006448]"></span>
            Financieel Overzicht{' '}
            <span className="text-[#4c5752] font-semibold">
              {selectedCity === 'all' ? '(Totaal Alle Steden)' : `(${displayedFestivals[0]?.name})`}
            </span>
          </h2>
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] sm:text-xs font-extrabold px-2 py-0.5 rounded-full border ${
                mollieEnv === 'live'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-amber-100 text-amber-800 border-amber-300'
              }`}
            >
              {mollieEnv === 'live' ? 'Mollie Live Modus' : 'Mollie Testmodus'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          {/* KPI 1: Totale Omzet */}
          <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded p-3.5 sm:p-5 shadow-[3px_3px_0px_rgba(29,28,26,0.9)] sm:shadow-[4px_4px_0px_rgba(29,28,26,0.9)]">
            <div className="flex items-center justify-between text-[#4c5752] mb-1">
              <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider truncate">
                Bruto Omzet
              </span>
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded bg-[#d8e7e2] text-[#006448] flex items-center justify-center font-bold text-xs border border-[#8ba198]">
                €
              </div>
            </div>
            <div className="text-lg sm:text-2xl lg:text-3xl font-extrabold text-[#006448] tracking-tight truncate">
              € {(totalRevenueCents / 100).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="mt-1 sm:mt-2 text-[10px] sm:text-[11px] font-medium text-[#4c5752] truncate">
              {mollieEnv === 'live' ? 'Geverifieerd via Mollie Live' : `${paidOrders.length} testbetalingen`}
            </div>
          </div>

          {/* KPI 2: Tickets Verkocht */}
          <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded p-3.5 sm:p-5 shadow-[3px_3px_0px_rgba(29,28,26,0.9)] sm:shadow-[4px_4px_0px_rgba(29,28,26,0.9)]">
            <div className="flex items-center justify-between text-[#4c5752] mb-1">
              <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider truncate">
                Tickets Verkocht
              </span>
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded bg-[#d8e7e2] text-[#006448] flex items-center justify-center font-bold text-xs border border-[#8ba198]">
                <Ticket className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#006448]" />
              </div>
            </div>
            <div className="text-lg sm:text-2xl lg:text-3xl font-extrabold text-[#1D1C1A] tracking-tight">
              {totalTicketsSold.toLocaleString('nl-NL')}{' '}
              <span className="text-xs sm:text-sm font-semibold text-[#4c5752]">/ {totalTicketsMax.toLocaleString('nl-NL')}</span>
            </div>
            {/* Progress Bar */}
            <div className="w-full bg-[#c1d4ce] h-1.5 sm:h-2 rounded-full mt-1.5 sm:mt-2 overflow-hidden">
              <div
                className="bg-[#006448] h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0.5, parseFloat(soldPercentage)))}%` }}
              ></div>
            </div>
            <div className="mt-1 text-[9px] sm:text-[11px] font-bold text-[#4c5752] text-right">
              {soldPercentage}% van zaalcapaciteit
            </div>
          </div>

          {/* KPI 3: Actieve Bestellingen */}
          <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded p-3.5 sm:p-5 shadow-[3px_3px_0px_rgba(29,28,26,0.9)] sm:shadow-[4px_4px_0px_rgba(29,28,26,0.9)]">
            <div className="flex items-center justify-between text-[#4c5752] mb-1">
              <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider truncate">
                Bestellingen
              </span>
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded bg-[#d8e7e2] text-[#006448] flex items-center justify-center font-bold text-xs border border-[#8ba198]">
                <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#006448]" />
              </div>
            </div>
            <div className="text-lg sm:text-2xl lg:text-3xl font-extrabold text-[#1D1C1A] tracking-tight">
              {totalOrdersCount}{' '}
              <span className="text-xs sm:text-sm font-semibold text-[#4c5752]">betaald</span>
            </div>
            <div className="mt-1 sm:mt-2 text-[9px] sm:text-[11px] font-medium text-[#4c5752] truncate">
              {paidOrders[0]?.orderNumber ? (
                <>Laatste: <span className="font-bold text-[#006448]">{paidOrders[0].orderNumber}</span></>
              ) : (
                'Geen actieve bestellingen'
              )}
            </div>
          </div>

          {/* KPI 4: Gemiddelde Orderwaarde (AOV) - Standaard CreditCard / Receipt icon */}
          <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded p-3.5 sm:p-5 shadow-[3px_3px_0px_rgba(29,28,26,0.9)] sm:shadow-[4px_4px_0px_rgba(29,28,26,0.9)]">
            <div className="flex items-center justify-between text-[#4c5752] mb-1">
              <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider truncate">
                Gem. Order (AOV)
              </span>
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded bg-[#caac8e] text-[#1D1C1A] flex items-center justify-center font-bold text-xs border border-[#1D1C1A]">
                <CreditCard className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#1D1C1A]" />
              </div>
            </div>
            <div className="text-lg sm:text-2xl lg:text-3xl font-extrabold text-[#1D1C1A] tracking-tight">
              € {(averageOrderValueCents / 100).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="mt-1 sm:mt-2 text-[9px] sm:text-[11px] font-medium text-[#4c5752] truncate">
              Per voltooide transactie
            </div>
          </div>
        </div>
      </div>

      {/* 3. FESTIVAL LOCATIES OVERZICHT (Gent Live Mollie + Den Haag & Amsterdam in voorbereiding) */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-[#1D1C1A] flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#006448]"></span>
              Festival Edities:
            </h2>
            <p className="text-[11px] sm:text-xs text-[#4c5752] font-medium mt-0.5">
              Klik op een festival om de bestellingen, zaalcapaciteit en scanner voor die locatie te beheren.
            </p>
          </div>
          <span className="text-[11px] sm:text-xs text-[#1D1C1A] font-extrabold bg-[#FCFAF7] px-2.5 py-1 rounded border-2 border-[#1D1C1A] shadow-[2px_2px_0px_rgba(29,28,26,0.8)] shrink-0 flex items-center gap-2 self-start sm:self-auto">
            <span className="flex items-center gap-1 text-[#1E3A8A]"><span className="w-2 h-2 rounded-full bg-[#1E3A8A]"></span> Gent</span>
            <span className="text-[#c1d4ce]">•</span>
            <span className="flex items-center gap-1 text-[#006448]"><span className="w-2 h-2 rounded-full bg-[#006448]"></span> Den Haag</span>
            <span className="text-[#c1d4ce]">•</span>
            <span className="flex items-center gap-1 text-[#8C0223]"><span className="w-2 h-2 rounded-full bg-[#8C0223]"></span> Amsterdam</span>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {displayedFestivals.map((fest) => {
            const theme = CITY_THEMES[fest.id] || CITY_THEMES.denhaag;
            return (
              <div
                key={fest.id}
                className={`${theme.gradientClass} border-2 border-[#1D1C1A] rounded-lg shadow-[4px_4px_0px_rgba(29,28,26,0.9)] flex flex-col justify-between overflow-hidden hover:-translate-y-0.5 transition-all`}
              >
                <div className="p-4 sm:p-5 flex flex-col flex-1 justify-between">
                  <div>
                    {/* City Badge & Status */}
                    <div className="flex items-center justify-between mb-2.5 sm:mb-3">
                      <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-widest bg-[#FCFAF7] text-[#1D1C1A] px-2.5 py-0.5 rounded border-2 border-[#1D1C1A] shadow-[1px_1px_0px_rgba(29,28,26,0.9)]">
                        {fest.edition}
                      </span>
                      <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#FCFAF7] text-[#1D1C1A] border-2 border-[#1D1C1A] shadow-[1px_1px_0px_rgba(29,28,26,0.9)] flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          fest.statusType === 'live' ? 'bg-emerald-600' : fest.statusType === 'test' ? 'bg-amber-500' : 'bg-gray-400'
                        }`}></span>
                        {fest.statusLabel}
                      </span>
                    </div>

                    <h3 className="font-extrabold text-base sm:text-lg text-white tracking-tight mb-1.5 drop-shadow-sm">
                      {fest.name}
                    </h3>

                    <div className="text-xs text-[#FAF7F2]/90 space-y-1 mb-3 sm:mb-4 font-medium">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#caac8e] shrink-0" />
                        <span>{fest.dates}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#caac8e] shrink-0" />
                        <span className="truncate">{fest.location}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-[#e4d5c4] font-bold">
                        <Building2 className="w-3.5 h-3.5 shrink-0" />
                        <span>{fest.accountInfo}</span>
                      </div>
                    </div>

                    {/* Financial & Ticket Line Details (Enclosed card) */}
                    <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded p-3 space-y-2 mb-3 sm:mb-4 shadow-[2px_2px_0px_rgba(29,28,26,0.9)] text-[#1D1C1A]">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#4c5752] font-bold">Omzet:</span>
                        <span className="font-extrabold text-[#1D1C1A]">
                          € {(fest.revenueCents / 100).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#4c5752] font-bold">Tickets:</span>
                        <span className="font-extrabold text-[#1D1C1A]">
                          {fest.ticketsSold.toLocaleString('nl-NL')} / {fest.ticketsTotal.toLocaleString('nl-NL')} ({fest.pct}%)
                        </span>
                      </div>
                      <div className="w-full bg-[#c1d4ce] h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`${theme.progressBar} h-full rounded-full transition-all duration-500`}
                          style={{ width: `${Math.min(100, Math.max(fest.ticketsSold > 0 ? 1 : 0, parseFloat(fest.pct)))}%` }}
                        ></div>
                      </div>
                      <div className="flex items-center justify-between text-[10px] sm:text-[11px] pt-1 border-t border-[#c1d4ce]/60">
                        <span className="text-[#4c5752] font-medium truncate mr-2">Status:</span>
                        <span className="font-bold text-[#1D1C1A]">
                          {fest.vipNote}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* City Manage Button */}
                  <button
                    onClick={() => {
                      navigate(`/admin/festival/${fest.id}`);
                    }}
                    className="w-full py-2.5 px-3 rounded text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer border-2 border-[#1D1C1A] shadow-[2px_2px_0px_rgba(29,28,26,0.9)] transition-all bg-[#FCFAF7] hover:bg-white text-[#1D1C1A] active:translate-y-0.5 group"
                  >
                    <span>Open Hub: {fest.id === 'denhaag' ? 'Den Haag' : fest.id === 'amsterdam' ? 'Amsterdam' : 'Gent'}</span>
                    <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. RECENTE BESTELLINGEN (Live Mollie transacties) */}
      <div>
        <div className="flex items-center justify-between mb-2.5 sm:mb-3">
          <div>
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-[#1D1C1A] flex items-center gap-1.5 sm:gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#006448]"></span>
              Recente Bestellingen
            </h2>
            <p className="text-[11px] sm:text-xs text-[#4c5752] font-medium hidden xs:block">
              {mollieEnv === 'live' 
                ? 'Geverifieerde live Mollie bestellingen.' 
                : 'Mollie testtransacties voor verificatie en controle.'}
            </p>
          </div>

          <Link
            to="/admin/festival/gent/orders"
            className="text-xs font-extrabold text-[#006448] hover:underline flex items-center gap-1"
          >
            <span>Alle Bestellingen</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Empty State */}
        {displayedOrders.length === 0 ? (
          <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-8 sm:p-12 text-center shadow-[4px_4px_0px_rgba(29,28,26,0.9)]">
            <div className="w-12 h-12 rounded-full bg-[#d8e7e2] text-[#006448] flex items-center justify-center mx-auto mb-3 border border-[#8ba198]">
              <Receipt className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-base sm:text-lg text-[#1D1C1A]">
              {mollieEnv === 'live' ? 'Nog geen live bestellingen ontvangen' : 'Geen bestellingen gevonden'}
            </h3>
            <p className="text-xs sm:text-sm text-[#4c5752] max-w-md mx-auto mt-1.5 font-medium">
              {mollieEnv === 'live'
                ? 'Zodra de eerste bezoeker via Mollie Live afrekent, verschijnt de bestelling direct hier in de cockpit.'
                : 'Schakel naar Mollie Test om de 14 proefbestellingen van Gent te bekijken, of plaats een nieuwe testorder.'}
            </p>
            {mollieEnv === 'live' && (
              <div className="mt-4">
                <button
                  onClick={() => setMollieEnv('test')}
                  className="btn-letterpress-outline px-4 py-2 rounded text-xs font-extrabold"
                >
                  Bekijk Testorders
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* MOBILE CARDS STREAM (< 768px) */}
            <div className="block md:hidden space-y-3">
              {displayedOrders.slice(0, 10).map((order) => (
                <div
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-3.5 shadow-[3px_3px_0px_rgba(29,28,26,0.9)] space-y-2 active:bg-[#FAF7F2] cursor-pointer"
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
                  </div>

                  <div className="pt-2 border-t border-[#c1d4ce] flex items-center justify-between">
                    <span className="font-extrabold text-sm text-[#1D1C1A]">
                      € {(order.totalCents / 100).toFixed(2).replace('.', ',')}
                    </span>

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

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOrder(order);
                        }}
                        className="btn-letterpress-gold px-2 py-0.5 rounded text-[10px] font-extrabold"
                      >
                        Details
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* DESKTOP TABLE VIEW (>= 768px) */}
            <div className="hidden md:block bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg shadow-[4px_4px_0px_rgba(29,28,26,0.9)] overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#FAF7F2] border-b-2 border-[#1D1C1A] text-[#4c5752] font-extrabold uppercase tracking-wider">
                    <th className="py-3 px-4">Order #</th>
                    <th className="py-3 px-4">Klantnaam</th>
                    <th className="py-3 px-4">Stad</th>
                    <th className="py-3 px-4">Bestelde Items</th>
                    <th className="py-3 px-4">Bedrag</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actie</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#c1d4ce]">
                  {displayedOrders.slice(0, 10).map((order) => (
                    <tr
                      key={order.id}
                      className="hover:bg-[#FAF7F2] transition-colors cursor-pointer"
                      onClick={() => setSelectedOrder(order)}
                    >
                      <td className="py-3 px-4 font-mono font-extrabold text-[#006448]">
                        {order.orderNumber}
                      </td>
                      <td className="py-3 px-4 font-bold text-[#1D1C1A]">
                        {order.customerName}
                        <span className="block text-[11px] font-normal text-[#4c5752]">
                          {order.customerEmail}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="bg-[#d8e7e2] text-[#006448] px-2 py-0.5 rounded font-bold text-[11px] border border-[#8ba198]">
                          {order.cityName}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#1D1C1A] font-medium">{order.itemsSummary}</td>
                      <td className="py-3 px-4 font-extrabold text-[#1D1C1A]">
                        € {(order.totalCents / 100).toFixed(2).replace('.', ',')}
                      </td>
                      <td className="py-3 px-4">
                        {order.status === 'paid' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3" /> Betaald
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                            <Clock className="w-3 h-3" /> {order.status === 'canceled' ? 'Geannuleerd' : 'In afwachting'}
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
          </>
        )}
      </div>

      {/* Slide-out Order Detail Drawer */}
      <OrderDetailDrawer order={selectedOrder} onClose={() => setSelectedOrder(null)} />
    </div>
  );
};
