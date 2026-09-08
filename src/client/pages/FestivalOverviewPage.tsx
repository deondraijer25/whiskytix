import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  Ticket,
  ShoppingBag,
  Sparkles,
  Calendar,
  Clock,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Activity,
  QrCode,
  Search,
  ExternalLink,
} from 'lucide-react';
import {
  INITIAL_FESTIVALS,
  INITIAL_SESSIONS,
  INITIAL_ORDERS,
  Order,
} from '../data/mockData';
import { OrderDetailDrawer } from '../components/OrderDetailDrawer';

export const FestivalOverviewPage: React.FC = () => {
  const { cityId = 'denhaag' } = useParams<{ cityId?: string }>();
  const navigate = useNavigate();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const activeFestival =
    INITIAL_FESTIVALS.find((f) => f.id === cityId) || INITIAL_FESTIVALS[0];

  // Scoped data
  const festivalSessions = INITIAL_SESSIONS.filter((s) => s.city === cityId);
  const regularSessions = festivalSessions.filter((s) => s.category !== 'masterclass');
  const festivalOrders = INITIAL_ORDERS.filter((o) => o.city === cityId);

  const totalRevenue = activeFestival.revenueCents;
  const totalSold = activeFestival.ticketsSold;
  const totalMax = activeFestival.ticketsTotal;
  const soldPct = ((totalSold / totalMax) * 100).toFixed(0);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* 1. Header Banner */}
      <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-4 sm:p-6 shadow-[4px_4px_0px_rgba(29,28,26,0.9)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-widest text-[#006448] bg-[#d8e7e2] px-2 py-0.5 rounded border border-[#8ba198]">
              {activeFestival.edition} • Directie Dashboard
            </span>
            <span className="text-[11px] sm:text-xs text-[#4c5752] font-semibold">
              • {activeFestival.location}
            </span>
          </div>
          <h1 className="text-xl sm:text-3xl font-extrabold text-[#1D1C1A] tracking-tight">
            Overzicht: {activeFestival.name}
          </h1>
          <p className="text-xs sm:text-sm text-[#4c5752] mt-0.5 font-medium">
            Realtime inzicht in omzet, zaalcapaciteit per sessie en recente transacties voor deze editie.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Link
            to={`/admin/festival/${cityId}/orders`}
            className="btn-letterpress flex-1 sm:flex-initial px-3.5 py-2 rounded text-xs font-extrabold flex items-center justify-center gap-2 shadow-[2px_2px_0px_rgba(29,28,26,0.9)]"
          >
            <Search className="w-4 h-4" />
            <span>Zoek Bestellingen</span>
          </Link>
          <Link
            to={`/scan?festival=${cityId}`}
            className="btn-letterpress-outline flex-1 sm:flex-initial px-3.5 py-2 rounded text-xs font-extrabold flex items-center justify-center gap-2"
          >
            <QrCode className="w-4 h-4 text-[#006448]" />
            <span>Deurscanner</span>
          </Link>
        </div>
      </div>

      {/* 2. TOP 4 FINANCIËLE & VERKOOP KPI'S */}
      <div>
        <div className="flex items-center justify-between mb-2.5 sm:mb-3">
          <h2 className="text-xs font-extrabold uppercase tracking-widest text-[#1D1C1A] flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#006448]"></span>
            Totaalscore {activeFestival.name}
          </h2>
          <span className="text-[10px] sm:text-xs text-[#4c5752] font-bold">Mollie Live</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          {/* KPI 1: Omzet */}
          <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded p-3.5 sm:p-5 shadow-[3px_3px_0px_rgba(29,28,26,0.9)]">
            <div className="flex items-center justify-between text-[#4c5752] mb-1">
              <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider truncate">
                Bruto Omzet
              </span>
              <div className="w-6 h-6 rounded bg-[#d8e7e2] text-[#006448] flex items-center justify-center font-bold text-xs">
                €
              </div>
            </div>
            <div className="text-lg sm:text-2xl lg:text-3xl font-extrabold text-[#006448] tracking-tight">
              € {(totalRevenue / 100).toLocaleString('nl-NL', { minimumFractionDigits: 0 })}
            </div>
            <div className="mt-1 text-[10px] sm:text-[11px] font-bold text-[#006448] flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 shrink-0" />
              <span>+18.4% vs vorig jaar</span>
            </div>
          </div>

          {/* KPI 2: Tickets Verkocht */}
          <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded p-3.5 sm:p-5 shadow-[3px_3px_0px_rgba(29,28,26,0.9)]">
            <div className="flex items-center justify-between text-[#4c5752] mb-1">
              <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider truncate">
                Tickets Verkocht
              </span>
              <div className="w-6 h-6 rounded bg-[#d8e7e2] text-[#006448] flex items-center justify-center font-bold text-xs">
                <Ticket className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-lg sm:text-2xl lg:text-3xl font-extrabold text-[#1D1C1A] tracking-tight">
              {totalSold.toLocaleString('nl-NL')}{' '}
              <span className="text-xs sm:text-sm font-semibold text-[#4c5752]">
                / {totalMax.toLocaleString('nl-NL')}
              </span>
            </div>
            <div className="w-full bg-[#c1d4ce] h-2 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-[#006448] h-full rounded-full transition-all duration-500"
                style={{ width: `${soldPct}%` }}
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
              <div className="w-6 h-6 rounded bg-[#d8e7e2] text-[#006448] flex items-center justify-center font-bold text-xs">
                <ShoppingBag className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-lg sm:text-2xl lg:text-3xl font-extrabold text-[#1D1C1A] tracking-tight">
              {festivalOrders.length * 480}{' '}
              <span className="text-xs sm:text-sm font-semibold text-[#4c5752]">orders</span>
            </div>
            <div className="mt-1 text-[10px] sm:text-[11px] font-bold text-[#4c5752]">
              Reeks: <span className="font-mono text-[#006448]">#WF-84000+</span>
            </div>
          </div>

          {/* KPI 4: Gemiddelde Orderwaarde */}
          <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded p-3.5 sm:p-5 shadow-[3px_3px_0px_rgba(29,28,26,0.9)]">
            <div className="flex items-center justify-between text-[#4c5752] mb-1">
              <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider truncate">
                Gem. Order (AOV)
              </span>
              <div className="w-6 h-6 rounded bg-[#caac8e] text-[#1D1C1A] flex items-center justify-center font-bold text-xs">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-lg sm:text-2xl lg:text-3xl font-extrabold text-[#1D1C1A] tracking-tight">
              € 154,50
            </div>
            <div className="mt-1 text-[10px] sm:text-[11px] font-bold text-[#4c5752]">
              Gem. 2,6 tickets / order
            </div>
          </div>
        </div>
      </div>

      {/* 3. DE SESSIE-THERMOMETER: Realtime Status per Dagdeel */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-[#1D1C1A] flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#006448]"></span>
              Sessie-Thermometer (Voortgang per Dagdeel)
            </h2>
            <p className="text-[11px] sm:text-xs text-[#4c5752] font-medium mt-0.5">
              Direct inzicht in welke sessies bijna vol zitten en waar marketing of capaciteit moet worden bijgestuurd.
            </p>
          </div>

          <Link
            to={`/admin/festival/${cityId}/inventory`}
            className="text-xs font-extrabold text-[#006448] hover:underline flex items-center gap-1 shrink-0"
          >
            <span>Zaalcapaciteit Beheren</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
          {regularSessions.map((session) => {
            const pct = Math.min(100, Math.round((session.sold / session.max) * 100));
            const remaining = Math.max(0, session.max - session.sold);
            const isFull = session.isSoldOut || remaining === 0;
            const isAlmostFull = !isFull && pct >= 85;

            return (
              <div
                key={session.id}
                className={`bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-4 shadow-[3px_3px_0px_rgba(29,28,26,0.9)] flex flex-col justify-between ${
                  isFull ? 'bg-red-50/20' : ''
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#4c5752] bg-[#FAF7F2] border border-[#c1d4ce] px-2 py-0.5 rounded">
                      {session.day}
                    </span>
                    {isFull ? (
                      <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300">
                        🔴 Uitverkocht
                      </span>
                    ) : isAlmostFull ? (
                      <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                        🟠 Bijna Vol ({remaining} over)
                      </span>
                    ) : (
                      <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                        🟢 {remaining} Beschikbaar
                      </span>
                    )}
                  </div>

                  <h3 className="font-extrabold text-base text-[#1D1C1A] tracking-tight">
                    {session.name}
                  </h3>
                  <div className="flex items-center gap-1 text-xs text-[#4c5752] font-semibold mb-3">
                    <Clock className="w-3.5 h-3.5 text-[#006448]" />
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
                    <div className="w-full bg-[#c1d4ce] h-2.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isFull
                            ? 'bg-red-600'
                            : isAlmostFull
                            ? 'bg-amber-500'
                            : 'bg-[#006448]'
                        }`}
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-[#c1d4ce] flex items-center justify-between text-xs">
                  <span className="text-[#4c5752] text-[11px] font-medium">
                    Atomaire voorraadvergrendeling
                  </span>
                  <Link
                    to={`/admin/festival/${cityId}/inventory`}
                    className="font-extrabold text-[#006448] hover:underline flex items-center gap-1"
                  >
                    <span>Wijzig</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. ONDERSTE HELFT: Recente Bestellingen & Directie Snelle Acties */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kolom 1 & 2: Recente Bestellingen van dit festival */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-[#1D1C1A] flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#006448]"></span>
                Laatste Bestellingen ({activeFestival.name})
              </h2>
              <p className="text-[11px] sm:text-xs text-[#4c5752] font-medium">
                Klik op een order om direct e-tickets te bekijken of te herverzenden.
              </p>
            </div>
            <Link
              to={`/admin/festival/${cityId}/orders`}
              className="text-xs font-extrabold text-[#006448] hover:underline flex items-center gap-1"
            >
              <span>Alle Orders ({festivalOrders.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {festivalOrders.slice(0, 4).map((order) => (
              <div
                key={order.id}
                onClick={() => setSelectedOrder(order)}
                className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-3.5 sm:p-4 shadow-[2px_2px_0px_rgba(29,28,26,0.9)] hover:bg-[#FAF7F2] transition-colors cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded bg-[#d8e7e2] text-[#006448] border border-[#8ba198] flex items-center justify-center font-bold text-xs shrink-0">
                    #WF
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-[#1D1C1A]">
                        {order.customerName}
                      </span>
                      <span className="text-[11px] font-mono text-[#4c5752]">
                        {order.orderNumber}
                      </span>
                    </div>
                    <div className="text-xs text-[#4c5752] font-medium">
                      {order.itemsSummary}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center">
                  <div className="text-right">
                    <span className="font-extrabold text-sm text-[#006448] block">
                      € {(order.totalCents / 100).toFixed(2).replace('.', ',')}
                    </span>
                    <span className="text-[10px] text-[#4c5752] font-semibold">
                      {order.createdAt}
                    </span>
                  </div>
                  <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Betaald
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Kolom 3: Directie Quick-Actions & Live Systeemstatus */}
        <div className="space-y-4">
          <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-[#1D1C1A] flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#006448]"></span>
            Snelle Acties
          </h2>

          <div className="space-y-2">
            <Link
              to={`/admin/festival/${cityId}/orders`}
              className="w-full bg-[#FCFAF7] border-2 border-[#1D1C1A] hover:bg-[#d8e7e2] p-3 rounded-lg font-extrabold text-xs text-[#1D1C1A] flex items-center justify-between shadow-[2px_2px_0px_rgba(29,28,26,0.9)] transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <Search className="w-4 h-4 text-[#006448]" />
                <span>Zoek Klant of Ticketnummer</span>
              </div>
              <ArrowRight className="w-4 h-4 text-[#4c5752] group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              to={`/admin/festival/${cityId}/inventory`}
              className="w-full bg-[#FCFAF7] border-2 border-[#1D1C1A] hover:bg-[#d8e7e2] p-3 rounded-lg font-extrabold text-xs text-[#1D1C1A] flex items-center justify-between shadow-[2px_2px_0px_rgba(29,28,26,0.9)] transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <Layers className="w-4 h-4 text-[#006448]" />
                <span>Zaalcapaciteit & Masterclasses</span>
              </div>
              <ArrowRight className="w-4 h-4 text-[#4c5752] group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              to={`/admin/festival/${cityId}/door`}
              className="w-full bg-[#FCFAF7] border-2 border-[#1D1C1A] hover:bg-[#d8e7e2] p-3 rounded-lg font-extrabold text-xs text-[#1D1C1A] flex items-center justify-between shadow-[2px_2px_0px_rgba(29,28,26,0.9)] transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <Activity className="w-4 h-4 text-[#006448]" />
                <span>Live Deurmonitor & Check-ins</span>
              </div>
              <ArrowRight className="w-4 h-4 text-[#4c5752] group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              to={`/scan?festival=${cityId}`}
              className="w-full bg-[#006448] text-white border-2 border-[#1D1C1A] hover:bg-[#004d37] p-3 rounded-lg font-extrabold text-xs flex items-center justify-between shadow-[2px_2px_0px_rgba(29,28,26,0.9)] transition-all group"
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
              <span>Mollie Webhook:</span>
              <span className="font-bold text-emerald-800">Actief (Live)</span>
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
        onClose={() => setSelectedOrder(null)}
      />
    </div>
  );
};
