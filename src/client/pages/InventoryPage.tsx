import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Layers, AlertCircle, CheckCircle, Edit3, Lock, Unlock, Users, Plus, Save } from 'lucide-react';
import { INITIAL_SESSIONS, INITIAL_FESTIVALS, SessionCapacity } from '../data/mockData';

export const InventoryPage: React.FC = () => {
  const { cityId } = useParams<{ cityId?: string }>();
  const [sessions, setSessions] = useState<SessionCapacity[]>(INITIAL_SESSIONS);
  const [selectedCity, setSelectedCity] = useState<'denhaag' | 'amsterdam' | 'gent'>(
    (cityId as any) || 'denhaag'
  );
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [tempCapacity, setTempCapacity] = useState<number>(0);

  const effectiveCity = (cityId as any) || selectedCity;
  const activeFestival = INITIAL_FESTIVALS.find((f) => f.id === effectiveCity);

  const filteredSessions = sessions.filter((s) => s.city === effectiveCity);
  const regularAndVip = filteredSessions.filter((s) => s.category !== 'masterclass');
  const masterclasses = filteredSessions.filter((s) => s.category === 'masterclass');

  const toggleSoldOut = (id: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isSoldOut: !s.isSoldOut } : s))
    );
  };

  const startEdit = (s: SessionCapacity) => {
    setEditingSessionId(s.id);
    setTempCapacity(s.max);
  };

  const saveCapacity = (id: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, max: tempCapacity } : s))
    );
    setEditingSessionId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-6 shadow-[5px_5px_0px_rgba(29,28,26,0.9)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-extrabold uppercase tracking-widest text-[#006448] bg-[#d8e7e2] px-2 py-0.5 rounded border border-[#8ba198]">
              {activeFestival ? `${activeFestival.edition} • Capaciteit` : 'Voorraad & Toegangscontrole'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1D1C1A] tracking-tight">
            {activeFestival ? `Zaalcapaciteit: ${activeFestival.name}` : 'Sessies & Zaalcapaciteit'}
          </h1>
          <p className="text-xs sm:text-sm text-[#4c5752] mt-0.5 font-medium">
            Beheer realtime bezoekersaantallen en voorkom overboekingen met atomaire voorraadvergrendeling.
          </p>
        </div>

        {/* City Filter Tabs (only shown if not in a festival route) */}
        {!cityId && (
          <div className="flex items-center gap-1 bg-[#FAF7F2] p-1.5 rounded border-2 border-[#1D1C1A] w-full sm:w-auto overflow-x-auto">
            {[
              { id: 'denhaag', label: 'Den Haag' },
              { id: 'amsterdam', label: 'Amsterdam' },
              { id: 'gent', label: 'Gent' },
            ].map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCity(c.id as any)}
                className={`flex-1 sm:flex-initial px-3 py-1.5 rounded text-xs font-extrabold uppercase tracking-wider transition-all text-center ${
                  selectedCity === c.id
                    ? 'bg-[#006448] text-white shadow-[2px_2px_0px_rgba(29,28,26,0.9)]'
                    : 'text-[#4c5752] hover:text-[#1D1C1A]'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hoofdsessies Section */}
      <div className="space-y-4">
        <h2 className="text-xs font-extrabold uppercase tracking-widest text-[#1D1C1A] flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#006448]"></span>
          Festival Sessies per Dag
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {regularAndVip.map((s) => {
            const pct = Math.min(100, Math.round((s.sold / s.max) * 100));
            const isFull = s.sold >= s.max || s.isSoldOut;

            return (
              <div
                key={s.id}
                className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-4 sm:p-5 shadow-[4px_4px_0px_rgba(29,28,26,0.9)] space-y-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#006448] bg-[#d8e7e2] px-2 py-0.5 rounded border border-[#8ba198]">
                      {s.day}
                    </span>
                    <h3 className="font-extrabold text-sm sm:text-base text-[#1D1C1A] mt-1">{s.name}</h3>
                    <p className="text-xs text-[#4c5752] font-semibold">{s.time}</p>
                  </div>

                  <button
                    onClick={() => toggleSoldOut(s.id)}
                    className={`px-2.5 py-1 rounded text-xs font-extrabold uppercase tracking-wider border-2 transition-all flex items-center gap-1 shrink-0 ${
                      isFull
                        ? 'bg-red-800 text-white border-[#1D1C1A] shadow-[2px_2px_0px_rgba(29,28,26,0.9)]'
                        : 'bg-emerald-100 text-[#006448] border-[#006448]'
                    }`}
                  >
                    {isFull ? (
                      <>
                        <Lock className="w-3.5 h-3.5" /> UITVERKOCHT
                      </>
                    ) : (
                      <>
                        <Unlock className="w-3.5 h-3.5" /> BESCHIKBAAR
                      </>
                    )}
                  </button>
                </div>

                {/* Progress Bar & Numbers */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-extrabold">
                    <span className="text-[#1D1C1A]">
                      {s.sold.toLocaleString()} / {s.max.toLocaleString()} kaarten
                    </span>
                    <span className={pct >= 90 ? 'text-red-700' : 'text-[#006448]'}>
                      {pct}% bezet
                    </span>
                  </div>

                  <div className="w-full bg-[#c1d4ce] h-2.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        pct >= 100
                          ? 'bg-red-800'
                          : pct >= 80
                          ? 'bg-amber-600'
                          : 'bg-[#006448]'
                      }`}
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>

                {/* Edit Capacity Button / Inline Form */}
                <div className="pt-2 border-t border-[#c1d4ce] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  {editingSessionId === s.id ? (
                    <div className="flex flex-wrap items-center gap-2 w-full">
                      <span className="text-xs font-bold text-[#4c5752]">Max:</span>
                      <input
                        type="number"
                        value={tempCapacity}
                        onChange={(e) => setTempCapacity(parseInt(e.target.value) || 0)}
                        className="w-24 px-2 py-1.5 bg-white border-2 border-[#1D1C1A] rounded text-base sm:text-xs font-extrabold"
                      />
                      <button
                        onClick={() => saveCapacity(s.id)}
                        className="btn-letterpress py-1.5 px-3 rounded text-xs font-extrabold flex items-center gap-1"
                      >
                        <Save className="w-3.5 h-3.5" /> Opslaan
                      </button>
                      <button
                        onClick={() => setEditingSessionId(null)}
                        className="text-xs font-bold text-[#4c5752] hover:text-[#1D1C1A] py-1.5 px-2"
                      >
                        Annuleer
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="text-xs text-[#4c5752] font-semibold">
                        Gereserveerd in cart lock: <strong>14 tickets</strong>
                      </span>
                      <button
                        onClick={() => startEdit(s)}
                        className="text-xs font-extrabold text-[#006448] hover:underline flex items-center gap-1 self-start sm:self-auto"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Capaciteit Wijzigen</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Masterclasses & Proeverijen Section */}
      <div className="space-y-4 pt-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-xs font-extrabold uppercase tracking-widest text-[#1D1C1A] flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#caac8e]"></span>
            Masterclasses & VIP Tastings (20-30 plaatsen)
          </h2>
          <span className="text-xs font-bold text-[#006448] cursor-pointer hover:underline">
            + Nieuwe Masterclass Toevoegen
          </span>
        </div>

        {/* Mobile Masterclasses Card Stream (< md) */}
        <div className="block md:hidden space-y-3">
          {masterclasses.map((mc) => {
            const pct = Math.round((mc.sold / mc.max) * 100);
            const isSoldOut = mc.isSoldOut || mc.sold >= mc.max;
            return (
              <div
                key={mc.id}
                className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-4 shadow-[3px_3px_0px_rgba(29,28,26,0.9)] space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <h3 className="font-extrabold text-sm text-[#1D1C1A] leading-snug">
                      {mc.name}
                    </h3>
                    <p className="text-xs text-[#4c5752] font-semibold">
                      {mc.day} • {mc.time}
                    </p>
                  </div>
                  {isSoldOut ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-red-800 bg-red-100 px-2 py-0.5 rounded-full border border-red-300 shrink-0">
                      <Lock className="w-3 h-3" /> VOL
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300 shrink-0">
                      <CheckCircle className="w-3 h-3" /> {mc.max - mc.sold} VRIJ
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-extrabold">
                    <span className="text-[#4c5752]">{mc.sold} van {mc.max} stoelen bezet</span>
                    <span className={pct >= 90 ? 'text-red-700' : 'text-[#006448]'}>{pct}%</span>
                  </div>
                  <div className="w-full bg-[#c1d4ce] h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${pct >= 100 ? 'bg-red-800' : 'bg-[#006448]'}`}
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>

                {/* Action Row */}
                <div className="pt-2 border-t border-[#c1d4ce] flex items-center justify-between">
                  <span className="text-[11px] text-[#4c5752] font-semibold">
                    Status: {isSoldOut ? 'Gesloten voor verkoop' : 'Beschikbaar'}
                  </span>
                  <button
                    onClick={() => toggleSoldOut(mc.id)}
                    className="btn-letterpress-outline px-3 py-1 rounded text-xs font-extrabold"
                  >
                    {mc.isSoldOut ? 'Zaal Openen' : 'Zaal Sluiten'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop Masterclasses Table (>= md) */}
        <div className="hidden md:block bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg shadow-[4px_4px_0px_rgba(29,28,26,0.9)] overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#FAF7F2] border-b-2 border-[#1D1C1A] text-[#4c5752] font-extrabold uppercase tracking-wider">
                <th className="py-3 px-4">Proeverij / Masterclass</th>
                <th className="py-3 px-4">Datum & Tijd</th>
                <th className="py-3 px-4">Capaciteit</th>
                <th className="py-3 px-4">Voortgang</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actie</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c1d4ce]">
              {masterclasses.map((mc) => {
                const pct = Math.round((mc.sold / mc.max) * 100);
                return (
                  <tr key={mc.id} className="hover:bg-[#FAF7F2]">
                    <td className="py-3 px-4 font-extrabold text-[#1D1C1A]">{mc.name}</td>
                    <td className="py-3 px-4 text-[#4c5752] font-semibold">
                      {mc.day} • {mc.time}
                    </td>
                    <td className="py-3 px-4 font-bold text-[#1D1C1A]">
                      {mc.sold} / {mc.max} stoelen
                    </td>
                    <td className="py-3 px-4 w-40">
                      <div className="w-full bg-[#c1d4ce] h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            pct >= 100 ? 'bg-red-800' : 'bg-[#006448]'
                          }`}
                          style={{ width: `${pct}%` }}
                        ></div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {mc.isSoldOut || mc.sold >= mc.max ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-red-800 bg-red-100 px-2 py-0.5 rounded-full border border-red-300">
                          <Lock className="w-3 h-3" /> VOLGEBOEKT
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                          <CheckCircle className="w-3 h-3" /> {mc.max - mc.sold} VRIJ
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => toggleSoldOut(mc.id)}
                        className="btn-letterpress-outline px-2.5 py-1 rounded text-[11px] font-extrabold"
                      >
                        {mc.isSoldOut ? 'Open' : 'Sluit'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
