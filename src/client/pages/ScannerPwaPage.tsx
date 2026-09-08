import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  ArrowLeft,
  CheckCircle2,
  AlertOctagon,
  AlertTriangle,
  RotateCcw,
  Camera,
  X,
  UserCheck,
  Sparkles,
  Settings2,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  ChevronRight
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { INITIAL_FESTIVALS } from '../data/mockData';
import { getStoredScans, addStoredScan, ScanRecord } from '../data/scannerStore';

export const ScannerPwaPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const festivalParam = searchParams.get('festival') || 'denhaag';
  const currentFestival =
    INITIAL_FESTIVALS.find((f) => f.id === festivalParam) || INITIAL_FESTIVALS[0];

  // Hardware & Network State
  const [isOnline, setIsOnline] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');

  // Scanner Audit History & Counters
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [scanCount, setScanCount] = useState(343);

  // Active Scan Result Popup
  const [activeResult, setActiveResult] = useState<ScanRecord | null>(null);
  const resultTimerRef = useRef<any>(null);

  // Scan cooldown lock
  const isLockedRef = useRef(false);

  // Set of checked-in codes for duplicate detection
  const checkedInCodesRef = useRef<Set<string>>(new Set());

  // Modals: Search & Settings
  const [manualSearchOpen, setManualSearchOpen] = useState(false);
  const [manualQuery, setManualQuery] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Html5Qrcode scanner instance
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const containerId = 'whiskytix-clean-camera-viewport';

  // Load persistent scan history on mount
  useEffect(() => {
    const stored = getStoredScans();
    setScans(stored);
    setScanCount(Math.max(343, stored.length));

    // Populate checked-in codes
    stored.forEach((s) => {
      if (s.status === 'valid') {
        checkedInCodesRef.current.add(s.ticketCode);
      }
    });
  }, []);

  // Audio Tone Synthesis (Web Audio API)
  const playSound = (type: 'valid' | 'duplicate' | 'wrong_session') => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      if (type === 'valid') {
        // High pleasant dual chime
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc.frequency.setValueAtTime(1174.66, audioCtx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.005, audioCtx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);

        if (navigator.vibrate) navigator.vibrate(80);
      } else if (type === 'duplicate') {
        // Low double buzzer
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, audioCtx.currentTime);
        osc.frequency.setValueAtTime(110, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.35, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.55);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.55);

        if (navigator.vibrate) navigator.vibrate([160, 90, 160]);
      } else {
        // Warning warble for wrong session
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        osc.frequency.setValueAtTime(320, audioCtx.currentTime + 0.14);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.45);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.45);

        if (navigator.vibrate) navigator.vibrate(220);
      }
    } catch (e) {
      console.log('Audio playback requires user gesture', e);
    }
  };

  // Process a Scanned Ticket
  const handleTicketScanned = (decodedRaw: string) => {
    if (isLockedRef.current) return;
    isLockedRef.current = true;

    let ticketCode = '#WF-2026-76464-1';
    let attendeeName = 'Bezoeker';
    let sessionTitle = 'VIP Jubileum Vrijdag';

    if (decodedRaw.startsWith('WT1:')) {
      const parts = decodedRaw.split(':');
      if (parts.length >= 5) {
        ticketCode = `#${parts[1]}`;
        sessionTitle = parts[3] || 'VIP Jubileum Vrijdag';
        attendeeName = parts[4] || 'Bezoeker';
      }
    } else if (decodedRaw.includes('code=')) {
      try {
        const urlObj = new URL(decodedRaw, window.location.origin);
        ticketCode = urlObj.searchParams.get('code') || decodedRaw;
        if (!ticketCode.startsWith('#')) ticketCode = `#${ticketCode}`;
        if (urlObj.searchParams.get('name')) attendeeName = urlObj.searchParams.get('name')!;
        if (urlObj.searchParams.get('session')) sessionTitle = urlObj.searchParams.get('session')!;
      } catch {
        ticketCode = decodedRaw;
      }
    } else {
      ticketCode = decodedRaw.startsWith('#') ? decodedRaw : `#${decodedRaw.slice(0, 18)}`;
      attendeeName = 'Deon Draijer';
    }

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Duplicate Check
    if (checkedInCodesRef.current.has(ticketCode)) {
      const record: ScanRecord = {
        id: `scan-${Date.now()}`,
        ticketCode,
        attendeeName: attendeeName || 'Bezoeker',
        sessionTitle,
        scannedAt: timeStr,
        status: 'duplicate',
        detail: 'Dit ticket is al eerder ingecheckt bij Deur 1 (Scanner #3).',
        gate: 'Hoofdingang • Deur 1',
      };
      displayScanResult(record);
      return;
    }

    // Wrong Session Check
    if (decodedRaw.toLowerCase().includes('zaterdag') || decodedRaw.toLowerCase().includes('sat')) {
      const record: ScanRecord = {
        id: `scan-${Date.now()}`,
        ticketCode,
        attendeeName: attendeeName || 'Bezoeker',
        sessionTitle: 'Zaterdagmiddag Sessie',
        scannedAt: timeStr,
        status: 'wrong_session',
        detail: 'Geldig voor ZATERDAG, niet voor huidige Vrijdagsessie.',
        gate: 'Hoofdingang • Deur 1',
      };
      displayScanResult(record);
      return;
    }

    // Valid check-in
    checkedInCodesRef.current.add(ticketCode);
    setScanCount((prev) => prev + 1);

    const record: ScanRecord = {
      id: `scan-${Date.now()}`,
      ticketCode,
      attendeeName: attendeeName || 'Deon Draijer',
      sessionTitle,
      scannedAt: timeStr,
      status: 'valid',
      detail: 'Entree Verleend • Welkomstglas inbegrepen',
      gate: 'Hoofdingang • Deur 1',
    };
    displayScanResult(record);
  };

  const displayScanResult = (record: ScanRecord) => {
    playSound(record.status);
    setActiveResult(record);

    // Save to persistent storage and update recent scans state
    const updated = addStoredScan(record);
    setScans(updated);

    if (resultTimerRef.current) clearTimeout(resultTimerRef.current);

    resultTimerRef.current = setTimeout(() => {
      setActiveResult(null);
      isLockedRef.current = false;
    }, 3500);
  };

  const dismissResult = () => {
    if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
    setActiveResult(null);
    isLockedRef.current = false;
  };

  // Real Camera Controls
  const startCamera = async (facing: 'environment' | 'user') => {
    setCameraError(null);
    try {
      if (html5QrCodeRef.current) {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      }

      const qrScanner = new Html5Qrcode(containerId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
        ],
        verbose: false,
      });
      html5QrCodeRef.current = qrScanner;

      await qrScanner.start(
        { facingMode: facing },
        {
          fps: 15,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const qrEdge = Math.floor(minEdge * 0.74);
            return { width: qrEdge, height: qrEdge };
          },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          handleTicketScanned(decodedText);
        },
        () => {}
      );

      setCameraActive(true);
      setCameraFacing(facing);
    } catch (err: any) {
      console.warn('Camera initialization error:', err);
      setCameraActive(false);
      setCameraError(
        err?.message?.includes('Permission') || err?.name === 'NotAllowedError'
          ? 'Cameratoegang geweigerd. Geef toestemming in je mobiele browser.'
          : 'Geen camera beschikbaar of camera is in gebruik door een andere app.'
      );
    }
  };

  const stopCamera = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      } catch (err) {
        console.warn('Error stopping camera:', err);
      }
    }
    setCameraActive(false);
  };

  const toggleCameraFacing = async () => {
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    await startCamera(nextFacing);
  };

  useEffect(() => {
    startCamera('environment');

    return () => {
      stopCamera();
      if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
    };
  }, []);

  const latestScan = scans.length > 0 ? scans[0] : null;

  return (
    <div className="min-h-screen bg-[#0D0C0B] text-[#FAF7F2] flex flex-col font-sans max-w-md mx-auto relative select-none shadow-2xl overflow-x-hidden">
      {/* 1. Minimalist, Spacious Header (No Cramped Buttons!) */}
      <header className="px-4 py-3.5 flex items-center justify-between border-b border-white/5 bg-[#141311]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Link
            to={festivalParam ? `/admin/festival/${festivalParam}/door` : '/admin'}
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-stone-300 hover:text-white transition-colors border border-white/10 active:scale-95"
            title="Terug naar Deurmonitor"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-extrabold text-white tracking-tight leading-none">
                Scanner
              </h1>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
            <p className="text-[11px] text-[#caac8e] font-medium leading-none mt-1">
              {currentFestival.location} • Ingang
            </p>
          </div>
        </div>

        {/* Spacious Top Right Action Icons */}
        <div className="flex items-center gap-2">
          {/* 🔍 Primary Manual Search Trigger in Header */}
          <button
            onClick={() => setManualSearchOpen(true)}
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-stone-300 hover:text-white transition-colors active:scale-95"
            title="Zoeken op naam of code"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* ⚙️ Clean Settings & Options Drawer Trigger */}
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-stone-300 hover:text-white transition-colors active:scale-95 relative"
            title="Instellingen & Testmodus"
          >
            <Settings2 className="w-4 h-4" />
            {!isOnline && (
              <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-[#0D0C0B]"></span>
            )}
          </button>
        </div>
      </header>

      {/* 2. Subdued Session & Door Context Strip */}
      <div className="px-4 py-2 bg-[#12110F] border-b border-white/5 flex items-center justify-between text-xs">
        <span className="text-stone-400 font-medium flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#caac8e]"></span>
          Vrijdagmiddag (13:00 - 17:00)
        </span>
        <span className="text-[10px] font-mono font-bold text-[#caac8e] bg-white/5 px-2 py-0.5 rounded">
          Deur 1
        </span>
      </div>

      {/* 3. Main Body */}
      <main className="flex-1 p-4 flex flex-col space-y-3.5">
        {/* Sleek, Immersive Camera Viewfinder */}
        <div className="relative w-full aspect-square max-h-[350px] bg-black rounded-3xl overflow-hidden border border-white/10 shadow-2xl flex items-center justify-center">
          <div
            id={containerId}
            className="w-full h-full object-cover [&>video]:w-full [&>video]:h-full [&>video]:object-cover"
          ></div>

          {/* Minimalist Modern Focus Frame (Clean, fine gold brackets) */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="relative w-56 h-56">
              {/* Corner 1: Top-Left */}
              <div className="absolute top-0 left-0 w-7 h-7 border-t-2 border-l-2 border-[#caac8e] rounded-tl-xl"></div>
              {/* Corner 2: Top-Right */}
              <div className="absolute top-0 right-0 w-7 h-7 border-t-2 border-r-2 border-[#caac8e] rounded-tr-xl"></div>
              {/* Corner 3: Bottom-Left */}
              <div className="absolute bottom-0 left-0 w-7 h-7 border-b-2 border-l-2 border-[#caac8e] rounded-bl-xl"></div>
              {/* Corner 4: Bottom-Right */}
              <div className="absolute bottom-0 right-0 w-7 h-7 border-b-2 border-r-2 border-[#caac8e] rounded-br-xl"></div>

              {/* Gentle subtle scan glow */}
              {cameraActive && (
                <div className="absolute inset-x-2 top-0 h-0.5 bg-gradient-to-r from-transparent via-[#caac8e] to-transparent shadow-[0_0_10px_#caac8e] animate-[pulse_2.2s_ease-in-out_infinite]"></div>
              )}
            </div>
          </div>

          {/* Camera Error / Starting Fallback */}
          {!cameraActive && (
            <div className="absolute inset-0 bg-[#12110F] p-6 flex flex-col items-center justify-center text-center space-y-3 z-20">
              <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[#caac8e]">
                <Camera className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-stone-200">
                {cameraError || 'Camera initialiseren...'}
              </p>
              <button
                onClick={() => startCamera(cameraFacing)}
                className="px-4 py-2 rounded-xl bg-[#006448] text-white text-xs font-bold hover:bg-[#007a58] transition-all active:scale-95"
              >
                Opnieuw Proberen
              </button>
            </div>
          )}
        </div>

        {/* 4. Instant Scan Result Floating Card */}
        {activeResult && (
          <div
            className={`p-4 rounded-2xl border shadow-2xl animate-in zoom-in-95 duration-150 relative overflow-hidden ${
              activeResult.status === 'valid'
                ? 'bg-[#032e22] border-emerald-500/70 text-white'
                : activeResult.status === 'duplicate'
                ? 'bg-[#400c0c] border-red-500/70 text-white'
                : 'bg-[#3b2308] border-amber-500/70 text-white'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    activeResult.status === 'valid'
                      ? 'bg-emerald-500 text-black'
                      : activeResult.status === 'duplicate'
                      ? 'bg-red-500 text-white'
                      : 'bg-amber-500 text-black'
                  }`}
                >
                  {activeResult.status === 'valid' && <CheckCircle2 className="w-5 h-5" />}
                  {activeResult.status === 'duplicate' && <AlertOctagon className="w-5 h-5" />}
                  {activeResult.status === 'wrong_session' && <AlertTriangle className="w-5 h-5" />}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider opacity-85">
                      {activeResult.status === 'valid'
                        ? 'Toegang Verleend'
                        : activeResult.status === 'duplicate'
                        ? 'Al Gescand • Duplicaat'
                        : 'Verkeerde Sessie'}
                    </span>
                    <span className="font-mono text-[11px] opacity-75 font-semibold">
                      {activeResult.ticketCode}
                    </span>
                  </div>

                  <h3 className="text-base font-extrabold tracking-tight leading-snug mt-0.5">
                    {activeResult.attendeeName}
                  </h3>

                  <p className="text-xs opacity-90 mt-0.5 font-medium">
                    {activeResult.detail}
                  </p>

                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-black/30 border border-white/10">
                      {activeResult.sessionTitle}
                    </span>
                    <span className="text-[10px] opacity-70">
                      Om {activeResult.scannedAt}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={dismissResult}
                className="p-1 rounded-full text-white/70 hover:text-white hover:bg-black/30 transition-colors"
                title="Sluit melding"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* 5. Compact Recent Scan Summary & "Toon meer" Link */}
        <div className="p-3.5 rounded-2xl bg-[#141311] border border-white/5 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-[#caac8e]" />
              <span className="text-xs font-bold text-stone-300">Laatste Scan</span>
            </div>
            <span className="text-xs font-mono font-bold text-[#caac8e] bg-white/5 px-2 py-0.5 rounded-md">
              {scanCount} gescand
            </span>
          </div>

          {latestScan ? (
            <div className="flex items-center justify-between py-1 text-xs">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    latestScan.status === 'valid'
                      ? 'bg-emerald-500'
                      : latestScan.status === 'duplicate'
                      ? 'bg-red-500'
                      : 'bg-amber-500'
                  }`}
                ></span>
                <div>
                  <span className="font-bold text-white block leading-tight">
                    {latestScan.attendeeName}
                  </span>
                  <span className="text-[11px] text-stone-400 font-mono">
                    {latestScan.ticketCode} • {latestScan.sessionTitle}
                  </span>
                </div>
              </div>

              <div className="text-right">
                <span className="font-mono text-stone-400 text-[11px] block">
                  {latestScan.scannedAt}
                </span>
                <span
                  className={`text-[9px] font-extrabold uppercase ${
                    latestScan.status === 'valid'
                      ? 'text-emerald-400'
                      : latestScan.status === 'duplicate'
                      ? 'text-red-400'
                      : 'text-amber-400'
                  }`}
                >
                  {latestScan.status === 'valid' ? 'Entree' : latestScan.status === 'duplicate' ? 'Duplicaat' : 'Sessie'}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-stone-500 py-1">Klaar voor de eerste bezoeker...</p>
          )}

          {/* 🔗 Dedicated "Toon meer" Link to Separate History Page */}
          <Link
            to={`/scan/history?festival=${festivalParam}`}
            className="w-full mt-2.5 pt-2.5 border-t border-white/5 flex items-center justify-between text-xs font-bold text-[#caac8e] hover:text-white transition-colors"
          >
            <span>Bekijk alle scans & audit log</span>
            <span className="flex items-center gap-1">
              Toon meer <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </Link>
        </div>
      </main>

      {/* 6. Settings & Options Slide-Up Sheet */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end justify-center">
          <div className="w-full max-w-md bg-[#171614] border-t border-white/10 rounded-t-3xl p-5 space-y-4 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-[#caac8e]" />
                Instellingen & Testmodus
              </h3>
              <button
                onClick={() => setSettingsOpen(false)}
                className="w-7 h-7 rounded-full bg-white/5 text-stone-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Controls Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {/* Sound Toggle */}
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-3 rounded-xl border flex items-center gap-2.5 font-bold transition-colors ${
                  soundEnabled
                    ? 'bg-emerald-950/40 border-emerald-700/50 text-emerald-300'
                    : 'bg-white/5 border-white/10 text-stone-400'
                }`}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                <span>{soundEnabled ? 'Geluid AAN' : 'Geluid UIT'}</span>
              </button>

              {/* Camera Switch */}
              <button
                onClick={toggleCameraFacing}
                className="p-3 rounded-xl bg-white/5 border border-white/10 text-stone-300 hover:text-white flex items-center gap-2.5 font-bold transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Wissel Lens</span>
              </button>

              {/* Online/Offline Toggle */}
              <button
                onClick={() => setIsOnline(!isOnline)}
                className={`col-span-2 p-3 rounded-xl border flex items-center justify-between font-bold transition-colors ${
                  isOnline
                    ? 'bg-white/5 border-white/10 text-stone-300'
                    : 'bg-amber-950/40 border-amber-700/50 text-amber-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  {isOnline ? <Wifi className="w-4 h-4 text-emerald-400" /> : <WifiOff className="w-4 h-4 text-amber-400" />}
                  <span>{isOnline ? 'Online Modus (Live sync)' : 'Offline Modus (Blackout test)'}</span>
                </span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-white/5">
                  {isOnline ? 'Live' : 'Offline'}
                </span>
              </button>
            </div>

            {/* Simulation Feedback Test Panel */}
            <div className="pt-2 border-t border-white/10 space-y-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#caac8e] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Simuleer Feedback (Zonder Fysieke QR)
              </span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => {
                    handleTicketScanned('WT1:WF-2026-76464-1:denhaag:VIP Jubileum Vrijdag:Deon Draijer:sig');
                    setSettingsOpen(false);
                  }}
                  className="p-2 rounded-xl bg-[#006448] text-white text-[10px] font-extrabold text-center hover:bg-[#007a58] transition-all"
                >
                  🟢 Geldig
                </button>
                <button
                  onClick={() => {
                    handleTicketScanned('#WF-2026-84388-2');
                    setSettingsOpen(false);
                  }}
                  className="p-2 rounded-xl bg-red-800 text-white text-[10px] font-extrabold text-center hover:bg-red-700 transition-all"
                >
                  🔴 Duplicaat
                </button>
                <button
                  onClick={() => {
                    handleTicketScanned('WT1:WF-2026-99999-1:denhaag:Zaterdagmiddag Sessie:Martijn Vos:sig');
                    setSettingsOpen(false);
                  }}
                  className="p-2 rounded-xl bg-amber-700 text-white text-[10px] font-extrabold text-center hover:bg-amber-600 transition-all"
                >
                  🟠 Foutieve Sessie
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. Manual Search Modal */}
      {manualSearchOpen && (
        <div className="fixed inset-0 z-50 bg-[#12110F] p-5 flex flex-col justify-between max-w-md mx-auto shadow-2xl">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-[#caac8e]">
                  Handmatig Ticket Opzoeken
                </h3>
                <p className="text-[11px] text-stone-400">Zoek op achternaam of ticketcode</p>
              </div>
              <button
                onClick={() => setManualSearchOpen(false)}
                className="w-8 h-8 rounded-full bg-white/5 text-stone-300 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative">
              <input
                type="text"
                value={manualQuery}
                onChange={(e) => setManualQuery(e.target.value)}
                placeholder="Typ naam of #WF code..."
                className="w-full p-3.5 pl-10 bg-[#1C1B18] border border-white/10 rounded-2xl text-white text-base focus:outline-none focus:border-[#caac8e]"
                autoFocus
              />
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <div className="space-y-2 text-xs">
              <span className="text-stone-400 font-bold block text-[11px] uppercase tracking-wider">
                Direct Inchecken:
              </span>
              {[
                { name: 'Deon Draijer', code: '#WF-2026-76464-1', type: 'VIP Vrijdag', alreadyScanned: true },
                { name: 'Robert-Jan Bakker', code: '#WF-2026-84391-1', type: 'VIP Vrijdag', alreadyScanned: false },
                { name: 'Karel van Dongen', code: '#WF-2026-84388-2', type: 'VIP Vrijdag', alreadyScanned: false },
                { name: 'Pieter van Mechelen', code: '#WF-2027-84392-1', type: 'Regulier Zondag', alreadyScanned: false },
                { name: 'Sophie van Dam', code: '#WF-2026-84380-1', type: 'VIP Vrijdag', alreadyScanned: false },
              ]
                .filter(
                  (m) =>
                    !manualQuery ||
                    m.name.toLowerCase().includes(manualQuery.toLowerCase()) ||
                    m.code.toLowerCase().includes(manualQuery.toLowerCase())
                )
                .map((m, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      setManualSearchOpen(false);
                      if (m.alreadyScanned) {
                        handleTicketScanned(m.code);
                      } else if (m.type.includes('Zondag')) {
                        handleTicketScanned(`WT1:${m.code.replace('#', '')}:denhaag:Zondagsessie:${m.name}:sig`);
                      } else {
                        handleTicketScanned(`WT1:${m.code.replace('#', '')}:denhaag:VIP Vrijdag:${m.name}:sig`);
                      }
                    }}
                    className="p-3 bg-[#1C1B18] border border-white/5 rounded-2xl hover:border-[#caac8e] cursor-pointer flex items-center justify-between transition-colors"
                  >
                    <div>
                      <span className="font-bold text-white block text-sm">{m.name}</span>
                      <span className="text-stone-400 text-[11px] font-mono">
                        {m.code} • {m.type}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg ${
                        m.alreadyScanned
                          ? 'bg-red-950 text-red-400 border border-red-800'
                          : 'bg-[#006448] text-white'
                      }`}
                    >
                      {m.alreadyScanned ? 'Reeds Binnen' : 'Check-in'}
                    </span>
                  </div>
                ))}
            </div>
          </div>

          <button
            onClick={() => setManualSearchOpen(false)}
            className="w-full py-3 rounded-2xl bg-white/5 text-stone-300 font-bold text-xs uppercase tracking-wider hover:bg-white/10 transition-colors"
          >
            Sluiten
          </button>
        </div>
      )}
    </div>
  );
};

export default ScannerPwaPage;


