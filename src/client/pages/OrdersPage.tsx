import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Search, ShoppingBag, CheckCircle2, Clock, X, ChevronRight, Download, Mail } from 'lucide-react';
import { INITIAL_ORDERS, INITIAL_FESTIVALS, Order } from '../data/mockData';
import { OrderDetailDrawer } from '../components/OrderDetailDrawer';

export const OrdersPage: React.FC = () => {
  const { cityId } = useParams<{ cityId?: string }>();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState(cityId || 'all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [liveOrders, setLiveOrders] = useState<Order[]>([]);

  const activeFestival = cityId ? INITIAL_FESTIVALS.find((f) => f.id === cityId) : null;
  const effectiveCity = cityId || selectedCity;

  useEffect(() => {
    const fetchLiveOrders = async () => {
      try {
        const res = await fetch('/api/admin/orders');
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.orders)) {
            setLiveOrders(data.orders);
          }
        }
      } catch (err) {
        console.error('Failed to fetch live orders:', err);
      }
    };
    fetchLiveOrders();
    const interval = setInterval(fetchLiveOrders, 8000);
    return () => clearInterval(interval);
  }, []);

  // Merge live orders with initial mock orders (avoiding duplicates by orderNumber)
  const allOrdersMap = new Map<string, Order>();
  liveOrders.forEach((o) => allOrdersMap.set(o.orderNumber, o));
  INITIAL_ORDERS.forEach((o) => {
    if (!allOrdersMap.has(o.orderNumber)) {
      allOrdersMap.set(o.orderNumber, o);
    }
  });

  const combinedOrders = Array.from(allOrdersMap.values());

  const filteredOrders = combinedOrders.filter((o) => {
    const matchesSearch =
      o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customerEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.customerPhone && o.customerPhone.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCity = effectiveCity === 'all' || o.city === effectiveCity;
    const matchesStatus = selectedStatus === 'all' || o.status === selectedStatus;

    return matchesSearch && matchesCity && matchesStatus;
  });

  const totalRevenue = filteredOrders
    .filter((o) => o.status === 'paid')
    .reduce((acc, o) => acc + o.totalCents, 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Title & Stats */}
      <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-4 sm:p-6 shadow-[4px_4px_0px_rgba(29,28,26,0.9)] sm:shadow-[5px_5px_0px_rgba(29,28,26,0.9)] flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-widest text-[#006448] bg-[#d8e7e2] px-2 py-0.5 rounded border border-[#8ba198]">
              {activeFestival ? `${activeFestival.edition} • Klantenbeheer` : 'Klanten & Bestellingen'}
            </span>
          </div>
          <h1 className="text-xl sm:text-3xl font-extrabold text-[#1D1C1A] tracking-tight">
            {activeFestival ? `Bestellingen ${activeFestival.name}` : 'Bestellingen Beheer'}
          </h1>
          <p className="text-xs sm:text-sm text-[#4c5752] mt-0.5 font-medium">
            Zoek direct op klantnaam, e-mail of #WF-nummer om klantvragen direct op te lossen.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-bold text-[#4c5752]">
          <span className="bg-[#FAF7F2] border border-[#c1d4ce] px-3 py-1.5 rounded shadow-xs">
            Aantal: <strong className="text-[#006448]">{filteredOrders.length}</strong> orders
          </span>
          <span className="bg-[#d8e7e2] border border-[#8ba198] px-3 py-1.5 rounded text-[#006448] shadow-xs">
            Omzet: <strong>€ {(totalRevenue / 100).toLocaleString('nl-NL', { minimumFractionDigits: 0 })}</strong>
          </span>
        </div>
      </div>

      {/* Search & Filter Bar (Mobile stacked, desktop row) */}
      <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-3 sm:p-4 shadow-[3px_3px_0px_rgba(29,28,26,0.9)] space-y-2.5 sm:space-y-0 sm:flex sm:gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#006448] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Typ naam, e-mail of #WF code..."
            className="w-full pl-9 pr-8 py-2 bg-white border-2 border-[#1D1C1A] rounded text-base sm:text-xs text-[#1D1C1A] font-semibold focus:outline-none focus:ring-2 focus:ring-[#006448]"
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
          {/* City Filter (only shown if not already scoped to a festival) */}
          {!cityId && (
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="bg-white border-2 border-[#1D1C1A] rounded px-3 py-2 text-xs font-bold text-[#1D1C1A] focus:outline-none"
            >
              <option value="all">Alle Steden</option>
              <option value="denhaag">Den Haag</option>
              <option value="amsterdam">Amsterdam</option>
              <option value="gent">Gent</option>
            </select>
          )}

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-white border-2 border-[#1D1C1A] rounded px-3 py-2 text-xs font-bold text-[#1D1C1A] focus:outline-none"
          >
            <option value="all">Alle Statussen</option>
            <option value="paid">Betaald</option>
            <option value="pending">In afwachting</option>
            <option value="refunded">Geannuleerd</option>
          </select>
        </div>
      </div>

      {/* MOBILE ORDER CARDS STREAM (< 768px) */}
      <div className="block md:hidden space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-6 text-center text-[#4c5752] font-bold text-xs">
            Geen bestellingen gevonden met deze zoektermen.
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
                <h3 className="font-extrabold text-sm text-[#1D1C1A]">{order.customerName}</h3>
                <span className="text-[11px] text-[#4c5752] block">{order.customerEmail}</span>
                <p className="text-xs text-[#1D1C1A] font-medium mt-1">{order.itemsSummary}</p>
              </div>

              <div className="pt-2 border-t border-[#c1d4ce] flex items-center justify-between">
                <div>
                  <span className="text-sm font-extrabold text-[#1D1C1A] block">
                    € {(order.totalCents / 100).toFixed(2).replace('.', ',')}
                  </span>
                  <span className="text-[10px] text-[#4c5752] font-semibold">{order.createdAt}</span>
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

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedOrder(order);
                    }}
                    className="btn-letterpress-gold px-2.5 py-1 rounded text-xs font-extrabold flex items-center gap-1"
                  >
                    <span>Details</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* DESKTOP ORDERS TABLE (>= 768px) */}
      <div className="hidden md:block bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg shadow-[4px_4px_0px_rgba(29,28,26,0.9)] overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[#FAF7F2] border-b-2 border-[#1D1C1A] text-[#4c5752] font-extrabold uppercase tracking-wider">
              <th className="py-3 px-4">Order #</th>
              <th className="py-3 px-4">Klantnaam & E-mail</th>
              <th className="py-3 px-4">Stad</th>
              <th className="py-3 px-4">Bestelde Items</th>
              <th className="py-3 px-4">Bedrag</th>
              <th className="py-3 px-4">Datum</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actie</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#c1d4ce]">
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-[#4c5752] font-bold">
                  Geen bestellingen gevonden met deze zoektermen.
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => (
                <tr
                  key={order.id}
                  className="hover:bg-[#FAF7F2] transition-colors cursor-pointer"
                  onClick={() => setSelectedOrder(order)}
                >
                  <td className="py-3 px-4 font-mono font-extrabold text-[#006448]">
                    {order.orderNumber}
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-extrabold text-[#1D1C1A] block">{order.customerName}</span>
                    <span className="text-[11px] text-[#4c5752]">{order.customerEmail}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="bg-[#d8e7e2] text-[#006448] px-2 py-0.5 rounded font-bold text-[11px] border border-[#8ba198]">
                      {order.cityName}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-medium text-[#1D1C1A] max-w-xs truncate">
                    {order.itemsSummary}
                  </td>
                  <td className="py-3 px-4 font-extrabold text-[#1D1C1A]">
                    € {(order.totalCents / 100).toFixed(2).replace('.', ',')}
                  </td>
                  <td className="py-3 px-4 text-[#4c5752] font-semibold">{order.createdAt}</td>
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
                      className="btn-letterpress-gold px-2.5 py-1 rounded text-[11px] font-extrabold cursor-pointer"
                    >
                      [Details]
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Slide-out Order Detail Drawer */}
      <OrderDetailDrawer order={selectedOrder} onClose={() => setSelectedOrder(null)} />
    </div>
  );
};
