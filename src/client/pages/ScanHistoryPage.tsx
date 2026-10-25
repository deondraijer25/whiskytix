import React, { useState, useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  CheckCircle2,
  AlertOctagon,
  AlertTriangle,
  Clock,
  Trash2,
} from 'lucide-react';
import { getStoredScans, clearStoredScans, ScanRecord } from '../data/scannerStore';
import { INITIAL_FESTIVALS } from '../data/mockData';

const HISTORY_THEMES: Record<
  string,
  {
    headerBg: string;
    primaryBg: string;
    primaryHover: string;
    badgeBg: string;
    badgeText: string;
  }
> = {
  gent: {
    headerBg: 'bg-[#1E3A8A]',
    primaryBg: 'bg-[#1E3A8A]',
    primaryHover: 'hover:bg-[#172554]',
    badgeBg: 'bg-[#EBF3FB]',
    badgeText: 'text-[#1E3A8A]',
  },
  denhaag: {
    headerBg: 'bg-[#006448]',
    primaryBg: 'bg-[#006448]',
    primaryHover: 'hover:bg-[#00503a]',
    badgeBg: 'bg-[#d8e7e2]',
    badgeText: 'text-[#006448]',
  },
  amsterdam: {
    headerBg: 'bg-[#8C0223]',
    primaryBg: 'bg-[#8C0223]',
    primaryHover: 'hover:bg-[#6c011b]',
    badgeBg: 'bg-[#FCE8EC]',
    badgeText: 'text-[#8C0223]',
  },
};

export const ScanHistoryPage: React.FC = () => {
  const { cityId } = useParams<{ cityId?: string }>();
  const [searchParams] = useSearchParams();
  const festivalParam = cityId || searchParams.get('festival') || 'denhaag';
  const currentFestival =
    INITIAL_FESTIVALS.find((f) => f.id === festivalParam) || INITIAL_FESTIVALS[0];
  const theme = HISTORY_THEMES[currentFestival.id] || HISTORY_THEMES.denhaag;

  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'valid' | 'duplicate' | 'wrong_session'>(
    'all'
  );

  useEffect(() => {
    setScans(getStoredScans());
  }, []);

  const handleClearHistory = () => {
    if (
      window.confirm(
        'Weet je zeker dat je de lokale scangeschiedenis van dit apparaat wilt wissen?'
      )
    ) {
      clearStoredScans();
      setScans([]);
    }
  };

  const filteredScans = scans.filter((s) => {
    const matchesStatus = statusFilter === 'all' ? true : s.status === statusFilter;
    const matchesSearch =
      !searchQuery ||
      s.attendeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.ticketCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.sessionTitle.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const validCount = scans.filter((s) => s.status === 'valid').length;
  const duplicateCount = scans.filter((s) => s.status === 'duplicate').length;
  const wrongCount = scans.filter((s) => s.status === 'wrong_session').length;
  const scannerUrl = `/admin/festival/${currentFestival.id}/scan`;

  return (
    <div className="min-h-screen bg-[#FAF7F2] bg-parchment-pattern text-[#1D1C1A] font-sans flex flex-col pb-8">
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col">
        {/* 1. Festival Header */}
        <header
          className={`${theme.headerBg} text-white px-4 py-3.5 border-b-2 border-[#1D1C1A] sticky top-0 z-40 shadow-sm`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                to={scannerUrl}
                className="w-9 h-9 rounded-lg bg-[#FCFAF7] text-[#1D1C1A] border-2 border-[#1D1C1A] shadow-[2px_2px_0px_rgba(29,28,26,0.9)] flex items-center justify-center shrink-0 hover:bg-[#FAF7F2] transition-colors"
                title="Terug naar scanner"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>

              <div className="min-w-0">
                <h1 className="text-sm font-extrabold text-white truncate">
                  Scangeschiedenis {currentFestival.city}
                </h1>
                <p className="text-xs text-white/85 font-medium truncate">
                  {currentFestival.name} · {currentFestival.location}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClearHistory}
              className="w-9 h-9 rounded-lg bg-[#FCFAF7] text-red-800 hover:bg-red-50 border-2 border-[#1D1C1A] shadow-[2px_2px_0px_rgba(29,28,26,0.9)] flex items-center justify-center transition-colors shrink-0 cursor-pointer"
              title="Geschiedenis wissen"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* 2. Key Stats Strip */}
        <div className="px-4 pt-4">
          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="p-3 rounded-xl bg-[#FCFAF7] border-2 border-[#1D1C1A] shadow-[2px_2px_0px_rgba(29,28,26,0.9)]">
              <span className="text-xs font-bold text-[#4c5752] block">Totaal</span>
              <span className="text-xl font-black text-[#1D1C1A] tabular-nums mt-0.5 block">
                {scans.length}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#FCFAF7] border-2 border-[#1D1C1A] shadow-[2px_2px_0px_rgba(29,28,26,0.9)]">
              <span className="text-xs font-bold text-[#006448] block">Geldig</span>
              <span className="text-xl font-black text-[#006448] tabular-nums mt-0.5 block">
                {validCount}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#FCFAF7] border-2 border-[#1D1C1A] shadow-[2px_2px_0px_rgba(29,28,26,0.9)]">
              <span className="text-xs font-bold text-red-800 block">Duplicaat</span>
              <span className="text-xl font-black text-red-800 tabular-nums mt-0.5 block">
                {duplicateCount}
              </span>
            </div>
          </div>
        </div>

        {/* 3. Search & Filter Bar */}
        <div className="p-4 space-y-3">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Zoek op naam of #WF code..."
              className="w-full py-2.5 pl-9 pr-4 bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg text-xs font-medium text-[#1D1C1A] placeholder-[#4c5752] focus:outline-none"
            />
            <Search className="w-3.5 h-3.5 text-[#4c5752] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-extrabold border-2 transition-all shrink-0 cursor-pointer ${
                statusFilter === 'all'
                  ? `${theme.primaryBg} text-white border-[#1D1C1A] shadow-[2px_2px_0px_rgba(29,28,26,0.9)]`
                  : 'bg-[#FCFAF7] text-[#4c5752] border-[#c1d4ce] hover:text-[#1D1C1A]'
              }`}
            >
              Alles ({scans.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('valid')}
              className={`px-3 py-1.5 rounded-lg font-extrabold border-2 transition-all shrink-0 cursor-pointer ${
                statusFilter === 'valid'
                  ? 'bg-[#006448] text-white border-[#1D1C1A] shadow-[2px_2px_0px_rgba(29,28,26,0.9)]'
                  : 'bg-[#FCFAF7] text-[#4c5752] border-[#c1d4ce] hover:text-[#1D1C1A]'
              }`}
            >
              Geldig ({validCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('duplicate')}
              className={`px-3 py-1.5 rounded-lg font-extrabold border-2 transition-all shrink-0 cursor-pointer ${
                statusFilter === 'duplicate'
                  ? 'bg-red-700 text-white border-[#1D1C1A] shadow-[2px_2px_0px_rgba(29,28,26,0.9)]'
                  : 'bg-[#FCFAF7] text-[#4c5752] border-[#c1d4ce] hover:text-[#1D1C1A]'
              }`}
            >
              Duplicaat ({duplicateCount})
            </button>
            {wrongCount > 0 && (
              <button
                type="button"
                onClick={() => setStatusFilter('wrong_session')}
                className={`px-3 py-1.5 rounded-lg font-extrabold border-2 transition-all shrink-0 cursor-pointer ${
                  statusFilter === 'wrong_session'
                    ? 'bg-amber-600 text-white border-[#1D1C1A] shadow-[2px_2px_0px_rgba(29,28,26,0.9)]'
                    : 'bg-[#FCFAF7] text-[#4c5752] border-[#c1d4ce] hover:text-[#1D1C1A]'
                }`}
              >
                Foute sessie ({wrongCount})
              </button>
            )}
          </div>
        </div>

        {/* 4. History List */}
        <main className="flex-1 px-4 space-y-2.5">
          {filteredScans.length === 0 ? (
            <div className="text-center py-10 bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-xl text-[#4c5752] text-xs space-y-2 shadow-[2px_2px_0px_rgba(29,28,26,0.9)]">
              <Clock className="w-6 h-6 mx-auto text-[#4c5752]" />
              <p className="font-bold">Geen scans gevonden.</p>
            </div>
          ) : (
            filteredScans.map((scan) => (
              <div
                key={scan.id}
                className={`p-3.5 rounded-xl border-2 border-[#1D1C1A] shadow-[2px_2px_0px_rgba(29,28,26,0.9)] ${
                  scan.status === 'valid'
                    ? 'bg-[#FCFAF7]'
                    : scan.status === 'duplicate'
                    ? 'bg-red-50'
                    : 'bg-amber-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg border border-[#1D1C1A] flex items-center justify-center shrink-0 mt-0.5 ${
                        scan.status === 'valid'
                          ? 'bg-[#006448] text-white'
                          : scan.status === 'duplicate'
                          ? 'bg-red-700 text-white'
                          : 'bg-amber-600 text-white'
                      }`}
                    >
                      {scan.status === 'valid' && <CheckCircle2 className="w-4 h-4" />}
                      {scan.status === 'duplicate' && <AlertOctagon className="w-4 h-4" />}
                      {scan.status === 'wrong_session' && <AlertTriangle className="w-4 h-4" />}
                    </div>

                    <div className="min-w-0">
                      <h3 className="text-sm font-extrabold text-[#1D1C1A] truncate">
                        {scan.attendeeName}
                      </h3>
                      <p className="text-xs text-[#4c5752] mt-0.5 truncate">
                        <span className="font-mono font-bold">{scan.ticketCode}</span> ·{' '}
                        {scan.sessionTitle}
                      </p>
                      <p className="text-xs text-[#4c5752] mt-1">{scan.detail}</p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold text-[#1D1C1A] block">{scan.scannedAt}</span>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded border border-[#1D1C1A] mt-1 inline-block ${
                        scan.status === 'valid'
                          ? 'bg-[#d8e7e2] text-[#006448]'
                          : scan.status === 'duplicate'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {scan.status === 'valid'
                        ? 'Geldig'
                        : scan.status === 'duplicate'
                        ? 'Duplicaat'
                        : 'Foute sessie'}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </main>

        {/* 5. Return to Camera CTA */}
        <div className="sticky bottom-4 px-4 pt-4">
          <Link
            to={scannerUrl}
            className={`w-full py-3 rounded-xl ${theme.primaryBg} ${theme.primaryHover} text-white font-extrabold text-xs border-2 border-[#1D1C1A] shadow-[3px_3px_0px_rgba(29,28,26,0.9)] flex items-center justify-center gap-2 transition-all`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Terug naar scanner {currentFestival.city}</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ScanHistoryPage;
