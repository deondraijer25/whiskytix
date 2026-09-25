import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Ticket,
  ShoppingBag,
  CreditCard,
  Receipt,
  Calendar,
  Clock,
  ArrowRight,
  CheckCircle2,
  Layers,
  Activity,
  QrCode,
  Search,
  RefreshCw,
} from 'lucide-react';
import {
  INITIAL_FESTIVALS,
  INITIAL_SESSIONS,
  Order,
  SessionCapacity,
} from '../data/mockData';
import { OrderDetailDrawer } from '../components/OrderDetailDrawer';

const CITY_THEMES: Record<string, {
  primary: string;
  gradientClass: string;
  dotColor: string;
  progressBar: string;
  accentText: string;
  badgeBg: string;
  badgeBorder: string;
  buttonBg: string;
}> = {
  gent: {
    primary: '#1E3A8A',
    gradientClass: 'bg-gradient-to-br from-[#172554] via-[#1E3A8A] to-[#1D4ED8]',
    dotColor: 'bg-[#1E3A8A]',
    progressBar: 'bg-[#1E3A8A]',
    accentText: 'text-[#1E3A8A]',
    badgeBg: 'bg-[#EBF3FB]',
    badgeBorder: 'border-[#BFDBFE]',
    buttonBg: 'bg-[#1E3A8A]',
  },
  denhaag: {
    primary: '#006448',
    gradientClass: 'bg-gradient-to-br from-[#003B2A] via-[#006448] to-[#047857]',
    dotColor: 'bg-[#006448]',
    progressBar: 'bg-[#006448]',
    accentText: 'text-[#006448]',
    badgeBg: 'bg-[#d8e7e2]',
    badgeBorder: 'border-[#8ba198]',
    buttonBg: 'bg-[#006448]',
  },
  amsterdam: {
    primary: '#8C0223',
    gradientClass: 'bg-gradient-to-br from-[#5C0117] via-[#8C0223] to-[#B91C1C]',
    dotColor: 'bg-[#8C0223]',
    progressBar: 'bg-[#8C0223]',
    accentText: 'text-[#8C0223]',
    badgeBg: 'bg-[#FCE8EC]',
    badgeBorder: 'border-[#F5B7C2]',
    buttonBg: 'bg-[#8C0223]',
  },
};

export const FestivalOverviewPage: React.FC = () => {
  const { cityId = 'gent' } = useParams<{ cityId?: string }>();
  const navigate = useNavigate();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const theme = CITY_THEMES[cityId] || CITY_THEMES.denhaag;

  const activeFestival = useMemo(() => {
    return INITIAL_FESTIVALS.find((f) => f.id === cityId) || INITIAL_FESTIVALS[0];
  }, [cityId]);

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/orders?festivalId=${cityId}`);
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

  useEffect(() => {
    fetchOrders();
  }, [cityId]);

  // Real paid orders for this festival
  const paidOrders = useMemo(() => {
    return orders.filter((o) => o.status === 'paid');
  }, [orders]);

  const totalRevenueCents = useMemo(() => {
    return paidOrders.reduce((acc, o) => acc + (o.totalCents || 0), 0);
  }, [paidOrders]);

  const totalTicketsSold = useMemo(() => {
    return paidOrders.reduce((acc, o) => acc + (o.tickets?.length || 1), 0);
  }, [paidOrders]);

  const totalMax = activeFestival.ticketsTotal;
  const soldPct = totalMax > 0 ? ((totalTicketsSold / totalMax) * 100).toFixed(1) : '0.0';
  const totalOrdersCount = paidOrders.length;
  const averageOrderValueCents = totalOrdersCount > 0 ? Math.round(totalRevenueCents / totalOrdersCount) : 0;

  // Real capacity calculation for sessions
  const sessions = useMemo<SessionCapacity[]>(() => {
    const rawSessions = INITIAL_SESSIONS.filter((s) => s.city === cityId);
    return rawSessions.map((session) => {
      // Calculate how many tickets were sold for this specific session
      let soldCount = 0;
      paidOrders.forEach((o) => {
        if (Array.isArray(o.tickets)) {
          o.tickets.forEach((t) => {
            if (t.session && t.session.toLowerCase().includes(session.name.toLowerCase().replace(' sessie', ''))) {
              soldCount++;
            }
          });
        }
      });
      return {
        ...session,
        sold: soldCount,
        isSoldOut: soldCount >= session.max,
      };
    });
  }, [cityId, paidOrders]);

  const isPrelaunch = cityId === 'denhaag' || cityId === 'amsterdam';

  return (
    <div className="space-y-6 sm:space-y-8 font-sans">
      {/* 1. Header Hero Banner with Festival Gradient */}
      <div className={`${theme.gradientClass} border-2 border-[#1D1C1A] rounded-lg p-5 sm:p-6 shadow-[4px_4px_0px_rgba(29,28,26,0.9)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-white`}>
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-widest bg-[#FCFAF7] text-[#1D1C1A] px-2.5 py-0.5 rounded border-2 border-[#1D1C1A] shadow-[1px_1px_0px_rgba(29,28,26,0.9)]">
              {activeFestival.edition} • Directie Dashboard
            </span>
            <span className="text-xs text-[#FAF7F2]/90 font-semibold">
              • {activeFestival.location}
            </span>
            <span
              className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border-2 border-[#1D1C1A] bg-[#FCFAF7] text-[#1D1C1A] shadow-[1px_1px_0px_rgba(29,28,26,0.9)] flex items-center gap-1.5"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isPrelaunch ? 'bg-amber-500' : 'bg-emerald-600'}`}></span>
              {isPrelaunch ? 'In Voorbereiding' : 'Mollie Actief'}
            </span>
          </div>
          <h1 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight drop-shadow-sm">
            Overzicht: {activeFestival.name}
          </h1>
          <p className="text-xs sm:text-sm text-[#FAF7F2]/90 mt-1 font-medium">
            {isPrelaunch
              ? 'Deze festivaleditie staat momenteel in voorbereiding. De kaartverkoop is nog niet gestart.'
              : 'Realtime inzicht in omzet, zaalcapaciteit en bestellingen via Mollie.'}
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <button
            onClick={fetchOrders}
            disabled={isLoading}
            className="p-2.5 rounded border-2 border-[#1D1C1A] bg-[#FCFAF7] hover:bg-white text-[#1D1C1A] shadow-[2px_2px_0px_rgba(29,28,26,0.9)] cursor-pointer disabled:opacity-50 transition-all active:translate-y-0.5"
            title="Ververs gegevens"
          >
            <RefreshCw className={`w-4 h-4 text-[#1D1C1A] ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            to={`/admin/festival/${cityId}/orders`}
            className="flex-1 sm:flex-initial px-3.5 py-2.5 rounded text-xs font-extrabold flex items-center justify-center gap-2 border-2 border-[#1D1C1A] bg-[#FCFAF7] hover:bg-white text-[#1D1C1A] shadow-[2px_2px_0px_rgba(29,28,26,0.9)] transition-all active:translate-y-0.5"
          >
            <Search className="w-4 h-4 text-[#1D1C1A]" />
            <span>Bestellingen</span>
          </Link>
          <Link
            to={`/scan?festival=${cityId}`}
            className="flex-1 sm:flex-initial px-3.5 py-2.5 rounded text-xs font-extrabold flex items-center justify-center gap-2 border-2 border-[#1D1C1A] bg-[#FCFAF7] hover:bg-white text-[#1D1C1A] shadow-[2px_2px_0px_rgba(29,28,26,0.9)] transition-all active:translate-y-0.5"
          >
            <QrCode className="w-4 h-4 text-[#1D1C1A]" />
            <span>Deurscanner</span>
          </Link>
        </div>
      </div>

      {/* Pre-launch notification banner for Den Haag & Amsterdam */}
      {isPrelaunch && (
        <div className="bg-[#FAF7F2] border-2 border-[#1D1C1A] rounded-lg p-4 shadow-[3px_3px_0px_rgba(29,28,26,0.9)] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-[#caac8e] border border-[#1D1C1A] flex items-center justify-center font-bold text-sm text-[#1D1C1A] shrink-0">
              ℹ
            </div>
            <div>
              <div className="text-xs font-extrabold text-[#1D1C1A] uppercase tracking-wider">
                Verkoop Status: In Voorbereiding
              </div>
              <div className="text-xs text-[#4c5752] font-medium mt-0.5">
                Voor {activeFestival.name} zijn nog geen tickets te koop aangeboden. Zodra het gezamenlijke Mollie account wordt geactiveerd, start de verkoop.
              </div>
            </div>
          </div>
          <Link
            to={`/admin/festival/${cityId}/inventory`}
            className="btn-letterpress-gold px-3 py-1.5 rounded text-xs font-extrabold shrink-0 hidden sm:inline-block"
          >
            Zaalcapaciteit Inrichten
          </Link>
        </div>
      )}

      {/* 2. TOP 4 FINANCIËLE & VERKOOP KPI'S */}
      <div>
        <div className="flex items-center justify-between mb-2.5 sm:mb-3">
          <h2 className="text-xs font-extrabold uppercase tracking-widest text-[#1D1C1A] flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${theme.dotColor}`}></span>
            Totaalscore {activeFestival.name}
          </h2>
          <span className="text-[10px] sm:text-xs text-[#4c5752] font-bold">
            {isPrelaunch ? 'Pre-launch' : 'Mollie Live Gekoppeld'}
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          {/* KPI 1: Omzet */}
          <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded p-3.5 sm:p-5 shadow-[3px_3px_0px_rgba(29,28,26,0.9)]">
            <div className="flex items-center justify-between text-[#4c5752] mb-1">
              <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider truncate">
                Bruto Omzet
              </span>
              <div className={`w-6 h-6 rounded ${theme.badgeBg} ${theme.accentText} flex items-center justify-center font-bold text-xs border ${theme.badgeBorder}`}>
                €
              </div>
            </div>
            <div className={`text-lg sm:text-2xl lg:text-3xl font-extrabold ${theme.accentText} tracking-tight`}>
              € {(totalRevenueCents / 100).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="mt-1 text-[10px] sm:text-[11px] font-medium text-[#4c5752] truncate">
              {isPrelaunch ? 'Kaartverkoop opent binnenkort' : `${paidOrders.length} transacties via Mollie`}
            </div>
          </div>

          {/* KPI 2: Tickets Verkocht */}
          <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded p-3.5 sm:p-5 shadow-[3px_3px_0px_rgba(29,28,26,0.9)]">
            <div className="flex items-center justify-between text-[#4c5752] mb-1">
              <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider truncate">
                Tickets Verkocht
              </span>
              <div className={`w-6 h-6 rounded ${theme.badgeBg} ${theme.accentText} flex items-center justify-center font-bold text-xs border ${theme.badgeBorder}`}>
                <Ticket className={`w-3.5 h-3.5 ${theme.accentText}`} />
              </div>
            </div>
            <div className="text-lg sm:text-2xl lg:text-3xl font-extrabold text-[#1D1C1A] tracking-tight">
              {totalTicketsSold.toLocaleString('nl-NL')}{' '}
              <span className="text-xs sm:text-sm font-semibold text-[#4c5752]">
                / {totalMax.toLocaleString('nl-NL')}
              </span>
            </div>
            <div className="w-full bg-[#c1d4ce] h-2 rounded-full mt-2 overflow-hidden">
              <div
                className={`${theme.progressBar} h-full rounded-full transition-all duration-500`}
                style={{ width: `${Math.min(100, Math.max(totalTicketsSold > 0 ? 1 : 0, parseFloat(soldPct)))}%` }}
              ></div>
            </div>
            <div className="mt-1 text-[10px] font-bold text-[#4c5752] text-right">
              {soldPct}% van zaal bezet
            </div>
          </div>

          {/* KPI 3: Aantal Bestellingen */}
          <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded p-3.5 sm:p-5 shadow-[3px_3px_0px_rgba(29,28,26,0.9)]">
            <div className="flex items-center justify-between text-[#4c5752] mb-1">
              <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider truncate">
                Aantal Orders
              </span>
              <div className={`w-6 h-6 rounded ${theme.badgeBg} ${theme.accentText} flex items-center justify-center font-bold text-xs border ${theme.badgeBorder}`}>
                <ShoppingBag className={`w-3.5 h-3.5 ${theme.accentText}`} />
              </div>
            </div>
            <div className="text-lg sm:text-2xl lg:text-3xl font-extrabold text-[#1D1C1A] tracking-tight">
              {totalOrdersCount}{' '}
              <span className="text-xs sm:text-sm font-semibold text-[#4c5752]">betaald</span>
            </div>
            <div className="mt-1 text-[10px] sm:text-[11px] font-medium text-[#4c5752] truncate">
              {paidOrders[0]?.orderNumber ? `Laatste: ${paidOrders[0].orderNumber}` : 'Geen actieve bestellingen'}
            </div>
          </div>

          {/* KPI 4: Gemiddelde Orderwaarde (AOV) - Standaard CreditCard icon */}
          <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded p-3.5 sm:p-5 shadow-[3px_3px_0px_rgba(29,28,26,0.9)]">
            <div className="flex items-center justify-between text-[#4c5752] mb-1">
              <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider truncate">
                Gem. Order (AOV)
              </span>
              <div className="w-6 h-6 rounded bg-[#caac8e] text-[#1D1C1A] flex items-center justify-center font-bold text-xs border border-[#1D1C1A]">
                <CreditCard className="w-3.5 h-3.5 text-[#1D1C1A]" />
              </div>
            </div>
            <div className="text-lg sm:text-2xl lg:text-3xl font-extrabold text-[#1D1C1A] tracking-tight">
              € {(averageOrderValueCents / 100).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="mt-1 text-[10px] sm:text-[11px] font-medium text-[#4c5752]">
              Per voltooide transactie
            </div>
          </div>
        </div>
      </div>

      {/* 3. DE SESSIE-THERMOMETER: Voortgang per Dagdeel */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-[#1D1C1A] flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${theme.dotColor}`}></span>
              Sessie-Thermometer (Voortgang per Dagdeel)
            </h2>
            <p className="text-[11px] sm:text-xs text-[#4c5752] font-medium mt-0.5">
              Direct inzicht in zaalcapaciteit en verkochte kaarten per sessie.
            </p>
          </div>

          <Link
            to={`/admin/festival/${cityId}/inventory`}
            className={`text-xs font-extrabold ${theme.accentText} hover:underline flex items-center gap-1 shrink-0`}
          >
            <span>Zaalcapaciteit Beheren</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
          {sessions.map((session) => {
            const pct = Math.min(100, Math.round((session.sold / session.max) * 100));
            const remaining = Math.max(0, session.max - session.sold);
            const isFull = session.isSoldOut || remaining === 0;

            return (
              <div
                key={session.id}
                className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-4 shadow-[3px_3px_0px_rgba(29,28,26,0.9)] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#4c5752] bg-[#FAF7F2] border border-[#c1d4ce] px-2 py-0.5 rounded">
                      {session.day}
                    </span>
                    {isFull ? (
                      <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300">
                        Uitverkocht
                      </span>
                    ) : (
                      <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${theme.badgeBg} ${theme.accentText} border ${theme.badgeBorder}`}>
                        {remaining} Beschikbaar
                      </span>
                    )}
                  </div>

                  <h3 className="font-extrabold text-base text-[#1D1C1A] tracking-tight">
                    {session.name}
                  </h3>
                  <div className="flex items-center gap-1 text-xs text-[#4c5752] font-semibold mb-3">
                    <Clock className={`w-3.5 h-3.5 ${theme.accentText}`} />
                    <span>{session.time} uur</span>
                  </div>

                  {/* Progress Meter */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-[#4c5752]">Verkocht:</span>
                      <span className="text-[#1D1C1A]">
                        <strong>{session.sold.toLocaleString('nl-NL')}</strong> / {session.max.toLocaleString('nl-NL')} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-[#c1d4ce] h-2 rounded-full overflow-hidden">
                      <div
                        className={`${theme.progressBar} h-full rounded-full transition-all duration-300`}
                        style={{ width: `${Math.min(100, Math.max(session.sold > 0 ? 1 : 0, pct))}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. RECENTE BESTELLINGEN & DIRECTIE ACTIES */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kolom 1 & 2: Recente Bestellingen */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-[#1D1C1A] flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${theme.dotColor}`}></span>
              Recente Bestellingen {activeFestival.name}
            </h2>
            <Link
              to={`/admin/festival/${cityId}/orders`}
              className={`text-xs font-extrabold ${theme.accentText} hover:underline flex items-center gap-1`}
            >
              <span>Alle Bestellingen</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {orders.length === 0 ? (
            <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-8 text-center shadow-[3px_3px_0px_rgba(29,28,26,0.9)]">
              <div className={`w-10 h-10 rounded-full ${theme.badgeBg} ${theme.accentText} flex items-center justify-center mx-auto mb-2 border ${theme.badgeBorder}`}>
                <Receipt className="w-5 h-5" />
              </div>
              <div className="font-extrabold text-sm text-[#1D1C1A]">
                Nog geen bestellingen voor {activeFestival.name}
              </div>
              <div className="text-xs text-[#4c5752] mt-1 font-medium max-w-sm mx-auto">
                {isPrelaunch
                  ? 'De kaartverkoop voor deze editie is nog in voorbereiding.'
                  : 'Zodra de eerste bezoeker via Mollie afrekent, verschijnt deze hier direct.'}
              </div>
            </div>
          ) : (
            <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg shadow-[3px_3px_0px_rgba(29,28,26,0.9)] overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#FAF7F2] border-b-2 border-[#1D1C1A] text-[#4c5752] font-extrabold uppercase tracking-wider">
                    <th className="py-2.5 px-3">Order #</th>
                    <th className="py-2.5 px-3">Klant</th>
                    <th className="py-2.5 px-3">Items</th>
                    <th className="py-2.5 px-3">Bedrag</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Actie</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#c1d4ce]">
                  {orders.slice(0, 8).map((order) => (
                    <tr
                      key={order.id}
                      className="hover:bg-[#FAF7F2] transition-colors cursor-pointer"
                      onClick={() => setSelectedOrder(order)}
                    >
                      <td className={`py-2.5 px-3 font-mono font-extrabold ${theme.accentText}`}>
                        {order.orderNumber}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-[#1D1C1A]">
                        {order.customerName}
                      </td>
                      <td className="py-2.5 px-3 text-[#4c5752] truncate max-w-[180px]">
                        {order.itemsSummary}
                      </td>
                      <td className="py-2.5 px-3 font-extrabold text-[#1D1C1A]">
                        € {(order.totalCents / 100).toFixed(2).replace('.', ',')}
                      </td>
                      <td className="py-2.5 px-3">
                        {order.status === 'paid' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3" /> Betaald
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                            In afwachting
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOrder(order);
                          }}
                          className="btn-letterpress-gold px-2 py-0.5 rounded text-[10px] font-extrabold cursor-pointer"
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

        {/* Kolom 3: Directie Quick-Actions & Live Systeemstatus */}
        <div className="space-y-4">
          <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-[#1D1C1A] flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${theme.dotColor}`}></span>
            Snelle Acties
          </h2>

          <div className="space-y-2">
            <Link
              to={`/admin/festival/${cityId}/orders`}
              className="w-full bg-[#FCFAF7] border-2 border-[#1D1C1A] hover:bg-[#FAF7F2] p-3 rounded-lg font-extrabold text-xs text-[#1D1C1A] flex items-center justify-between shadow-[2px_2px_0px_rgba(29,28,26,0.9)] transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <Search className={`w-4 h-4 ${theme.accentText}`} />
                <span>Zoek Klant of Ticketnummer</span>
              </div>
              <ArrowRight className="w-4 h-4 text-[#4c5752] group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              to={`/admin/festival/${cityId}/inventory`}
              className="w-full bg-[#FCFAF7] border-2 border-[#1D1C1A] hover:bg-[#FAF7F2] p-3 rounded-lg font-extrabold text-xs text-[#1D1C1A] flex items-center justify-between shadow-[2px_2px_0px_rgba(29,28,26,0.9)] transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <Layers className={`w-4 h-4 ${theme.accentText}`} />
                <span>Zaalcapaciteit & Masterclasses</span>
              </div>
              <ArrowRight className="w-4 h-4 text-[#4c5752] group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              to={`/admin/festival/${cityId}/door`}
              className="w-full bg-[#FCFAF7] border-2 border-[#1D1C1A] hover:bg-[#FAF7F2] p-3 rounded-lg font-extrabold text-xs text-[#1D1C1A] flex items-center justify-between shadow-[2px_2px_0px_rgba(29,28,26,0.9)] transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <Activity className={`w-4 h-4 ${theme.accentText}`} />
                <span>Live Deurmonitor & Check-ins</span>
              </div>
              <ArrowRight className="w-4 h-4 text-[#4c5752] group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              to={`/scan?festival=${cityId}`}
              className={`w-full ${theme.buttonBg} text-white border-2 border-[#1D1C1A] hover:opacity-90 p-3 rounded-lg font-extrabold text-xs flex items-center justify-between shadow-[2px_2px_0px_rgba(29,28,26,0.9)] transition-all group`}
            >
              <div className="flex items-center gap-2.5">
                <QrCode className="w-4 h-4 text-[#caac8e]" />
                <span>Open Deurscanner PWA</span>
              </div>
              <ArrowRight className="w-4 h-4 text-[#caac8e] group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {/* Systeemstatus Box */}
          <div className="bg-[#FAF7F2] border border-[#c1d4ce] rounded-lg p-3.5 space-y-2 text-xs">
            <div className="font-extrabold text-[#1D1C1A] text-[11px] uppercase tracking-wider">
              Systeemstatus {activeFestival.edition}:
            </div>
            <div className="flex items-center justify-between text-[#4c5752]">
              <span>Mollie Koppeling:</span>
              <span className={`font-bold ${isPrelaunch ? 'text-[#4c5752]' : 'text-emerald-800'}`}>
                {isPrelaunch ? 'In voorbereiding' : 'Actief'}
              </span>
            </div>
            <div className="flex items-center justify-between text-[#4c5752]">
              <span>Supabase RLS:</span>
              <span className="font-bold text-emerald-800">Beveiligd</span>
            </div>
            <div className="flex items-center justify-between text-[#4c5752]">
              <span>QR Verificatie:</span>
              <span className="font-bold font-mono text-[10px] text-[#006448]">
                HMAC-SHA256
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Order Detail Drawer */}
      <OrderDetailDrawer
        order={selectedOrder}
        cityId={cityId}
        onClose={() => setSelectedOrder(null)}
      />
    </div>
  );
};
