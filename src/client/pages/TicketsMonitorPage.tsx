import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  QrCode,
  Search,
  CheckCircle2,
  AlertOctagon,
  RefreshCw,
  FileText,
  Eye,
  X,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Layers,
  ArrowLeftRight
} from 'lucide-react';
import { INITIAL_FESTIVALS } from '../data/mockData';

interface MonitorTicket {
  id: string;
  orderId: string;
  orderNumber: string;
  ticketCode: string;
  qrPayload?: string;
  qrPayloadHash: string;
  attendeeName: string;
  customerEmail: string;
  customerPhone?: string;
  status: 'valid' | 'checked_in' | 'cancelled' | 'swapped';
  sessionTitle: string;
  cityName: string;
  festivalId?: string;
  dateStr?: string;
  timeStr?: string;
  pdfUrl: string;
  checkedInAt?: string | null;
  swapReason?: string;
  swappedAt?: string;
  createdAt: string;
}

export const TicketsMonitorPage: React.FC = () => {
  const { cityId } = useParams<{ cityId?: string }>();
  const [tickets, setTickets] = useState<MonitorTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedCity, setSelectedCity] = useState(cityId || 'all');

  // Modals
  const [swapModalTicket, setSwapModalTicket] = useState<MonitorTicket | null>(null);
  const [newSessionTitle, setNewSessionTitle] = useState('VIP SESSIE — VRIJDAG');
  const [swapReason, setSwapReason] = useState('Telefonisch verzoek klant wegens verhindering');
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapSuccessMessage, setSwapSuccessMessage] = useState<string | null>(null);

  const [inspectQrTicket, setInspectQrTicket] = useState<MonitorTicket | null>(null);

  const activeFestival = cityId ? INITIAL_FESTIVALS.find((f) => f.id === cityId) : null;
  const effectiveCity = cityId || selectedCity;

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/tickets');
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.tickets)) {
          setTickets(data.tickets);
        }
      }
    } catch (err) {
      console.error('Kon tickets niet ophalen:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
    const interval = setInterval(fetchTickets, 10000);
    return () => clearInterval(interval);
  }, []);

  // Filter tickets
  const filteredTickets = tickets.filter((t) => {
    const matchesCity = effectiveCity === 'all' || t.cityName === effectiveCity || t.festivalId === effectiveCity;
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      t.ticketCode.toLowerCase().includes(q) ||
      t.attendeeName.toLowerCase().includes(q) ||
      (t.customerEmail && t.customerEmail.toLowerCase().includes(q)) ||
      t.orderNumber.toLowerCase().includes(q) ||
      t.sessionTitle.toLowerCase().includes(q);

    return matchesCity && matchesStatus && matchesSearch;
  });

  // KPI calculations
  const totalCount = tickets.length;
  const validCount = tickets.filter((t) => t.status === 'valid').length;
  const checkedInCount = tickets.filter((t) => t.status === 'checked_in').length;
  const swappedCount = tickets.filter((t) => t.status === 'swapped' || t.status === 'cancelled').length;

  const handleExecuteSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!swapModalTicket) return;

    try {
      setIsSwapping(true);
      const cleanCode = swapModalTicket.ticketCode.replace('#', '');
      const res = await fetch(`/api/admin/tickets/${encodeURIComponent(cleanCode)}/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newSessionTitle,
          reason: swapReason,
          adminEmail: 'beheer@whiskyfestival.nl',
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSwapSuccessMessage(data.message || 'Ticket succesvol omgeruild!');
        setTimeout(() => {
          setSwapModalTicket(null);
          setSwapSuccessMessage(null);
          fetchTickets();
        }, 1800);
      } else {
        alert('Fout bij omruilen: ' + (data.error || 'Onbekende fout'));
      }
    } catch (err: any) {
      alert('Netwerkfout: ' + err.message);
    } finally {
      setIsSwapping(false);
    }
  };

  const handleCancelTicket = async (ticketCode: string) => {
    if (!window.confirm(`Weet je zeker dat je ticket ${ticketCode} wilt annuleren? De QR-code wordt direct ongeldig gemaakt.`)) {
      return;
    }

    try {
      const cleanCode = ticketCode.replace('#', '');
      const res = await fetch(`/api/admin/tickets/${encodeURIComponent(cleanCode)}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Handmatig geannuleerd door beheerder' }),
      });
      if (res.ok) {
        fetchTickets();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-6 shadow-[5px_5px_0px_rgba(29,28,26,0.9)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-extrabold uppercase tracking-widest text-[#006448] bg-[#d8e7e2] px-2 py-0.5 rounded border border-[#8ba198]">
              {activeFestival ? `${activeFestival.name} • Barcode Engine` : 'Centrale Barcode & PDF Monitor'}
            </span>
            <span className="text-xs text-[#4c5752] font-semibold">• HMAC-SHA256 Beveiligd</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1D1C1A] tracking-tight">
            Ticket & QR-Code Generator Monitor
          </h1>
          <p className="text-xs sm:text-sm text-[#4c5752] mt-0.5 font-medium">
            Realtime overzicht van alle geminte e-tickets, cryptografische handtekeningen, PDF downloads en omruilingen.
          </p>
        </div>

        <button
          onClick={fetchTickets}
          className="flex items-center gap-2 bg-[#FAF7F2] hover:bg-[#EAE5DC] text-[#1D1C1A] px-3.5 py-2 rounded border-2 border-[#1D1C1A] text-xs font-bold transition shadow-[2px_2px_0px_rgba(29,28,26,0.8)]"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Verversen
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded p-4 shadow-[3px_3px_0px_rgba(29,28,26,0.9)]">
          <div className="flex items-center justify-between text-[#4c5752] mb-1">
            <span className="text-xs font-extrabold uppercase tracking-wider">Totaal Gemint</span>
            <QrCode className="w-4 h-4 text-[#006448]" />
          </div>
          <div className="text-2xl font-extrabold text-[#1D1C1A]">{totalCount}</div>
          <p className="text-[11px] text-[#7A7268] mt-0.5">Officiële e-tickets gegenereerd</p>
        </div>

        <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded p-4 shadow-[3px_3px_0px_rgba(29,28,26,0.9)]">
          <div className="flex items-center justify-between text-[#4c5752] mb-1">
            <span className="text-xs font-extrabold uppercase tracking-wider">Actief Geldig</span>
            <ShieldCheck className="w-4 h-4 text-[#006448]" />
          </div>
          <div className="text-2xl font-extrabold text-[#006448]">{validCount}</div>
          <p className="text-[11px] text-[#7A7268] mt-0.5">Klaar voor de scanner</p>
        </div>

        <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded p-4 shadow-[3px_3px_0px_rgba(29,28,26,0.9)]">
          <div className="flex items-center justify-between text-[#4c5752] mb-1">
            <span className="text-xs font-extrabold uppercase tracking-wider">Ingecheckt</span>
            <CheckCircle2 className="w-4 h-4 text-[#1E3A8A]" />
          </div>
          <div className="text-2xl font-extrabold text-[#1E3A8A]">{checkedInCount}</div>
          <p className="text-[11px] text-[#7A7268] mt-0.5">Reeds door de deur</p>
        </div>

        <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded p-4 shadow-[3px_3px_0px_rgba(29,28,26,0.9)]">
          <div className="flex items-center justify-between text-[#4c5752] mb-1">
            <span className="text-xs font-extrabold uppercase tracking-wider">Omgeruild / Verval</span>
            <ArrowLeftRight className="w-4 h-4 text-[#8C0223]" />
          </div>
          <div className="text-2xl font-extrabold text-[#8C0223]">{swappedCount}</div>
          <p className="text-[11px] text-[#7A7268] mt-0.5">Oude barcodes geneutraliseerd</p>
        </div>
      </div>

      {/* Zoek- & Filterbalk */}
      <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded p-4 shadow-[3px_3px_0px_rgba(29,28,26,0.9)] flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#7A7268]" />
          <input
            type="text"
            placeholder="Zoek op #WF-code, koper, sessie..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#FAF7F2] border border-[#DED6C9] rounded pl-9 pr-3 py-1.5 text-xs font-semibold text-[#1D1C1A] focus:outline-none focus:border-[#1D1C1A]"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          {['all', 'valid', 'checked_in', 'swapped', 'cancelled'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1 rounded text-xs font-bold transition border ${
                statusFilter === status
                  ? 'bg-[#1D1C1A] text-white border-[#1D1C1A]'
                  : 'bg-[#FAF7F2] text-[#4C5752] border-[#DED6C9] hover:border-[#1D1C1A]'
              }`}
            >
              {status === 'all'
                ? 'Alle'
                : status === 'valid'
                ? 'Geldig'
                : status === 'checked_in'
                ? 'Ingecheckt'
                : status === 'swapped'
                ? 'Omgeruild'
                : 'Geannuleerd'}
            </button>
          ))}
        </div>
      </div>

      {/* Tickets Tabel */}
      <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg shadow-[4px_4px_0px_rgba(29,28,26,0.9)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#FAF7F2] border-b-2 border-[#1D1C1A] text-[#7A7268] uppercase tracking-wider font-extrabold">
                <th className="py-3 px-4">Ticketcode</th>
                <th className="py-3 px-4">Kaarthouder</th>
                <th className="py-3 px-4">Sessie / Type</th>
                <th className="py-3 px-4">HMAC Handtekening</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Acties</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAE5DC]">
              {filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#7A7268] font-semibold">
                    Geen tickets gevonden binnen deze filters.
                  </td>
                </tr>
              ) : (
                filteredTickets.map((ticket) => {
                  const cleanCode = ticket.ticketCode.replace('#', '');
                  const pdfDownloadUrl = `/api/tickets/${encodeURIComponent(cleanCode)}/pdf?city=${ticket.cityName || 'denhaag'}&name=${encodeURIComponent(ticket.attendeeName)}&title=${encodeURIComponent(ticket.sessionTitle)}`;

                  return (
                    <tr key={ticket.ticketCode} className="hover:bg-[#FAF7F2] transition">
                      <td className="py-3 px-4 font-mono font-bold text-[#1E3A8A]">
                        {ticket.ticketCode}
                        {ticket.swappedToTicketId && (
                          <div className="text-[10px] text-[#8C0223] font-sans font-extrabold mt-0.5">
                            ↳ Omgeruild
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-[#1D1C1A]">{ticket.attendeeName}</div>
                        <div className="text-[10px] text-[#7A7268]">{ticket.customerEmail}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-[#1D1C1A]">{ticket.sessionTitle}</div>
                        <div className="text-[10px] text-[#7A7268]">
                          {ticket.dateStr || 'Festivaldag'} &bull; {ticket.cityName.toUpperCase()}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <div className="inline-flex items-center gap-1.5 bg-[#FAF7F2] px-2 py-0.5 rounded border border-[#DED6C9]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#006448]"></span>
                          <span className="text-[10px] font-bold text-[#4C5752]">
                            {ticket.qrPayloadHash ? ticket.qrPayloadHash.substring(0, 10) : 'HMAC-OK'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {ticket.status === 'valid' && (
                          <span className="inline-flex items-center gap-1 bg-[#E6F4EA] text-[#006448] px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border border-[#A8DAB5]">
                            Geldig
                          </span>
                        )}
                        {ticket.status === 'checked_in' && (
                          <span className="inline-flex items-center gap-1 bg-[#EBF3FB] text-[#1E3A8A] px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border border-[#BFDBFE]">
                            Ingecheckt
                          </span>
                        )}
                        {ticket.status === 'swapped' && (
                          <span className="inline-flex items-center gap-1 bg-[#FEF3C7] text-[#92400E] px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border border-[#FDE68A]">
                            Omgeruild
                          </span>
                        )}
                        {ticket.status === 'cancelled' && (
                          <span className="inline-flex items-center gap-1 bg-[#FEE2E2] text-[#991B1B] px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border border-[#FECACA]">
                            Vervallen
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Bekijk PDF */}
                          <a
                            href={pdfDownloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-[#FAF7F2] hover:bg-[#EAE5DC] text-[#1D1C1A] px-2 py-1 rounded border border-[#1D1C1A] text-[10px] font-bold inline-flex items-center gap-1"
                            title="Bekijk Vector A4 PDF"
                          >
                            <FileText className="w-3 h-3" />
                            PDF
                          </a>

                          {/* Bekijk QR Payload */}
                          <button
                            onClick={() => setInspectQrTicket(ticket)}
                            className="bg-[#FAF7F2] hover:bg-[#EAE5DC] text-[#1D1C1A] px-2 py-1 rounded border border-[#1D1C1A] text-[10px] font-bold inline-flex items-center gap-1"
                            title="Inspecteer QR Barcode"
                          >
                            <QrCode className="w-3 h-3" />
                            QR
                          </button>

                          {/* Inruilen / Wijzigen (alleen voor geldige tickets) */}
                          {ticket.status === 'valid' && (
                            <button
                              onClick={() => {
                                setSwapModalTicket(ticket);
                                setNewSessionTitle(
                                  ticket.sessionTitle.includes('Vrijdag')
                                    ? 'ZATERDAGMIDDAG SESSIE'
                                    : 'VIP SESSIE — VRIJDAG'
                                );
                              }}
                              className="bg-[#CAAC8E] hover:bg-[#B99979] text-[#1D1C1A] px-2 py-1 rounded border border-[#1D1C1A] text-[10px] font-bold inline-flex items-center gap-1"
                              title="Inruilen voor andere sessie"
                            >
                              <RefreshCw className="w-3 h-3" />
                              Inruilen
                            </button>
                          )}

                          {/* Annuleren */}
                          {ticket.status === 'valid' && (
                            <button
                              onClick={() => handleCancelTicket(ticket.ticketCode)}
                              className="text-[#8C0223] hover:bg-[#FEE2E2] p-1 rounded transition"
                              title="Annuleren"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: TICKET INRUILEN / SWAP ENGINE */}
      {swapModalTicket && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg max-w-lg w-full p-6 shadow-[8px_8px_0px_rgba(29,28,26,1)] animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#EAE5DC] pb-3 mb-4">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-[#006448]" />
                <h3 className="text-lg font-extrabold text-[#1D1C1A]">Ticket Inruilen / Sessie Wijzigen</h3>
              </div>
              <button
                onClick={() => setSwapModalTicket(null)}
                className="text-[#7A7268] hover:text-[#1D1C1A] p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {swapSuccessMessage ? (
              <div className="bg-[#E6F4EA] border-2 border-[#006448] rounded p-4 text-center my-4">
                <CheckCircle2 className="w-8 h-8 text-[#006448] mx-auto mb-2" />
                <div className="font-extrabold text-sm text-[#006448]">{swapSuccessMessage}</div>
                <div className="text-xs text-[#4C5752] mt-1">Oude barcode is direct gedeactiveerd in de scanner.</div>
              </div>
            ) : (
              <form onSubmit={handleExecuteSwap} className="space-y-4 text-xs">
                {/* Huidig ticket overzicht */}
                <div className="bg-[#FAF7F2] border border-[#DED6C9] rounded p-3">
                  <div className="text-[10px] font-extrabold uppercase text-[#7A7268]">Huidig Ticket</div>
                  <div className="font-mono font-extrabold text-sm text-[#1E3A8A] mt-0.5">
                    {swapModalTicket.ticketCode}
                  </div>
                  <div className="font-bold text-[#1D1C1A]">{swapModalTicket.attendeeName}</div>
                  <div className="text-[#4C5752] mt-0.5">
                    Huidige sessie: <strong>{swapModalTicket.sessionTitle}</strong>
                  </div>
                </div>

                {/* Kies nieuwe sessie */}
                <div>
                  <label className="block text-[11px] font-extrabold uppercase text-[#1D1C1A] mb-1">
                    Nieuwe Sessie Toewijzen:
                  </label>
                  <select
                    value={newSessionTitle}
                    onChange={(e) => setNewSessionTitle(e.target.value)}
                    className="w-full bg-[#FAF7F2] border-2 border-[#1D1C1A] rounded p-2.5 font-bold text-xs focus:outline-none"
                  >
                    <option value="VIP SESSIE — VRIJDAG">VIP Sessie — Vrijdag (13:00 - 17:00)</option>
                    <option value="VRIJDAGAVOND ENTREE">Vrijdagavond Entree (19:00 - 23:00)</option>
                    <option value="ZATERDAGMIDDAG SESSIE">Zaterdagmiddag Sessie (13:00 - 17:00)</option>
                    <option value="ZATERDAGAVOND SESSIE">Zaterdagavond Sessie (19:00 - 23:00)</option>
                    <option value="ZONDAGMIDDAG SESSIE">Zondagmiddag Sessie (13:00 - 17:00)</option>
                  </select>
                </div>

                {/* Reden voor omboeking */}
                <div>
                  <label className="block text-[11px] font-extrabold uppercase text-[#1D1C1A] mb-1">
                    Reden van Omboeking (voor audit log):
                  </label>
                  <input
                    type="text"
                    required
                    value={swapReason}
                    onChange={(e) => setSwapReason(e.target.value)}
                    placeholder="Bijv. Klant verhinderd op zaterdag, omgeboekt per telefoon"
                    className="w-full bg-[#FAF7F2] border border-[#DED6C9] rounded p-2 font-medium text-xs focus:outline-none focus:border-[#1D1C1A]"
                  />
                </div>

                {/* Uitleg wat er gebeurt */}
                <div className="bg-[#EBF3FB] border border-[#BFDBFE] rounded p-3 text-[11px] text-[#1E3A8A] space-y-1">
                  <div className="font-bold flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    Wat er direct gebeurt bij bevestiging:
                  </div>
                  <div>&bull; De oude barcode wordt <strong>per direct ongeldig</strong> gemaakt in alle scanners.</div>
                  <div>&bull; Er wordt een <strong>nieuw ticket</strong> gemint met aangepaste QR-code.</div>
                  <div>&bull; De nieuwe downloadlink wordt klaargezet voor verzending via GoHighLevel.</div>
                </div>

                {/* Knoppen */}
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSwapModalTicket(null)}
                    className="px-3 py-2 rounded border border-[#1D1C1A] font-bold text-xs"
                  >
                    Annuleren
                  </button>
                  <button
                    type="submit"
                    disabled={isSwapping}
                    className="bg-[#006448] hover:bg-[#004d37] text-white px-4 py-2 rounded border-2 border-[#1D1C1A] font-extrabold text-xs shadow-[2px_2px_0px_rgba(29,28,26,1)] transition flex items-center gap-1.5"
                  >
                    {isSwapping ? 'Omboeken...' : 'Bevestig Inruil & Genereer Nieuw Ticket →'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: QR INSPECTIE MODAL */}
      {inspectQrTicket && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg max-w-sm w-full p-6 shadow-[8px_8px_0px_rgba(29,28,26,1)] text-center">
            <div className="flex justify-end">
              <button onClick={() => setInspectQrTicket(null)} className="text-[#7A7268] hover:text-[#1D1C1A]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <QrCode className="w-8 h-8 text-[#006448] mx-auto mb-2" />
            <h3 className="font-extrabold text-base text-[#1D1C1A]">{inspectQrTicket.ticketCode}</h3>
            <p className="text-xs text-[#4C5752] mb-3">{inspectQrTicket.sessionTitle}</p>

            <div className="bg-[#FAF7F2] border-2 border-[#1D1C1A] rounded p-3 text-left space-y-2 mb-4">
              <div>
                <div className="text-[10px] font-extrabold uppercase text-[#7A7268]">Kaarthouder</div>
                <div className="font-bold text-xs text-[#1D1C1A]">{inspectQrTicket.attendeeName}</div>
              </div>
              <div>
                <div className="text-[10px] font-extrabold uppercase text-[#7A7268]">Cryptografische HMAC Hash</div>
                <div className="font-mono text-[11px] font-bold text-[#006448]">{inspectQrTicket.qrPayloadHash || 'HMAC-SHA256'}</div>
              </div>
              <div>
                <div className="text-[10px] font-extrabold uppercase text-[#7A7268]">Status</div>
                <div className="font-bold text-xs capitalize text-[#1D1C1A]">{inspectQrTicket.status}</div>
              </div>
            </div>

            <button
              onClick={() => setInspectQrTicket(null)}
              className="w-full bg-[#1D1C1A] text-white py-2 rounded text-xs font-bold"
            >
              Sluiten
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
