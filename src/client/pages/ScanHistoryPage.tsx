import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  CheckCircle2,
  AlertOctagon,
  AlertTriangle,
  RotateCcw,
  Clock,
  Filter,
  ShieldCheck,
  Trash2,
  Download
} from 'lucide-react';
import { getStoredScans, clearStoredScans, ScanRecord } from '../data/scannerStore';
import { INITIAL_FESTIVALS } from '../data/mockData';

export const ScanHistoryPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const festivalParam = searchParams.get('festival') || 'denhaag';
  const currentFestival =
    INITIAL_FESTIVALS.find((f) => f.id === festivalParam) || INITIAL_FESTIVALS[0];

  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'valid' | 'duplicate' | 'wrong_session'>('all');

  useEffect(() => {
    setScans(getStoredScans());
  }, []);

  const handleClearHistory = () => {
    if (window.confirm('Weet je zeker dat je de lokale scangeschiedenis van dit apparaat wilt wissen?')) {
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

  return (
    <div className="min-h-screen bg-[#0F0E0D] text-[#FAF7F2] flex flex-col font-sans max-w-md mx-auto relative select-none shadow-2xl pb-8">
      {/* 1. Sleek Header */}
      <header className="bg-[#171614] border-b border-[#24221F] px-4 py-3 sticky top-0 z-40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to={`/scan?festival=${festivalParam}`}
              className="w-9 h-9 rounded-xl bg-[#24221F] hover:bg-[#2C2925] flex items-center justify-center text-stone-300 hover:text-white transition-colors border border-white/5 active:scale-95"
              title="Terug naar Camera Scanner"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>

            <div>
              <h1 className="text-sm font-extrabold text-white tracking-tight flex items-center gap-1.5">
                Scangeschiedenis
              </h1>
              <p className="text-[11px] text-[#caac8e] font-medium">
                {currentFestival.location} • Ingang
              </p>
            </div>
          </div>

          <button
            onClick={handleClearHistory}
            className="w-8 h-8 rounded-lg bg-[#24221F] text-stone-400 hover:text-red-400 flex items-center justify-center transition-colors border border-white/5"
            title="Geschiedenis wissen"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* 2. Key Stats Strip */}
      <div className="bg-[#141311] border-b border-[#24221F] px-4 py-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2.5 rounded-xl bg-[#1C1A17] border border-white/5">
            <span className="text-[10px] uppercase font-bold text-stone-400 block tracking-wider">
              Totaal
            </span>
            <span className="text-base font-black text-white">{scans.length}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-800/30">
            <span className="text-[10px] uppercase font-bold text-emerald-400 block tracking-wider">
              Geldig
            </span>
            <span className="text-base font-black text-emerald-300">{validCount}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-red-950/20 border border-red-800/30">
            <span className="text-[10px] uppercase font-bold text-red-400 block tracking-wider">
              Duplicaat
            </span>
            <span className="text-base font-black text-red-300">{duplicateCount}</span>
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
            placeholder="Zoek bezoeker of #WF code..."
            className="w-full py-2.5 pl-9 pr-4 bg-[#1C1A17] border border-white/10 rounded-xl text-xs text-white placeholder-stone-500 focus:outline-none focus:border-[#caac8e]"
          />
          <Search className="w-3.5 h-3.5 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-[11px]">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all shrink-0 ${
              statusFilter === 'all'
                ? 'bg-[#caac8e] text-black font-extrabold shadow'
                : 'bg-[#1C1A17] text-stone-400 border border-white/5'
            }`}
          >
            Alles ({scans.length})
          </button>
          <button
            onClick={() => setStatusFilter('valid')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all shrink-0 ${
              statusFilter === 'valid'
                ? 'bg-emerald-600 text-white font-extrabold'
                : 'bg-[#1C1A17] text-stone-400 border border-white/5'
            }`}
          >
            Geldig ({validCount})
          </button>
          <button
            onClick={() => setStatusFilter('duplicate')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all shrink-0 ${
              statusFilter === 'duplicate'
                ? 'bg-red-700 text-white font-extrabold'
                : 'bg-[#1C1A17] text-stone-400 border border-white/5'
            }`}
          >
            Duplicaat ({duplicateCount})
          </button>
          {wrongCount > 0 && (
            <button
              onClick={() => setStatusFilter('wrong_session')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all shrink-0 ${
                statusFilter === 'wrong_session'
                  ? 'bg-amber-600 text-white font-extrabold'
                  : 'bg-[#1C1A17] text-stone-400 border border-white/5'
              }`}
            >
              Sessie Alert ({wrongCount})
            </button>
          )}
        </div>
      </div>

      {/* 4. History List */}
      <main className="flex-1 px-4 space-y-2">
        {filteredScans.length === 0 ? (
          <div className="text-center py-12 text-stone-500 text-xs space-y-2">
            <Clock className="w-8 h-8 mx-auto opacity-30" />
            <p>Geen scans gevonden die voldoen aan het filter.</p>
          </div>
        ) : (
          filteredScans.map((scan) => (
            <div
              key={scan.id}
              className={`p-3.5 rounded-xl border transition-all ${
                scan.status === 'valid'
                  ? 'bg-[#141311] border-white/5 text-white'
                  : scan.status === 'duplicate'
                  ? 'bg-red-950/30 border-red-800/40 text-red-100'
                  : 'bg-amber-950/30 border-amber-800/40 text-amber-100'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      scan.status === 'valid'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                        : scan.status === 'duplicate'
                        ? 'bg-red-900 text-red-200'
                        : 'bg-amber-900 text-amber-200'
                    }`}
                  >
                    {scan.status === 'valid' && <CheckCircle2 className="w-4 h-4" />}
                    {scan.status === 'duplicate' && <AlertOctagon className="w-4 h-4" />}
                    {scan.status === 'wrong_session' && <AlertTriangle className="w-4 h-4" />}
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-white leading-tight">
                      {scan.attendeeName}
                    </h3>
                    <p className="text-[11px] text-stone-400 font-mono mt-0.5">
                      {scan.ticketCode} • {scan.sessionTitle}
                    </p>
                    <p className="text-[10px] text-stone-500 mt-1">
                      {scan.detail}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-mono font-bold text-stone-300 block">
                    {scan.scannedAt}
                  </span>
                  <span
                    className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded mt-1 inline-block ${
                      scan.status === 'valid'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-700/50'
                        : scan.status === 'duplicate'
                        ? 'bg-red-900/60 text-red-300 border border-red-700/50'
                        : 'bg-amber-900/60 text-amber-300 border border-amber-700/50'
                    }`}
                  >
                    {scan.status === 'valid'
                      ? 'Entree'
                      : scan.status === 'duplicate'
                      ? 'Duplicaat'
                      : 'Sessie Alert'}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </main>

      {/* 5. Return to Camera Floating CTA */}
      <div className="sticky bottom-4 px-4 pt-2">
        <Link
          to={`/scan?festival=${festivalParam}`}
          className="w-full py-3.5 rounded-xl bg-[#006448] hover:bg-[#007a58] text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl active:scale-[0.98] transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Terug naar Live Scanner</span>
        </Link>
      </div>
    </div>
  );
};

export default ScanHistoryPage;
