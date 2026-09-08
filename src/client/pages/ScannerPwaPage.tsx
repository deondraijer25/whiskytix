import React, { useState } from 'react';
import { QrCode, Flashlight, Search, Wifi, WifiOff, Battery, Volume2, ArrowLeft, CheckCircle2, AlertOctagon, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { INITIAL_FESTIVALS } from '../data/mockData';

export const ScannerPwaPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const festivalParam = searchParams.get('festival') || 'denhaag';
  const currentFestival =
    INITIAL_FESTIVALS.find((f) => f.id === festivalParam) || INITIAL_FESTIVALS[0];

  const [torchOn, setTorchOn] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [scanCount, setScanCount] = useState(342);
  const [lastScanResult, setLastScanResult] = useState<{
    type: 'valid' | 'duplicate' | 'wrong_session';
    title: string;
    detail: string;
  } | null>(null);

  const [manualSearchOpen, setManualSearchOpen] = useState(false);
  const [manualQuery, setManualQuery] = useState('');

  // Audio tone generator using Web Audio API
  const playSound = (type: 'valid' | 'duplicate' | 'wrong_session') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      if (type === 'valid') {
        // High crisp beep
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
        osc.frequency.setValueAtTime(1174.66, audioCtx.currentTime + 0.08); // D6 note
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.25);

        // Haptic feedback
        if (navigator.vibrate) navigator.vibrate(80);
      } else if (type === 'duplicate') {
        // Low double buzz
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(130, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.35, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);

        if (navigator.vibrate) navigator.vibrate([150, 80, 150]);
      } else {
        // Warning warble
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        osc.frequency.setValueAtTime(330, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);

        if (navigator.vibrate) navigator.vibrate(200);
      }
    } catch (e) {
      console.log('Audio requires user gesture', e);
    }
  };

  const simulateScan = (type: 'valid' | 'duplicate' | 'wrong_session') => {
    playSound(type);

    if (type === 'valid') {
      setScanCount((c) => c + 1);
      setLastScanResult({
        type: 'valid',
        title: 'GELDIG TICKET: Deon Draijer',
        detail: 'VIP Jubileum Vrijdag • Entree Verleend • Geniet van het festival!',
      });
    } else if (type === 'duplicate') {
      setLastScanResult({
        type: 'duplicate',
        title: 'AL GESCAND! (DUPLICAAT ALERT)',
        detail: 'Reeds ingecheckt om 13:14 uur bij Deur 1 door scanner Vrijwilliger #3.',
      });
    } else {
      setLastScanResult({
        type: 'wrong_session',
        title: 'VERKEERDE SESSIE OF DAG!',
        detail: 'Dit ticket is geldig voor ZATERDAGAVOND, niet voor de huidige sessie.',
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#141210] text-[#FAF7F2] flex flex-col font-sans max-w-md mx-auto border-x-2 border-[#1D1C1A] shadow-2xl relative select-none pb-8 sm:pb-4">
      {/* PWA Mobile Header */}
      <div className="bg-[#1D1C1A] border-b-2 border-[#006448] p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to={festivalParam ? `/admin/festival/${festivalParam}/door` : '/admin'}
            className="p-1.5 rounded bg-black/40 text-gray-300 hover:text-white"
            title="Terug naar Festival Hub"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-[#006448] p-1 border border-[#caac8e]">
              <img src="/logo-white.svg" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="font-extrabold text-sm tracking-tight text-white flex items-center gap-1.5">
                WHISKYTIX SCANNER
              </h1>
              <p className="text-[10px] text-[#caac8e] font-bold">
                {currentFestival.location} • Ingang
              </p>
            </div>
          </div>
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setIsOnline(!isOnline)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
              isOnline ? 'bg-emerald-950 text-emerald-400 border border-emerald-600' : 'bg-amber-950 text-amber-400 border border-amber-600'
            }`}
            title="Klik om Offline Blackout Mode te testen"
          >
            {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            <span>{isOnline ? 'Online' : 'Offline'}</span>
          </button>
          <div className="flex items-center text-gray-400">
            <Battery className="w-4 h-4 text-emerald-500" />
          </div>
        </div>
      </div>

      {/* Main Scanner Body */}
      <div className="flex-1 p-4 flex flex-col justify-between space-y-4">
        {/* Camera Viewfinder Simulator Box */}
        <div className="relative bg-[#0d0c0a] border-2 border-[#006448] rounded-xl h-72 flex flex-col items-center justify-center overflow-hidden shadow-inner">
          {/* Viewfinder Target Corner Overlays */}
          <div className="absolute top-4 left-4 w-8 h-8 border-t-4 border-l-4 border-[#caac8e]"></div>
          <div className="absolute top-4 right-4 w-8 h-8 border-t-4 border-r-4 border-[#caac8e]"></div>
          <div className="absolute bottom-4 left-4 w-8 h-8 border-b-4 border-l-4 border-[#caac8e]"></div>
          <div className="absolute bottom-4 right-4 w-8 h-8 border-b-4 border-r-4 border-[#caac8e]"></div>

          {/* Animated Laser Scanning Line */}
          <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-0.5 bg-red-500 shadow-[0_0_8px_#ef4444] animate-pulse"></div>

          {/* Viewfinder Center Prompt */}
          <div className="text-center p-4 z-10">
            <QrCode className="w-12 h-12 text-[#caac8e] mx-auto mb-2 opacity-80" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-gray-300 block">
              Richt Camera op E-Ticket QR
            </span>
            <span className="text-[11px] text-gray-500">
              HMAC SHA-256 Vector Verificatie
            </span>
          </div>

          {/* Torch Toggle inside viewfinder */}
          <button
            onClick={() => setTorchOn(!torchOn)}
            className={`absolute bottom-3 px-3 py-1.5 rounded-full text-xs font-extrabold flex items-center gap-1.5 transition-all ${
              torchOn
                ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/50'
                : 'bg-black/60 text-gray-300 border border-gray-700'
            }`}
          >
            <Flashlight className="w-3.5 h-3.5" />
            <span>{torchOn ? 'Zaklamp AAN' : 'Zaklamp'}</span>
          </button>
        </div>

        {/* Scan Result Alert Overlay Card */}
        {lastScanResult && (
          <div
            className={`p-4 rounded-lg border-2 animate-in zoom-in-95 duration-150 shadow-xl ${
              lastScanResult.type === 'valid'
                ? 'bg-emerald-950/90 border-emerald-500 text-emerald-100'
                : lastScanResult.type === 'duplicate'
                ? 'bg-red-950/90 border-red-500 text-red-100'
                : 'bg-amber-950/90 border-amber-500 text-amber-100'
            }`}
          >
            <div className="flex items-start gap-3">
              {lastScanResult.type === 'valid' && (
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
              )}
              {lastScanResult.type === 'duplicate' && (
                <AlertOctagon className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
              )}
              {lastScanResult.type === 'wrong_session' && (
                <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
              )}

              <div>
                <h4 className="font-extrabold text-sm uppercase tracking-wide">
                  {lastScanResult.title}
                </h4>
                <p className="text-xs opacity-90 mt-0.5">{lastScanResult.detail}</p>
              </div>
            </div>
          </div>
        )}

        {/* Quick Simulator Test Buttons (For Verification) */}
        <div className="bg-[#1D1C1A] p-3 rounded-lg border border-[#006448]/50 space-y-2">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#caac8e] block text-center">
            Simuleer Scan Feedback (Geluid & Kleur):
          </span>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => simulateScan('valid')}
              className="bg-[#006448] hover:bg-[#007a58] text-white py-2 px-2 rounded text-[11px] font-extrabold flex flex-col items-center justify-center text-center shadow"
            >
              <span>🟢 Test Geldig</span>
              <span className="text-[9px] opacity-80">(Hoge Beep)</span>
            </button>
            <button
              onClick={() => simulateScan('duplicate')}
              className="bg-red-800 hover:bg-red-900 text-white py-2 px-2 rounded text-[11px] font-extrabold flex flex-col items-center justify-center text-center shadow"
            >
              <span>🔴 Duplicaat</span>
              <span className="text-[9px] opacity-80">(Lage Zoem)</span>
            </button>
            <button
              onClick={() => simulateScan('wrong_session')}
              className="bg-amber-700 hover:bg-amber-800 text-white py-2 px-2 rounded text-[11px] font-extrabold flex flex-col items-center justify-center text-center shadow"
            >
              <span>🟠 Sessie Fout</span>
              <span className="text-[9px] opacity-80">(Alert Toon)</span>
            </button>
          </div>
        </div>

        {/* Scanner Stats & Manual Search */}
        <div className="space-y-2">
          <div className="bg-[#1D1C1A] border border-gray-800 rounded p-3 flex items-center justify-between text-xs">
            <span className="text-gray-400 font-semibold">Totaal Scans Deze Telefoon:</span>
            <span className="font-extrabold text-[#caac8e] text-base">{scanCount} tickets</span>
          </div>

          <button
            onClick={() => setManualSearchOpen(true)}
            className="w-full bg-[#FCFAF7] text-[#1D1C1A] border-2 border-[#1D1C1A] py-2.5 rounded font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[2px_2px_0px_rgba(202,172,142,0.8)]"
          >
            <Search className="w-4 h-4 text-[#006448]" />
            <span>Handmatig Zoeken op Naam / Code</span>
          </button>
        </div>
      </div>

      {/* Manual Search Modal */}
      {manualSearchOpen && (
        <div className="absolute inset-0 z-50 bg-[#1D1C1A]/95 p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="font-extrabold text-sm uppercase tracking-wider text-[#caac8e]">
                Handmatig Ticket Opzoeken
              </h3>
              <button
                onClick={() => setManualSearchOpen(false)}
                className="text-gray-400 hover:text-white text-xs font-bold"
              >
                Sluiten ✕
              </button>
            </div>

            <input
              type="text"
              value={manualQuery}
              onChange={(e) => setManualQuery(e.target.value)}
              placeholder="Typ bezoeker of #WF code..."
              className="w-full p-3 bg-black border-2 border-[#006448] rounded text-white text-base focus:outline-none"
              autoFocus
            />

            <div className="space-y-2 text-xs">
              <span className="text-gray-400 font-bold block">Snelle matches:</span>
              {[
                { name: 'Robert-Jan Bakker', code: '#WF-2026-84391-1', type: 'VIP Vrijdag' },
                { name: 'Karel van Dongen', code: '#WF-2026-84391-2', type: 'VIP Vrijdag' },
                { name: 'Pieter van Mechelen', code: '#WF-2027-84392-1', type: 'Regulier Zondag' },
              ].map((m, i) => (
                <div
                  key={i}
                  onClick={() => {
                    setManualSearchOpen(false);
                    simulateScan('valid');
                  }}
                  className="p-2.5 bg-black/60 border border-gray-800 rounded hover:border-[#006448] cursor-pointer flex items-center justify-between"
                >
                  <div>
                    <span className="font-bold text-white block">{m.name}</span>
                    <span className="text-gray-400 text-[11px] font-mono">{m.code}</span>
                  </div>
                  <span className="text-[10px] bg-[#006448] text-white font-bold px-2 py-0.5 rounded">
                    Check-in
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
