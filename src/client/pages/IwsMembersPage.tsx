import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  RefreshCw,
  Download,
  Mail,
  Phone,
  MapPin,
  Calendar,
  CreditCard,
  CheckCircle2,
  XCircle,
  Award,
  Wine,
  X,
  ChevronLeft,
  ChevronRight,
  FileText,
  Ticket,
  UserPlus,
  RotateCcw,
} from 'lucide-react';

export interface IwsFestivalClaim {
  lidnummer: string;
  festivalId: 'denhaag' | 'gent' | 'amsterdam';
  festivalName: string;
  orderNumber: string;
  discountCents: number;
  customerEmail?: string;
  customerName?: string;
  claimedAt: string;
}

export interface IwsConscriboMember {
  id: string;
  lidnummer: string;
  aanhef: string;
  voorletters: string;
  roepnaam: string;
  tussenvoegsel: string;
  achternaam: string;
  volledigeNaam: string;
  geboortedatum: string;
  straat: string;
  huisnummer: string;
  toevoeging: string;
  postcode: string;
  plaats: string;
  land: string;
  adresVolledig: string;
  email: string;
  telefoon: string;
  mobiel: string;
  bedrijfsnaam: string;
  typeLidmaatschap: string;
  lidSinds: string;
  eindDatum: string;
  lidmaatschapsperiode: number;
  status: 'actief' | 'verlopen';
  contributieBedrag: number;
  magazineBedrag: number;
  bottelingLuxeBedrag: number;
  glasLuxeBedrag: number;
  totaalBedrag: number;
  betaalwijze: string;
  factuurmaand: string;
  iban: string;
  bic: string;
  rekeninghouder: string;
  wcoc: boolean;
  nieuwsbrief: boolean;
  privacyAkkoord: boolean;
  iwf2026: string;
  iwf2025: string;
  iwf2024: string;
  iwf2023: string;
  bottelingLuxe2026: string;
  bottelingLuxe2025: string;
  bottelingLuxe2024: string;
  opmerkingen: string;
  isManual?: boolean;
  claim?: IwsFestivalClaim | null;
}

export interface IwsConscriboStats {
  totalMembers: number;
  activeMembers: number;
  expiredMembers: number;
  totalAnnualRevenue: number;
  averageAnnualAmount: number;
  iwf2026Count: number;
  wcocCount: number;
  claimedCount?: number;
  claimedByFestival?: {
    denhaag: number;
    gent: number;
    amsterdam: number;
  };
  byType: Record<string, number>;
  byPaymentMethod: Record<string, number>;
  lastSyncedAt: string;
}

function formatDateNl(isoDate: string): string {
  if (!isoDate || isoDate === '0000-00-00') return '—';
  const clean = isoDate.slice(0, 10);
  const parts = clean.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function formatEuro(amount: number): string {
  return `€ ${amount.toLocaleString('nl-NL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getMembershipBadgeStyle(type: string): string {
  const lower = (type || '').toLowerCase();
  if (lower.includes('luxe')) {
    return 'bg-[#774d35] text-[#fff5dc] border-[#1D1C1A]';
  }
  if (lower.includes('all-in')) {
    return 'bg-[#006448] text-white border-[#1D1C1A]';
  }
  if (lower.includes('basis')) {
    return 'bg-[#d8e7e2] text-[#006448] border-[#8ba198]';
  }
  if (lower.includes('partner')) {
    return 'bg-[#e4d5c4] text-[#1D1C1A] border-[#1D1C1A]';
  }
  if (lower.includes('erelid') || lower.includes('bestuur')) {
    return 'bg-[#1D1C1A] text-[#d5c28a] border-[#1D1C1A]';
  }
  return 'bg-[#FAF7F2] text-[#4c5752] border-[#c1d4ce]';
}

export const IwsMembersPage: React.FC = () => {
  const [members, setMembers] = useState<IwsConscriboMember[]>([]);
  const [stats, setStats] = useState<IwsConscriboStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & sorting
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedPayment, setSelectedPayment] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [claimFilter, setClaimFilter] = useState<'all' | 'available' | 'claimed'>('all');
  const [onlyIwf2026, setOnlyIwf2026] = useState<boolean>(false);
  const [onlyWcoc, setOnlyWcoc] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<
    'lidnummer_asc' | 'lidnummer_desc' | 'naam_asc' | 'sinds_asc' | 'sinds_desc' | 'bedrag_desc'
  >('lidnummer_asc');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  // Selected member for detail drawer
  const [selectedMember, setSelectedMember] = useState<IwsConscriboMember | null>(null);
  const [claimBusy, setClaimBusy] = useState<boolean>(false);

  // Add new member modal
  const [showNewMemberModal, setShowNewMemberModal] = useState<boolean>(false);
  const [newMemberSaving, setNewMemberSaving] = useState<boolean>(false);
  const [newMemberForm, setNewMemberForm] = useState({
    lidnummer: '',
    volledigeNaam: '',
    email: '',
    telefoon: '',
    straat: '',
    huisnummer: '',
    postcode: '',
    plaats: '',
    land: 'Nederland',
    typeLidmaatschap: 'All-in',
    totaalBedrag: 84.5,
  });

  const fetchMembers = async (forceRefresh = false) => {
    if (forceRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const res = await fetch(`/api/admin/iws-members${forceRefresh ? '?refresh=true' : ''}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Kon ledenbestand niet ophalen uit Conscribo.');
      }
      const nextMembers: IwsConscriboMember[] = data.members || [];
      setMembers(nextMembers);
      setStats(data.stats || null);
      if (selectedMember) {
        const updated = nextMembers.find((m) => m.lidnummer === selectedMember.lidnummer);
        if (updated) setSelectedMember(updated);
      }
    } catch (err: any) {
      setError(err.message || 'Fout bij verbinden met Conscribo API.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMembers(false);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchQuery,
    selectedType,
    selectedPayment,
    selectedStatus,
    claimFilter,
    onlyIwf2026,
    onlyWcoc,
    sortBy,
    pageSize,
  ]);

  const availableTypes = useMemo(() => {
    const types = new Set<string>();
    members.forEach((m) => {
      if (m.typeLidmaatschap) types.add(m.typeLidmaatschap);
    });
    return Array.from(types);
  }, [members]);

  const filteredMembers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    const list = members.filter((m) => {
      if (selectedType !== 'all' && m.typeLidmaatschap !== selectedType) return false;
      if (selectedPayment !== 'all' && (m.betaalwijze || 'onbekend') !== selectedPayment) return false;
      if (selectedStatus !== 'all' && m.status !== selectedStatus) return false;
      if (claimFilter === 'available' && m.claim) return false;
      if (claimFilter === 'claimed' && !m.claim) return false;
      if (onlyIwf2026 && !m.iwf2026) return false;
      if (onlyWcoc && !m.wcoc) return false;

      if (q) {
        const haystack = [
          m.lidnummer,
          `ws-${m.lidnummer}`,
          m.volledigeNaam,
          m.roepnaam,
          m.achternaam,
          m.voorletters,
          m.straat,
          m.huisnummer,
          m.postcode,
          m.plaats,
          m.email,
          m.telefoon,
          m.mobiel,
          m.iban,
          m.iwf2026,
          m.bedrijfsnaam,
          m.claim?.festivalName || '',
          m.claim?.orderNumber || '',
        ]
          .join(' ')
          .toLowerCase();

        if (!haystack.includes(q)) return false;
      }

      return true;
    });

    list.sort((a, b) => {
      if (sortBy === 'lidnummer_asc') {
        return (parseInt(a.lidnummer, 10) || 0) - (parseInt(b.lidnummer, 10) || 0);
      }
      if (sortBy === 'lidnummer_desc') {
        return (parseInt(b.lidnummer, 10) || 0) - (parseInt(a.lidnummer, 10) || 0);
      }
      if (sortBy === 'naam_asc') {
        return a.achternaam.localeCompare(b.achternaam, 'nl');
      }
      if (sortBy === 'sinds_asc') {
        return (a.lidSinds || '9999').localeCompare(b.lidSinds || '9999');
      }
      if (sortBy === 'sinds_desc') {
        return (b.lidSinds || '').localeCompare(a.lidSinds || '');
      }
      if (sortBy === 'bedrag_desc') {
        return b.totaalBedrag - a.totaalBedrag;
      }
      return 0;
    });

    return list;
  }, [
    members,
    searchQuery,
    selectedType,
    selectedPayment,
    selectedStatus,
    claimFilter,
    onlyIwf2026,
    onlyWcoc,
    sortBy,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / pageSize));
  const paginatedMembers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredMembers.slice(start, start + pageSize);
  }, [filteredMembers, currentPage, pageSize]);

  const handleManualClaim = async (lidnummer: string, festivalId: 'denhaag' | 'gent' | 'amsterdam') => {
    setClaimBusy(true);
    try {
      const res = await fetch('/api/admin/iws-members/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lidnummer,
          festivalId,
          orderNumber: 'ADMIN-CLAIM',
          customerEmail: selectedMember?.email,
          customerName: selectedMember?.volledigeNaam,
        }),
      });
      if (res.ok) {
        await fetchMembers(false);
      }
    } finally {
      setClaimBusy(false);
    }
  };

  const handleReleaseClaim = async (lidnummer: string) => {
    setClaimBusy(true);
    try {
      const res = await fetch(`/api/admin/iws-members/claim/${encodeURIComponent(lidnummer)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await fetchMembers(false);
      }
    } finally {
      setClaimBusy(false);
    }
  };

  const handleCreateManualMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberForm.lidnummer.trim() || !newMemberForm.volledigeNaam.trim()) return;
    setNewMemberSaving(true);
    try {
      const res = await fetch('/api/admin/iws-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMemberForm),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setShowNewMemberModal(false);
        setNewMemberForm({
          lidnummer: '',
          volledigeNaam: '',
          email: '',
          telefoon: '',
          straat: '',
          huisnummer: '',
          postcode: '',
          plaats: '',
          land: 'Nederland',
          typeLidmaatschap: 'All-in',
          totaalBedrag: 84.5,
        });
        await fetchMembers(false);
      }
    } finally {
      setNewMemberSaving(false);
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'Lidnummer',
      'Aanhef',
      'Voorletters',
      'Roepnaam',
      'Tussenvoegsel',
      'Achternaam',
      'Geboortedatum',
      'Straat',
      'Huisnummer',
      'Toevoeging',
      'Postcode',
      'Plaats',
      'Land',
      'E-mailadres',
      'Telefoon',
      'Mobiel',
      'Type Lidmaatschap',
      'Totaalbedrag',
      'Contributiebedrag',
      'Magazinebedrag',
      'Botteling Luxe Bedrag',
      'Glas Luxe Bedrag',
      'Betaalwijze',
      'Factuurmaand',
      'IBAN',
      'Lid Sinds',
      'Einddatum',
      'Status',
      'Gratis Ticket Claim',
      'Claim Ordernr',
      'IWF 2026',
      'WCOC',
      'Opmerkingen',
    ];

    const escapeCell = (val: unknown) => {
      const str = val === null || val === undefined ? '' : String(val);
      if (str.includes(';') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = filteredMembers.map((m) =>
      [
        m.lidnummer,
        m.aanhef,
        m.voorletters,
        m.roepnaam,
        m.tussenvoegsel,
        m.achternaam,
        m.geboortedatum,
        m.straat,
        m.huisnummer,
        m.toevoeging,
        m.postcode,
        m.plaats,
        m.land,
        m.email,
        m.telefoon,
        m.mobiel,
        m.typeLidmaatschap,
        m.totaalBedrag.toFixed(2).replace('.', ','),
        m.contributieBedrag.toFixed(2).replace('.', ','),
        m.magazineBedrag.toFixed(2).replace('.', ','),
        m.bottelingLuxeBedrag.toFixed(2).replace('.', ','),
        m.glasLuxeBedrag.toFixed(2).replace('.', ','),
        m.betaalwijze,
        m.factuurmaand,
        m.iban,
        m.lidSinds,
        m.eindDatum,
        m.status,
        m.claim ? m.claim.festivalName : 'Beschikbaar',
        m.claim ? m.claim.orderNumber : '',
        m.iwf2026,
        m.wcoc ? 'Ja' : 'Nee',
        m.opmerkingen,
      ]
        .map(escapeCell)
        .join(';')
    );

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `iws-conscribo-leden-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* 1. Header Banner */}
      <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-4 sm:p-6 shadow-[4px_4px_0px_rgba(29,28,26,0.9)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-lg bg-[#774d35] border-2 border-[#1D1C1A] shadow-[2px_2px_0px_rgba(29,28,26,0.9)] flex items-center justify-center shrink-0 text-[#fff5dc]">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#1D1C1A] tracking-tight">
                IWS Ledenbestand
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-extrabold bg-[#d8e7e2] text-[#006448] border border-[#8ba198]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#006448]"></span>
                Conscribo API Live (iws)
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-extrabold bg-[#fff5dc] text-[#774d35] border border-[#774d35]">
                1x Gratis Ticket: Den Haag €55,00 • Gent €39,50 • Amsterdam €39,95
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#4c5752] mt-0.5 font-medium">
              Stichting International Whisky Society • Leden kunnen eenmalig kiezen voor 1 gratis ticket bij Den Haag, Gent óf Amsterdam.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => setShowNewMemberModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border-2 border-[#1D1C1A] bg-[#006448] hover:bg-[#004f39] text-white shadow-[2px_2px_0px_rgba(29,28,26,0.9)] cursor-pointer text-xs font-extrabold transition-all"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>+ Nieuw IWS Lid</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={loading || filteredMembers.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border-2 border-[#1D1C1A] bg-[#FAF7F2] hover:bg-[#d8e7e2] text-[#1D1C1A] shadow-[2px_2px_0px_rgba(29,28,26,0.9)] cursor-pointer text-xs font-extrabold transition-all disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 text-[#006448]" />
            <span>Exporteer CSV ({filteredMembers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => fetchMembers(true)}
            disabled={loading || refreshing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border-2 border-[#1D1C1A] bg-[#774d35] hover:bg-[#5e3b28] text-[#fff5dc] shadow-[2px_2px_0px_rgba(29,28,26,0.9)] cursor-pointer text-xs font-extrabold transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing || loading ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Synchroniseren...' : 'Ververs uit Conscribo'}</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border-2 border-red-800 rounded-lg p-4 text-xs sm:text-sm text-red-900 font-bold flex items-center justify-between">
          <span>Fout bij laden uit Conscribo: {error}</span>
          <button
            type="button"
            onClick={() => fetchMembers(true)}
            className="px-3 py-1 bg-red-800 text-white rounded font-extrabold text-xs cursor-pointer"
          >
            Opnieuw proberen
          </button>
        </div>
      )}

      {/* 2. KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded p-4 shadow-[3px_3px_0px_rgba(29,28,26,0.9)]">
          <div className="flex items-center justify-between text-[#4c5752] mb-1">
            <span className="text-xs font-bold">Totaal IWS Leden</span>
            <Users className="w-4 h-4 text-[#774d35]" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-[#1D1C1A]">
            {stats ? stats.totalMembers.toLocaleString('nl-NL') : '—'}
          </div>
          <div className="mt-1 text-xs font-medium text-[#4c5752]">
            <span className="text-[#006448] font-bold">{stats?.activeMembers ?? 0} actief</span> •{' '}
            <span>{stats?.expiredMembers ?? 0} verlopen</span>
          </div>
        </div>

        <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded p-4 shadow-[3px_3px_0px_rgba(29,28,26,0.9)]">
          <div className="flex items-center justify-between text-[#4c5752] mb-1">
            <span className="text-xs font-bold">Jaarlijkse Contributie</span>
            <CreditCard className="w-4 h-4 text-[#006448]" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-[#006448]">
            {stats ? formatEuro(stats.totalAnnualRevenue) : '—'}
          </div>
          <div className="mt-1 text-xs font-medium text-[#4c5752]">
            Gem. {stats ? formatEuro(stats.averageAnnualAmount) : '—'} per actief lid
          </div>
        </div>

        <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded p-4 shadow-[3px_3px_0px_rgba(29,28,26,0.9)]">
          <div className="flex items-center justify-between text-[#4c5752] mb-1">
            <span className="text-xs font-bold">Verdeling Pakketten</span>
            <Award className="w-4 h-4 text-[#774d35]" />
          </div>
          <div className="text-xs font-bold text-[#1D1C1A] space-y-0.5 mt-1">
            <div className="flex justify-between">
              <span>All-in (€ 84,50):</span>
              <span className="font-extrabold text-[#006448]">{stats?.byType?.['All-in'] ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Basis / Partner (€ 67,50):</span>
              <span className="font-extrabold">
                {(stats?.byType?.['Basis'] ?? 0) + (stats?.byType?.['Partner'] ?? 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>De Luxe (€ 124,50):</span>
              <span className="font-extrabold text-[#774d35]">{stats?.byType?.['De Luxe'] ?? 0}</span>
            </div>
          </div>
        </div>

        <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded p-4 shadow-[3px_3px_0px_rgba(29,28,26,0.9)]">
          <div className="flex items-center justify-between text-[#4c5752] mb-1">
            <span className="text-xs font-bold">1x Gratis Ticket Claims</span>
            <Ticket className="w-4 h-4 text-[#006448]" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-[#1D1C1A]">
            {stats?.claimedCount ?? 0}{' '}
            <span className="text-xs font-semibold text-[#4c5752]">
              / {stats?.activeMembers ?? 0} geclaimd
            </span>
          </div>
          <div className="mt-1 text-[11px] font-bold text-[#4c5752]">
            DH: <span className="text-[#1D1C1A]">{stats?.claimedByFestival?.denhaag ?? 0}</span> • Gent:{' '}
            <span className="text-[#1D1C1A]">{stats?.claimedByFestival?.gent ?? 0}</span> • AMS:{' '}
            <span className="text-[#1D1C1A]">{stats?.claimedByFestival?.amsterdam ?? 0}</span>
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-4 shadow-[3px_3px_0px_rgba(29,28,26,0.9)] space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search input */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-[#4c5752] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Zoek op lidnr (bijv. 271 of WS-271), naam, adres, woonplaats, e-mail..."
              className="w-full pl-9 pr-8 py-2 bg-[#FAF7F2] border-2 border-[#1D1C1A] rounded text-xs font-bold text-[#1D1C1A] placeholder:text-[#4c5752]/70 focus:outline-none focus:bg-white"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#4c5752] hover:text-[#1D1C1A] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Membership Type Filter */}
          <div className="md:col-span-2">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              aria-label="Filter op lidmaatschapstype"
              className="w-full py-2 px-2.5 bg-[#FAF7F2] border-2 border-[#1D1C1A] rounded text-xs font-bold text-[#1D1C1A] cursor-pointer"
            >
              <option value="all">Alle types ({members.length})</option>
              {availableTypes.map((t) => (
                <option key={t} value={t}>
                  {t} ({stats?.byType?.[t] ?? 0})
                </option>
              ))}
            </select>
          </div>

          {/* Payment Method Filter */}
          <div className="md:col-span-2">
            <select
              value={selectedPayment}
              onChange={(e) => setSelectedPayment(e.target.value)}
              aria-label="Filter op betaalwijze"
              className="w-full py-2 px-2.5 bg-[#FAF7F2] border-2 border-[#1D1C1A] rounded text-xs font-bold text-[#1D1C1A] cursor-pointer"
            >
              <option value="all">Alle betaalwijzen</option>
              <option value="incasso">Automatische incasso</option>
              <option value="factuur">Factuur</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="md:col-span-1">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              aria-label="Filter op status"
              className="w-full py-2 px-2 bg-[#FAF7F2] border-2 border-[#1D1C1A] rounded text-xs font-bold text-[#1D1C1A] cursor-pointer"
            >
              <option value="all">Status: Alle</option>
              <option value="actief">Actief</option>
              <option value="verlopen">Verlopen</option>
            </select>
          </div>

          {/* Sorting */}
          <div className="md:col-span-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              aria-label="Sorteer leden"
              className="w-full py-2 px-2.5 bg-[#FAF7F2] border-2 border-[#1D1C1A] rounded text-xs font-bold text-[#1D1C1A] cursor-pointer"
            >
              <option value="lidnummer_asc">Lidnr. (Oplopend)</option>
              <option value="lidnummer_desc">Lidnr. (Aflopend)</option>
              <option value="naam_asc">Achternaam (A-Z)</option>
              <option value="sinds_asc">Lid sinds (Oudste eerst)</option>
              <option value="sinds_desc">Lid sinds (Nieuwste eerst)</option>
              <option value="bedrag_desc">Bedrag (Hoog - Laag)</option>
            </select>
          </div>
        </div>

        {/* Quick Toggle Chips & Counter */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#c1d4ce]">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setClaimFilter(claimFilter === 'available' ? 'all' : 'available')}
              className={`px-2.5 py-1 rounded text-[11px] font-extrabold border transition-all cursor-pointer ${
                claimFilter === 'available'
                  ? 'bg-[#006448] text-white border-[#1D1C1A]'
                  : 'bg-[#FAF7F2] text-[#4c5752] border-[#c1d4ce] hover:border-[#1D1C1A]'
              }`}
            >
              Gratis ticket nog beschikbaar
            </button>
            <button
              type="button"
              onClick={() => setClaimFilter(claimFilter === 'claimed' ? 'all' : 'claimed')}
              className={`px-2.5 py-1 rounded text-[11px] font-extrabold border transition-all cursor-pointer ${
                claimFilter === 'claimed'
                  ? 'bg-[#774d35] text-[#fff5dc] border-[#1D1C1A]'
                  : 'bg-[#FAF7F2] text-[#4c5752] border-[#c1d4ce] hover:border-[#1D1C1A]'
              }`}
            >
              Gratis ticket geclaimd ({stats?.claimedCount ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setOnlyIwf2026(!onlyIwf2026)}
              className={`px-2.5 py-1 rounded text-[11px] font-extrabold border transition-all cursor-pointer ${
                onlyIwf2026
                  ? 'bg-[#006448] text-white border-[#1D1C1A]'
                  : 'bg-[#FAF7F2] text-[#4c5752] border-[#c1d4ce] hover:border-[#1D1C1A]'
              }`}
            >
              IWF 2026 historie ({stats?.iwf2026Count ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setOnlyWcoc(!onlyWcoc)}
              className={`px-2.5 py-1 rounded text-[11px] font-extrabold border transition-all cursor-pointer ${
                onlyWcoc
                  ? 'bg-[#774d35] text-[#fff5dc] border-[#1D1C1A]'
                  : 'bg-[#FAF7F2] text-[#4c5752] border-[#c1d4ce] hover:border-[#1D1C1A]'
              }`}
            >
              WCOC Leden ({stats?.wcocCount ?? 0})
            </button>
          </div>

          <div className="text-xs font-bold text-[#4c5752]">
            Toont <span className="font-extrabold text-[#1D1C1A]">{filteredMembers.length}</span> van{' '}
            <span className="font-extrabold text-[#1D1C1A]">{members.length}</span> leden
          </div>
        </div>
      </div>

      {/* 4. Members Table */}
      <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg shadow-[4px_4px_0px_rgba(29,28,26,0.9)] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-[#774d35] animate-spin mx-auto" />
            <div className="text-sm font-extrabold text-[#1D1C1A]">
              Ledenbestand live ophalen uit Conscribo (iws)...
            </div>
            <div className="text-xs text-[#4c5752]">
              Alle leden en bijbehorende NAW-, contributie- en festivalclaimgegevens worden geladen.
            </div>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <div className="text-base font-extrabold text-[#1D1C1A]">
              Geen leden gevonden voor deze zoekopdracht
            </div>
            <p className="text-xs text-[#4c5752]">
              Pas je zoekterm of filters aan om alle leden weer te bekijken.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#FAF7F2] border-b-2 border-[#1D1C1A] text-[11px] font-extrabold uppercase tracking-wider text-[#4c5752]">
                  <th className="py-3 px-3 sm:px-4">Lidnr.</th>
                  <th className="py-3 px-3 sm:px-4">Klant & Geboortedatum</th>
                  <th className="py-3 px-3 sm:px-4">NAW / Adresgegevens</th>
                  <th className="py-3 px-3 sm:px-4">Contact</th>
                  <th className="py-3 px-3 sm:px-4">Lidmaatschap</th>
                  <th className="py-3 px-3 sm:px-4">Bedrag</th>
                  <th className="py-3 px-3 sm:px-4">1x Gratis Ticket</th>
                  <th className="py-3 px-3 sm:px-4">Lid sinds & Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c1d4ce] text-xs">
                {paginatedMembers.map((member) => {
                  const fullDisplay = [
                    member.aanhef,
                    member.voorletters,
                    member.roepnaam ? `(${member.roepnaam})` : '',
                    member.tussenvoegsel,
                    member.achternaam,
                  ]
                    .filter(Boolean)
                    .join(' ');

                  return (
                    <tr
                      key={member.id}
                      onClick={() => setSelectedMember(member)}
                      className="hover:bg-[#FAF7F2] transition-colors cursor-pointer group"
                    >
                      {/* Lidnummer */}
                      <td className="py-3 px-3 sm:px-4 align-top whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded font-extrabold text-xs bg-[#FAF7F2] border border-[#1D1C1A] text-[#1D1C1A] group-hover:bg-[#774d35] group-hover:text-[#fff5dc] transition-colors">
                          #{member.lidnummer}
                        </span>
                      </td>

                      {/* Klant & Geboortedatum */}
                      <td className="py-3 px-3 sm:px-4 align-top">
                        <div className="font-extrabold text-[#1D1C1A] group-hover:text-[#006448] flex items-center gap-1.5">
                          <span>{fullDisplay || member.volledigeNaam}</span>
                          {member.isManual && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-[#fff5dc] text-[#774d35] border border-[#774d35]">
                              Nieuw
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#4c5752] flex items-center gap-2 mt-0.5">
                          {member.geboortedatum && (
                            <span>Geb: {formatDateNl(member.geboortedatum)}</span>
                          )}
                          {member.bedrijfsnaam && (
                            <span className="text-[#774d35] font-bold">• {member.bedrijfsnaam}</span>
                          )}
                        </div>
                      </td>

                      {/* NAW / Adres */}
                      <td className="py-3 px-3 sm:px-4 align-top">
                        <div className="font-bold text-[#1D1C1A]">
                          {[member.straat, member.huisnummer, member.toevoeging].filter(Boolean).join(' ') || '—'}
                        </div>
                        <div className="text-[11px] text-[#4c5752]">
                          {[member.postcode, member.plaats].filter(Boolean).join(' ')}
                          {member.land && member.land.toLowerCase() !== 'nederland' ? ` (${member.land})` : ''}
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="py-3 px-3 sm:px-4 align-top">
                        {member.email ? (
                          <div className="font-bold text-[#1D1C1A] truncate max-w-[180px]" title={member.email}>
                            {member.email}
                          </div>
                        ) : (
                          <div className="text-[#4c5752] italic">Geen e-mail</div>
                        )}
                        <div className="text-[11px] text-[#4c5752] mt-0.5">
                          {member.mobiel || member.telefoon || '—'}
                        </div>
                      </td>

                      {/* Type Lidmaatschap & Tags */}
                      <td className="py-3 px-3 sm:px-4 align-top">
                        <div className="flex flex-wrap items-center gap-1">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-extrabold border ${getMembershipBadgeStyle(
                              member.typeLidmaatschap
                            )}`}
                          >
                            {member.typeLidmaatschap}
                          </span>
                          {member.wcoc && (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-[#d5c28a]/40 text-[#1D1C1A] border border-[#774d35]">
                              WCOC
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Bedrag & Betaalwijze */}
                      <td className="py-3 px-3 sm:px-4 align-top whitespace-nowrap">
                        <div className="font-extrabold text-sm text-[#1D1C1A]">
                          {formatEuro(member.totaalBedrag)}
                        </div>
                        <div className="text-[11px] text-[#4c5752] capitalize">
                          {member.betaalwijze || '—'}
                        </div>
                      </td>

                      {/* 1x Gratis Ticket Claim Status */}
                      <td className="py-3 px-3 sm:px-4 align-top whitespace-nowrap">
                        {member.claim ? (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-extrabold bg-[#774d35] text-[#fff5dc] border border-[#1D1C1A]">
                              Geclaimd: {member.claim.festivalName}
                            </span>
                            <div className="text-[10px] font-bold text-[#4c5752] mt-0.5">
                              {member.claim.orderNumber} (-{formatEuro(member.claim.discountCents / 100)})
                            </div>
                          </div>
                        ) : member.status === 'actief' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-extrabold bg-[#d8e7e2] text-[#006448] border border-[#8ba198]">
                            ✓ Beschikbaar (1x)
                          </span>
                        ) : (
                          <span className="text-[11px] text-[#4c5752]">Niet actief</span>
                        )}
                      </td>

                      {/* Lid sinds & Status */}
                      <td className="py-3 px-3 sm:px-4 align-top whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {member.status === 'actief' ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-[#d8e7e2] text-[#006448] border border-[#8ba198]">
                              <CheckCircle2 className="w-3 h-3" />
                              Actief
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-red-100 text-red-800 border border-red-300">
                              <XCircle className="w-3 h-3" />
                              Verlopen
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-bold text-[#1D1C1A] mt-1">
                          Sinds: {formatDateNl(member.lidSinds)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {!loading && filteredMembers.length > 0 && (
          <div className="bg-[#FAF7F2] border-t-2 border-[#1D1C1A] px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#4c5752]">
              <span>Rijen per pagina:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="px-2 py-1 bg-[#FCFAF7] border border-[#1D1C1A] rounded text-xs font-extrabold text-[#1D1C1A] cursor-pointer"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
                <option value={2000}>Alles ({filteredMembers.length})</option>
              </select>
              <span className="ml-2">
                Pagina <strong className="text-[#1D1C1A]">{currentPage}</strong> van{' '}
                <strong className="text-[#1D1C1A]">{totalPages}</strong>
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded border-2 border-[#1D1C1A] bg-[#FCFAF7] hover:bg-[#d8e7e2] text-xs font-extrabold disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Vorige</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded border-2 border-[#1D1C1A] bg-[#FCFAF7] hover:bg-[#d8e7e2] text-xs font-extrabold disabled:opacity-40 cursor-pointer"
              >
                <span>Volgende</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. Member Detail Slide-Over Drawer */}
      {selectedMember && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end animate-in fade-in duration-150"
          onClick={() => setSelectedMember(null)}
        >
          <div
            className="w-full max-w-xl bg-[#FCFAF7] border-l-2 border-[#1D1C1A] h-full overflow-y-auto p-5 sm:p-6 space-y-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="flex items-start justify-between gap-3 pb-4 border-b-2 border-[#1D1C1A]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded bg-[#774d35] text-[#fff5dc] border border-[#1D1C1A] text-xs font-extrabold">
                    Lidnr. #{selectedMember.lidnummer} (WS-{selectedMember.lidnummer})
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-extrabold border ${getMembershipBadgeStyle(
                      selectedMember.typeLidmaatschap
                    )}`}
                  >
                    {selectedMember.typeLidmaatschap}
                  </span>
                  {selectedMember.status === 'actief' ? (
                    <span className="px-2 py-0.5 rounded text-xs font-extrabold bg-[#d8e7e2] text-[#006448] border border-[#8ba198]">
                      Actief
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-xs font-extrabold bg-red-100 text-red-800 border border-red-300">
                      Verlopen
                    </span>
                  )}
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-[#1D1C1A] mt-2">
                  {[
                    selectedMember.aanhef,
                    selectedMember.voorletters,
                    selectedMember.roepnaam ? `"${selectedMember.roepnaam}"` : '',
                    selectedMember.tussenvoegsel,
                    selectedMember.achternaam,
                  ]
                    .filter(Boolean)
                    .join(' ') || selectedMember.volledigeNaam}
                </h2>
                <p className="text-xs text-[#4c5752] font-medium">
                  Conscribo Relatie-ID: #{selectedMember.id}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedMember(null)}
                className="p-2 rounded border-2 border-[#1D1C1A] bg-[#FAF7F2] hover:bg-[#d8e7e2] cursor-pointer"
              >
                <X className="w-4 h-4 text-[#1D1C1A]" />
              </button>
            </div>

            {/* Section 0: 1x Gratis Festivalticket Regeling (Cross-Festival Claim) */}
            <div className="bg-[#FAF7F2] border-2 border-[#1D1C1A] rounded-lg p-4 space-y-3 shadow-[2px_2px_0px_rgba(29,28,26,0.9)]">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#006448] flex items-center gap-1.5">
                  <Ticket className="w-3.5 h-3.5" />
                  1x Gratis Festivalticket (Keuze uit Den Haag / Gent / Amsterdam)
                </h3>
              </div>

              {selectedMember.claim ? (
                <div className="bg-[#fff5dc] border-2 border-[#774d35] rounded p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-[#774d35] text-sm">
                      ✓ Geclaimd voor {selectedMember.claim.festivalName}
                    </span>
                    <span className="font-extrabold text-[#1D1C1A]">
                      -{formatEuro(selectedMember.claim.discountCents / 100)}
                    </span>
                  </div>
                  <div className="text-[#4c5752] font-semibold">
                    Ordernummer: <strong className="text-[#1D1C1A]">{selectedMember.claim.orderNumber}</strong> •{' '}
                    Datum: <strong className="text-[#1D1C1A]">{formatDateNl(selectedMember.claim.claimedAt)}</strong>
                  </div>
                  <div className="pt-1">
                    <button
                      type="button"
                      disabled={claimBusy}
                      onClick={() => handleReleaseClaim(selectedMember.lidnummer)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border-2 border-[#1D1C1A] bg-white hover:bg-red-50 text-red-800 text-xs font-extrabold cursor-pointer disabled:opacity-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Claim vrijgeven / Resetten (zodat lid opnieuw kan bestellen)</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-[#FCFAF7] border border-[#c1d4ce] rounded p-3 space-y-2.5 text-xs">
                  <div className="font-bold text-[#006448]">
                    ✓ Dit lid heeft het eenmalige gratis ticket nog NIET ingezet.
                  </div>
                  <div className="text-[#4c5752]">
                    Het lid kan met code <strong>{selectedMember.lidnummer}</strong> of{' '}
                    <strong>WS-{selectedMember.lidnummer}</strong> eenmalig 1 gratis ticket bestellen bij één van de 3 festivals:
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      disabled={claimBusy}
                      onClick={() => handleManualClaim(selectedMember.lidnummer, 'denhaag')}
                      className="px-2.5 py-1.5 rounded border border-[#1D1C1A] bg-[#FAF7F2] hover:bg-[#d8e7e2] text-[11px] font-extrabold text-[#1D1C1A] cursor-pointer"
                    >
                      Markeer geclaimd: Den Haag (€55,00)
                    </button>
                    <button
                      type="button"
                      disabled={claimBusy}
                      onClick={() => handleManualClaim(selectedMember.lidnummer, 'gent')}
                      className="px-2.5 py-1.5 rounded border border-[#1D1C1A] bg-[#FAF7F2] hover:bg-[#d8e7e2] text-[11px] font-extrabold text-[#1D1C1A] cursor-pointer"
                    >
                      Markeer geclaimd: Gent (€39,50)
                    </button>
                    <button
                      type="button"
                      disabled={claimBusy}
                      onClick={() => handleManualClaim(selectedMember.lidnummer, 'amsterdam')}
                      className="px-2.5 py-1.5 rounded border border-[#1D1C1A] bg-[#FAF7F2] hover:bg-[#d8e7e2] text-[11px] font-extrabold text-[#1D1C1A] cursor-pointer"
                    >
                      Markeer geclaimd: Amsterdam (€39,95)
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Section 1: NAW & Contactgegevens */}
            <div className="bg-[#FAF7F2] border-2 border-[#1D1C1A] rounded-lg p-4 space-y-3 shadow-[2px_2px_0px_rgba(29,28,26,0.9)]">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#774d35] flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                NAW & Contactgegevens
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-[#4c5752] font-semibold">Volledige naam</div>
                  <div className="font-extrabold text-[#1D1C1A]">{selectedMember.volledigeNaam || '—'}</div>
                </div>
                <div>
                  <div className="text-[#4c5752] font-semibold">Roepnaam</div>
                  <div className="font-extrabold text-[#1D1C1A]">{selectedMember.roepnaam || '—'}</div>
                </div>
                <div>
                  <div className="text-[#4c5752] font-semibold">Geboortedatum</div>
                  <div className="font-extrabold text-[#1D1C1A]">{formatDateNl(selectedMember.geboortedatum)}</div>
                </div>
                <div>
                  <div className="text-[#4c5752] font-semibold">Organisatie / Bedrijf</div>
                  <div className="font-extrabold text-[#1D1C1A]">{selectedMember.bedrijfsnaam || '—'}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-[#4c5752] font-semibold">Adres</div>
                  <div className="font-extrabold text-[#1D1C1A]">
                    {[selectedMember.straat, selectedMember.huisnummer, selectedMember.toevoeging]
                      .filter(Boolean)
                      .join(' ') || '—'}
                  </div>
                  <div className="font-bold text-[#1D1C1A]">
                    {[selectedMember.postcode, selectedMember.plaats, selectedMember.land].filter(Boolean).join(', ')}
                  </div>
                </div>
                <div>
                  <div className="text-[#4c5752] font-semibold flex items-center gap-1">
                    <Mail className="w-3 h-3" /> E-mailadres
                  </div>
                  {selectedMember.email ? (
                    <a
                      href={`mailto:${selectedMember.email}`}
                      className="font-extrabold text-[#006448] hover:underline break-all"
                    >
                      {selectedMember.email}
                    </a>
                  ) : (
                    <div className="font-bold text-[#4c5752]">—</div>
                  )}
                </div>
                <div>
                  <div className="text-[#4c5752] font-semibold flex items-center gap-1">
                    <Phone className="w-3 h-3" /> Telefoon / Mobiel
                  </div>
                  <div className="font-extrabold text-[#1D1C1A]">
                    {[selectedMember.mobiel, selectedMember.telefoon].filter(Boolean).join(' / ') || '—'}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Financieel & Contributie */}
            <div className="bg-[#FAF7F2] border-2 border-[#1D1C1A] rounded-lg p-4 space-y-3 shadow-[2px_2px_0px_rgba(29,28,26,0.9)]">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#006448] flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5" />
                Contributie & Betaalgegevens
              </h3>
              <div className="bg-[#FCFAF7] border border-[#c1d4ce] rounded p-3 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#4c5752] font-semibold">Basis contributiebedrag:</span>
                  <span className="font-bold text-[#1D1C1A]">{formatEuro(selectedMember.contributieBedrag)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#4c5752] font-semibold">Whisky Passion magazinebedrag:</span>
                  <span className="font-bold text-[#1D1C1A]">{formatEuro(selectedMember.magazineBedrag)}</span>
                </div>
                {(selectedMember.bottelingLuxeBedrag > 0 || selectedMember.glasLuxeBedrag > 0) && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-[#4c5752] font-semibold">Botteling De Luxe:</span>
                      <span className="font-bold text-[#1D1C1A]">{formatEuro(selectedMember.bottelingLuxeBedrag)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#4c5752] font-semibold">Glas & Lanyard De Luxe:</span>
                      <span className="font-bold text-[#1D1C1A]">{formatEuro(selectedMember.glasLuxeBedrag)}</span>
                    </div>
                  </>
                )}
                <div className="border-t border-[#c1d4ce] pt-1.5 flex justify-between text-sm font-extrabold text-[#006448]">
                  <span>Totaal Jaarbedrag:</span>
                  <span>{formatEuro(selectedMember.totaalBedrag)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-[#4c5752] font-semibold">Betaalwijze</div>
                  <div className="font-extrabold text-[#1D1C1A] capitalize">{selectedMember.betaalwijze || '—'}</div>
                </div>
                <div>
                  <div className="text-[#4c5752] font-semibold">Factuurmaand</div>
                  <div className="font-extrabold text-[#1D1C1A]">{selectedMember.factuurmaand || '—'}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-[#4c5752] font-semibold">IBAN / Bankrekening</div>
                  <div className="font-extrabold text-[#1D1C1A]">
                    {selectedMember.iban || '—'}
                    {selectedMember.bic ? ` (${selectedMember.bic})` : ''}
                    {selectedMember.rekeninghouder ? ` — t.n.v. ${selectedMember.rekeninghouder}` : ''}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Lidmaatschap Looptijd & Festival Historie */}
            <div className="bg-[#FAF7F2] border-2 border-[#1D1C1A] rounded-lg p-4 space-y-3 shadow-[2px_2px_0px_rgba(29,28,26,0.9)]">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#1D1C1A] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#774d35]" />
                Lidmaatschap, IWF Historie & Bottelingen
              </h3>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-[#FCFAF7] border border-[#c1d4ce] rounded p-2.5">
                  <div className="text-[#4c5752] text-[11px] font-semibold">Lid sinds</div>
                  <div className="font-extrabold text-[#1D1C1A] mt-0.5">{formatDateNl(selectedMember.lidSinds)}</div>
                </div>
                <div className="bg-[#FCFAF7] border border-[#c1d4ce] rounded p-2.5">
                  <div className="text-[#4c5752] text-[11px] font-semibold">Einddatum</div>
                  <div className="font-extrabold text-[#1D1C1A] mt-0.5">{formatDateNl(selectedMember.eindDatum)}</div>
                </div>
                <div className="bg-[#FCFAF7] border border-[#c1d4ce] rounded p-2.5">
                  <div className="text-[#4c5752] text-[11px] font-semibold">WCOC Lid</div>
                  <div className="font-extrabold text-[#1D1C1A] mt-0.5">
                    {selectedMember.wcoc ? 'Ja (Deelnemer)' : 'Nee'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-[#FCFAF7] border border-[#c1d4ce] rounded p-2.5">
                  <div className="text-[#4c5752] text-[11px] font-semibold">IWF 2026</div>
                  <div className="font-extrabold text-[#006448] mt-0.5">{selectedMember.iwf2026 || '—'}</div>
                </div>
                <div className="bg-[#FCFAF7] border border-[#c1d4ce] rounded p-2.5">
                  <div className="text-[#4c5752] text-[11px] font-semibold">IWF 2025</div>
                  <div className="font-extrabold text-[#1D1C1A] mt-0.5">{selectedMember.iwf2025 || '—'}</div>
                </div>
              </div>

              {selectedMember.opmerkingen && (
                <div className="bg-[#fff5dc] border border-[#774d35] rounded p-3 text-xs">
                  <div className="font-extrabold text-[#774d35] flex items-center gap-1 mb-1">
                    <FileText className="w-3.5 h-3.5" />
                    Opmerkingen:
                  </div>
                  <div className="text-[#1D1C1A] font-medium whitespace-pre-wrap">{selectedMember.opmerkingen}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. New IWS Member Modal */}
      {showNewMemberModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowNewMemberModal(false)}
        >
          <div
            className="w-full max-w-md bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-5 shadow-[6px_6px_0px_rgba(29,28,26,0.9)] space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b-2 border-[#1D1C1A] pb-3">
              <h3 className="text-base font-extrabold text-[#1D1C1A] flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-[#006448]" />
                Nieuw IWS-lid toevoegen
              </h3>
              <button
                type="button"
                onClick={() => setShowNewMemberModal(false)}
                className="p-1 rounded border border-[#1D1C1A] bg-[#FAF7F2] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#4c5752]">
              Leden die in Conscribo worden ingeschreven werken automatisch realtime. Gebruik dit formulier alleen voor pas aangemelde leden die nog niet in Conscribo zijn verwerkt.
            </p>

            <form onSubmit={handleCreateManualMember} className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-extrabold text-[#1D1C1A] mb-1">Lidnummer *</label>
                  <input
                    type="text"
                    required
                    placeholder="bijv. 2850"
                    value={newMemberForm.lidnummer}
                    onChange={(e) => setNewMemberForm({ ...newMemberForm, lidnummer: e.target.value })}
                    className="w-full px-2.5 py-2 bg-[#FAF7F2] border-2 border-[#1D1C1A] rounded font-bold"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block font-extrabold text-[#1D1C1A] mb-1">Volledige Naam *</label>
                  <input
                    type="text"
                    required
                    placeholder="Voor- en achternaam"
                    value={newMemberForm.volledigeNaam}
                    onChange={(e) => setNewMemberForm({ ...newMemberForm, volledigeNaam: e.target.value })}
                    className="w-full px-2.5 py-2 bg-[#FAF7F2] border-2 border-[#1D1C1A] rounded font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-extrabold text-[#1D1C1A] mb-1">E-mailadres</label>
                  <input
                    type="email"
                    placeholder="naam@voorbeeld.nl"
                    value={newMemberForm.email}
                    onChange={(e) => setNewMemberForm({ ...newMemberForm, email: e.target.value })}
                    className="w-full px-2.5 py-2 bg-[#FAF7F2] border-2 border-[#1D1C1A] rounded font-bold"
                  />
                </div>
                <div>
                  <label className="block font-extrabold text-[#1D1C1A] mb-1">Telefoon</label>
                  <input
                    type="text"
                    placeholder="06-..."
                    value={newMemberForm.telefoon}
                    onChange={(e) => setNewMemberForm({ ...newMemberForm, telefoon: e.target.value })}
                    className="w-full px-2.5 py-2 bg-[#FAF7F2] border-2 border-[#1D1C1A] rounded font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-extrabold text-[#1D1C1A] mb-1">Pakket</label>
                  <select
                    value={newMemberForm.typeLidmaatschap}
                    onChange={(e) => {
                      const val = e.target.value;
                      const bedrag = val === 'De Luxe' ? 124.5 : val === 'All-in' ? 84.5 : 67.5;
                      setNewMemberForm({ ...newMemberForm, typeLidmaatschap: val, totaalBedrag: bedrag });
                    }}
                    className="w-full px-2.5 py-2 bg-[#FAF7F2] border-2 border-[#1D1C1A] rounded font-bold"
                  >
                    <option value="All-in">All-in (€ 84,50)</option>
                    <option value="Basis">Basis (€ 67,50)</option>
                    <option value="Partner">Partner (€ 67,50)</option>
                    <option value="De Luxe">De Luxe (€ 124,50)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-extrabold text-[#1D1C1A] mb-1">Woonplaats</label>
                  <input
                    type="text"
                    placeholder="bijv. Den Haag"
                    value={newMemberForm.plaats}
                    onChange={(e) => setNewMemberForm({ ...newMemberForm, plaats: e.target.value })}
                    className="w-full px-2.5 py-2 bg-[#FAF7F2] border-2 border-[#1D1C1A] rounded font-bold"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewMemberModal(false)}
                  className="px-3.5 py-2 rounded border-2 border-[#1D1C1A] bg-[#FAF7F2] font-extrabold cursor-pointer"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  disabled={newMemberSaving}
                  className="px-4 py-2 rounded border-2 border-[#1D1C1A] bg-[#006448] text-white font-extrabold cursor-pointer shadow-[2px_2px_0px_rgba(29,28,26,0.9)]"
                >
                  {newMemberSaving ? 'Opslaan...' : 'Lid toevoegen & activeren'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
