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
  Settings2,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  ChevronRight,
} from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { INITIAL_FESTIVALS, INITIAL_SESSIONS } from '../data/mockData';
import {
  getStoredScans,
  addStoredScan,
  ScanRecord,
  VaultTicket,
  getTicketVault,
  saveTicketVault,
  updateVaultTicketStatus,
  getPendingSyncScans,
  addPendingSyncScan,
  removeSyncedPendingScans,
} from '../data/scannerStore';

const SCANNER_THEMES: Record<
  string,
  {
    headerBg: string;
    primaryBg: string;
    primaryHover: string;
    badgeBg: string;
    badgeText: string;
    accentBorder: string;
    accentText: string;
  }
> = {
  gent: {
    headerBg: 'bg-[#1E3A8A]',
    primaryBg: 'bg-[#1E3A8A]',
    primaryHover: 'hover:bg-[#172554]',
    badgeBg: 'bg-[#EBF3FB]',
    badgeText: 'text-[#1E3A8A]',
    accentBorder: 'border-[#60A5FA]',
    accentText: 'text-[#1E3A8A]',
  },
  denhaag: {
    headerBg: 'bg-[#006448]',
    primaryBg: 'bg-[#006448]',
    primaryHover: 'hover:bg-[#00503a]',
    badgeBg: 'bg-[#d8e7e2]',
    badgeText: 'text-[#006448]',
    accentBorder: 'border-[#caac8e]',
    accentText: 'text-[#006448]',
  },
  amsterdam: {
    headerBg: 'bg-[#8C0223]',
    primaryBg: 'bg-[#8C0223]',
    primaryHover: 'hover:bg-[#6c011b]',
    badgeBg: 'bg-[#FCE8EC]',
    badgeText: 'text-[#8C0223]',
    accentBorder: 'border-[#F5B7C2]',
    accentText: 'text-[#8C0223]',
  },
};

export const ScannerPwaPage: React.FC = () => {
  const { cityId } = useParams<{ cityId?: string }>();
  const [searchParams] = useSearchParams();
  const festivalParam = cityId || searchParams.get('festival') || 'denhaag';
  const currentFestival =
    INITIAL_FESTIVALS.find((f) => f.id === festivalParam) || INITIAL_FESTIVALS[0];
  const theme = SCANNER_THEMES[currentFestival.id] || SCANNER_THEMES.denhaag;

  const festivalSessions = INITIAL_SESSIONS.filter(
    (s) => s.city === currentFestival.id && s.category !== 'masterclass'
  );
  const [selectedSessionLabel, setSelectedSessionLabel] = useState<string>(
    festivalSessions[0]
      ? `${festivalSessions[0].name} (${festivalSessions[0].time})`
      : 'Vrijdagmiddag (13:00 - 17:00)'
  );

  useEffect(() => {
    const sessions = INITIAL_SESSIONS.filter(
      (s) => s.city === currentFestival.id && s.category !== 'masterclass'
    );
    if (sessions[0]) {
      setSelectedSessionLabel(`${sessions[0].name} (${sessions[0].time})`);
    }
  }, [currentFestival.id]);

  // Hardware & Network State
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');

  // Scanner Audit History, Local Ticket Vault & Offline Queue Counters
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [scanCount, setScanCount] = useState(0);
  const [vaultTickets, setVaultTickets] = useState<VaultTicket[]>(() =>
    getTicketVault(currentFestival.id)
  );
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(() =>
    getPendingSyncScans().length
  );

  // Active Scan Result Popup
  const [activeResult, setActiveResult] = useState<ScanRecord | null>(null);
  const resultTimerRef = useRef<any>(null);

  // Scan cooldown lock
  const isLockedRef = useRef(false);

  // Set of checked-in codes for instant duplicate detection
  const checkedInCodesRef = useRef<Set<string>>(new Set());

  // Modals: Search & Settings
  const [manualSearchOpen, setManualSearchOpen] = useState(false);
  const [manualQuery, setManualQuery] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [liveTickets, setLiveTickets] = useState<
    Array<{ name: string; code: string; type: string; alreadyScanned: boolean }>
  >([]);

  // Html5Qrcode scanner instance
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const containerId = 'whiskytix-clean-camera-viewport';

  // Flush offline scans to server when connection is available
  const flushOfflineQueue = async () => {
    const pending = getPendingSyncScans();
    setPendingSyncCount(pending.length);
    if (pending.length === 0) return;

    try {
      const res = await fetch('/api/scanner/sync-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          festivalId: currentFestival.id,
          scans: pending,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.results)) {
          const syncedCodes = data.results
            .filter((r: any) => r.synced)
            .map((r: any) => r.ticketCode);
          const remaining = removeSyncedPendingScans(syncedCodes);
          setPendingSyncCount(remaining.length);
        }
      }
    } catch {
      // Keep in queue for next online cycle
    }
  };

  // Preload & sync Local Ticket Vault (~150 KB) every 12 seconds when online
  const refreshTicketVault = async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOnline(false);
      return;
    }

    try {
      await flushOfflineQueue();

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(`/api/scanner/manifest?city=${currentFestival.id}`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.tickets)) {
          const pendingCodes = new Set(
            getPendingSyncScans().map((s) => s.ticketCode.toUpperCase())
          );
          const merged: VaultTicket[] = data.tickets.map((t: VaultTicket) => {
            const normCode = t.code.startsWith('#')
              ? t.code.toUpperCase()
              : `#${t.code.toUpperCase()}`;
            if (t.status === 'checked_in' || pendingCodes.has(normCode)) {
              checkedInCodesRef.current.add(normCode);
              return { ...t, code: normCode, status: 'checked_in' };
            }
            return { ...t, code: normCode };
          });
          saveTicketVault(currentFestival.id, merged);
          setVaultTickets(merged);
          setIsOnline(true);
        }
      }
    } catch {
      // Remain calm and use existing local vault
    }
  };

  // Load persistent scan history + local ticket vault on mount & set up 12s sync + online listeners
  useEffect(() => {
    const stored = getStoredScans();
    setScans(stored);
    setScanCount(stored.length);

    stored.forEach((s) => {
      if (s.status === 'valid') {
        checkedInCodesRef.current.add(s.ticketCode.toUpperCase());
      }
    });

    const cachedVault = getTicketVault(currentFestival.id);
    setVaultTickets(cachedVault);
    cachedVault.forEach((t) => {
      if (t.status === 'checked_in') {
        const normCode = t.code.startsWith('#') ? t.code.toUpperCase() : `#${t.code.toUpperCase()}`;
        checkedInCodesRef.current.add(normCode);
      }
    });

    refreshTicketVault();
    const interval = setInterval(refreshTicketVault, 12000);

    const handleOnline = () => {
      setIsOnline(true);
      refreshTicketVault();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [currentFestival.id]);

  // Populate manual search list from Local Ticket Vault first (100% offline-ready), then enrich if online
  useEffect(() => {
    const fromVault = vaultTickets
      .filter((t) => t.status !== 'cancelled' && t.status !== 'swapped')
      .map((t) => ({
        name: t.name || 'Bezoeker',
        code: t.code,
        type: t.session || 'Entreeticket',
        alreadyScanned:
          t.status === 'checked_in' || checkedInCodesRef.current.has(t.code.toUpperCase()),
      }));
    if (fromVault.length > 0) {
      setLiveTickets(fromVault);
    }

    if (!manualSearchOpen || !isOnline) return;
    fetch(`/api/admin/tickets?city=${currentFestival.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.tickets) && data.tickets.length > 0) {
          const mapped = data.tickets
            .filter((t: any) => t.status !== 'cancelled' && t.status !== 'swapped')
            .map((t: any) => {
              const code = t.code || t.ticketCode;
              return {
                name: t.attendeeName || t.buyerName || 'Bezoeker',
                code,
                type: t.session || 'Entreeticket',
                alreadyScanned:
                  t.status === 'checked-in' ||
                  checkedInCodesRef.current.has(String(code).toUpperCase()),
              };
            });
          setLiveTickets(mapped);
        }
      })
      .catch(() => {});
  }, [manualSearchOpen, currentFestival.id, vaultTickets, isOnline]);

  // Audio Tone Synthesis (Web Audio API)
  const playSound = (type: 'valid' | 'duplicate' | 'wrong_session') => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      if (type === 'valid') {
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

  // Validate against the phone's Local Ticket Vault in <10ms when WiFi/4G drops or stalls > 1.2s
  const validateAgainstLocalVault = (
    ticketCode: string,
    qrCity: string,
    fallbackName: string,
    fallbackSession: string,
    timeStr: string
  ) => {
    const normCode = ticketCode.startsWith('#')
      ? ticketCode.toUpperCase()
      : `#${ticketCode.toUpperCase()}`;

    const normalizeCity = (val: string) => {
      const s = (val || '').toLowerCase();
      if (s.includes('haag')) return 'denhaag';
      if (s.includes('amsterdam')) return 'amsterdam';
      if (s.includes('gent')) return 'gent';
      return '';
    };

    const currentVault = getTicketVault(currentFestival.id);
    const vaultMatch = currentVault.find(
      (t) => (t.code.startsWith('#') ? t.code.toUpperCase() : `#${t.code.toUpperCase()}`) === normCode
    );

    const attendeeName = vaultMatch?.name || fallbackName || 'Bezoeker';
    const sessionTitle = vaultMatch?.session || fallbackSession || 'Entreeticket';

    // 1. Check wrong festival
    const actualCity = normalizeCity(qrCity || vaultMatch?.city || '');
    const expectedCity = normalizeCity(currentFestival.id);
    if (actualCity && expectedCity && actualCity !== expectedCity) {
      const cityLabels: Record<string, string> = {
        denhaag: 'Den Haag',
        gent: 'Gent',
        amsterdam: 'Amsterdam',
      };
      displayScanResult({
        id: `scan-${Date.now()}`,
        ticketCode: normCode,
        attendeeName,
        sessionTitle,
        scannedAt: timeStr,
        status: 'wrong_session',
        detail: `Verkeerd festival: ticket is voor ${cityLabels[actualCity] || actualCity}.`,
        gate: 'Hoofdingang · Deur 1',
      });
      return;
    }

    // 2. Check cancelled or swapped in vault
    if (vaultMatch?.status === 'cancelled' || vaultMatch?.status === 'swapped') {
      displayScanResult({
        id: `scan-${Date.now()}`,
        ticketCode: normCode,
        attendeeName,
        sessionTitle,
        scannedAt: timeStr,
        status: 'duplicate',
        detail:
          vaultMatch.status === 'swapped'
            ? `Ticket is omgeruild (${vaultMatch.swapReason || 'Sessie gewijzigd'})`
            : 'Ticket is geannuleerd en niet meer geldig.',
        gate: 'Hoofdingang · Deur 1',
      });
      return;
    }

    // 3. Check duplicate scan in vault or local memory
    if (
      vaultMatch?.status === 'checked_in' ||
      checkedInCodesRef.current.has(normCode)
    ) {
      displayScanResult({
        id: `scan-${Date.now()}`,
        ticketCode: normCode,
        attendeeName,
        sessionTitle,
        scannedAt: timeStr,
        status: 'duplicate',
        detail: 'Dit ticket is al eerder gescand.',
        gate: 'Hoofdingang · Deur 1',
      });
      return;
    }

    // 4. Valid ticket -> mark checked-in locally & enqueue for background batch sync
    const nowIso = new Date().toISOString();
    checkedInCodesRef.current.add(normCode);
    const updatedVault = updateVaultTicketStatus(currentFestival.id, normCode, 'checked_in', nowIso);
    setVaultTickets(updatedVault);

    const updatedQueue = addPendingSyncScan({
      ticketCode: normCode,
      festivalId: currentFestival.id,
      scannedAt: nowIso,
      gate: 'Hoofdingang · Deur 1',
    });
    setPendingSyncCount(updatedQueue.length);
    setScanCount((prev) => prev + 1);

    displayScanResult({
      id: `scan-${Date.now()}`,
      ticketCode: normCode,
      attendeeName,
      sessionTitle,
      scannedAt: timeStr,
      status: 'valid',
      detail: 'Toegang verleend · Welkomstglas inbegrepen',
      gate: 'Hoofdingang · Deur 1',
    });
  };

  // Process a Scanned Ticket (Online with 1.2s fast timeout -> automatic <10ms Local Vault fallback)
  const handleTicketScanned = async (decodedRaw: string) => {
    if (isLockedRef.current) return;
    isLockedRef.current = true;

    let ticketCode = '#WF-2026-76464-1';
    let attendeeName = 'Bezoeker';
    let sessionTitle = festivalSessions[0]?.name || 'Entreeticket';
    let qrCity = '';

    if (decodedRaw.startsWith('WT1:')) {
      const parts = decodedRaw.split(':');
      if (parts.length >= 5) {
        ticketCode = parts[1].startsWith('#') ? parts[1] : `#${parts[1]}`;
        qrCity = parts[2] || '';
        sessionTitle = parts[3] || sessionTitle;
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

    const normCode = ticketCode.toUpperCase();
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // If offline Mode is active or browser has no signal, validate in <10ms against Local Ticket Vault
    if (!isOnline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      validateAgainstLocalVault(normCode, qrCity, attendeeName, sessionTitle, timeStr);
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);

      const res = await fetch('/api/scanner/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrPayload: decodedRaw,
          code: normCode,
          festivalId: currentFestival.id,
          gate: 'Hoofdingang · Deur 1',
          fastOnly: true,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await res.json();

      if (res.ok && data.valid) {
        checkedInCodesRef.current.add(normCode);
        const updatedVault = updateVaultTicketStatus(
          currentFestival.id,
          normCode,
          'checked_in',
          data.checkedInAt
        );
        setVaultTickets(updatedVault);
        setScanCount((prev) => prev + 1);

        const record: ScanRecord = {
          id: `scan-${Date.now()}`,
          ticketCode: normCode,
          attendeeName: data.attendeeName || attendeeName,
          sessionTitle: data.sessionTitle || sessionTitle,
          scannedAt: timeStr,
          status: 'valid',
          detail: data.message || 'Toegang verleend · Welkomstglas inbegrepen',
          gate: 'Hoofdingang · Deur 1',
        };
        displayScanResult(record);
        return;
      }

      const errMsg = data.error || 'Ticket niet geldig.';
      const isDuplicate = errMsg.toUpperCase().includes('AL GESCAND');
      const isSwapped =
        errMsg.toUpperCase().includes('OMGERUILD') || errMsg.toUpperCase().includes('VERVALLEN');

      if (isDuplicate) {
        checkedInCodesRef.current.add(normCode);
        updateVaultTicketStatus(currentFestival.id, normCode, 'checked_in');
      }

      const record: ScanRecord = {
        id: `scan-${Date.now()}`,
        ticketCode: normCode,
        attendeeName: data.attendeeName || attendeeName || 'Bezoeker',
        sessionTitle: data.sessionTitle || sessionTitle,
        scannedAt: timeStr,
        status: isSwapped ? 'duplicate' : isDuplicate ? 'duplicate' : 'wrong_session',
        detail: errMsg,
        gate: 'Hoofdingang · Deur 1',
      };
      displayScanResult(record);
      return;
    } catch {
      // Venue WiFi/4G dropped or stalled >1.2s -> Seamless <10ms fallback to Local Ticket Vault!
      validateAgainstLocalVault(normCode, qrCity, attendeeName, sessionTitle, timeStr);
    }
  };

  const displayScanResult = (record: ScanRecord) => {
    playSound(record.status);
    setActiveResult(record);

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
          ? 'Cameratoegang geweigerd. Geef toestemming in je browser.'
          : 'Geen camera gevonden op dit apparaat.'
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
  const historyUrl = `/admin/festival/${currentFestival.id}/scan/history`;

  return (
    <div className="min-h-screen bg-[#FAF7F2] bg-parchment-pattern text-[#1D1C1A] font-sans flex flex-col">
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col">
        {/* 1. Festival-Themed Header */}
        <header
          className={`${theme.headerBg} text-white px-4 py-3.5 border-b-2 border-[#1D1C1A] sticky top-0 z-40 shadow-sm`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                to={`/admin/festival/${currentFestival.id}/door`}
                className="w-9 h-9 rounded-lg bg-[#FCFAF7] text-[#1D1C1A] border-2 border-[#1D1C1A] shadow-[2px_2px_0px_rgba(29,28,26,0.9)] flex items-center justify-center shrink-0 hover:bg-[#FAF7F2] transition-colors"
                title={`Terug naar ${currentFestival.name}`}
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-extrabold text-white truncate">
                    Scanner {currentFestival.city}
                  </h1>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
                </div>
                <p className="text-xs text-white/85 font-medium truncate">
                  {currentFestival.name} · {currentFestival.location}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setManualSearchOpen(true)}
                className="w-9 h-9 rounded-lg bg-[#FCFAF7] text-[#1D1C1A] border-2 border-[#1D1C1A] shadow-[2px_2px_0px_rgba(29,28,26,0.9)] flex items-center justify-center hover:bg-[#FAF7F2] transition-colors cursor-pointer"
                title="Zoeken op naam of code"
              >
                <Search className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="w-9 h-9 rounded-lg bg-[#FCFAF7] text-[#1D1C1A] border-2 border-[#1D1C1A] shadow-[2px_2px_0px_rgba(29,28,26,0.9)] flex items-center justify-center hover:bg-[#FAF7F2] transition-colors relative cursor-pointer"
                title="Instellingen"
              >
                <Settings2 className="w-4 h-4" />
                {!isOnline && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 border border-[#1D1C1A]"></span>
                )}
              </button>
            </div>
          </div>
        </header>

        {/* 2. Session & Gate Bar */}
        <div className="px-4 py-2.5 bg-[#FCFAF7] border-b-2 border-[#1D1C1A] flex items-center justify-between gap-2 text-xs">
          <div className="text-[#1D1C1A] font-bold flex items-center gap-2 min-w-0">
            <span className={`w-2 h-2 rounded-full ${theme.primaryBg} shrink-0`}></span>
            {festivalSessions.length > 0 ? (
              <select
                value={selectedSessionLabel}
                onChange={(e) => setSelectedSessionLabel(e.target.value)}
                className="bg-transparent text-[#1D1C1A] font-bold text-xs focus:outline-none cursor-pointer truncate"
              >
                {festivalSessions.map((s) => {
                  const label = `${s.name} (${s.time})`;
                  return (
                    <option key={s.id} value={label} className="bg-[#FCFAF7] text-[#1D1C1A]">
                      {label}
                    </option>
                  );
                })}
              </select>
            ) : (
              <span className="truncate">{selectedSessionLabel}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {pendingSyncCount > 0 && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded border border-[#1D1C1A] bg-amber-50 text-amber-900">
                {pendingSyncCount} wachtend
              </span>
            )}
            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded border border-[#1D1C1A] ${theme.badgeBg} ${theme.badgeText}`}
              title={`${vaultTickets.length} tickets geladen in lokale offline kluis`}
            >
              Deur 1
            </span>
          </div>
        </div>

        {/* 3. Main Scanner Content */}
        <main className="flex-1 p-4 flex flex-col space-y-4">
          {/* Camera Viewfinder Framed in Tactile Festival Card */}
          <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-xl p-2.5 shadow-[4px_4px_0px_rgba(29,28,26,0.9)]">
            <div className="relative w-full aspect-square max-h-[340px] bg-[#1D1C1A] rounded-lg overflow-hidden border border-[#1D1C1A] flex items-center justify-center">
              <div
                id={containerId}
                className="w-full h-full object-cover [&>video]:w-full [&>video]:h-full [&>video]:object-cover"
              ></div>

              {/* Focus Frame */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="relative w-52 h-52">
                  <div
                    className={`absolute top-0 left-0 w-7 h-7 border-t-4 border-l-4 ${theme.accentBorder} rounded-tl-lg`}
                  ></div>
                  <div
                    className={`absolute top-0 right-0 w-7 h-7 border-t-4 border-r-4 ${theme.accentBorder} rounded-tr-lg`}
                  ></div>
                  <div
                    className={`absolute bottom-0 left-0 w-7 h-7 border-b-4 border-l-4 ${theme.accentBorder} rounded-bl-lg`}
                  ></div>
                  <div
                    className={`absolute bottom-0 right-0 w-7 h-7 border-b-4 border-r-4 ${theme.accentBorder} rounded-br-lg`}
                  ></div>
                </div>
              </div>

              {/* Camera Error / Starting Fallback */}
              {!cameraActive && (
                <div className="absolute inset-0 bg-[#FCFAF7] p-6 flex flex-col items-center justify-center text-center space-y-3 z-20">
                  <div
                    className={`w-12 h-12 rounded-lg ${theme.badgeBg} border-2 border-[#1D1C1A] flex items-center justify-center ${theme.badgeText}`}
                  >
                    <Camera className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-[#1D1C1A] max-w-xs">
                    {cameraError || 'Camera starten...'}
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => startCamera(cameraFacing)}
                      className={`px-4 py-2 rounded-lg ${theme.primaryBg} ${theme.primaryHover} text-white text-xs font-extrabold border-2 border-[#1D1C1A] shadow-[2px_2px_0px_rgba(29,28,26,0.9)] transition-all cursor-pointer`}
                    >
                      Opnieuw proberen
                    </button>
                    <button
                      type="button"
                      onClick={() => setManualSearchOpen(true)}
                      className="px-4 py-2 rounded-lg bg-[#FAF7F2] hover:bg-[#e4d5c4] text-[#1D1C1A] text-xs font-extrabold border-2 border-[#1D1C1A] shadow-[2px_2px_0px_rgba(29,28,26,0.9)] transition-all cursor-pointer"
                    >
                      Handmatig zoeken
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 4. Instant Scan Result Card */}
          {activeResult && (
            <div
              className={`p-4 rounded-xl border-2 border-[#1D1C1A] shadow-[3px_3px_0px_rgba(29,28,26,0.9)] animate-in zoom-in-95 duration-150 ${
                activeResult.status === 'valid'
                  ? 'bg-[#e8f5f0] text-[#1D1C1A]'
                  : activeResult.status === 'duplicate'
                  ? 'bg-red-50 text-[#1D1C1A]'
                  : 'bg-amber-50 text-[#1D1C1A]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`w-9 h-9 rounded-lg border-2 border-[#1D1C1A] flex items-center justify-center shrink-0 mt-0.5 ${
                      activeResult.status === 'valid'
                        ? 'bg-[#006448] text-white'
                        : activeResult.status === 'duplicate'
                        ? 'bg-red-700 text-white'
                        : 'bg-amber-600 text-white'
                    }`}
                  >
                    {activeResult.status === 'valid' && <CheckCircle2 className="w-5 h-5" />}
                    {activeResult.status === 'duplicate' && <AlertOctagon className="w-5 h-5" />}
                    {activeResult.status === 'wrong_session' && (
                      <AlertTriangle className="w-5 h-5" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-extrabold ${
                          activeResult.status === 'valid'
                            ? 'text-[#006448]'
                            : activeResult.status === 'duplicate'
                            ? 'text-red-800'
                            : 'text-amber-800'
                        }`}
                      >
                        {activeResult.status === 'valid'
                          ? 'Toegang verleend'
                          : activeResult.status === 'duplicate'
                          ? 'Al gescand'
                          : 'Verkeerde sessie'}
                      </span>
                      <span className="font-mono text-xs text-[#4c5752] font-bold">
                        {activeResult.ticketCode}
                      </span>
                    </div>

                    <h3 className="text-base font-extrabold text-[#1D1C1A] leading-snug mt-0.5">
                      {activeResult.attendeeName}
                    </h3>

                    <p className="text-xs text-[#4c5752] mt-0.5 font-medium">
                      {activeResult.detail}
                    </p>

                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-[#FCFAF7] border border-[#1D1C1A]">
                        {activeResult.sessionTitle}
                      </span>
                      <span className="text-xs text-[#4c5752] font-medium">
                        {activeResult.scannedAt}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={dismissResult}
                  className="p-1 rounded text-[#4c5752] hover:text-[#1D1C1A] transition-colors cursor-pointer"
                  title="Sluiten"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* 5. Recent Scan Card */}
          <div className="p-4 rounded-xl bg-[#FCFAF7] border-2 border-[#1D1C1A] shadow-[3px_3px_0px_rgba(29,28,26,0.9)]">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <UserCheck className={`w-4 h-4 ${theme.accentText}`} />
                <span className="text-xs font-extrabold text-[#1D1C1A]">Laatste scan</span>
              </div>
              <span
                className={`text-xs font-extrabold px-2.5 py-0.5 rounded border border-[#1D1C1A] ${theme.badgeBg} ${theme.badgeText}`}
              >
                {scanCount} gescand
              </span>
            </div>

            {latestScan ? (
              <div className="flex items-center justify-between py-1.5 text-xs border-t border-[#c1d4ce]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      latestScan.status === 'valid'
                        ? 'bg-[#006448]'
                        : latestScan.status === 'duplicate'
                        ? 'bg-red-600'
                        : 'bg-amber-500'
                    }`}
                  ></span>
                  <div className="min-w-0">
                    <span className="font-extrabold text-[#1D1C1A] block truncate">
                      {latestScan.attendeeName}
                    </span>
                    <span className="text-xs text-[#4c5752] block truncate">
                      <span className="font-mono">{latestScan.ticketCode}</span> ·{' '}
                      {latestScan.sessionTitle}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0 ml-2">
                  <span className="text-xs font-bold text-[#1D1C1A] block">
                    {latestScan.scannedAt}
                  </span>
                  <span
                    className={`text-[11px] font-bold ${
                      latestScan.status === 'valid'
                        ? 'text-[#006448]'
                        : latestScan.status === 'duplicate'
                        ? 'text-red-700'
                        : 'text-amber-700'
                    }`}
                  >
                    {latestScan.status === 'valid'
                      ? 'Geldig'
                      : latestScan.status === 'duplicate'
                      ? 'Duplicaat'
                      : 'Sessie'}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#4c5752] py-1">Nog geen scans op dit apparaat.</p>
            )}

            <Link
              to={historyUrl}
              className={`w-full mt-2.5 pt-2.5 border-t border-[#c1d4ce] flex items-center justify-between text-xs font-extrabold ${theme.accentText} hover:underline`}
            >
              <span>Scangeschiedenis bekijken</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </main>
      </div>

      {/* 6. Settings Modal */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 bg-[#1D1C1A]/60 flex items-end sm:items-center justify-center p-3">
          <div className="w-full max-w-md bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-xl p-5 space-y-4 shadow-xl font-sans">
            <div className="flex items-center justify-between border-b border-[#c1d4ce] pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-[#1D1C1A]">
                  Scanner instellingen ({currentFestival.city})
                </h3>
                <p className="text-xs text-[#4c5752]">{currentFestival.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="w-8 h-8 rounded-lg bg-[#FAF7F2] border border-[#1D1C1A] text-[#1D1C1A] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-3 rounded-lg border-2 border-[#1D1C1A] flex items-center gap-2 font-extrabold transition-colors cursor-pointer ${
                  soundEnabled
                    ? `${theme.badgeBg} ${theme.badgeText}`
                    : 'bg-[#FAF7F2] text-[#4c5752]'
                }`}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                <span>{soundEnabled ? 'Geluid aan' : 'Geluid uit'}</span>
              </button>

              <button
                type="button"
                onClick={toggleCameraFacing}
                className="p-3 rounded-lg bg-[#FAF7F2] border-2 border-[#1D1C1A] text-[#1D1C1A] hover:bg-[#e4d5c4] flex items-center gap-2 font-extrabold transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Wissel camera</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const nextOnline = !isOnline;
                  setIsOnline(nextOnline);
                  if (nextOnline) refreshTicketVault();
                }}
                className={`col-span-2 p-3 rounded-lg border-2 border-[#1D1C1A] flex items-center justify-between font-extrabold transition-colors cursor-pointer ${
                  isOnline ? 'bg-[#FAF7F2] text-[#1D1C1A]' : 'bg-amber-50 text-amber-900'
                }`}
              >
                <span className="flex items-center gap-2">
                  {isOnline ? (
                    <Wifi className="w-4 h-4 text-[#006448]" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-amber-700" />
                  )}
                  <span>
                    {isOnline
                      ? `Online (${vaultTickets.length} tickets offline gereed)`
                      : `Offline kluis (${vaultTickets.length} tickets)`}
                  </span>
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-[#FCFAF7] border border-[#1D1C1A]">
                  {pendingSyncCount > 0 ? `${pendingSyncCount} in wachtrij` : isOnline ? 'Actief' : 'Offline'}
                </span>
              </button>
            </div>

            {/* Test Scans */}
            <div className="pt-3 border-t border-[#c1d4ce] space-y-2">
              <span className="text-xs font-extrabold text-[#1D1C1A] block">
                Testscan uitvoeren
              </span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleTicketScanned(
                      `WT1:WF-2026-76464-1:${currentFestival.id}:${festivalSessions[0]?.name || 'Vrijdag'}:Deon Draijer:sig`
                    );
                    setSettingsOpen(false);
                  }}
                  className="p-2.5 rounded-lg bg-[#006448] text-white text-xs font-extrabold border-2 border-[#1D1C1A] shadow-[2px_2px_0px_rgba(29,28,26,0.9)] cursor-pointer"
                >
                  Geldig
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleTicketScanned('#WF-2026-84388-2');
                    setSettingsOpen(false);
                  }}
                  className="p-2.5 rounded-lg bg-red-700 text-white text-xs font-extrabold border-2 border-[#1D1C1A] shadow-[2px_2px_0px_rgba(29,28,26,0.9)] cursor-pointer"
                >
                  Duplicaat
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleTicketScanned(
                      `WT1:WF-2026-99999-1:${currentFestival.id}:Zaterdagmiddag:Martijn Vos:sig`
                    );
                    setSettingsOpen(false);
                  }}
                  className="p-2.5 rounded-lg bg-amber-600 text-white text-xs font-extrabold border-2 border-[#1D1C1A] shadow-[2px_2px_0px_rgba(29,28,26,0.9)] cursor-pointer"
                >
                  Foute sessie
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. Manual Search Modal */}
      {manualSearchOpen && (
        <div className="fixed inset-0 z-50 bg-[#1D1C1A]/60 flex items-center justify-center p-3">
          <div className="w-full max-w-md bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-xl p-5 flex flex-col justify-between max-h-[85vh] shadow-xl font-sans">
            <div className="space-y-4 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between border-b border-[#c1d4ce] pb-3 shrink-0">
                <div>
                  <h3 className="font-extrabold text-sm text-[#1D1C1A]">
                    Bezoeker zoeken ({currentFestival.city})
                  </h3>
                  <p className="text-xs text-[#4c5752]">Zoek op naam of ticketcode</p>
                </div>
                <button
                  type="button"
                  onClick={() => setManualSearchOpen(false)}
                  className="w-8 h-8 rounded-lg bg-[#FAF7F2] border border-[#1D1C1A] text-[#1D1C1A] flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="relative shrink-0">
                <input
                  type="text"
                  value={manualQuery}
                  onChange={(e) => setManualQuery(e.target.value)}
                  placeholder="Zoek op naam of #WF code..."
                  className="w-full p-3 pl-9 bg-[#FAF7F2] border-2 border-[#1D1C1A] rounded-lg text-[#1D1C1A] text-sm font-medium focus:outline-none"
                  autoFocus
                />
                <Search className="w-4 h-4 text-[#4c5752] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <div className="space-y-2 text-xs overflow-y-auto pr-1 flex-1">
                {(liveTickets.length > 0
                  ? liveTickets
                  : [
                      {
                        name: 'Deon Draijer',
                        code: '#WF-2026-76464-1',
                        type: festivalSessions[0]?.name || 'Vrijdag',
                        alreadyScanned: true,
                      },
                      {
                        name: 'Robert-Jan Bakker',
                        code: '#WF-2026-84391-1',
                        type: festivalSessions[0]?.name || 'Vrijdag',
                        alreadyScanned: false,
                      },
                    ]
                )
                  .filter(
                    (m) =>
                      !manualQuery ||
                      m.name.toLowerCase().includes(manualQuery.toLowerCase()) ||
                      m.code.toLowerCase().includes(manualQuery.toLowerCase()) ||
                      m.type.toLowerCase().includes(manualQuery.toLowerCase())
                  )
                  .slice(0, 30)
                  .map((m, i) => (
                    <div
                      key={i}
                      onClick={() => {
                        setManualSearchOpen(false);
                        handleTicketScanned(m.code);
                      }}
                      className="p-3 bg-[#FAF7F2] border-2 border-[#1D1C1A] rounded-lg hover:bg-[#e4d5c4]/40 cursor-pointer flex items-center justify-between transition-colors"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="font-extrabold text-[#1D1C1A] block text-sm truncate">
                          {m.name}
                        </span>
                        <span className="text-[#4c5752] text-xs block truncate">
                          <span className="font-mono">{m.code}</span> · {m.type}
                        </span>
                      </div>
                      <span
                        className={`text-xs font-extrabold px-2.5 py-1 rounded border border-[#1D1C1A] shrink-0 ${
                          m.alreadyScanned
                            ? 'bg-red-50 text-red-800'
                            : `${theme.primaryBg} text-white`
                        }`}
                      >
                        {m.alreadyScanned ? 'Binnen' : 'Inchecken'}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setManualSearchOpen(false)}
              className="w-full mt-4 py-2.5 rounded-lg bg-[#FAF7F2] border-2 border-[#1D1C1A] text-[#1D1C1A] font-extrabold text-xs hover:bg-[#e4d5c4] transition-colors cursor-pointer shrink-0"
            >
              Sluiten
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScannerPwaPage;
