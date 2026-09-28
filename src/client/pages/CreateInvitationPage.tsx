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
  AlertCircle,
  Search,
  X,
} from 'lucide-react';
import { getFestivalCatalog, FestivalCatalogItem, formatEuro } from '../data/festivalCatalog';
import { INITIAL_FESTIVALS } from '../data/mockData';

const CITY_THEMES: Record<string, {
  primary: string;
  gradientClass: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  btnBg: string;
  btnHover: string;
  ring: string;
}> = {
  gent: {
    primary: '#1E3A8A',
    gradientClass: 'bg-gradient-to-br from-[#172554] via-[#1E3A8A] to-[#1D4ED8]',
    badgeBg: 'bg-[#EBF3FB]',
    badgeText: 'text-[#1E3A8A]',
    badgeBorder: 'border-[#BFDBFE]',
    btnBg: 'bg-[#1E3A8A]',
    btnHover: 'hover:bg-[#172554]',
    ring: 'focus:ring-[#1E3A8A]',
  },
  denhaag: {
    primary: '#006448',
    gradientClass: 'bg-gradient-to-br from-[#003B2A] via-[#006448] to-[#047857]',
    badgeBg: 'bg-[#d8e7e2]',
    badgeText: 'text-[#006448]',
    badgeBorder: 'border-[#8ba198]',
    btnBg: 'bg-[#006448]',
    btnHover: 'hover:bg-[#005039]',
    ring: 'focus:ring-[#006448]',
  },
  amsterdam: {
    primary: '#8C0223',
    gradientClass: 'bg-gradient-to-br from-[#5C0117] via-[#8C0223] to-[#B91C1C]',
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

  // Search & Filter
  const [filterCategory, setFilterCategory] = useState<'all' | 'entree' | 'masterclass' | 'special'>('all');
  const [sessionSearchQuery, setSessionSearchQuery] = useState('');

  const catalogItems = useMemo(() => getFestivalCatalog(selectedCity), [selectedCity]);

  const filteredCatalogItems = useMemo(() => {
    return catalogItems.filter((item) => {
      const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
      const q = sessionSearchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.dateStr.toLowerCase().includes(q) ||
        item.timeStr.toLowerCase().includes(q) ||
        (item.location && item.location.toLowerCase().includes(q));

      return matchesCategory && matchesSearch;
    });
  }, [catalogItems, filterCategory, sessionSearchQuery]);

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
      {/* 1. TOP HERO BANNER MET FESTIVAL GRADIENT (GENT: BLAUW) */}
      <div className={`${theme.gradientClass} border-2 border-[#1D1C1A] rounded-lg p-5 sm:p-6 shadow-[4px_4px_0px_rgba(29,28,26,0.9)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-white`}>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to={cityId ? `/admin/festival/${cityId}/orders` : `/admin/festival/${selectedCity}/orders`}
              className="inline-flex items-center gap-1.5 text-xs font-extrabold text-white/80 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Terug naar Bestellingen</span>
            </Link>
            <span className="text-white/40">•</span>
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded bg-white/20 text-white border border-white/30">
              {activeFestival?.edition || 'Whisky Festival'} • Vrijkaarten
            </span>
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#FCFAF7] text-[#1D1C1A] border border-[#1D1C1A] shadow-[1px_1px_0px_rgba(29,28,26,0.9)] flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#006448]" />
              <span>Directie Vrijstelling Actief</span>
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight drop-shadow-sm">
            Nieuwe Gastuitnodiging & Vrijkaart
          </h1>
          <p className="text-xs sm:text-sm text-white/90 font-medium">
            Verstrek kosteloos officiële toegangskaarten aan relaties of sprekers. Uitverkochte sessies zijn toegestaan via de directiereserve.
          </p>
        </div>

        {/* City Switcher if not locked to single city route */}
        {!cityId && (
          <div className="flex items-center gap-1.5 bg-[#FAF7F2] p-1.5 rounded border-2 border-[#1D1C1A] shrink-0 text-[#1D1C1A]">
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

      {submitError && (
        <div className="p-4 bg-red-50 border-2 border-red-700 text-red-800 rounded-lg text-xs font-bold flex items-center gap-2 shadow-[2px_2px_0px_rgba(185,28,28,0.9)]">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-700" />
          <span>{submitError}</span>
        </div>
      )}

      {/* 2. FORMULIER LAYOUT */}
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LINKER KOLOM: GEGEVENS GAST & DOELGROEP (5 cols) */}
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
                      className={`flex-1 py-2 rounded border-2 border-[#1D1C1A] text-xs font-black transition-all cursor-pointer ${
                        guestQuantity === num
                          ? 'bg-[#006448] text-white shadow-[2px_2px_0px_rgba(29,28,26,0.9)]'
                          : 'bg-white text-[#1D1C1A] hover:bg-[#FAF7F2]'
                      }`}
                    >
                      {num}x {num === 1 ? 'Kaart' : 'Kaarten'}
                    </button>
                  ))}
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] font-bold text-[#4c5752] uppercase">Aangepast:</span>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={guestQuantity}
                      onChange={(e) => setGuestQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-14 p-1.5 text-center bg-white border-2 border-[#1D1C1A] rounded text-xs font-black text-[#1D1C1A]"
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
                  placeholder="Bijv. Partner van hoofdsponsor"
                  className="w-full p-2.5 bg-white border-2 border-[#1D1C1A] rounded text-xs font-medium text-[#1D1C1A] focus:outline-none focus:ring-2 focus:ring-[#006448]"
                />
              </div>
            </div>
          </div>

          {/* RECHTER KOLOM: SESSIE ZOEKEN EN SELECTEREN (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-5 sm:p-6 shadow-[4px_4px_0px_rgba(29,28,26,0.9)] space-y-3.5">
              <div className="flex items-center gap-2 pb-3 border-b border-[#c1d4ce]">
                <div className="w-6 h-6 rounded-full bg-[#1D1C1A] text-white flex items-center justify-center text-xs font-black">
                  3
                </div>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-[#1D1C1A]">
                    Selecteer Sessie of Masterclass <span className="text-red-600">*</span>
                  </h2>
                  <p className="text-[11px] text-[#4c5752]">
                    Zoek en kies de gewenste toegang uit het festivalprogramma.
                  </p>
                </div>
              </div>

              {/* RUSTIGE ZOEKBALK MET VERGROOTGLAS */}
              <div className="relative">
                <Search className="w-4 h-4 text-[#8ba198] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={sessionSearchQuery}
                  onChange={(e) => setSessionSearchQuery(e.target.value)}
                  placeholder="Zoek op titel, dag of tijd (bijv. 'Zaterdag', 'Dada', 'Bootje')..."
                  className="w-full pl-9 pr-8 py-2 bg-white border-2 border-[#1D1C1A] rounded text-xs font-semibold text-[#1D1C1A] focus:outline-none focus:ring-2 focus:ring-[#006448]"
                />
                {sessionSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setSessionSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                    title="Wissen"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* CATEGORIE TABS (NETJES GEWRAPED ZONDER HORIZONTALE SCROLLBAR) */}
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => setFilterCategory('all')}
                  className={`px-3 py-1 rounded text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    filterCategory === 'all'
                      ? 'bg-[#006448] text-white shadow-[1px_1px_0px_rgba(29,28,26,0.9)]'
                      : 'bg-[#FAF7F2] border border-[#c1d4ce] text-[#4c5752] hover:text-[#1D1C1A]'
                  }`}
                >
                  Alle ({catalogItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterCategory('entree')}
                  className={`px-3 py-1 rounded text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    filterCategory === 'entree'
                      ? 'bg-[#006448] text-white shadow-[1px_1px_0px_rgba(29,28,26,0.9)]'
                      : 'bg-[#FAF7F2] border border-[#c1d4ce] text-[#4c5752] hover:text-[#1D1C1A]'
                  }`}
                >
                  Entrees ({catalogItems.filter((i) => i.category === 'entree').length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterCategory('masterclass')}
                  className={`px-3 py-1 rounded text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    filterCategory === 'masterclass'
                      ? 'bg-[#006448] text-white shadow-[1px_1px_0px_rgba(29,28,26,0.9)]'
                      : 'bg-[#FAF7F2] border border-[#c1d4ce] text-[#4c5752] hover:text-[#1D1C1A]'
                  }`}
                >
                  Masterclasses ({catalogItems.filter((i) => i.category === 'masterclass').length})
                </button>
                {catalogItems.some((i) => i.category === 'special') && (
                  <button
                    type="button"
                    onClick={() => setFilterCategory('special')}
                    className={`px-3 py-1 rounded text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                      filterCategory === 'special'
                        ? 'bg-[#006448] text-white shadow-[1px_1px_0px_rgba(29,28,26,0.9)]'
                        : 'bg-[#FAF7F2] border border-[#c1d4ce] text-[#4c5752] hover:text-[#1D1C1A]'
                    }`}
                  >
                    Specials & Tours ({catalogItems.filter((i) => i.category === 'special').length})
                  </button>
                )}
              </div>

              {/* OVERZICHTELIJKE SESSIELIJST */}
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {filteredCatalogItems.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#4c5752] font-semibold bg-white rounded border border-[#c1d4ce]">
                    Geen sessies of masterclasses gevonden voor "{sessionSearchQuery}".
                  </div>
                ) : (
                  filteredCatalogItems.map((item) => {
                    const isSelected = selectedItemId === item.id;
                    const isSoldOut = !!item.isSoldOut;

                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedItemId(item.id)}
                        className={`p-3 rounded-lg border-2 transition-all cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 ${
                          isSelected
                            ? 'bg-[#FAF7F2] border-[#1D1C1A] shadow-[2px_2px_0px_rgba(29,28,26,0.9)] ring-1 ring-[#006448]'
                            : 'bg-white border-[#c1d4ce] hover:border-[#1D1C1A]'
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
                                ? 'SPECIAL'
                                : 'ENTREETICKET'}
                            </span>

                            {isSoldOut ? (
                              <span className="inline-flex items-center text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-[#FAF0E6] text-[#8C3A00] border border-[#E0B896]">
                                Uitverkocht — Directie Vrijstelling
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-[#d8e7e2] text-[#006448] border border-[#8ba198]">
                                <CheckCircle2 className="w-3 h-3 text-[#006448]" />
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
                        </div>

                        <div className="text-left sm:text-right shrink-0 flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto pt-1 sm:pt-0 border-t sm:border-0 border-gray-100">
                          <div className="text-[11px] text-[#4c5752]">
                            Normaal: <span className="line-through font-bold">{formatEuro(item.originalPriceEur)}</span>
                          </div>
                          <div className="text-xs font-black text-[#006448]">
                            € 0,00 Vrijkaart
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {selectedItem?.isSoldOut && (
                <div className="p-2.5 bg-[#FAF0E6] border border-[#E0B896] rounded text-xs text-[#8C3A00]">
                  <strong>Directie Vrijstelling:</strong> Deze sessie is uitverkocht voor publiek en wordt toegekend via het directiecontingent.
                </div>
              )}
            </div>

            {/* 3. ACTIEBALK & SAMENVATTING (ZONDER NEP TICKET/QR PREVIEW) */}
            <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-5 shadow-[4px_4px_0px_rgba(29,28,26,0.9)] space-y-4">
              {/* Rustige compacte samenvattingsstrook */}
              {selectedItem && (
                <div className="p-3.5 bg-[#FAF7F2] border border-[#c1d4ce] rounded flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <div className="text-[10px] font-bold text-[#4c5752] uppercase tracking-wider">
                      Geselecteerde Toegangskaart:
                    </div>
                    <div className="font-extrabold text-[#1D1C1A] text-sm">
                      {guestQuantity}x {selectedItem.title}
                    </div>
                    <div className="text-[11px] text-[#4c5752]">
                      {selectedItem.dateStr} • {selectedItem.timeStr} • Ontvanger: <strong className="text-[#1D1C1A]">{guestName.trim() || 'Nog in te vullen'}</strong>
                    </div>
                  </div>

                  <div className="text-left sm:text-right shrink-0">
                    <div className="text-[10px] font-bold text-[#4c5752] uppercase">Kosten</div>
                    <div className="text-sm font-black text-[#006448]">€ 0,00 (Vrijkaart)</div>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <Link
                  to={cityId ? `/admin/festival/${cityId}/orders` : `/admin/festival/${selectedCity}/orders`}
                  className="w-full sm:w-auto px-6 py-2.5 rounded border-2 border-[#1D1C1A] bg-white text-xs font-black text-[#1D1C1A] hover:bg-gray-100 shadow-[2px_2px_0px_rgba(29,28,26,0.9)] text-center cursor-pointer transition-all"
                >
                  Annuleren
                </Link>

                <button
                  type="submit"
                  disabled={isSubmitting || !guestName.trim() || !guestEmail.trim() || !selectedItem}
                  className={`w-full sm:flex-1 py-2.5 px-6 rounded border-2 border-[#1D1C1A] ${theme.btnBg} text-white ${theme.btnHover} text-xs font-black shadow-[3px_3px_0px_rgba(29,28,26,0.9)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-all`}
                >
                  <Ticket className="w-4 h-4" />
                  <span>
                    {isSubmitting
                      ? 'Gastuitnodiging Aanmaken...'
                      : `Gastuitnodiging (${guestQuantity}x) Aanmaken`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
