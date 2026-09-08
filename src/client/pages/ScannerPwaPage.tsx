import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Wifi,
  WifiOff,
  Volume2,
  VolumeX,
  ArrowLeft,
  CheckCircle2,
  AlertOctagon,
  AlertTriangle,
  RotateCcw,
  Camera,
  ChevronDown,
  ChevronUp,
  X,
  UserCheck,
  Sparkles
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { INITIAL_FESTIVALS } from '../data/mockData';

interface ScanRecord {
  id: string;
  ticketCode: string;
  attendeeName: string;
  sessionTitle: string;
  scannedAt: string;
  status: 'valid' | 'duplicate' | 'wrong_session';
  detail: string;
}

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

  // Scanner Counters & Audit History
  const [scanCount, setScanCount] = useState(342);
  const [recentScans, setRecentScans] = useState<ScanRecord[]>([
    {
      id: 'init-1',
      ticketCode: '#WF-2026-84388-2',
      attendeeName: 'Karel van Dongen',
      sessionTitle: 'VIP Jubileum Vrijdag',
      scannedAt: '13:41',
      status: 'valid',
      detail: 'Entree Verleend • Welkomstglas inbegrepen',
    },
    {
      id: 'init-2',
      ticketCode: '#WF-2026-84380-1',
      attendeeName: 'Sophie van Dam',
      sessionTitle: 'VIP Jubileum Vrijdag',
      scannedAt: '13:38',
      status: 'valid',
      detail: 'Entree Verleend',
    },
  ]);

  // Current Active Scan Result Overlay
  const [activeResult, setActiveResult] = useState<ScanRecord | null>(null);
  const resultTimerRef = useRef<any>(null);

  // Scan cooldown lock so rapid video frames don't double fire
  const isLockedRef = useRef(false);

  // In-memory set of already scanned ticket codes to detect real duplicates
  const checkedInCodesRef = useRef<Set<string>>(new Set(['#WF-2026-84388-2', '#WF-2026-84380-1', '#WF-2026-84391-1']));

  // Manual Search modal & query
  const [manualSearchOpen, setManualSearchOpen] = useState(false);
  const [manualQuery, setManualQuery] = useState('');

  // Collapsible Simulation Tools (for testing / demo)
  const [showSimPanel, setShowSimPanel] = useState(false);

  // Html5Qrcode scanner instance ref
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const containerId = 'whiskytix-camera-viewport';

  // Audio tone generator using Web Audio API
  const playSound = (type: 'valid' | 'duplicate' | 'wrong_session') => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      if (type === 'valid') {
        // High crisp pleasant dual-tone chime
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
        osc.frequency.setValueAtTime(1174.66, audioCtx.currentTime + 0.08); // D6 note
        gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.005, audioCtx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);

        if (navigator.vibrate) navigator.vibrate(80);
      } else if (type === 'duplicate') {
        // Low ominous double buzzer
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

  // Process a scanned or looked-up ticket code
  const handleTicketScanned = (decodedRaw: string) => {
    if (isLockedRef.current) return;
    isLockedRef.current = true;

    // Parse payload format: WT1:<ticketCode>:<city>:<session>:<attendeeName>:<sig>
    // Or URL format: ...?code=WF-2026-84387-1
    // Or plain ticket code: #WF-2026-84387-1
    let ticketCode = '#WF-2026-84391-1';
    let attendeeName = 'Bezoeker';
    let sessionTitle = 'VIP Jubileum Vrijdag';

    if (decodedRaw.startsWith('WT1:')) {
      const parts = decodedRaw.split(':');
      if (parts.length >= 5) {
        ticketCode = `#${parts[1]}`;
        sessionTitle = parts[3] || 'Vrijdagmiddag Sessie';
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
      };
      displayScanResult(record);
      return;
    }

    // Wrong Session Check simulation (if ticket mentions Saturday or Sunday)
    if (decodedRaw.toLowerCase().includes('zaterdag') || decodedRaw.toLowerCase().includes('sat')) {
      const record: ScanRecord = {
        id: `scan-${Date.now()}`,
        ticketCode,
        attendeeName: attendeeName || 'Bezoeker',
        sessionTitle: 'Zaterdagmiddag Sessie',
        scannedAt: timeStr,
        status: 'wrong_session',
        detail: 'Geldig voor ZATERDAG, niet voor de huidige Vrijdagsessie.',
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
    };
    displayScanResult(record);
  };

  const displayScanResult = (record: ScanRecord) => {
    playSound(record.status);
    setActiveResult(record);

    // Add to recent scans
    setRecentScans((prev) => [record, ...prev.slice(0, 3)]);

    if (resultTimerRef.current) clearTimeout(resultTimerRef.current);

    // Auto clear alert after 3.8 seconds so staff can rapidly scan next ticket
    resultTimerRef.current = setTimeout(() => {
      setActiveResult(null);
      isLockedRef.current = false;
    }, 3800);
  };

  const dismissResult = () => {
    if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
    setActiveResult(null);
    isLockedRef.current = false;
  };

  // Start real Camera Scanner with html5-qrcode
  const startCamera = async (facing: 'environment' | 'user') => {
    setCameraError(null);
    try {
      // Clean up previous instance if any
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
            const qrEdge = Math.floor(minEdge * 0.72);
            return { width: qrEdge, height: qrEdge };
          },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          handleTicketScanned(decodedText);
        },
        () => {
          // Frame decode error; expected while searching
        }
      );

      setCameraActive(true);
      setCameraFacing(facing);
    } catch (err: any) {
      console.warn('Camera initialization error:', err);
      setCameraActive(false);
      setCameraError(
        err?.message?.includes('Permission') || err?.name === 'NotAllowedError'
          ? 'Cameratoegang geweigerd in browser. Geef toestemming om te scannen.'
          : 'Geen camera gevonden of camera is al in gebruik door een andere app.'
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

  // Mount effect: Start camera automatically
  useEffect(() => {
    startCamera('environment');

    return () => {
      stopCamera();
      if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#0F0E0D] text-[#FAF7F2] flex flex-col font-sans max-w-md mx-auto relative select-none shadow-2xl overflow-x-hidden">
      {/* 1. Sleek Top Navigation & Door Status Bar */}
      <header className="bg-[#171614] border-b border-[#2C2A26] px-4 py-3 sticky top-0 z-40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to={festivalParam ? `/admin/festival/${festivalParam}/door` : '/admin'}
              className="w-8 h-8 rounded-lg bg-[#24221F] hover:bg-[#2F2C28] flex items-center justify-center text-stone-300 hover:text-white transition-colors border border-[#38342F]"
              title="Terug naar Deurmonitor"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-widest text-[#caac8e]">
                  {currentFestival.location}
                </span>
                <span className="text-stone-500 text-xs">•</span>
                <span className="text-[11px] font-semibold text-stone-300">Hoofdingang</span>
              </div>
              <h1 className="text-sm font-extrabold text-white tracking-tight flex items-center gap-1.5">
                Whiskytix Scanner
              </h1>
            </div>
          </div>

          {/* Quick Header Controls */}
          <div className="flex items-center gap-1.5">
            {/* Camera switch button if active */}
            {cameraActive && (
              <button
                onClick={toggleCameraFacing}
                className="w-8 h-8 rounded-lg bg-[#24221F] border border-[#38342F] text-stone-300 hover:text-white flex items-center justify-center transition-colors"
                title="Wissel camera (Voor / Achter)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Sound Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${
                soundEnabled
                  ? 'bg-[#006448]/20 border-[#006448]/60 text-emerald-400'
                  : 'bg-[#24221F] border-[#38342F] text-stone-500'
              }`}
              title={soundEnabled ? 'Geluid AAN' : 'Geluid GEDEMPT'}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>

            {/* Online / Offline Pill */}
            <button
              onClick={() => setIsOnline(!isOnline)}
              className={`px-2 py-1 rounded-lg text-[10px] font-extrabold flex items-center gap-1.5 border transition-all ${
                isOnline
                  ? 'bg-emerald-950/70 text-emerald-400 border-emerald-700/60'
                  : 'bg-amber-950/70 text-amber-400 border-amber-700/60'
              }`}
              title="Klik om te testen tussen Online en Offline modus"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
              <span>{isOnline ? 'Online' : 'Offline'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. Active Session Context Pill */}
      <div className="bg-[#1D1B18] px-4 py-2 border-b border-[#2C2A26] flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#caac8e]"></span>
          <span className="text-stone-400 font-medium">Huidige sessie:</span>
          <span className="font-bold text-[#FAF7F2]">Vrijdagmiddag (13:00 - 17:00)</span>
        </div>
        <span className="text-[10px] font-mono text-[#caac8e] font-bold bg-[#caac8e]/10 px-2 py-0.5 rounded">
          Deur 1
        </span>
      </div>

      {/* 3. Main Scanner Container */}
      <main className="flex-1 p-4 flex flex-col space-y-4">
        {/* Live Camera Viewfinder Card */}
        <div className="relative w-full aspect-square max-h-[340px] bg-black rounded-2xl overflow-hidden border border-[#2F2C28] shadow-2xl flex items-center justify-center">
          {/* HTML5 QR Code DOM Mount Point */}
          <div
            id={containerId}
            className="w-full h-full object-cover [&>video]:w-full [&>video]:h-full [&>video]:object-cover"
          ></div>

          {/* Clean Scanner Focus Reticle Overlay (Subtle gold brackets) */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="relative w-56 h-56">
              {/* Corner 1: Top-Left */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-[#caac8e] rounded-tl-lg"></div>
              {/* Corner 2: Top-Right */}
              <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-[#caac8e] rounded-tr-lg"></div>
              {/* Corner 3: Bottom-Left */}
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-[#caac8e] rounded-bl-lg"></div>
              {/* Corner 4: Bottom-Right */}
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-[#caac8e] rounded-br-lg"></div>

              {/* Gentle Scanning Pulse Sweep (Non-jarring, subtle) */}
              {cameraActive && (
                <div className="absolute inset-x-2 top-0 h-0.5 bg-gradient-to-r from-transparent via-[#caac8e] to-transparent shadow-[0_0_12px_#caac8e] animate-[pulse_2s_ease-in-out_infinite]"></div>
              )}
            </div>
          </div>

          {/* Camera Loading or Error State Fallback */}
          {!cameraActive && (
            <div className="absolute inset-0 bg-[#121110] p-6 flex flex-col items-center justify-center text-center space-y-3 z-20">
              <div className="w-12 h-12 rounded-full bg-[#1F1D1A] border border-[#38342F] flex items-center justify-center text-[#caac8e]">
                <Camera className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-stone-200">
                  {cameraError || 'Camera inschakelen...'}
                </p>
                <p className="text-[11px] text-stone-400 max-w-xs">
                  {cameraError
                    ? 'Scan via handmatig zoeken of herstart de camera.'
                    : 'Geef toestemming in je mobiele browser om tickets direct te scannen.'}
                </p>
              </div>

              <button
                onClick={() => startCamera(cameraFacing)}
                className="px-4 py-2 rounded-lg bg-[#006448] text-white text-xs font-extrabold hover:bg-[#007a58] transition-colors"
              >
                Start Camera Opnieuw
              </button>
            </div>
          )}

          {/* Subdued Bottom Guide Prompt inside Viewport */}
          {cameraActive && (
            <div className="absolute bottom-3 inset-x-0 flex justify-center pointer-events-none">
              <span className="text-[10px] font-bold tracking-wider uppercase text-stone-300 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                Houd QR-code in het kader
              </span>
            </div>
          )}
        </div>

        {/* 4. Instant Scan Feedback Hero Card */}
        {activeResult ? (
          <div
            className={`p-4 rounded-xl border shadow-2xl animate-in zoom-in-95 duration-150 relative overflow-hidden ${
              activeResult.status === 'valid'
                ? 'bg-[#003828] border-emerald-500/80 text-white'
                : activeResult.status === 'duplicate'
                ? 'bg-[#4a0e0e] border-red-500/80 text-white'
                : 'bg-[#4a2e0a] border-amber-500/80 text-white'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    activeResult.status === 'valid'
                      ? 'bg-emerald-500 text-black'
                      : activeResult.status === 'duplicate'
                      ? 'bg-red-500 text-white'
                      : 'bg-amber-500 text-black'
                  }`}
                >
                  {activeResult.status === 'valid' && <CheckCircle2 className="w-6 h-6" />}
                  {activeResult.status === 'duplicate' && <AlertOctagon className="w-6 h-6" />}
                  {activeResult.status === 'wrong_session' && <AlertTriangle className="w-6 h-6" />}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-80">
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

                  <h3 className="text-base font-black tracking-tight leading-tight mt-0.5">
                    {activeResult.attendeeName}
                  </h3>

                  <p className="text-xs opacity-90 mt-1 font-medium leading-relaxed">
                    {activeResult.detail}
                  </p>

                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-black/30 border border-white/10">
                      {activeResult.sessionTitle}
                    </span>
                    <span className="text-[10px] opacity-70">
                      Geregistreerd om {activeResult.scannedAt}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={dismissResult}
                className="p-1 rounded-full text-white/70 hover:text-white hover:bg-black/30 transition-colors"
                title="Sluit melding"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        ) : (
          /* Subtle Ready Indicator when idle */
          <div className="bg-[#171614] border border-[#282622] rounded-xl p-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-stone-300 font-medium">Scanner gereed voor volgende bezoeker</span>
            </div>
            <span className="text-stone-500 text-[11px] font-semibold">Realtime Sync</span>
          </div>
        )}

        {/* 5. Recente Scans Audit Trail (Mini-geschiedenis) */}
        <div className="bg-[#171614] border border-[#282622] rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-extrabold uppercase tracking-widest text-[#caac8e] flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5" />
              Recente Scans aan deze Deur
            </h4>
            <span className="text-[11px] font-bold text-stone-400">
              Totaal: <strong className="text-white">{scanCount}</strong>
            </span>
          </div>

          <div className="space-y-1.5">
            {recentScans.slice(0, 3).map((scan) => (
              <div
                key={scan.id}
                className="p-2 rounded-lg bg-[#201E1A] border border-[#2E2B26] flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      scan.status === 'valid'
                        ? 'bg-emerald-500'
                        : scan.status === 'duplicate'
                        ? 'bg-red-500'
                        : 'bg-amber-500'
                    }`}
                  ></div>
                  <div>
                    <span className="font-bold text-white block leading-tight">
                      {scan.attendeeName}
                    </span>
                    <span className="text-[10px] text-stone-400 font-mono">
                      {scan.ticketCode} • {scan.sessionTitle}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[11px] font-mono font-bold text-stone-300 block">
                    {scan.scannedAt}
                  </span>
                  <span
                    className={`text-[9px] font-bold uppercase ${
                      scan.status === 'valid'
                        ? 'text-emerald-400'
                        : scan.status === 'duplicate'
                        ? 'text-red-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {scan.status === 'valid' ? 'Entree' : scan.status === 'duplicate' ? 'Duplicaat' : 'Sessie'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 6. Primary Action: Manual Search Button */}
        <button
          onClick={() => setManualSearchOpen(true)}
          className="w-full bg-[#FAF7F2] hover:bg-white text-[#141210] p-3.5 rounded-xl font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-transform active:scale-[0.98] shadow-lg"
        >
          <Search className="w-4 h-4 text-[#006448]" />
          <span>Handmatig Zoeken op Naam of Code</span>
        </button>

        {/* 7. Collapsible Test & Demo Bar (Neatly tucked away) */}
        <div className="pt-1">
          <button
            onClick={() => setShowSimPanel(!showSimPanel)}
            className="w-full py-2 px-3 rounded-lg bg-[#171614] border border-[#282622] text-stone-400 hover:text-stone-200 text-[11px] font-bold flex items-center justify-between transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#caac8e]" />
              <span>Demo & Geluidstesten (Simulatiemodus)</span>
            </span>
            {showSimPanel ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showSimPanel && (
            <div className="mt-2 p-3 bg-[#171614] border border-[#282622] rounded-xl space-y-2 animate-in fade-in-50 duration-150">
              <p className="text-[10px] text-stone-400 leading-normal">
                Test direct het visuele gedrag, audio-signalen en haptische feedback zonder fysiek kaartje:
              </p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() =>
                    handleTicketScanned('WT1:WF-2026-84391-1:denhaag:VIP Jubileum Vrijdag:Deon Draijer:test')
                  }
                  className="bg-[#006448] hover:bg-[#007a58] text-white py-2 px-1.5 rounded-lg text-[10px] font-black flex flex-col items-center justify-center text-center shadow transition-transform active:scale-95"
                >
                  <span>🟢 Geldig</span>
                  <span className="text-[9px] opacity-75 font-normal">Hoge Chime</span>
                </button>
                <button
                  onClick={() =>
                    handleTicketScanned('#WF-2026-84388-2')
                  }
                  className="bg-red-900 hover:bg-red-800 text-white py-2 px-1.5 rounded-lg text-[10px] font-black flex flex-col items-center justify-center text-center shadow transition-transform active:scale-95"
                >
                  <span>🔴 Duplicaat</span>
                  <span className="text-[9px] opacity-75 font-normal">Lage Zoemer</span>
                </button>
                <button
                  onClick={() =>
                    handleTicketScanned('WT1:WF-2026-99999-1:denhaag:Zaterdagmiddag Sessie:Pieter Bakker:test')
                  }
                  className="bg-amber-800 hover:bg-amber-700 text-white py-2 px-1.5 rounded-lg text-[10px] font-black flex flex-col items-center justify-center text-center shadow transition-transform active:scale-95"
                >
                  <span>🟠 Foutieve Sessie</span>
                  <span className="text-[9px] opacity-75 font-normal">Alert Toon</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* 8. Modern Full-Screen Slide-Over for Manual Search */}
      {manualSearchOpen && (
        <div className="fixed inset-0 z-50 bg-[#121110] p-5 flex flex-col justify-between max-w-md mx-auto shadow-2xl">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#2C2A26] pb-3">
              <div>
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-[#caac8e]">
                  Gastenlijst & Ticket Zoeken
                </h3>
                <p className="text-[11px] text-stone-400">Zoek op achternaam of ticketcode</p>
              </div>
              <button
                onClick={() => setManualSearchOpen(false)}
                className="w-8 h-8 rounded-lg bg-[#24221F] text-stone-300 hover:text-white flex items-center justify-center"
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
                className="w-full p-3.5 pl-10 bg-[#1C1B18] border border-[#38342F] rounded-xl text-white text-base focus:outline-none focus:border-[#006448]"
                autoFocus
              />
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <div className="space-y-2 text-xs">
              <span className="text-stone-400 font-bold block text-[11px] uppercase tracking-wider">
                Direct Inchecken:
              </span>
              {[
                { name: 'Robert-Jan Bakker', code: '#WF-2026-84391-1', type: 'VIP Vrijdag', alreadyScanned: true },
                { name: 'Deon Draijer', code: '#WF-2026-84387-1', type: 'VIP Vrijdag', alreadyScanned: false },
                { name: 'Karel van Dongen', code: '#WF-2026-84388-2', type: 'VIP Vrijdag', alreadyScanned: true },
                { name: 'Pieter van Mechelen', code: '#WF-2027-84392-1', type: 'Regulier Zondag', alreadyScanned: false },
                { name: 'Anouk de Vries', code: '#WF-2026-84400-1', type: 'VIP Vrijdag', alreadyScanned: false },
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
                    className="p-3 bg-[#1C1B18] border border-[#2E2B26] rounded-xl hover:border-[#caac8e] cursor-pointer flex items-center justify-between transition-colors"
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
            className="w-full py-3 rounded-xl bg-[#24221F] text-stone-300 font-bold text-xs uppercase tracking-wider"
          >
            Sluiten
          </button>
        </div>
      )}
    </div>
  );
};

