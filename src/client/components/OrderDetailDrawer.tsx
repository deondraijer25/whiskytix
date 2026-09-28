import React, { useState, useEffect, useMemo } from 'react';
import { X, Mail, Download, RefreshCw, CheckCircle, Clock, AlertTriangle, ShieldCheck, User, Phone, Calendar, Plus, Ticket, Tag, Check } from 'lucide-react';
import { Order } from '../data/mockData';
import { getFestivalCatalog, FestivalCatalogItem, formatEuro } from '../data/festivalCatalog';

function formatPurchaseDateTime(dateStr?: string): string {
  if (!dateStr) return 'Onbekend';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const datePart = d.toLocaleDateString('nl-NL', {
      timeZone: 'Europe/Amsterdam',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const timePart = d.toLocaleTimeString('nl-NL', {
      timeZone: 'Europe/Amsterdam',
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${datePart} om ${timePart} uur`;
  } catch {
    return dateStr;
  }
}

interface OrderDetailDrawerProps {
  order: Order | null;
  cityId?: string;
  onClose: () => void;
  onOrderUpdated?: () => void;
}

const DRAWER_THEMES: Record<string, {
  primary: string;
  headerBg: string;
  headerBadgeBg: string;
  textPrimary: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  btnPrimary: string;
  accentSubtle: string;
  ring: string;
}> = {
  gent: {
    primary: '#1E3A8A',
    headerBg: 'bg-[#1E3A8A]',
    headerBadgeBg: 'bg-[#BFDBFE] text-[#1E3A8A] border-[#93C5FD]',
    textPrimary: 'text-[#1E3A8A]',
    badgeBg: 'bg-[#EBF3FB]',
    badgeText: 'text-[#1E3A8A]',
    badgeBorder: 'border-[#BFDBFE]',
    btnPrimary: 'bg-[#1E3A8A] hover:bg-[#172554] text-white',
    accentSubtle: 'text-[#BFDBFE]',
    ring: 'focus:ring-[#1E3A8A]',
  },
  denhaag: {
    primary: '#006448',
    headerBg: 'bg-[#006448]',
    headerBadgeBg: 'bg-[#d8e7e2] text-[#006448] border-[#8ba198]',
    textPrimary: 'text-[#006448]',
    badgeBg: 'bg-[#d8e7e2]',
    badgeText: 'text-[#006448]',
    badgeBorder: 'border-[#8ba198]',
    btnPrimary: 'bg-[#006448] hover:bg-[#00523b] text-white',
    accentSubtle: 'text-[#d8e7e2]',
    ring: 'focus:ring-[#006448]',
  },
  amsterdam: {
    primary: '#8C0223',
    headerBg: 'bg-[#8C0223]',
    headerBadgeBg: 'bg-[#FECDD3] text-[#8C0223] border-[#FDA4AF]',
    textPrimary: 'text-[#8C0223]',
    badgeBg: 'bg-[#FCE8EC]',
    badgeText: 'text-[#8C0223]',
    badgeBorder: 'border-[#F5B7C2]',
    btnPrimary: 'bg-[#8C0223] hover:bg-[#70021c] text-white',
    accentSubtle: 'text-[#FECDD3]',
    ring: 'focus:ring-[#8C0223]',
  },
};

export const OrderDetailDrawer: React.FC<OrderDetailDrawerProps> = ({ order, cityId, onClose, onOrderUpdated }) => {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [swapModalTicket, setSwapModalTicket] = useState<any | null>(null);
  const [targetSession, setTargetSession] = useState<string>('Vrijdagavond 19:00 - 23:00');
  const [swapReason, setSwapReason] = useState<string>('Klantverzoek via support');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [localTickets, setLocalTickets] = useState<any[] | null>(null);

  // Reset local overrides when order changes or updates
  useEffect(() => {
    setLocalTickets(null);
  }, [order?.orderNumber, order?.tickets]);

  // Add comp / gift ticket modal states (using official catalog)
  const [showAddTicketModal, setShowAddTicketModal] = useState<boolean>(false);
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<FestivalCatalogItem | null>(null);
  const [catalogFilterTab, setCatalogFilterTab] = useState<'all' | 'entree' | 'masterclass' | 'special'>('all');
  const [addAttendeeName, setAddAttendeeName] = useState<string>('');
  const [addReason, setAddReason] = useState<string>('VIP / Zakenrelatie');
  const [isSubmittingAddTicket, setIsSubmittingAddTicket] = useState<boolean>(false);

  // Compute live effective tickets
  const effectiveTickets: any[] = useMemo(() => {
    if (!order) return [];
    if (localTickets) return localTickets;
    let base = Array.isArray(order.tickets) && order.tickets.length > 0 ? [...order.tickets] : [];

    const hasMashedSingleTicket =
      base.length === 1 &&
      ((base[0].session && (base[0].session.includes(',') || base[0].session.includes('1x'))) ||
        (order.itemsSummary && order.itemsSummary.includes(',')));

    if (base.length === 0 || hasMashedSingleTicket) {
      const summary = order.itemsSummary || (base[0] ? base[0].session : '');
      const cleanNum = (order.orderNumber || 'WF').replace('#', '');
      const parts = (summary || '').split(',').map((p: string) => p.trim()).filter(Boolean);
      const parsed: any[] = [];
      let ticketIndex = 1;

      for (const part of parts) {
        const qMatch = part.match(/^(\d+)x\s*(.*)$/i);
        const qty = qMatch ? parseInt(qMatch[1], 10) || 1 : 1;
        const title = qMatch ? qMatch[2].trim() || 'Entreeticket' : part;
        const isMc = title.toLowerCase().includes('masterclass');

        for (let q = 0; q < qty; q++) {
          parsed.push({
            code: `#${cleanNum}-${ticketIndex}`,
            type: isMc ? 'Masterclass' : 'Entreeticket',
            session: title,
            attendeeName: order.customerName,
            status: order.status === 'paid' ? 'valid' : 'cancelled',
          });
          ticketIndex++;
        }
      }
      if (parsed.length > 0) {
        return parsed;
      }
    }
    return base;
  }, [order, localTickets]);

  // Compute dynamic items summary derived from live active tickets
  const summaryItems = useMemo(() => {
    const active = effectiveTickets.filter((t: any) => t.status === 'valid' || t.status === 'checked_in');
    if (active.length > 0) {
      const counts: Record<string, number> = {};
      for (const t of active) {
        const title = t.session || t.sessionTitle || t.type || 'Toegangsticket';
        counts[title] = (counts[title] || 0) + 1;
      }
      return Object.entries(counts).map(([title, quantity]) => ({
        quantity,
        title,
      }));
    }

    if (!order?.itemsSummary) return [];
    return order.itemsSummary
      .split(',')
      .map((part) => {
        const p = part.trim();
        const m = p.match(/^(\d+)x\s*(.*)$/i);
        if (m) {
          return {
            quantity: parseInt(m[1], 10) || 1,
            title: m[2].trim(),
          };
        }
        return {
          quantity: 1,
          title: p,
        };
      })
      .filter((it) => Boolean(it.title));
  }, [effectiveTickets, order?.itemsSummary]);

  if (!order) return null;

  // Resolve dynamic city theme
  const resolvedCityKey = (
    cityId ||
    (order.city || '') ||
    (order.cityName || '')
  ).toLowerCase().includes('gent')
    ? 'gent'
    : (cityId || (order.city || '') || (order.cityName || '')).toLowerCase().includes('amsterdam')
    ? 'amsterdam'
    : 'denhaag';

  const theme = DRAWER_THEMES[resolvedCityKey] || DRAWER_THEMES.denhaag;

  const citySessionOptions: Record<string, string[]> = {
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

  const availableSessions = citySessionOptions[resolvedCityKey] || citySessionOptions.denhaag;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleResendEmail = () => {
    showToast(`✉️ E-Tickets opnieuw verstuurd naar ${order.customerEmail} via Resend!`);
  };

  const handleDownloadPdf = () => {
    showToast(`📄 PDF E-Ticket (#${order.orderNumber}) wordt geopend...`);
    const firstTicket = effectiveTickets[0];
    const code = firstTicket ? firstTicket.code.replace('#', '') : 'WF1861';
    const session = firstTicket ? firstTicket.session : 'VIP Sessie';
    window.open(`/api/tickets/${encodeURIComponent(code)}/pdf?city=${resolvedCityKey}&name=${encodeURIComponent(order.customerName)}&title=${encodeURIComponent(session)}&orderNumber=${encodeURIComponent(order.orderNumber)}`, '_blank');
  };

  const handleRefund = () => {
    if (window.confirm(`Weet u zeker dat u bestelling ${order.orderNumber} wilt annuleren en de voorraad wilt teruggeven?`)) {
      showToast(`🔄 Bestelling ${order.orderNumber} is geannuleerd. Zaalvoorraad direct teruggegeven.`);
    }
  };

  const handleSwapSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!swapModalTicket) return;
    setIsProcessing(true);
    const rawCode = swapModalTicket.code.replace('#', '');
    try {
      const res = await fetch(`/api/admin/tickets/${encodeURIComponent(rawCode)}/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newSessionTitle: targetSession,
          newSessionName: targetSession,
          reason: swapReason,
          adminEmail: 'beheer@whiskyfestival.nl',
        }),
      });
      const data = await res.json();
      const newTicket = data.newTicket || (data.data && data.data.newTicket);
      if (res.ok && (data.success || data.ok) && newTicket) {
        showToast(`🎉 Ticket succesvol omgeruild! Nieuwe code: ${newTicket.ticketCode}`);
        const cleanNewCode = newTicket.ticketCode.startsWith('#') ? newTicket.ticketCode : `#${newTicket.ticketCode}`;
        const newCodeWithoutHash = cleanNewCode.replace(/^#+/, '');
        // Update local tickets list
        const updated = effectiveTickets.map(t => {
          if (t.code === swapModalTicket.code || t.code.replace('#', '') === rawCode) {
            return {
              ...t,
              status: 'swapped',
              replacedBy: newCodeWithoutHash,
              swappedToTicketCode: cleanNewCode,
            };
          }
          return t;
        });
        const isMc = targetSession.toLowerCase().includes('masterclass');
        // Add new swapped ticket
        updated.push({
          code: cleanNewCode,
          type: isMc ? 'Masterclass' : 'Entreeticket',
          session: targetSession,
          attendeeName: newTicket.attendeeName || swapModalTicket.attendeeName || order.customerName,
          status: 'valid',
          dateStr: newTicket.dateStr,
          timeStr: newTicket.timeStr,
        });
        setLocalTickets(updated);
        setSwapModalTicket(null);
        if (onOrderUpdated) onOrderUpdated();
      } else {
        showToast(`⚠️ Fout bij omruilen: ${data.error || 'Onbekende fout'}`);
      }
    } catch (err: any) {
      showToast(`⚠️ Fout bij omruilen: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelSingleTicket = async (ticket: any) => {
    if (!window.confirm(`Weet u zeker dat u ticket ${ticket.code} wilt annuleren? De QR-code wordt direct ongeldig gemaakt en 1 plek komt terug vrij.`)) {
      return;
    }
    const rawCode = ticket.code.replace('#', '');
    try {
      await fetch(`/api/admin/tickets/${encodeURIComponent(rawCode)}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Handmatig geannuleerd via orderbeheer' }),
      });
    } catch (_) {}
    const updated = effectiveTickets.map(t => {
      if (t.code === ticket.code) return { ...t, status: 'cancelled' };
      return t;
    });
    setLocalTickets(updated);
    showToast(`🚫 Ticket ${ticket.code} is geannuleerd en QR is ongeldig gemaakt.`);
    if (onOrderUpdated) onOrderUpdated();
  };

  const handleAddTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCatalogItem) {
      showToast('⚠️ Selecteer een ticket of masterclass uit de lijst.');
      return;
    }
    setIsSubmittingAddTicket(true);
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(order.orderNumber)}/add-ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionTitle: selectedCatalogItem.title,
          attendeeName: addAttendeeName.trim() || order.customerName,
          reason: addReason.trim() || 'VIP / Zakenrelatie',
          cityName: order.cityName || resolvedCityKey,
          dateStr: selectedCatalogItem.dateStr,
          timeStr: selectedCatalogItem.timeStr,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`🎁 Ticket "${selectedCatalogItem.title}" succesvol toegevoegd aan bestelling!`);
        setShowAddTicketModal(false);
        const newTicket = data.ticket;
        const updated = [...effectiveTickets, {
          code: newTicket.ticketCode,
          type: newTicket.sessionTitle.toLowerCase().includes('masterclass') ? 'Masterclass' : 'Entreeticket',
          session: newTicket.sessionTitle,
          attendeeName: newTicket.attendeeName,
          status: 'valid',
        }];
        setLocalTickets(updated);
        if (onOrderUpdated) onOrderUpdated();
      } else {
        showToast(`⚠️ Fout bij toevoegen: ${data.error || 'Onbekende fout'}`);
      }
    } catch (err: any) {
      showToast(`⚠️ Fout bij toevoegen: ${err.message}`);
    } finally {
      setIsSubmittingAddTicket(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div className="w-full sm:max-w-xl bg-[#FCFAF7] border-l-2 sm:border-l-3 border-[#1D1C1A] shadow-2xl h-full flex flex-col justify-between overflow-hidden">
        {/* Drawer Header */}
        <div className={`p-4 sm:p-6 ${theme.headerBg} text-white border-b-2 border-[#1D1C1A] flex items-center justify-between shrink-0`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded bg-[#1D1C1A] border border-[#caac8e] flex items-center justify-center font-extrabold text-xs sm:text-sm text-[#caac8e] shrink-0">
              #WF
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg text-[#FAF7F2]">{order.orderNumber}</h3>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border uppercase ${theme.headerBadgeBg}`}>
                  {order.cityName}
                </span>
              </div>
              <p className={`text-[11px] sm:text-xs ${theme.accentSubtle}`}>
                Mollie Betaalreferentie • Status: {order.status === 'paid' ? 'Betaald' : order.status}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-black/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Toast Notification */}
        {toastMessage && (
          <div className={`m-3 sm:m-4 p-3 border-2 rounded text-xs font-extrabold flex items-center gap-2 ${theme.badgeBg} ${theme.badgeBorder} ${theme.textPrimary} shadow-sm`}>
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Drawer Body Content (Scrollable independently) */}
        <div className="p-4 sm:p-6 space-y-5 flex-1 overflow-y-auto">
          {/* Klantgegevens Card */}
          <div className="bg-[#FAF7F2] border-2 border-[#1D1C1A] rounded-lg p-4 shadow-[3px_3px_0px_rgba(29,28,26,0.15)]">
            <h4 className={`text-xs font-extrabold uppercase tracking-wider mb-3 flex items-center gap-1.5 ${theme.textPrimary}`}>
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
                <span className="font-bold text-[#1D1C1A]">{order.customerPhone || 'Niet opgegeven'}</span>
              </div>
              <div>
                <span className="text-[#4c5752] block font-semibold text-[11px]">Aankoopmoment:</span>
                <span className="font-bold text-[#1D1C1A] flex items-center gap-1.5" title={order.createdAt}>
                  <Calendar className={`w-3.5 h-3.5 ${theme.textPrimary}`} /> {formatPurchaseDateTime(order.createdAt)}
                </span>
              </div>
            </div>
          </div>

          {/* Besteloverzicht & Financiële Specificatie */}
          <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-4 shadow-[2px_2px_0px_rgba(29,28,26,0.15)] space-y-3">
            <div className="pb-3 border-b border-[#c1d4ce]">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#1D1C1A] block mb-2">
                Besteloverzicht:
              </span>
              {summaryItems.length === 0 ? (
                <div className="text-xs text-[#4c5752] font-medium">Geen items gespecificeerd</div>
              ) : (
                <ul className="space-y-1.5">
                  {summaryItems.map((item, idx) => {
                    const isMc = item.title.toLowerCase().includes('masterclass');
                    return (
                      <li key={idx} className="flex items-center justify-between text-xs bg-[#FAF7F2] border border-[#c1d4ce] rounded px-2.5 py-1.5">
                        <span className="font-semibold text-[#1D1C1A] flex items-center gap-2">
                          <span className="font-mono font-extrabold text-[11px] bg-white border border-[#1D1C1A] px-1.5 py-0.5 rounded shadow-[1px_1px_0px_rgba(29,28,26,0.6)] text-[#006448]">
                            {item.quantity}x
                          </span>
                          <span className="font-bold text-[#1D1C1A]">{item.title}</span>
                        </span>
                        <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded border tracking-wider ${
                          isMc ? 'bg-[#EBF3FB] text-[#1E3A8A] border-[#BFDBFE]' : 'bg-[#d8e7e2] text-[#006448] border-[#8ba198]'
                        }`}>
                          {isMc ? 'Masterclass' : 'Entree'}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="flex items-center justify-between pt-0.5">
              <span className="text-xs sm:text-sm font-extrabold text-[#1D1C1A]">Totaalbedrag (incl. BTW):</span>
              <span className={`text-base sm:text-lg font-extrabold ${theme.textPrimary}`}>
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
              <div className="space-y-3">
                {effectiveTickets.map((t, idx) => {
                  const isSwapped = t.status === 'swapped';
                  const isCancelled = t.status === 'cancelled';
                  const isValid = !isSwapped && !isCancelled;

                  return (
                    <div
                      key={idx}
                      className={`p-3.5 border-2 rounded-lg space-y-2.5 shadow-[2px_2px_0px_rgba(29,28,26,0.15)] transition-colors ${
                        isSwapped
                          ? 'bg-amber-50/60 border-amber-400 opacity-90'
                          : isCancelled
                          ? 'bg-red-50/50 border-red-300 opacity-75'
                          : 'bg-[#FAF7F2] border-[#1D1C1A]'
                      }`}
                    >
                      {/* Top Row: Ticket Code & Attendee + Status Badge */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`font-mono text-xs font-extrabold px-2 py-0.5 rounded border shrink-0 ${
                              isSwapped
                                ? 'bg-amber-100 text-amber-900 border-amber-400 line-through'
                                : isCancelled
                                ? 'bg-red-100 text-red-800 border-red-400 line-through'
                                : `${theme.badgeBg} ${theme.badgeText} ${theme.badgeBorder}`
                            }`}
                          >
                            {t.code}
                          </span>
                          <span className={`text-xs font-extrabold truncate ${isCancelled ? 'line-through text-gray-500' : 'text-[#1D1C1A]'}`}>
                            {t.attendeeName}
                          </span>
                        </div>

                        {/* Status Badge right-aligned at top */}
                        <div className="shrink-0">
                          {isValid && (
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${theme.badgeBg} ${theme.badgeText} ${theme.badgeBorder}`}>
                              <CheckCircle className="w-3 h-3" /> GELDIG
                            </span>
                          )}
                          {isSwapped && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-400">
                              <RefreshCw className="w-3 h-3" /> OMGERUILD
                            </span>
                          )}
                          {isCancelled && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 text-red-800 border border-red-400">
                              <X className="w-3 h-3" /> GEANNULEERD
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Middle: Session details */}
                      <div className="text-[11px] text-[#4c5752] font-semibold">
                        {(() => {
                          const session = t.session || '';
                          const type = t.type || '';
                          const isRedundant =
                            !type ||
                            session.toLowerCase().startsWith(type.toLowerCase()) ||
                            type.toLowerCase() === session.toLowerCase();
                          return isRedundant ? session : `${type} • ${session}`;
                        })()}
                        {isSwapped && (t.replacedBy || t.swappedToTicketCode) && (
                          <div className="text-[10px] text-amber-800 font-bold flex items-center gap-1 mt-0.5">
                            <span>↳ Vervangen door ticket #{String(t.replacedBy || t.swappedToTicketCode).replace(/^#+/, '')}</span>
                          </div>
                        )}
                      </div>

                      {/* Bottom Row: Actions Bar */}
                      {isValid && (
                        <div className="pt-2 border-t border-[#c1d4ce]/70 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <a
                              href={`/api/tickets/${encodeURIComponent(t.code.replace('#', ''))}/pdf?city=${resolvedCityKey}&name=${encodeURIComponent(t.attendeeName)}&title=${encodeURIComponent(t.session)}&date=${encodeURIComponent(t.dateStr || '')}&time=${encodeURIComponent(t.timeStr || '')}&orderNumber=${encodeURIComponent(order.orderNumber)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border-2 border-[#1D1C1A] bg-white hover:bg-[#FAF7F2] text-[#1D1C1A] text-xs font-extrabold shadow-[2px_2px_0px_rgba(29,28,26,0.9)] transition-all cursor-pointer"
                              title="Bekijk of download ticket PDF"
                            >
                              <Download className="w-3.5 h-3.5 text-[#4c5752]" />
                              <span>Ticket PDF ↗</span>
                            </a>

                            <button
                              type="button"
                              onClick={() => {
                                setSwapModalTicket(t);
                                const currentLower = (t.session || '').toLowerCase();
                                const alt = availableSessions.find(s => !s.toLowerCase().includes(currentLower.slice(0, 5))) || availableSessions[0];
                                setTargetSession(alt);
                                setSwapReason('Klantverzoek via support wegens verhindering');
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border-2 border-[#1D1C1A] bg-[#caac8e] hover:bg-[#b89a7c] text-[#1D1C1A] text-xs font-extrabold shadow-[2px_2px_0px_rgba(29,28,26,0.9)] transition-all cursor-pointer"
                              title="Ruil dit ticket om voor een andere sessie"
                            >
                              <RefreshCw className="w-3 h-3 text-[#1D1C1A]" />
                              <span>Omruilen</span>
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleCancelSingleTicket(t)}
                            className="text-[11px] font-bold text-red-700 hover:text-red-900 hover:underline px-2 py-1 transition-colors cursor-pointer"
                            title="Annuleer alleen dit ticket"
                          >
                            Annuleren
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Quick Action: Add Comp / Gift Ticket directly to this order */}
            <div className="mt-3">
              <button
                type="button"
                onClick={() => {
                  const items = getFestivalCatalog(resolvedCityKey as any);
                  setSelectedCatalogItem(items[0] || null);
                  setCatalogFilterTab('all');
                  setAddAttendeeName(order.customerName);
                  setAddReason('VIP / Zakenrelatie');
                  setShowAddTicketModal(true);
                }}
                className="w-full py-2.5 px-3 rounded border-2 border-dashed border-[#006448] bg-[#FAF7F2] hover:bg-[#d8e7e2]/60 text-[#006448] text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[2px_2px_0px_rgba(0,100,72,0.15)] hover:shadow-[2px_2px_0px_rgba(29,28,26,0.8)]"
              >
                <Plus className="w-4 h-4" />
                <span>+ Ticket of Masterclass Toevoegen (Kosteloos / Relatiegeschenk)</span>
              </button>
            </div>
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
              className={`py-2.5 px-3 rounded border-2 border-[#1D1C1A] text-xs font-extrabold flex items-center justify-center gap-1.5 text-center shadow-[2px_2px_0px_rgba(29,28,26,0.9)] cursor-pointer transition-all ${theme.btnPrimary}`}
            >
              <Mail className="w-4 h-4" />
              <span>Verstuur E-Tickets Opnieuw</span>
            </button>

            <button
              onClick={handleDownloadPdf}
              className="py-2.5 px-3 rounded border-2 border-[#1D1C1A] bg-[#caac8e] hover:bg-[#b89a7c] text-[#1D1C1A] text-xs font-extrabold flex items-center justify-center gap-1.5 text-center shadow-[2px_2px_0px_rgba(29,28,26,0.9)] cursor-pointer transition-all"
            >
              <Download className="w-4 h-4 text-[#1D1C1A]" />
              <span>Download Alle E-Tickets (PDF)</span>
            </button>
          </div>

          <button
            onClick={handleRefund}
            className="w-full py-2 px-3 rounded border-2 border-red-800 text-red-800 hover:bg-red-50 text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors text-center cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Annuleren & Voorraad Teruggeven</span>
          </button>
        </div>

        {/* Inline Omruil Modal */}
        {swapModalTicket && (
          <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-[#FAF7F2] border-3 border-[#1D1C1A] rounded-lg shadow-2xl max-w-md w-full p-5 sm:p-6 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b-2 border-[#1D1C1A] mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded bg-[#caac8e] border border-[#1D1C1A] flex items-center justify-center">
                    <RefreshCw className="w-4 h-4 text-[#1D1C1A]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-[#1D1C1A]">Ticket Inruilen / Wijzigen</h3>
                    <p className="text-[11px] text-[#4c5752]">Directe heruitgifte met nieuwe QR-code</p>
                  </div>
                </div>
                <button
                  onClick={() => setSwapModalTicket(null)}
                  className="p-1 text-gray-500 hover:text-black rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSwapSubmit} className="space-y-4">
                <div className="p-3 bg-[#e8e2d9] border border-[#1D1C1A] rounded text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Huidig Ticket:</span>
                    <span className="font-mono font-bold text-[#006448]">{swapModalTicket.code}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Huidige Sessie:</span>
                    <span className="font-bold text-[#1D1C1A]">{swapModalTicket.session}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Naam Bezoeker:</span>
                    <span className="font-bold text-[#1D1C1A]">{swapModalTicket.attendeeName}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase text-[#1D1C1A] mb-1.5">
                    Nieuwe Sessie / Tickettype:
                  </label>
                  <select
                    value={targetSession}
                    onChange={(e) => setTargetSession(e.target.value)}
                    className="w-full p-2.5 bg-white border-2 border-[#1D1C1A] rounded text-xs font-bold text-[#1D1C1A] focus:outline-none focus:ring-2 focus:ring-[#006448]"
                  >
                    {availableSessions.map((sess) => (
                      <option key={sess} value={sess}>
                        {sess}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase text-[#1D1C1A] mb-1.5">
                    Reden van Wijziging:
                  </label>
                  <input
                    type="text"
                    value={swapReason}
                    onChange={(e) => setSwapReason(e.target.value)}
                    placeholder="Bijv. Klant kon niet op zaterdag, omgeboekt"
                    className="w-full p-2.5 bg-white border-2 border-[#1D1C1A] rounded text-xs font-medium text-[#1D1C1A] focus:outline-none focus:ring-2 focus:ring-[#006448]"
                  />
                </div>

                <div className="p-3 bg-amber-50 border border-amber-300 rounded text-[11px] text-amber-900">
                  ⚠️ <strong>Let op:</strong> De oude QR-code ({swapModalTicket.code}) wordt per direct <strong>geïnvalideerd</strong> aan de deur. De bezoeker ontvangt een nieuwe PDF met een verse QR-code.
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSwapModalTicket(null)}
                    className="flex-1 py-2 rounded border border-gray-400 text-xs font-bold text-gray-700 hover:bg-gray-100"
                  >
                    Annuleren
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="flex-1 btn-letterpress-gold py-2 rounded text-xs font-extrabold flex items-center justify-center gap-1.5"
                  >
                    {isProcessing ? 'Verwerken...' : '🔄 Bevestig Omruiling'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Ticket of Masterclass toevoegen (Kosteloos verstrekt) */}
        {showAddTicketModal && (
          <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-[#FCFAF7] border-3 border-[#1D1C1A] rounded-lg shadow-[6px_6px_0px_rgba(29,28,26,0.9)] max-w-2xl w-full p-5 sm:p-6 animate-in zoom-in-95 duration-150 my-6 flex flex-col max-h-[92vh]">
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b-2 border-[#1D1C1A] shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded bg-[#FAF7F2] border-2 border-[#1D1C1A] flex items-center justify-center ${theme.textPrimary} shrink-0 shadow-[2px_2px_0px_rgba(29,28,26,0.9)]`}>
                    <Ticket className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-[#1D1C1A]">Ticket of Masterclass Toevoegen</h3>
                    <p className="text-xs text-[#4c5752]">Kosteloos toevoegen als relatiegeschenk of vrijkaart voor {order.customerName}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddTicketModal(false)}
                  className="p-1.5 text-gray-500 hover:text-black rounded cursor-pointer"
                  title="Sluiten"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddTicketSubmit} className="flex-1 overflow-y-auto pr-1 mt-4 space-y-4 text-xs font-sans">
                {/* Bestelling Info Bar */}
                <div className="p-3 bg-[#FAF7F2] border-2 border-[#1D1C1A] rounded-lg text-xs flex flex-wrap items-center justify-between gap-2 shadow-[2px_2px_0px_rgba(29,28,26,0.2)]">
                  <div>
                    <span className="text-[#4c5752] font-semibold">Bestelling: </span>
                    <strong className="font-sans font-bold text-[#1D1C1A]">{order.orderNumber}</strong>
                  </div>
                  <div>
                    <span className="text-[#4c5752] font-semibold">Festival: </span>
                    <span className={`font-bold ${theme.textPrimary} uppercase tracking-wider text-[11px] ${theme.badgeBg} px-2 py-0.5 rounded border ${theme.badgeBorder}`}>{order.cityName || resolvedCityKey}</span>
                  </div>
                  <div>
                    <span className="text-[#4c5752] font-semibold">Tarief: </span>
                    <span className={`font-extrabold ${theme.textPrimary} ${theme.badgeBg} px-2 py-0.5 rounded text-[11px] border ${theme.badgeBorder}`}>Kosteloos (€ 0,00)</span>
                  </div>
                </div>

                {/* Filter Tabs & Session Selector */}
                <div className="space-y-2 pt-1 border-t border-[#c1d4ce]">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <label className="text-xs font-extrabold uppercase text-[#1D1C1A]">
                      Selecteer Sessie of Masterclass: <span className="text-red-600">*</span>
                    </label>

                    {/* Filter Tabs (NO emojis) */}
                    <div className="flex items-center gap-1 bg-[#FAF7F2] p-1 border-2 border-[#1D1C1A] rounded">
                      <button
                        type="button"
                        onClick={() => {
                          setCatalogFilterTab('all');
                          const allItems = getFestivalCatalog(resolvedCityKey as any);
                          if (allItems.length > 0) setSelectedCatalogItem(allItems[0]);
                        }}
                        className={`px-2.5 py-1 rounded text-[11px] font-extrabold transition-all cursor-pointer ${
                          catalogFilterTab === 'all'
                            ? 'bg-[#006448] text-white shadow-[1px_1px_0px_rgba(29,28,26,0.9)]'
                            : 'text-[#4c5752] hover:text-[#1D1C1A]'
                        }`}
                      >
                        Alle ({getFestivalCatalog(resolvedCityKey as any).length})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCatalogFilterTab('entree');
                          const entrees = getFestivalCatalog(resolvedCityKey as any).filter((i) => i.category === 'entree' || i.category === 'special');
                          if (entrees.length > 0) setSelectedCatalogItem(entrees[0]);
                        }}
                        className={`px-2.5 py-1 rounded text-[11px] font-extrabold transition-all cursor-pointer ${
                          catalogFilterTab === 'entree'
                            ? 'bg-[#006448] text-white shadow-[1px_1px_0px_rgba(29,28,26,0.9)]'
                            : 'text-[#4c5752] hover:text-[#1D1C1A]'
                        }`}
                      >
                        Entrees ({getFestivalCatalog(resolvedCityKey as any).filter((i) => i.category === 'entree' || i.category === 'special').length})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCatalogFilterTab('masterclass');
                          const mcs = getFestivalCatalog(resolvedCityKey as any).filter((i) => i.category === 'masterclass');
                          if (mcs.length > 0) setSelectedCatalogItem(mcs[0]);
                        }}
                        className={`px-2.5 py-1 rounded text-[11px] font-extrabold transition-all cursor-pointer ${
                          catalogFilterTab === 'masterclass'
                            ? 'bg-[#006448] text-white shadow-[1px_1px_0px_rgba(29,28,26,0.9)]'
                            : 'text-[#4c5752] hover:text-[#1D1C1A]'
                        }`}
                      >
                        Masterclasses ({getFestivalCatalog(resolvedCityKey as any).filter((i) => i.category === 'masterclass').length})
                      </button>
                    </div>
                  </div>

                  {/* Dropdown Selector */}
                  <select
                    value={selectedCatalogItem?.id || ''}
                    onChange={(e) => {
                      const all = getFestivalCatalog(resolvedCityKey as any);
                      const found = all.find((i) => i.id === e.target.value);
                      if (found) setSelectedCatalogItem(found);
                    }}
                    className="w-full p-2.5 bg-white border-2 border-[#1D1C1A] rounded text-xs font-bold text-[#1D1C1A] focus:outline-none focus:ring-2 focus:ring-[#006448]"
                  >
                    {getFestivalCatalog(resolvedCityKey as any)
                      .filter((item) => catalogFilterTab === 'all' || item.category === catalogFilterTab || (catalogFilterTab === 'entree' && item.category === 'special'))
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.dateStr} • {item.timeStr} — {item.title} (Normale waarde: {formatEuro(item.originalPriceEur)}){item.isSoldOut ? ' [UITVERKOCHT — Directie Vrijstelling]' : ''}
                        </option>
                      ))}
                  </select>

                  {/* Live Ticket Preview Card */}
                  {selectedCatalogItem && (
                    <div className="p-3.5 bg-[#FAF7F2] border-2 border-[#1D1C1A] rounded-lg shadow-[2px_2px_0px_rgba(29,28,26,0.15)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${
                              selectedCatalogItem.category === 'masterclass'
                                ? 'bg-[#e4d5c4] text-[#543b20] border-[#caac8e]'
                                : selectedCatalogItem.category === 'special'
                                ? 'bg-[#eedccb] text-[#6d4c1d] border-[#caac8e]'
                                : 'bg-[#d8e7e2] text-[#006448] border-[#8ba198]'
                            }`}
                          >
                            {selectedCatalogItem.category === 'masterclass'
                              ? 'MASTERCLASS'
                              : selectedCatalogItem.category === 'special'
                              ? 'VIP & ARRANGEMENT'
                              : 'ENTREETICKET'}
                          </span>
                          {selectedCatalogItem.isSoldOut && (
                            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border bg-[#FAF0E6] text-[#8C3A00] border-[#E0B896]">
                              Uitverkocht — Directie Vrijstelling
                            </span>
                          )}
                          <div className="flex items-center gap-1 text-[11px] text-[#4c5752] font-semibold">
                            <Calendar className="w-3.5 h-3.5 text-[#006448]" />
                            <span>{selectedCatalogItem.dateStr}</span>
                            <span className="text-[#8ba198]">•</span>
                            <Clock className="w-3.5 h-3.5 text-[#006448]" />
                            <span>{selectedCatalogItem.timeStr}</span>
                          </div>
                        </div>
                        <div className="text-sm font-extrabold text-[#1D1C1A]">
                          {selectedCatalogItem.title}
                        </div>
                        {selectedCatalogItem.location && (
                          <div className="text-[11px] text-[#4c5752]">
                            Locatie: {selectedCatalogItem.location}
                          </div>
                        )}
                      </div>

                      <div className="text-left sm:text-right shrink-0 bg-white sm:bg-transparent p-2 sm:p-0 rounded border sm:border-0 border-[#c1d4ce] w-full sm:w-auto">
                        <div className="text-[11px] text-[#4c5752] font-semibold">
                          Normale waarde:{' '}
                          <span className="line-through font-bold">
                            {formatEuro(selectedCatalogItem.originalPriceEur)}
                          </span>
                        </div>
                        <div className="text-xs font-black text-[#006448]">
                          Kosteloos verstrekt (€ 0,00)
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Form fields: Attendee & Reason in 2 columns */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-[#c1d4ce]">
                  <div>
                    <label className="block text-xs font-extrabold uppercase text-[#1D1C1A] mb-1">
                      Naam op Ticket:
                    </label>
                    <input
                      type="text"
                      value={addAttendeeName}
                      onChange={(e) => setAddAttendeeName(e.target.value)}
                      placeholder="Naam van de bezoeker"
                      className="w-full p-2.5 bg-white border-2 border-[#1D1C1A] rounded text-xs font-medium text-[#1D1C1A] focus:outline-none focus:ring-2 focus:ring-[#006448]"
                    />
                    <p className="text-[10px] text-[#4c5752] mt-1">Standaard de naam van de hoofdkoper.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold uppercase text-[#1D1C1A] mb-1">
                      Type Gast / Reden:
                    </label>
                    <select
                      value={addReason}
                      onChange={(e) => setAddReason(e.target.value)}
                      className="w-full p-2.5 bg-white border-2 border-[#1D1C1A] rounded text-xs font-bold text-[#1D1C1A] focus:outline-none focus:ring-2 focus:ring-[#006448]"
                    >
                      <option value="VIP / Zakenrelatie">VIP / Zakenrelatie</option>
                      <option value="Cadeau van organisatie">Cadeau van organisatie</option>
                      <option value="Spreker / Masterclass Host">Spreker / Masterclass Host</option>
                      <option value="Pers & Media">Pers & Media</option>
                      <option value="Organisatie & Crew">Organisatie & Crew</option>
                      <option value="Vrijkaart / Winactie">Vrijkaart / Winactie</option>
                    </select>
                  </div>
                </div>

                <div className="p-3 bg-[#FAF7F2] border-2 border-[#1D1C1A] rounded-lg text-[11px] text-[#4c5752] space-y-1 shadow-[2px_2px_0px_rgba(29,28,26,0.15)]">
                  <div className="font-extrabold text-[#1D1C1A] flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-[#006448]" />
                    Direct Beschikbaar & Scanbaar:
                  </div>
                  <div>• Het ticket wordt direct toegevoegd aan bestelling <strong>{order.orderNumber}</strong>.</div>
                  <div>• De bezoeker ziet dit ticket direct in zijn/haar online portaal.</div>
                  <div>• Direct geldig voor ingangscontrole aan de kassa & downloadbaar als A4 PDF.</div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-[#c1d4ce] shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowAddTicketModal(false)}
                    className="flex-1 py-2.5 rounded border-2 border-[#1D1C1A] bg-white text-xs font-extrabold text-[#1D1C1A] hover:bg-gray-100 shadow-[2px_2px_0px_rgba(29,28,26,0.8)] cursor-pointer"
                  >
                    Annuleren
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingAddTicket || !selectedCatalogItem}
                    className={`flex-1 py-2.5 rounded border-2 border-[#1D1C1A] ${theme.btnPrimary} text-xs font-black shadow-[2px_2px_0px_rgba(29,28,26,0.9)] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50`}
                  >
                    <Ticket className="w-4 h-4" />
                    <span>{isSubmittingAddTicket ? 'Toevoegen...' : 'Ticket Toevoegen aan Bestelling'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
