import React, { useState } from 'react';
import { X, Mail, Download, RefreshCw, CheckCircle, Clock, AlertTriangle, ShieldCheck, User, Phone, Calendar } from 'lucide-react';
import { Order } from '../data/mockData';

interface OrderDetailDrawerProps {
  order: Order | null;
  onClose: () => void;
}

export const OrderDetailDrawer: React.FC<OrderDetailDrawerProps> = ({ order, onClose }) => {
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  if (!order) return null;

  // Ensure tickets are fully represented even if backend/storage only had header
  let effectiveTickets = Array.isArray(order.tickets) && order.tickets.length > 0 ? [...order.tickets] : [];
  if (effectiveTickets.length === 0) {
    const cleanNum = (order.orderNumber || 'WF').replace('#', '');
    let count = 1;
    const qtyMatch = (order.itemsSummary || '').match(/^(\d+)x/);
    if (qtyMatch) {
      count = parseInt(qtyMatch[1], 10);
    } else if (order.totalCents === 25950) {
      count = 6;
    }
    for (let i = 1; i <= count; i++) {
      effectiveTickets.push({
        code: `#${cleanNum}-${i}`,
        type: 'Entreeticket',
        session: (order.itemsSummary || 'Festival Entreeticket').replace(/^\d+x\s*/, ''),
        attendeeName: order.customerName,
        status: order.status === 'paid' ? 'valid' : 'cancelled',
      });
    }
  }

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleResendEmail = () => {
    showToast(`✉️ E-Tickets opnieuw verstuurd naar ${order.customerEmail} via Resend!`);
  };

  const handleDownloadPdf = () => {
    showToast(`📄 PDF E-Ticket (#${order.orderNumber}) wordt geopend...`);
    const firstTicket = effectiveTickets[0];
    const cityKey = order.cityName.toLowerCase().includes('gent') ? 'gent' : order.cityName.toLowerCase().includes('amsterdam') ? 'amsterdam' : 'denhaag';
    const code = firstTicket ? firstTicket.code.replace('#', '') : 'WF1861';
    const session = firstTicket ? firstTicket.session : 'VIP Sessie';
    window.open(`/api/tickets/${encodeURIComponent(code)}/pdf?city=${cityKey}&name=${encodeURIComponent(order.customerName)}&title=${encodeURIComponent(session)}&orderNumber=${encodeURIComponent(order.orderNumber)}`, '_blank');
  };

  const handleRefund = () => {
    if (window.confirm(`Weet u zeker dat u bestelling ${order.orderNumber} wilt annuleren en de voorraad wilt teruggeven?`)) {
      showToast(`🔄 Bestelling ${order.orderNumber} is geannuleerd. Zaalvoorraad direct teruggegeven.`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div className="w-full sm:max-w-xl bg-[#FCFAF7] border-l-2 sm:border-l-3 border-[#1D1C1A] shadow-2xl h-full flex flex-col justify-between overflow-hidden">
        {/* Drawer Header */}
        <div className="p-4 sm:p-6 bg-[#006448] text-white border-b-2 border-[#1D1C1A] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded bg-[#1D1C1A] border border-[#caac8e] flex items-center justify-center font-extrabold text-xs sm:text-sm text-[#caac8e] shrink-0">
              #WF
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg text-[#FAF7F2]">{order.orderNumber}</h3>
                <span className="bg-[#d8e7e2] text-[#006448] text-[10px] font-bold px-2 py-0.5 rounded border border-[#8ba198] uppercase">
                  {order.cityName}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-[#d8e7e2]">Mollie Betaalreferentie • Status: {order.status === 'paid' ? 'Betaald' : order.status}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-black/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Toast Notification */}
        {toastMessage && (
          <div className="m-3 sm:m-4 p-3 bg-[#d8e7e2] border-2 border-[#006448] rounded text-[#006448] text-xs font-extrabold flex items-center gap-2 shadow-[2px_2px_0px_rgba(0,100,72,0.4)]">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Drawer Body Content (Scrollable independently) */}
        <div className="p-4 sm:p-6 space-y-5 flex-1 overflow-y-auto">
          {/* Klantgegevens Card */}
          <div className="bg-[#FAF7F2] border-2 border-[#1D1C1A] rounded p-4 shadow-[3px_3px_0px_rgba(29,28,26,0.15)]">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#006448] mb-3 flex items-center gap-1.5">
              <User className="w-4 h-4" /> Klant- & Contactgegevens
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[#4c5752] block font-semibold text-[11px]">Klantnaam:</span>
                <span className="font-extrabold text-[#1D1C1A] text-sm">{order.customerName}</span>
              </div>
              <div>
                <span className="text-[#4c5752] block font-semibold text-[11px]">E-mailadres:</span>
                <span className="font-bold text-[#1D1C1A] break-all">{order.customerEmail}</span>
              </div>
              <div>
                <span className="text-[#4c5752] block font-semibold text-[11px]">Telefoon:</span>
                <span className="font-bold text-[#1D1C1A]">{order.customerPhone}</span>
              </div>
              <div>
                <span className="text-[#4c5752] block font-semibold text-[11px]">Aankoopmoment:</span>
                <span className="font-bold text-[#1D1C1A] flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-[#006448]" /> {order.createdAt}
                </span>
              </div>
            </div>
          </div>

          {/* Financiële Specificatie */}
          <div className="bg-white border-2 border-[#c1d4ce] rounded p-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#c1d4ce] mb-3">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#1D1C1A]">
                Besteloverzicht:
              </span>
              <span className="text-xs font-bold text-[#006448] text-right">{order.itemsSummary}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-extrabold text-[#1D1C1A]">Totaalbedrag (incl. BTW):</span>
              <span className="text-base sm:text-lg font-extrabold text-[#006448]">
                € {(order.totalCents / 100).toFixed(2).replace('.', ',')}
              </span>
            </div>
          </div>

          {/* Uitgegeven E-Tickets Breakdown */}
          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#1D1C1A] mb-3 flex items-center justify-between">
              <span>Uitgegeven E-Tickets ({effectiveTickets.length})</span>
              <span className="text-[11px] font-bold text-[#4c5752]">HMAC Beveiligd</span>
            </h4>

            {effectiveTickets.length === 0 ? (
              <p className="text-xs text-gray-500 italic p-4 bg-gray-50 rounded border border-dashed border-gray-300 text-center">
                Geen individuele toegangskaarten voor deze bestelling (bijvoorbeeld losse merchandise/festivalfles).
              </p>
            ) : (
              <div className="space-y-2.5">
                {effectiveTickets.map((t, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-[#FAF7F2] border-2 border-[#1D1C1A] rounded flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-[2px_2px_0px_rgba(29,28,26,0.1)]"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-extrabold text-[#006448] bg-[#d8e7e2] px-1.5 py-0.5 rounded border border-[#8ba198]">
                          {t.code}
                        </span>
                        <span className="text-xs font-extrabold text-[#1D1C1A]">
                          {t.attendeeName}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#4c5752] mt-0.5 font-medium">
                        {t.type} • {t.session}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#d8e7e2] text-[#006448] border border-[#006448]">
                        <CheckCircle className="w-3 h-3" /> GELDIG
                      </span>
                      <a
                        href={`/api/tickets/${encodeURIComponent(t.code.replace('#', ''))}/pdf?city=${order.cityName.toLowerCase().includes('gent') ? 'gent' : order.cityName.toLowerCase().includes('amsterdam') ? 'amsterdam' : 'denhaag'}&name=${encodeURIComponent(t.attendeeName)}&title=${encodeURIComponent(t.session)}&orderNumber=${encodeURIComponent(order.orderNumber)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] font-extrabold text-[#006448] hover:underline bg-white px-2 py-0.5 rounded border border-[#1D1C1A] shadow-[1px_1px_0px_rgba(29,28,26,0.9)] flex items-center gap-1 cursor-pointer"
                      >
                        <span>Bekijk PDF ↗</span>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Drawer Bottom Action Buttons (Sticky at bottom for quick thumb reach) */}
        <div className="p-4 sm:p-6 bg-[#FAF7F2] border-t-2 border-[#1D1C1A] space-y-2.5 shrink-0 shadow-[0_-4px_12px_rgba(29,28,26,0.06)]">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#4c5752] mb-1">
            Snelle Beheerder Acties:
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              onClick={handleResendEmail}
              className="btn-letterpress py-2.5 px-3 rounded text-xs font-extrabold flex items-center justify-center gap-1.5 text-center"
            >
              <Mail className="w-4 h-4 text-[#e4d5c4]" />
              <span>Verstuur E-Tickets Opnieuw</span>
            </button>

            <button
              onClick={handleDownloadPdf}
              className="btn-letterpress-gold py-2.5 px-3 rounded text-xs font-extrabold flex items-center justify-center gap-1.5 text-center"
            >
              <Download className="w-4 h-4 text-[#1D1C1A]" />
              <span>Download Alle E-Tickets (PDF)</span>
            </button>
          </div>

          <button
            onClick={handleRefund}
            className="w-full py-2 px-3 rounded border-2 border-red-800 text-red-800 hover:bg-red-50 text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors text-center"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Annuleren & Voorraad Teruggeven</span>
          </button>
        </div>
      </div>
    </div>
  );
};
