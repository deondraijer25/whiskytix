import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Activity, ShieldAlert, CheckCircle, Clock, Volume2, VolumeX, AlertTriangle, Users, ArrowUpRight } from 'lucide-react';
import { INITIAL_SCAN_LOGS, INITIAL_FESTIVALS, ScanLog } from '../data/mockData';

export const DoorMonitorPage: React.FC = () => {
  const { cityId = 'denhaag' } = useParams<{ cityId?: string }>();
  const activeFestival = INITIAL_FESTIVALS.find((f) => f.id === cityId) || INITIAL_FESTIVALS[0];

  const [scanLogs, setScanLogs] = useState<ScanLog[]>(INITIAL_SCAN_LOGS);
  const [insideCount, setInsideCount] = useState(1042);
  const maxCapacity = activeFestival.id === 'amsterdam' ? 950 : activeFestival.id === 'gent' ? 800 : 1250;
  const insidePercentage = ((insideCount / maxCapacity) * 100).toFixed(1);

  const [alertActive, setAlertActive] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Play audio buzzer on duplicate scan
  const playAlertSound = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, audioCtx.currentTime); // Low warning buzz
      osc.frequency.setValueAtTime(110, audioCtx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.6);
    } catch (e) {
      console.log('Audio not allowed without gesture', e);
    }
  };

  const triggerSimulatedDuplicate = () => {
    setAlertActive(true);
    playAlertSound();

    const fakeDuplicate: ScanLog = {
      id: `scan-${Date.now()}`,
      ticketCode: '#WF-2026-84391-1',
      attendeeName: 'Robert-Jan Bakker (Duplicaat Poging)',
      sessionName: 'VIP Jubileum Vrijdag',
      city: activeFestival.name,
      gate: 'Deur 1 (Hoofdingang)',
      volunteerName: 'Daan (Scanner #3)',
      scannedAt: new Date().toLocaleTimeString(),
      status: 'duplicate',
    };

    setScanLogs([fakeDuplicate, ...scanLogs]);

    setTimeout(() => {
      setAlertActive(false);
    }, 6000);
  };

  return (
    <div className="space-y-6">
      {/* Red Duplicate / Fraud Alert Banner */}
      {alertActive && (
        <div className="bg-red-800 border-3 border-[#1D1C1A] text-white p-4 sm:p-6 rounded-lg shadow-[6px_6px_0px_rgba(29,28,26,0.9)] animate-bounce flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded bg-white text-red-800 flex items-center justify-center font-extrabold text-xl sm:text-2xl shrink-0">
              <ShieldAlert className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <div>
              <div className="text-[10px] sm:text-xs uppercase font-extrabold tracking-widest text-red-200">
                🚨 Duplicaat & Fraude Alert
              </div>
              <div className="font-extrabold text-sm sm:text-base">
                Ongeldige of Dubbele Scan Gedetecteerd aan Deur 1
              </div>
              <p className="text-xs text-red-100 mt-0.5">
                Barcode #WF-2026-84391-1 is zojuist opnieuw aangeboden. Toegang geweigerd!
              </p>
            </div>
          </div>
          <button
            onClick={() => setAlertActive(false)}
            className="w-full sm:w-auto bg-white text-red-900 px-3 py-1.5 rounded font-extrabold text-xs uppercase text-center"
          >
            Bevestig Alert
          </button>
        </div>
      )}

      {/* Header */}
      <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-4 sm:p-6 shadow-[5px_5px_0px_rgba(29,28,26,0.9)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-xs font-extrabold uppercase tracking-widest text-[#006448] bg-[#d8e7e2] px-2 py-0.5 rounded border border-[#8ba198]">
              {activeFestival.location} • Deurcontrole
            </span>
            <div className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
              <span className="text-[11px] text-[#006448] font-extrabold">LIVE VERBONDEN</span>
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1D1C1A] tracking-tight">
            Live Deurmonitor: {activeFestival.name}
          </h1>
          <p className="text-xs sm:text-sm text-[#4c5752] mt-0.5 font-medium">
            Volg live de binnenkomst van bezoekers aan de deuren en detecteer eventuele valse tickets direct.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="flex-1 sm:flex-initial p-2 bg-[#FAF7F2] border-2 border-[#1D1C1A] rounded text-xs font-bold text-[#1D1C1A] flex items-center justify-center gap-1.5"
            title={soundEnabled ? 'Geluid Uitschakelen' : 'Geluid Inschakelen'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-[#006448]" /> : <VolumeX className="w-4 h-4 text-gray-500" />}
            <span>{soundEnabled ? 'Geluid Aan' : 'Geluid Uit'}</span>
          </button>

          <button
            onClick={triggerSimulatedDuplicate}
            className="flex-1 sm:flex-initial bg-red-800 text-white border-2 border-[#1D1C1A] px-3.5 py-2 rounded text-xs font-extrabold uppercase tracking-wider shadow-[3px_3px_0px_rgba(29,28,26,0.9)] hover:bg-red-900 transition-colors flex items-center justify-center gap-1.5 text-center"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Simuleer Dubbele Scan</span>
          </button>
        </div>
      </div>

      {/* Big Realtime Bezoekersteller Card */}
      <div className="bg-[#006448] text-[#FAF7F2] border-3 border-[#1D1C1A] rounded-lg p-5 sm:p-8 shadow-[6px_6px_0px_rgba(29,28,26,0.9)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-widest text-[#e4d5c4] block mb-1">
              Huidige Zaalbezetting (Grote Kerk):
            </span>
            <div className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight">
              {insideCount.toLocaleString()} <span className="text-xl sm:text-3xl text-[#d8e7e2]">/ {maxCapacity.toLocaleString()}</span>
            </div>
            <p className="text-xs text-[#d8e7e2] mt-1 font-semibold">
              Nog {maxCapacity - insideCount} plaatsen beschikbaar voor deze sessie.
            </p>
          </div>

          <div className="text-left sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 border-white/20">
            <div className="text-3xl sm:text-5xl font-extrabold text-[#caac8e]">
              {insidePercentage}%
            </div>
            <span className="text-xs font-bold text-[#d8e7e2] uppercase tracking-wider">
              Bezoekers Binnen
            </span>
          </div>
        </div>

        {/* Big Progress Bar */}
        <div className="w-full bg-[#1D1C1A]/40 h-4 rounded-full mt-5 sm:mt-6 overflow-hidden border border-[#d8e7e2]/30">
          <div
            className="bg-[#caac8e] h-full rounded-full transition-all duration-500"
            style={{ width: `${insidePercentage}%` }}
          ></div>
        </div>
      </div>

      {/* Instroom per Kwartier Visualisatie & Live Scan Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Instroom per Kwartier */}
        <div className="lg:col-span-1 bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-4 sm:p-5 shadow-[4px_4px_0px_rgba(29,28,26,0.9)] space-y-4">
          <h3 className="text-xs font-extrabold uppercase tracking-widest text-[#1D1C1A] flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-[#006448]" /> Instroom per Kwartier
          </h3>

          <div className="space-y-2 text-xs">
            {[
              { time: '13:00 - 13:15', count: 180, pct: 100, label: 'Piekdrukte (Deuren open)' },
              { time: '13:15 - 13:30', count: 145, pct: 80, label: 'Doorstroom hoog' },
              { time: '13:30 - 13:45', count: 95, pct: 52, label: 'VIP start' },
              { time: '13:45 - 14:00', count: 42, pct: 23, label: 'Reguliere inloop' },
              { time: '14:00 - 14:15', count: 18, pct: 10, label: 'Rustig' },
            ].map((slot, i) => (
              <div key={i} className="p-2.5 bg-[#FAF7F2] rounded border border-[#c1d4ce] space-y-1">
                <div className="flex items-center justify-between font-extrabold">
                  <span className="text-[#1D1C1A]">{slot.time}</span>
                  <span className="text-[#006448]">{slot.count} bezoekers</span>
                </div>
                <div className="w-full bg-[#c1d4ce] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-[#006448] h-full rounded-full"
                    style={{ width: `${slot.pct}%` }}
                  ></div>
                </div>
                <div className="text-[10px] text-[#4c5752] font-semibold">{slot.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Scan Feed */}
        <div className="lg:col-span-2 bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-4 sm:p-5 shadow-[4px_4px_0px_rgba(29,28,26,0.9)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-[#1D1C1A] flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-[#006448]" /> Live Scanner Feed
              </h3>
              <span className="text-[11px] font-bold text-[#006448]">Realtime Audit Trail</span>
            </div>

            <div className="space-y-2.5">
              {scanLogs.map((log) => (
                <div
                  key={log.id}
                  className={`p-3 rounded border-2 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 ${
                    log.status === 'duplicate'
                      ? 'bg-red-50 border-red-800 text-red-950 shadow-[2px_2px_0px_rgba(153,27,27,0.5)]'
                      : 'bg-[#FAF7F2] border-[#1D1C1A] text-[#1D1C1A] shadow-[2px_2px_0px_rgba(29,28,26,0.1)]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded flex items-center justify-center font-bold text-xs shrink-0 ${
                        log.status === 'duplicate'
                          ? 'bg-red-800 text-white'
                          : 'bg-[#006448] text-white'
                      }`}
                    >
                      {log.status === 'duplicate' ? '!' : '✓'}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-extrabold text-xs">{log.attendeeName}</span>
                        <span className="font-mono text-[10px] sm:text-[11px] font-bold bg-white px-1.5 py-0.2 rounded border border-gray-300">
                          {log.ticketCode}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#4c5752] mt-0.5">
                        {log.gate} • Scanner: <strong>{log.volunteerName}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end sm:text-right shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-[#c1d4ce]/50">
                    <span className="text-xs font-mono font-bold">{log.scannedAt}</span>
                    {log.status === 'duplicate' ? (
                      <span className="ml-2 text-[10px] font-extrabold text-red-800 uppercase">
                        DUBBEL-SCAN ALERT
                      </span>
                    ) : (
                      <span className="ml-2 text-[10px] font-extrabold text-[#006448] uppercase">
                        INCHECKT
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#c1d4ce] text-center text-xs text-[#4c5752]">
            Data wordt direct gerepliceerd naar de centrale PostgreSQL database via Supabase Realtime.
          </div>
        </div>
      </div>
    </div>
  );
};
