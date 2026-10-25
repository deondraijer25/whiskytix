import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Activity,
  ShieldAlert,
  Clock,
  Volume2,
  VolumeX,
  AlertTriangle,
  RefreshCw,
  Info,
  QrCode,
} from 'lucide-react';
import { INITIAL_FESTIVALS } from '../data/mockData';
import { useEnvironment } from '../context/EnvironmentContext';
import { MollieEnvToggle } from '../components/MollieEnvToggle';

interface ScannedTicket {
  ticketCode: string;
  attendeeName: string;
  sessionTitle: string;
  cityName: string;
  festivalId?: string;
  status: string;
  checkedInAt?: string | null;
}

const DOOR_THEMES: Record<
  string,
  {
    primaryBg: string;
    primaryHover: string;
    textAccent: string;
  }
> = {
  gent: {
    primaryBg: 'bg-[#1E3A8A]',
    primaryHover: 'hover:bg-[#172554]',
    textAccent: 'text-[#1E3A8A]',
  },
  denhaag: {
    primaryBg: 'bg-[#006448]',
    primaryHover: 'hover:bg-[#00503a]',
    textAccent: 'text-[#006448]',
  },
  amsterdam: {
    primaryBg: 'bg-[#8C0223]',
    primaryHover: 'hover:bg-[#6c011b]',
    textAccent: 'text-[#8C0223]',
  },
};

export const DoorMonitorPage: React.FC = () => {
  const { cityId = 'denhaag' } = useParams<{ cityId?: string }>();
  const activeFestival =
    INITIAL_FESTIVALS.find((f: any) => f.id === cityId) || INITIAL_FESTIVALS[0];
  const theme = DOOR_THEMES[activeFestival.id] || DOOR_THEMES.denhaag;

  const isPrelaunch = activeFestival.id === 'amsterdam';

  const { env: mollieEnv } = useEnvironment();
  const [tickets, setTickets] = useState<ScannedTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [alertTesting, setAlertTesting] = useState(false);

  // Maximum venue capacity per city
  const maxCapacity =
    activeFestival.id === 'amsterdam' ? 950 : activeFestival.id === 'gent' ? 800 : 1250;

  const fetchDoorData = async (targetEnv?: 'test' | 'live') => {
    try {
      setLoading(true);
      const activeEnv = targetEnv || mollieEnv;
      const res = await fetch(`/api/admin/tickets?city=${activeFestival.id}&env=${activeEnv}`);
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
    fetchDoorData(mollieEnv);
    const interval = setInterval(() => fetchDoorData(mollieEnv), 10000);
    return () => clearInterval(interval);
  }, [activeFestival.id, mollieEnv]);

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
              <div className="text-xs font-bold text-red-200">Luidsprekertest</div>
              <div className="font-extrabold text-sm">Alarmsignaal afgespeeld</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAlertTesting(false)}
            className="bg-white text-red-900 px-3 py-1 rounded font-extrabold text-xs cursor-pointer"
          >
            Sluiten
          </button>
        </div>
      )}

      {/* Pre-launch Notification */}
      {isPrelaunch && (
        <div className="bg-[#FCFAF7] border-2 border-[#c1d4ce] rounded-lg p-4 shadow-[2px_2px_0px_rgba(29,28,26,0.06)] flex items-start gap-3">
          <div
            className={`p-2 rounded bg-[#FAF7F2] ${theme.textAccent} shrink-0 border border-[#8ba198]/40 mt-0.5`}
          >
            <Info className="w-4 h-4" />
          </div>
          <div>
            <span className={`text-xs font-extrabold ${theme.textAccent} block mb-0.5`}>
              Festival in voorbereiding
            </span>
            <p className="text-xs text-[#4c5752] leading-relaxed">
              De deuren voor <strong>{activeFestival.name}</strong> zijn momenteel gesloten.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-4 sm:p-6 shadow-[5px_5px_0px_rgba(29,28,26,0.9)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#1D1C1A] tracking-tight">
            Deur & Scanner ({activeFestival.city})
          </h1>
          <p className="text-xs text-[#4c5752] mt-0.5 font-medium">
            {activeFestival.name} · {activeFestival.location}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <Link
            to={`/admin/festival/${activeFestival.id}/scan`}
            className={`px-3.5 py-2 rounded ${theme.primaryBg} ${theme.primaryHover} text-white border-2 border-[#1D1C1A] text-xs font-extrabold shadow-[2px_2px_0px_rgba(29,28,26,0.9)] flex items-center gap-1.5 transition-all`}
          >
            <QrCode className="w-4 h-4" />
            <span>Open scanner {activeFestival.city}</span>
          </Link>

          <MollieEnvToggle onEnvChange={(newEnv) => fetchDoorData(newEnv)} />

          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 bg-[#FAF7F2] border-2 border-[#1D1C1A] rounded text-xs font-bold text-[#1D1C1A] flex items-center justify-center gap-1.5 cursor-pointer"
            title={soundEnabled ? 'Geluid uitschakelen' : 'Geluid inschakelen'}
          >
            {soundEnabled ? (
              <Volume2 className={`w-4 h-4 ${theme.textAccent}`} />
            ) : (
              <VolumeX className="w-4 h-4 text-gray-500" />
            )}
            <span>{soundEnabled ? 'Geluid aan' : 'Geluid uit'}</span>
          </button>

          <button
            type="button"
            onClick={handleTestAlertSound}
            className="bg-[#FAF7F2] hover:bg-[#EAE5DC] text-[#1D1C1A] border-2 border-[#1D1C1A] px-3 py-2 rounded text-xs font-bold shadow-[2px_2px_0px_rgba(29,28,26,0.8)] flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <AlertTriangle className="w-4 h-4 text-amber-700" />
            <span>Test geluid</span>
          </button>

          <button
            type="button"
            onClick={() => fetchDoorData(mollieEnv)}
            className="p-2 bg-[#FAF7F2] hover:bg-[#EAE5DC] text-[#1D1C1A] border-2 border-[#1D1C1A] rounded text-xs font-bold shadow-[2px_2px_0px_rgba(29,28,26,0.8)] cursor-pointer"
            title="Verversen"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Realtime Zaalbezetting Card */}
      <div
        className={`${theme.primaryBg} text-[#FAF7F2] border-2 border-[#1D1C1A] rounded-lg p-5 sm:p-7 shadow-[5px_5px_0px_rgba(29,28,26,0.9)]`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6">
          <div>
            <span className="text-xs font-bold text-white/80 block mb-1">
              Zaalbezetting {activeFestival.city}
            </span>
            <div className="text-3xl sm:text-5xl font-black tracking-tight tabular-nums">
              {insideCount.toLocaleString('nl-NL')}{' '}
              <span className="text-xl sm:text-2xl text-white/75 font-bold">
                / {maxCapacity.toLocaleString('nl-NL')}
              </span>
            </div>
            <p className="text-xs text-white/85 mt-1 font-medium">
              {insideCount === 0
                ? `Maximaal ${maxCapacity.toLocaleString('nl-NL')} bezoekers`
                : `Nog ${maxCapacity - insideCount} plaatsen beschikbaar`}
            </p>
          </div>

          <div className="text-left sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 border-white/20">
            <div className="text-3xl sm:text-5xl font-black text-[#e4d5c4] tabular-nums">
              {insidePercentage}%
            </div>
            <span className="text-xs font-bold text-white/85">Binnen</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[#1D1C1A]/40 h-3.5 rounded-full mt-5 overflow-hidden border border-white/25">
          <div
            className="bg-[#e4d5c4] h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.max(0, Math.min(100, Number(insidePercentage)))}%` }}
          ></div>
        </div>
      </div>

      {/* Instroom & Live Scan Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Instroom */}
        <div className="lg:col-span-1 bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-4 sm:p-5 shadow-[4px_4px_0px_rgba(29,28,26,0.9)] space-y-4">
          <h3 className="text-sm font-extrabold text-[#1D1C1A] flex items-center gap-1.5">
            <Clock className={`w-4 h-4 ${theme.textAccent}`} /> Instroom
          </h3>

          {checkedInTickets.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#4c5752] bg-[#FAF7F2] rounded border border-[#c1d4ce] space-y-1.5">
              <Clock className="w-6 h-6 mx-auto opacity-40 text-[#4c5752]" />
              <div className="font-extrabold text-[#1D1C1A]">Nog geen inloop</div>
            </div>
          ) : (
            <div className="space-y-2 text-xs">
              <div className="p-3 bg-[#FAF7F2] rounded border border-[#c1d4ce] space-y-1.5">
                <div className="flex items-center justify-between font-extrabold">
                  <span className="text-[#1D1C1A]">Ingecheckt</span>
                  <span className={theme.textAccent}>{checkedInTickets.length} bezoekers</span>
                </div>
                <div className="w-full bg-[#c1d4ce] h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`${theme.primaryBg} h-full rounded-full`}
                    style={{ width: `${insidePercentage}%` }}
                  ></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Live Scan Feed */}
        <div className="lg:col-span-2 bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-4 sm:p-5 shadow-[4px_4px_0px_rgba(29,28,26,0.9)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-extrabold text-[#1D1C1A] flex items-center gap-1.5">
                <Activity className={`w-4 h-4 ${theme.textAccent}`} /> Recente scans
              </h3>
              <Link
                to={`/admin/festival/${activeFestival.id}/scan/history`}
                className={`text-xs font-extrabold ${theme.textAccent} hover:underline`}
              >
                Volledige geschiedenis →
              </Link>
            </div>

            {checkedInTickets.length === 0 ? (
              <div className="py-10 text-center text-xs text-[#4c5752] space-y-2">
                <Activity className={`w-7 h-7 mx-auto opacity-30 ${theme.textAccent}`} />
                <div className="font-extrabold text-[#1D1C1A] text-sm">Nog geen scans</div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {checkedInTickets.map((t) => (
                  <div
                    key={t.ticketCode}
                    className="p-3 rounded border-2 bg-[#FAF7F2] border-[#1D1C1A] text-[#1D1C1A] shadow-[2px_2px_0px_rgba(29,28,26,0.1)] flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded flex items-center justify-center font-bold text-xs shrink-0 ${theme.primaryBg} text-white`}
                      >
                        ✓
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-extrabold text-xs">{t.attendeeName}</span>
                          <span className="font-mono text-[11px] font-bold bg-white px-1.5 py-0.5 rounded border border-gray-300">
                            {t.ticketCode}
                          </span>
                        </div>
                        <div className="text-xs text-[#4c5752] mt-0.5">
                          Hoofdingang · {t.sessionTitle}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end sm:text-right shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-[#c1d4ce]/50">
                      <span className="text-xs font-bold">
                        {t.checkedInAt ? new Date(t.checkedInAt).toLocaleTimeString() : 'Zojuist'}
                      </span>
                      <span className={`ml-2 text-xs font-extrabold ${theme.textAccent}`}>
                        Ingecheckt
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoorMonitorPage;
