import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Activity,
  ShieldAlert,
  Clock,
  Volume2,
  VolumeX,
  AlertTriangle,
  RefreshCw,
  Info
} from 'lucide-react';
import { INITIAL_FESTIVALS } from '../data/mockData';

interface ScannedTicket {
  ticketCode: string;
  attendeeName: string;
  sessionTitle: string;
  cityName: string;
  festivalId?: string;
  status: string;
  checkedInAt?: string | null;
}

export const DoorMonitorPage: React.FC = () => {
  const { cityId = 'denhaag' } = useParams<{ cityId?: string }>();
  const activeFestival = INITIAL_FESTIVALS.find((f) => f.id === cityId) || INITIAL_FESTIVALS[0];

  const isPrelaunch = activeFestival.id === 'denhaag' || activeFestival.id === 'amsterdam';

  const [tickets, setTickets] = useState<ScannedTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [alertTesting, setAlertTesting] = useState(false);

  // Maximum venue capacity per city
  const maxCapacity = activeFestival.id === 'amsterdam' ? 950 : activeFestival.id === 'gent' ? 800 : 1250;

  const fetchDoorData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/tickets');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.tickets)) {
          setTickets(data.tickets);
        }
      }
    } catch (err) {
      console.error('Kon deurcontrole data niet ophalen:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoorData();
    const interval = setInterval(fetchDoorData, 10000);
    return () => clearInterval(interval);
  }, [activeFestival.id]);

  // Filter tickets belonging to this festival
  const festivalTickets = isPrelaunch
    ? []
    : tickets.filter((t) => {
        const c = (t.cityName || '').toLowerCase();
        const f = (t.festivalId || '').toLowerCase();
        const target = activeFestival.id.toLowerCase();
        return f === target || c.includes(target);
      });

  // Real checked-in visitors inside
  const checkedInTickets = festivalTickets.filter((t) => t.status === 'checked_in');
  const insideCount = checkedInTickets.length;
  const insidePercentage = maxCapacity > 0 ? ((insideCount / maxCapacity) * 100).toFixed(1) : '0.0';

  // Play audio buzzer test
  const playAlertSound = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, audioCtx.currentTime);
      osc.frequency.setValueAtTime(110, audioCtx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.6);
    } catch (e) {
      console.log('Audio requires user gesture', e);
    }
  };

  const handleTestAlertSound = () => {
    setAlertTesting(true);
    playAlertSound();
    setTimeout(() => {
      setAlertTesting(false);
    }, 2500);
  };

  return (
    <div className="space-y-6">
      {/* Alert Test Banner */}
      {alertTesting && (
        <div className="bg-red-800 border-2 border-[#1D1C1A] text-white p-4 rounded-lg shadow-[4px_4px_0px_rgba(29,28,26,0.9)] flex items-center justify-between gap-3 animate-in fade-in duration-150">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-white text-red-800 flex items-center justify-center font-extrabold text-xl shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-extrabold tracking-widest text-red-200">
                Luidspreker & Hardware Test
              </div>
              <div className="font-extrabold text-sm">
                Alarmsignaal actief afgespeeld via audio-interface
              </div>
            </div>
          </div>
          <button
            onClick={() => setAlertTesting(false)}
            className="bg-white text-red-900 px-3 py-1 rounded font-extrabold text-xs uppercase"
          >
            Sluiten
          </button>
        </div>
      )}

      {/* Pre-launch Notification for Den Haag & Amsterdam */}
      {isPrelaunch && (
        <div className="bg-[#FCFAF7] border-2 border-[#c1d4ce] rounded-lg p-4 shadow-[2px_2px_0px_rgba(29,28,26,0.06)] flex items-start gap-3">
          <div className="p-2 rounded bg-[#FAF7F2] text-[#006448] shrink-0 border border-[#8ba198]/40 mt-0.5">
            <Info className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#006448] block mb-0.5">
              Festival In Voorbereiding
            </span>
            <p className="text-xs text-[#4c5752] leading-relaxed">
              De deuren voor <strong>{activeFestival.name}</strong> zijn momenteel gesloten. De live deurtelling en scannerpoorten worden automatisch actief zodra de kaartverkoop start en scanners inchecken.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-4 sm:p-6 shadow-[5px_5px_0px_rgba(29,28,26,0.9)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-xs font-extrabold uppercase tracking-widest text-[#006448] bg-[#d8e7e2] px-2 py-0.5 rounded border border-[#8ba198]">
              {activeFestival.location} • Deurcontrole
            </span>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
              <span className="text-[11px] text-[#006448] font-extrabold">
                {isPrelaunch ? 'STANDBY' : 'LIVE VERBONDEN'}
              </span>
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1D1C1A] tracking-tight">
            Live Deurmonitor: {activeFestival.name}
          </h1>
          <p className="text-xs sm:text-sm text-[#4c5752] mt-0.5 font-medium">
            Volg live de binnenkomst van bezoekers aan de ingangsdeuren en inspecteer realtime check-ins.
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
            onClick={handleTestAlertSound}
            className="flex-1 sm:flex-initial bg-[#FAF7F2] hover:bg-[#EAE5DC] text-[#1D1C1A] border-2 border-[#1D1C1A] px-3.5 py-2 rounded text-xs font-extrabold tracking-wider shadow-[2px_2px_0px_rgba(29,28,26,0.8)] flex items-center justify-center gap-1.5 text-center"
          >
            <AlertTriangle className="w-4 h-4 text-amber-700" />
            <span>Test Audiosignaal</span>
          </button>

          <button
            onClick={fetchDoorData}
            className="p-2 bg-[#FAF7F2] hover:bg-[#EAE5DC] text-[#1D1C1A] border-2 border-[#1D1C1A] rounded text-xs font-bold shadow-[2px_2px_0px_rgba(29,28,26,0.8)]"
            title="Verversen"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Realtime Zaalbezetting Card */}
      <div className="bg-[#006448] text-[#FAF7F2] border-3 border-[#1D1C1A] rounded-lg p-5 sm:p-8 shadow-[6px_6px_0px_rgba(29,28,26,0.9)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-widest text-[#e4d5c4] block mb-1">
              Huidige Zaalbezetting ({activeFestival.name}):
            </span>
            <div className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight">
              {insideCount.toLocaleString()} <span className="text-xl sm:text-3xl text-[#d8e7e2]">/ {maxCapacity.toLocaleString()}</span>
            </div>
            <p className="text-xs text-[#d8e7e2] mt-1 font-semibold">
              {insideCount === 0
                ? `Deuren zijn gereed voor maximaal ${maxCapacity.toLocaleString()} gelijktijdige bezoekers.`
                : `Nog ${maxCapacity - insideCount} plaatsen beschikbaar voor deze sessie.`}
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
            style={{ width: `${Math.max(0, Math.min(100, Number(insidePercentage)))}%` }}
          ></div>
        </div>
      </div>

      {/* Instroom per Kwartier & Live Scan Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Instroom per Kwartier */}
        <div className="lg:col-span-1 bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-4 sm:p-5 shadow-[4px_4px_0px_rgba(29,28,26,0.9)] space-y-4">
          <h3 className="text-xs font-extrabold uppercase tracking-widest text-[#1D1C1A] flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-[#006448]" /> Instroomverloop
          </h3>

          {checkedInTickets.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#4c5752] bg-[#FAF7F2] rounded border border-[#c1d4ce] space-y-1.5">
              <Clock className="w-6 h-6 mx-auto opacity-40 text-[#4c5752]" />
              <div className="font-extrabold text-[#1D1C1A]">Geen inloop geregistreerd</div>
              <p className="text-[11px] text-[#7A7268]">
                Zodra de deuren openen en bezoekers passeren, wordt de kwartierverdeling hier opgebouwd.
              </p>
            </div>
          ) : (
            <div className="space-y-2 text-xs">
              <div className="p-2.5 bg-[#FAF7F2] rounded border border-[#c1d4ce] space-y-1">
                <div className="flex items-center justify-between font-extrabold">
                  <span className="text-[#1D1C1A]">Actieve Sessie</span>
                  <span className="text-[#006448]">{checkedInTickets.length} bezoekers</span>
                </div>
                <div className="w-full bg-[#c1d4ce] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-[#006448] h-full rounded-full"
                    style={{ width: `${insidePercentage}%` }}
                  ></div>
                </div>
                <div className="text-[10px] text-[#4c5752] font-semibold">Geregistreerde check-ins</div>
              </div>
            </div>
          )}
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

            {checkedInTickets.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#4c5752] space-y-2">
                <Activity className="w-8 h-8 mx-auto opacity-30 text-[#006448]" />
                <div className="font-extrabold text-[#1D1C1A] text-sm">Nog geen scans geregistreerd</div>
                <p className="text-[11px] text-[#7A7268] max-w-sm mx-auto">
                  De audit trail toont direct alle goedgekeurde en geweigerde barcodes zodra de scanners aan de poorten actief zijn.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {checkedInTickets.map((t) => (
                  <div
                    key={t.ticketCode}
                    className="p-3 rounded border-2 bg-[#FAF7F2] border-[#1D1C1A] text-[#1D1C1A] shadow-[2px_2px_0px_rgba(29,28,26,0.1)] flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded flex items-center justify-center font-bold text-xs shrink-0 bg-[#006448] text-white">
                        ✓
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-extrabold text-xs">{t.attendeeName}</span>
                          <span className="font-mono text-[10px] sm:text-[11px] font-bold bg-white px-1.5 py-0.2 rounded border border-gray-300">
                            {t.ticketCode}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#4c5752] mt-0.5">
                          Hoofdingang • {t.sessionTitle}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end sm:text-right shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-[#c1d4ce]/50">
                      <span className="text-xs font-mono font-bold">
                        {t.checkedInAt ? new Date(t.checkedInAt).toLocaleTimeString() : 'Zojuist'}
                      </span>
                      <span className="ml-2 text-[10px] font-extrabold text-[#006448] uppercase">
                        INGECHECKT
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-[#c1d4ce] text-center text-xs text-[#4c5752]">
            Data wordt direct beveiligd en gesynchroniseerd over alle aangesloten poortscanners.
          </div>
        </div>
      </div>
    </div>
  );
};
