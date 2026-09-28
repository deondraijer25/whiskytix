import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Ticket,
  CheckCircle2,
  Calendar,
  Clock,
  MapPin,
  ShieldCheck,
  User,
  Mail,
  Phone,
  FileText,
  AlertCircle,
  Sparkles,
  QrCode,
  Tag,
  Check,
} from 'lucide-react';
import { getFestivalCatalog, FestivalCatalogItem, formatEuro } from '../data/festivalCatalog';
import { INITIAL_FESTIVALS } from '../data/mockData';

const CITY_THEMES: Record<string, {
  primary: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  btnBg: string;
  btnHover: string;
  ring: string;
}> = {
  gent: {
    primary: '#1E3A8A',
    badgeBg: 'bg-[#EBF3FB]',
    badgeText: 'text-[#1E3A8A]',
    badgeBorder: 'border-[#BFDBFE]',
    btnBg: 'bg-[#1E3A8A]',
    btnHover: 'hover:bg-[#172554]',
    ring: 'focus:ring-[#1E3A8A]',
  },
  denhaag: {
    primary: '#006448',
    badgeBg: 'bg-[#d8e7e2]',
    badgeText: 'text-[#006448]',
    badgeBorder: 'border-[#8ba198]',
    btnBg: 'bg-[#006448]',
    btnHover: 'hover:bg-[#005039]',
    ring: 'focus:ring-[#006448]',
  },
  amsterdam: {
    primary: '#8C0223',
    badgeBg: 'bg-[#FCE8EC]',
    badgeText: 'text-[#8C0223]',
    badgeBorder: 'border-[#F5B7C2]',
    btnBg: 'bg-[#8C0223]',
    btnHover: 'hover:bg-[#70021c]',
    ring: 'focus:ring-[#8C0223]',
  },
};

export const CreateInvitationPage: React.FC = () => {
  const { cityId } = useParams<{ cityId?: string }>();
  const navigate = useNavigate();

  // Active City
  const [selectedCity, setSelectedCity] = useState<'gent' | 'denhaag' | 'amsterdam'>(
    (cityId as any) === 'amsterdam' || (cityId as any) === 'denhaag' ? (cityId as any) : 'gent'
  );

  const theme = CITY_THEMES[selectedCity] || CITY_THEMES.denhaag;
  const activeFestival = INITIAL_FESTIVALS.find((f) => f.id === selectedCity);

  const authData = useMemo(() => {
    try {
      const raw = localStorage.getItem('whiskytix_auth');
      if (raw) return JSON.parse(raw);
    } catch {
      // fallback
    }
    return { user: 'Deon Draijer', email: 'beheer@whiskyfestival.nl', role: 'admin' };
  }, []);

  // Form Fields
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestReason, setGuestReason] = useState('VIP / Zakenrelatie');
  const [guestNotes, setGuestNotes] = useState('');
  const [guestQuantity, setGuestQuantity] = useState(1);

  // Catalog Item Selection
  const [filterCategory, setFilterCategory] = useState<'all' | 'entree' | 'masterclass' | 'special'>('all');
  const catalogItems = useMemo(() => getFestivalCatalog(selectedCity), [selectedCity]);

  const filteredCatalogItems = useMemo(() => {
    if (filterCategory === 'all') return catalogItems;
    return catalogItems.filter((i) => i.category === filterCategory);
  }, [catalogItems, filterCategory]);

  const [selectedItemId, setSelectedItemId] = useState<string>(() => {
    const items = getFestivalCatalog(selectedCity);
    return items[0]?.id || '';
  });

  // Switch selection if city changes
  useEffect(() => {
    const items = getFestivalCatalog(selectedCity);
    if (!items.some((i) => i.id === selectedItemId)) {
      setSelectedItemId(items[0]?.id || '');
    }
  }, [selectedCity]);

  const selectedItem: FestivalCatalogItem | undefined = useMemo(() => {
    return catalogItems.find((i) => i.id === selectedItemId) || filteredCatalogItems[0];
  }, [catalogItems, selectedItemId, filteredCatalogItems]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!guestName.trim() || !guestEmail.trim()) {
      setSubmitError('Vul alstublieft de naam en het e-mailadres van de gast in.');
      return;
    }

    if (!selectedItem) {
      setSubmitError('Selecteer een geldige sessie of masterclass.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/orders/create-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: guestName.trim(),
          customerEmail: guestEmail.trim(),
          customerPhone: guestPhone.trim() || undefined,
          city: selectedCity,
          sessionTitle: selectedItem.title,
          dateStr: selectedItem.dateStr,
          timeStr: selectedItem.timeStr,
          quantity: guestQuantity,
          reason: guestReason,
          notes: guestNotes.trim() || undefined,
          adminEmail: authData.email || 'beheer@whiskyfestival.nl',
        }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.order) {
        // Redirection Flow: Navigate directly to the orders list and highlight/open the created order
        const targetUrl = cityId
          ? `/admin/festival/${cityId}/orders?openOrder=${encodeURIComponent(data.order.orderNumber)}`
          : `/admin/festival/${selectedCity}/orders?openOrder=${encodeURIComponent(data.order.orderNumber)}`;
        navigate(targetUrl);
      } else {
        setSubmitError(data.error || 'Er is een onbekende fout opgetreden bij het aanmaken.');
      }
    } catch (err: any) {
      setSubmitError(`Netwerkfout: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans">
      {/* 1. TOP BREADCRUMB & HEADER */}
      <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-5 sm:p-6 shadow-[4px_4px_0px_rgba(29,28,26,0.9)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Link
              to={cityId ? `/admin/festival/${cityId}/orders` : `/admin/festival/${selectedCity}/orders`}
              className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#4c5752] hover:text-[#1D1C1A] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Terug naar Bestellingen</span>
            </Link>
            <span className="text-[#8ba198]">•</span>
            <span className={`text-[10px] sm:text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded border ${theme.badgeBg} ${theme.badgeText} ${theme.badgeBorder}`}>
              {activeFestival?.edition || 'Whisky Festival'} • Vrijkaarten
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1D1C1A] tracking-tight">
            Nieuwe Gastuitnodiging & Vrijkaart
          </h1>
          <p className="text-xs sm:text-sm text-[#4c5752] mt-1 font-medium">
            Verstrek officiële toegangskaarten kosteloos aan VIP's, relaties, sprekers, pers of medewerkers.
          </p>
        </div>

        {/* City Switcher if not locked to single city route */}
        {!cityId && (
          <div className="flex items-center gap-1.5 bg-[#FAF7F2] p-1.5 rounded border-2 border-[#1D1C1A]">
            {[
              { id: 'gent', name: 'Gent' },
              { id: 'denhaag', name: 'Den Haag' },
              { id: 'amsterdam', name: 'Amsterdam' },
            ].map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCity(c.id as any)}
                className={`px-3 py-1.5 rounded text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  selectedCity === c.id
                    ? 'bg-[#006448] text-white shadow-[2px_2px_0px_rgba(29,28,26,0.9)]'
                    : 'text-[#4c5752] hover:text-[#1D1C1A]'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2. DIRECTIE BEVOEGDHEID BANNER */}
      <div className="bg-[#FAF7F2] border-2 border-[#1D1C1A] rounded-lg p-4 shadow-[3px_3px_0px_rgba(29,28,26,0.9)] flex items-start sm:items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-[#d8e7e2] border-2 border-[#1D1C1A] flex items-center justify-center text-[#006448] shrink-0 shadow-[1px_1px_0px_rgba(29,28,26,0.9)]">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="flex-1 text-xs">
          <div className="font-extrabold text-[#1D1C1A] flex items-center gap-2 flex-wrap">
            <span>Directie Vrijstellingsbevoegdheid Actief</span>
            <span className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded bg-[#006448] text-white tracking-wider">
              {authData.role === 'admin' ? 'Eigenaarsrecht (Admin)' : 'Organisator'}
            </span>
            <span className="text-[11px] text-[#4c5752] font-semibold">
              • Ingelogd als: <strong className="text-[#1D1C1A]">{authData.user}</strong> ({authData.email})
            </span>
          </div>
          <p className="text-[#4c5752] mt-0.5 font-medium leading-relaxed">
            Als festivaldirectie kunt u te allen tijde gasten toelaten — <strong>ook wanneer sessies of masterclasses voor het publiek volledig zijn uitverkocht</strong>. De kaarten worden toegekend vanuit de organisatiereserve met een officiële en direct scanbare kassa-barcode.
          </p>
        </div>
      </div>

      {submitError && (
        <div className="p-4 bg-red-50 border-2 border-red-700 text-red-800 rounded-lg text-xs font-bold flex items-center gap-2 shadow-[2px_2px_0px_rgba(185,28,28,0.9)]">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-700" />
          <span>{submitError}</span>
        </div>
      )}

      {/* 3. MAIN TWO-COLUMN FORM LAYOUT */}
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LINKER KOLOM: GEGEVENS GAST & DOELGROEP (5 cols op desktop) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Stap 1: Contactgegevens */}
            <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-5 sm:p-6 shadow-[4px_4px_0px_rgba(29,28,26,0.9)] space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-[#c1d4ce]">
                <div className="w-6 h-6 rounded-full bg-[#1D1C1A] text-white flex items-center justify-center text-xs font-black">
                  1
                </div>
                <h2 className="text-sm font-black uppercase tracking-wider text-[#1D1C1A]">
                  Gegevens van de Gast
                </h2>
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase text-[#1D1C1A] mb-1">
                  Naam Gast of Contactpersoon <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#8ba198] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Bijv. Alexander van den Berg"
                    className="w-full pl-9 pr-3 py-2.5 bg-white border-2 border-[#1D1C1A] rounded text-xs font-bold text-[#1D1C1A] focus:outline-none focus:ring-2 focus:ring-[#006448]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase text-[#1D1C1A] mb-1">
                  E-mailadres Ontvanger <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#8ba198] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="relatie@bedrijf.be"
                    className="w-full pl-9 pr-3 py-2.5 bg-white border-2 border-[#1D1C1A] rounded text-xs font-bold text-[#1D1C1A] focus:outline-none focus:ring-2 focus:ring-[#006448]"
                  />
                </div>
                <p className="text-[11px] text-[#4c5752] mt-1 font-medium">
                  De bezoeker kan met dit e-mailadres direct inloggen in het online gastportaal en de officiële PDF-tickets downloaden.
                </p>
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase text-[#1D1C1A] mb-1">
                  Telefoonnummer (Optioneel)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-[#8ba198] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder="+32 470 12 34 56 of +31 6 12345678"
                    className="w-full pl-9 pr-3 py-2.5 bg-white border-2 border-[#1D1C1A] rounded text-xs font-bold text-[#1D1C1A] focus:outline-none focus:ring-2 focus:ring-[#006448]"
                  />
                </div>
              </div>
            </div>

            {/* Stap 2: Aantal & Uitnodigingsreden */}
            <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-5 sm:p-6 shadow-[4px_4px_0px_rgba(29,28,26,0.9)] space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-[#c1d4ce]">
                <div className="w-6 h-6 rounded-full bg-[#1D1C1A] text-white flex items-center justify-center text-xs font-black">
                  2
                </div>
                <h2 className="text-sm font-black uppercase tracking-wider text-[#1D1C1A]">
                  Type Gast & Aantal Kaarten
                </h2>
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase text-[#1D1C1A] mb-1">
                  Type Gast / Reden van Verstrekking
                </label>
                <select
                  value={guestReason}
                  onChange={(e) => setGuestReason(e.target.value)}
                  className="w-full p-2.5 bg-white border-2 border-[#1D1C1A] rounded text-xs font-bold text-[#1D1C1A] focus:outline-none focus:ring-2 focus:ring-[#006448] cursor-pointer"
                >
                  <option value="VIP / Zakenrelatie">VIP / Zakenrelatie</option>
                  <option value="Spreker / Masterclass Host">Spreker / Masterclass Host</option>
                  <option value="Pers & Media">Pers & Media</option>
                  <option value="Organisatie & Crew">Organisatie & Crew</option>
                  <option value="Vrijkaart / Winactie">Vrijkaart / Winactie</option>
                  <option value="Relatiegeschenk Directie">Relatiegeschenk Directie</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase text-[#1D1C1A] mb-1">
                  Aantal Kaarten
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 4].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setGuestQuantity(num)}
                      className={`flex-1 py-2.5 rounded border-2 border-[#1D1C1A] text-xs font-black transition-all cursor-pointer ${
                        guestQuantity === num
                          ? 'bg-[#006448] text-white shadow-[2px_2px_0px_rgba(29,28,26,0.9)]'
                          : 'bg-white text-[#1D1C1A] hover:bg-[#FAF7F2]'
                      }`}
                    >
                      {num}x {num === 1 ? 'Kaart' : 'Kaarten'}
                    </button>
                  ))}
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] font-bold text-[#4c5752] uppercase">Anders:</span>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={guestQuantity}
                      onChange={(e) => setGuestQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-16 p-2 text-center bg-white border-2 border-[#1D1C1A] rounded text-xs font-black text-[#1D1C1A]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase text-[#1D1C1A] mb-1">
                  Interne Notitie (Optioneel)
                </label>
                <input
                  type="text"
                  value={guestNotes}
                  onChange={(e) => setGuestNotes(e.target.value)}
                  placeholder="Bijv. Toegekend door directie — Partner van hoofdsponsor"
                  className="w-full p-2.5 bg-white border-2 border-[#1D1C1A] rounded text-xs font-medium text-[#1D1C1A] focus:outline-none focus:ring-2 focus:ring-[#006448]"
                />
                <p className="text-[10px] text-[#4c5752] mt-1 font-medium">
                  Alleen zichtbaar voor de organisatie in het beheerpaneel en op het overzicht.
                </p>
              </div>
            </div>
          </div>

          {/* RECHTER KOLOM: SESSIESELECTIE & TICKET PREVIEW (7 cols op desktop) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-5 sm:p-6 shadow-[4px_4px_0px_rgba(29,28,26,0.9)] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#c1d4ce]">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-[#1D1C1A] text-white flex items-center justify-center text-xs font-black">
                    3
                  </div>
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-wider text-[#1D1C1A]">
                      Selecteer Sessie of Masterclass <span className="text-red-600">*</span>
                    </h2>
                    <p className="text-[11px] text-[#4c5752]">
                      Kies de gewenste toegang uit het officiële programma.
                    </p>
                  </div>
                </div>

                {/* Filter categorieën */}
                <div className="flex items-center gap-1 bg-[#FAF7F2] p-1 border-2 border-[#1D1C1A] rounded overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setFilterCategory('all')}
                    className={`px-2.5 py-1 rounded text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                      filterCategory === 'all'
                        ? 'bg-[#006448] text-white shadow-[1px_1px_0px_rgba(29,28,26,0.9)]'
                        : 'text-[#4c5752] hover:text-[#1D1C1A]'
                    }`}
                  >
                    Alle ({catalogItems.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterCategory('entree')}
                    className={`px-2.5 py-1 rounded text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                      filterCategory === 'entree'
                        ? 'bg-[#006448] text-white shadow-[1px_1px_0px_rgba(29,28,26,0.9)]'
                        : 'text-[#4c5752] hover:text-[#1D1C1A]'
                    }`}
                  >
                    Entrees ({catalogItems.filter((i) => i.category === 'entree').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterCategory('masterclass')}
                    className={`px-2.5 py-1 rounded text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                      filterCategory === 'masterclass'
                        ? 'bg-[#006448] text-white shadow-[1px_1px_0px_rgba(29,28,26,0.9)]'
                        : 'text-[#4c5752] hover:text-[#1D1C1A]'
                    }`}
                  >
                    Masterclasses ({catalogItems.filter((i) => i.category === 'masterclass').length})
                  </button>
                  {catalogItems.some((i) => i.category === 'special') && (
                    <button
                      type="button"
                      onClick={() => setFilterCategory('special')}
                      className={`px-2.5 py-1 rounded text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                        filterCategory === 'special'
                          ? 'bg-[#006448] text-white shadow-[1px_1px_0px_rgba(29,28,26,0.9)]'
                          : 'text-[#4c5752] hover:text-[#1D1C1A]'
                      }`}
                    >
                      Specials & Tours ({catalogItems.filter((i) => i.category === 'special').length})
                    </button>
                  )}
                </div>
              </div>

              {/* Ademende lijst met alle sessies en hun realtime status */}
              <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                {filteredCatalogItems.map((item) => {
                  const isSelected = selectedItemId === item.id;
                  const isSoldOut = !!item.isSoldOut;

                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedItemId(item.id)}
                      className={`p-3.5 rounded-lg border-2 transition-all cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-[#FAF7F2] border-[#1D1C1A] shadow-[3px_3px_0px_rgba(29,28,26,0.9)] ring-1 ring-[#006448]'
                          : 'bg-white border-[#c1d4ce] hover:border-[#1D1C1A] hover:bg-[#FAF7F2]/60'
                      }`}
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${
                              item.category === 'masterclass'
                                ? 'bg-[#e4d5c4] text-[#543b20] border-[#caac8e]'
                                : item.category === 'special'
                                ? 'bg-[#eedccb] text-[#6d4c1d] border-[#caac8e]'
                                : 'bg-[#d8e7e2] text-[#006448] border-[#8ba198]'
                            }`}
                          >
                            {item.category === 'masterclass'
                              ? 'MASTERCLASS'
                              : item.category === 'special'
                              ? 'SPECIAL / RONDVAART'
                              : 'ENTREETICKET'}
                          </span>

                          {/* UITVERKOCHT OF BESCHIKBAAR STATUS PILL */}
                          {isSoldOut ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-900 border border-indigo-300">
                              <Sparkles className="w-3 h-3 text-indigo-700" />
                              Uitverkocht — Directie Vrijstelling
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Beschikbaar
                            </span>
                          )}

                          <div className="flex items-center gap-1 text-[11px] text-[#4c5752] font-semibold">
                            <Calendar className="w-3 h-3 text-[#006448]" />
                            <span>{item.dateStr}</span>
                            <span className="text-[#8ba198]">•</span>
                            <Clock className="w-3 h-3 text-[#006448]" />
                            <span>{item.timeStr}</span>
                          </div>
                        </div>

                        <div className="text-sm font-extrabold text-[#1D1C1A] leading-tight">
                          {item.title}
                        </div>

                        {item.location && (
                          <div className="flex items-center gap-1 text-[11px] text-[#4c5752]">
                            <MapPin className="w-3 h-3 text-[#8ba198]" />
                            <span>{item.location}</span>
                          </div>
                        )}
                      </div>

                      <div className="text-left sm:text-right shrink-0 flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-0 border-gray-100">
                        <div className="text-[11px] text-[#4c5752]">
                          Normaal: <span className="line-through font-bold">{formatEuro(item.originalPriceEur)}</span>
                        </div>
                        <div className="text-xs font-black text-[#006448]">
                          Kosteloos (€ 0,00)
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Notitie wanneer een uitverkochte sessie is gekozen */}
              {selectedItem?.isSoldOut && (
                <div className="p-3 bg-indigo-50 border-2 border-indigo-800 rounded-lg text-xs text-indigo-950 flex items-start gap-2 shadow-[2px_2px_0px_rgba(49,46,129,0.2)]">
                  <Sparkles className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-black">Directie Vrijstelling Toegepast:</strong> Deze sessie is uitverkocht voor publieke kaartkopers. Whiskytix kent de tickets toe met officiële HMAC-beveiliging vanuit het directiecontingent.
                  </div>
                </div>
              )}
            </div>

            {/* LIVE TICKET STUB PREVIEW */}
            {selectedItem && (
              <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-5 sm:p-6 shadow-[4px_4px_0px_rgba(29,28,26,0.9)] space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-[#4c5752] flex items-center gap-1.5">
                    <Ticket className="w-4 h-4 text-[#006448]" />
                    <span>Live Ticket Preview & Kassa-koppeling</span>
                  </h3>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-[#d8e7e2] text-[#006448] border border-[#8ba198]">
                    Scanbaar E-Ticket
                  </span>
                </div>

                {/* Perforated Heritage Ticket Stub */}
                <div className="border-2 border-[#1D1C1A] rounded-lg overflow-hidden bg-white shadow-[2px_2px_0px_rgba(29,28,26,0.8)]">
                  <div className="p-4 bg-[#FAF7F2] border-b-2 border-dashed border-[#1D1C1A] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-[#006448] bg-[#d8e7e2] px-2 py-0.5 rounded border border-[#8ba198]">
                        {selectedCity === 'gent' ? 'Gent 2026' : selectedCity === 'amsterdam' ? 'Amsterdam 2027' : 'Den Haag 2026'}
                      </span>
                      <h4 className="text-base font-black text-[#1D1C1A] mt-1">
                        {selectedItem.title}
                      </h4>
                      <p className="text-xs text-[#4c5752] font-semibold">
                        {selectedItem.dateStr} • {selectedItem.timeStr}
                      </p>
                    </div>

                    <div className="text-left sm:text-right">
                      <div className="text-[10px] font-bold uppercase text-[#4c5752]">Bedrag</div>
                      <div className="text-sm font-black text-[#006448]">€ 0,00 Vrijkaart</div>
                    </div>
                  </div>

                  <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs bg-white">
                    <div className="space-y-1">
                      <div className="text-[11px] text-[#4c5752] font-bold">Naam op Toegangskaart:</div>
                      <div className="text-sm font-extrabold text-[#1D1C1A]">
                        {guestName.trim() || 'Naam van de genodigde'} {guestQuantity > 1 ? `(+ ${guestQuantity - 1}x gasten)` : ''}
                      </div>
                      <div className="text-[11px] text-[#4c5752]">
                        Status: <strong className="text-emerald-700">Geldig Toegangsbiljet</strong> • Directie: {guestReason}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 bg-[#FAF7F2] border border-[#c1d4ce] px-3 py-2 rounded shrink-0">
                      <QrCode className="w-7 h-7 text-[#1D1C1A]" />
                      <div className="text-[10px] font-mono text-[#4c5752] leading-tight">
                        <div className="font-bold text-[#1D1C1A]">HMAC QR</div>
                        <div>Direct scanbaar</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-[#4c5752] space-y-0.5">
                  <div>• Er wordt direct een bestelling aangemaakt met status <strong>Betaald (€ 0,00)</strong>.</div>
                  <div>• {guestQuantity}x ticket(s) met unieke barcode en A4 downloadbare PDF.</div>
                  <div>• De gast kan direct inloggen met het e-mailadres <strong>{guestEmail || '...'}</strong>.</div>
                </div>
              </div>
            )}

            {/* ACTIEKNOPPEN ONDERZIJDE */}
            <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-4 sm:p-5 shadow-[4px_4px_0px_rgba(29,28,26,0.9)] flex flex-col sm:flex-row items-center gap-3">
              <Link
                to={cityId ? `/admin/festival/${cityId}/orders` : `/admin/festival/${selectedCity}/orders`}
                className="w-full sm:w-auto px-6 py-3 rounded border-2 border-[#1D1C1A] bg-white text-xs font-black text-[#1D1C1A] hover:bg-gray-100 shadow-[2px_2px_0px_rgba(29,28,26,0.9)] text-center cursor-pointer transition-all"
              >
                Annuleren
              </Link>

              <button
                type="submit"
                disabled={isSubmitting || !guestName.trim() || !guestEmail.trim() || !selectedItem}
                className={`w-full sm:flex-1 py-3 px-6 rounded border-2 border-[#1D1C1A] ${theme.btnBg} text-white ${theme.btnHover} text-sm font-black shadow-[3px_3px_0px_rgba(29,28,26,0.9)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-all`}
              >
                <Ticket className="w-4 h-4" />
                <span>
                  {isSubmitting
                    ? 'Officiële Gastuitnodiging Wordt Aangemaakt...'
                    : `Gastuitnodiging (${guestQuantity}x) Definitief Aanmaken`}
                </span>
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
