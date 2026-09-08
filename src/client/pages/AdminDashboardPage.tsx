import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  Ticket,
  ShoppingBag,
  Sparkles,
  Calendar,
  MapPin,
  ChevronRight,
  ArrowRight,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { INITIAL_FESTIVALS, INITIAL_ORDERS, Order } from '../data/mockData';
import { OrderDetailDrawer } from '../components/OrderDetailDrawer';

interface AdminDashboardPageProps {
  selectedCity: string;
  onCityChange: (city: string) => void;
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({
  selectedCity,
  onCityChange,
}) => {
  const navigate = useNavigate();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Filter festivals based on active selector
  const displayedFestivals =
    selectedCity === 'all'
      ? INITIAL_FESTIVALS
      : INITIAL_FESTIVALS.filter((f) => f.id === selectedCity);

  // Filter orders
  const displayedOrders =
    selectedCity === 'all'
      ? INITIAL_ORDERS
      : INITIAL_ORDERS.filter((o) => o.city === selectedCity);

  // Aggregated KPIs
  const totalRevenueCents = displayedFestivals.reduce((acc, f) => acc + f.revenueCents, 0);
  const totalTicketsSold = displayedFestivals.reduce((acc, f) => acc + f.ticketsSold, 0);
  const totalTicketsMax = displayedFestivals.reduce((acc, f) => acc + f.ticketsTotal, 0);
  const soldPercentage = ((totalTicketsSold / totalTicketsMax) * 100).toFixed(1);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Welcome Banner */}
      <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-4 sm:p-6 shadow-[4px_4px_0px_rgba(29,28,26,0.9)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-widest text-[#006448] bg-[#d8e7e2] px-2 py-0.5 rounded border border-[#8ba198]">
              Centraal Cockpit Overzicht
            </span>
            <span className="text-[11px] sm:text-xs text-[#4c5752] font-semibold">• Live Supabase & Mollie</span>
          </div>
          <h1 className="text-xl sm:text-3xl font-extrabold text-[#1D1C1A] tracking-tight">
            3-Steden Festival Cockpit
          </h1>
          <p className="text-xs sm:text-sm text-[#4c5752] mt-0.5 font-medium">
            Overkoepelend inzicht in omzet en transacties. Klik hieronder op een festival om de bestellingen, zalen of scanner van die locatie te openen.
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <span className="text-xs font-bold text-[#006448] bg-[#d8e7e2] px-3 py-1.5 rounded border border-[#8ba198]">
            3 Edities Actief
          </span>
        </div>
      </div>

      {/* 1. FINANCIEEL OVERZICHT (2x2 grid on mobile, 4 columns on desktop) */}
      <div>
        <div className="flex items-center justify-between mb-2.5 sm:mb-3">
          <h2 className="text-xs font-extrabold uppercase tracking-widest text-[#1D1C1A] flex items-center gap-1.5 sm:gap-2">
            <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-[#006448]"></span>
            Financieel Overzicht{' '}
            <span className="hidden xs:inline">
              {selectedCity === 'all' ? '(Totaal Alle 3 Festivals)' : `(${displayedFestivals[0]?.name})`}
            </span>
          </h2>
          <span className="text-[10px] sm:text-xs text-[#4c5752] font-bold">Mollie Live</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          {/* KPI 1: Totale Omzet */}
          <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded p-3.5 sm:p-5 shadow-[3px_3px_0px_rgba(29,28,26,0.9)] sm:shadow-[4px_4px_0px_rgba(29,28,26,0.9)]">
            <div className="flex items-center justify-between text-[#4c5752] mb-1">
              <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider truncate">
                Bruto Omzet
              </span>
              <div className="w-5 h-5 sm:w-7 sm:h-7 rounded bg-[#d8e7e2] text-[#006448] flex items-center justify-center font-bold text-xs">
                €
              </div>
            </div>
            <div className="text-lg sm:text-2xl lg:text-3xl font-extrabold text-[#006448] tracking-tight truncate">
              € {(totalRevenueCents / 100).toLocaleString('nl-NL', { minimumFractionDigits: 0 })}
            </div>
            <div className="mt-1 sm:mt-2 text-[10px] sm:text-[11px] font-bold text-[#006448] flex items-center gap-1 truncate">
              <TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span>+14.2% vs vorig</span>
            </div>
          </div>

          {/* KPI 2: Tickets Verkocht */}
          <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded p-3.5 sm:p-5 shadow-[3px_3px_0px_rgba(29,28,26,0.9)] sm:shadow-[4px_4px_0px_rgba(29,28,26,0.9)]">
            <div className="flex items-center justify-between text-[#4c5752] mb-1">
              <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider truncate">
                Tickets Verkocht
              </span>
              <div className="w-5 h-5 sm:w-7 sm:h-7 rounded bg-[#d8e7e2] text-[#006448] flex items-center justify-center font-bold text-xs">
                <Ticket className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
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
                style={{ width: `${soldPercentage}%` }}
              ></div>
            </div>
            <div className="mt-1 text-[9px] sm:text-[11px] font-bold text-[#4c5752] text-right">
              {soldPercentage}% bezet
            </div>
          </div>

          {/* KPI 3: Actieve Bestellingen */}
          <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded p-3.5 sm:p-5 shadow-[3px_3px_0px_rgba(29,28,26,0.9)] sm:shadow-[4px_4px_0px_rgba(29,28,26,0.9)]">
            <div className="flex items-center justify-between text-[#4c5752] mb-1">
              <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider truncate">
                Bestellingen
              </span>
              <div className="w-5 h-5 sm:w-7 sm:h-7 rounded bg-[#d8e7e2] text-[#006448] flex items-center justify-center font-bold text-xs">
                <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
            <div className="text-lg sm:text-2xl lg:text-3xl font-extrabold text-[#1D1C1A] tracking-tight">
              4.120 <span className="text-xs sm:text-sm font-semibold text-[#4c5752]">orders</span>
            </div>
            <div className="mt-1 sm:mt-2 text-[9px] sm:text-[11px] font-bold text-[#4c5752] truncate">
              Reeks: <span className="font-mono text-[#006448]">#WF-80000+</span>
            </div>
          </div>

          {/* KPI 4: Gemiddelde Orderwaarde */}
          <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded p-3.5 sm:p-5 shadow-[3px_3px_0px_rgba(29,28,26,0.9)] sm:shadow-[4px_4px_0px_rgba(29,28,26,0.9)]">
            <div className="flex items-center justify-between text-[#4c5752] mb-1">
              <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider truncate">
                Gem. Order (AOV)
              </span>
              <div className="w-5 h-5 sm:w-7 sm:h-7 rounded bg-[#caac8e] text-[#1D1C1A] flex items-center justify-center font-bold text-xs">
                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
            <div className="text-lg sm:text-2xl lg:text-3xl font-extrabold text-[#1D1C1A] tracking-tight">
              € 143,82
            </div>
            <div className="mt-1 sm:mt-2 text-[9px] sm:text-[11px] font-bold text-[#4c5752] truncate">
              Incl. masterclasses
            </div>
          </div>
        </div>
      </div>

      {/* 2. ACTIEVE FESTIVAL EDITIES (Kies een editie) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-[#1D1C1A] flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#006448]"></span>
              Kies een Festival Editie om te beheren:
            </h2>
            <p className="text-[11px] sm:text-xs text-[#4c5752] font-medium mt-0.5">
              Klik op een festival om direct naar de bestellingen, zaalcapaciteit en live deurcontrole van die locatie te gaan.
            </p>
          </div>
          <span className="text-[11px] sm:text-xs text-[#006448] font-extrabold bg-[#d8e7e2] px-2.5 py-1 rounded border border-[#8ba198] shrink-0">
            3 Edities Actief
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {displayedFestivals.map((fest) => {
            const festPct = ((fest.ticketsSold / fest.ticketsTotal) * 100).toFixed(0);
            return (
              <div
                key={fest.id}
                className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-4 sm:p-5 shadow-[4px_4px_0px_rgba(29,28,26,0.9)] flex flex-col justify-between"
              >
                <div>
                  {/* City Badge & Status */}
                  <div className="flex items-center justify-between mb-2.5 sm:mb-3">
                    <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-widest text-[#006448] bg-[#d8e7e2] px-2 py-0.5 rounded border border-[#8ba198]">
                      {fest.edition}
                    </span>
                    <span
                      className={`text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                        fest.status === 'live'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-400'
                          : 'bg-amber-100 text-amber-800 border-amber-400'
                      }`}
                    >
                      {fest.statusLabel}
                    </span>
                  </div>

                  <h3 className="font-extrabold text-base sm:text-lg text-[#1D1C1A] tracking-tight mb-1">
                    {fest.name}
                  </h3>

                  <div className="text-xs text-[#4c5752] space-y-1 mb-3 sm:mb-4 font-medium">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#006448] shrink-0" />
                      <span>{fest.dates}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#006448] shrink-0" />
                      <span className="truncate">{fest.location}</span>
                    </div>
                  </div>

                  {/* Financial & Ticket Line Details */}
                  <div className="bg-[#FAF7F2] border border-[#c1d4ce] rounded p-3 space-y-2 mb-3 sm:mb-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#4c5752] font-bold">Omzet:</span>
                      <span className="font-extrabold text-[#006448]">
                        € {(fest.revenueCents / 100).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#4c5752] font-bold">Tickets:</span>
                      <span className="font-extrabold text-[#1D1C1A]">
                        {fest.ticketsSold.toLocaleString('nl-NL')} / {fest.ticketsTotal.toLocaleString('nl-NL')} ({festPct}%)
                      </span>
                    </div>
                    <div className="w-full bg-[#c1d4ce] h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-[#006448] h-full rounded-full"
                        style={{ width: `${festPct}%` }}
                      ></div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] sm:text-[11px] pt-1 border-t border-[#c1d4ce]">
                      <span className="text-[#4c5752] font-semibold truncate mr-2">VIP Vrijdag:</span>
                      <span
                        className={`font-extrabold shrink-0 ${
                          fest.vipSold === fest.vipTotal ? 'text-red-700' : 'text-[#006448]'
                        }`}
                      >
                        {fest.vipStatus}
                      </span>
                    </div>
                  </div>
                </div>

                {/* City Manage Button - Navigates directly into Festival Hub Layer 2 */}
                <button
                  onClick={() => {
                    navigate(`/admin/festival/${fest.id}/orders`);
                  }}
                  className="btn-letterpress-outline w-full py-2.5 px-3 rounded text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer hover:bg-[#006448] hover:text-white transition-all shadow-[2px_2px_0px_rgba(29,28,26,0.9)]"
                >
                  <span>Open Hub: {fest.id === 'denhaag' ? 'Den Haag' : fest.id === 'amsterdam' ? 'Amsterdam' : 'Gent'}</span>
                  <ChevronRight className="w-4 h-4 text-[#006448] group-hover:text-white" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. RECENTE BESTELLINGEN (Dual View: Mobile Cards & Desktop Table) */}
      <div>
        <div className="flex items-center justify-between mb-2.5 sm:mb-3">
          <div>
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-[#1D1C1A] flex items-center gap-1.5 sm:gap-2">
              <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-[#006448]"></span>
              Recente Bestellingen
            </h2>
            <p className="text-[11px] sm:text-xs text-[#4c5752] font-medium hidden xs:block">
              Realtime Mollie transacties gekoppeld aan Supabase.
            </p>
          </div>

          <Link
            to="/admin/orders"
            className="text-xs font-extrabold text-[#006448] hover:underline flex items-center gap-1"
          >
            <span>Alle Bestellingen</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* MOBILE CARDS STREAM (Shown on mobile devices < 768px) */}
        <div className="block md:hidden space-y-3">
          {displayedOrders.map((order) => (
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

        {/* DESKTOP TABLE VIEW (Shown on md: screens >= 768px) */}
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
              {displayedOrders.map((order) => (
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
                      className="btn-letterpress-gold px-2.5 py-1 rounded text-[11px] font-extrabold"
                    >
                      [Details]
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-out Order Detail Drawer */}
      <OrderDetailDrawer order={selectedOrder} onClose={() => setSelectedOrder(null)} />
    </div>
  );
};
