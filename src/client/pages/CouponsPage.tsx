import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Ticket, Plus, CheckCircle, X, Percent, Trash2, PauseCircle } from 'lucide-react';
import { INITIAL_COUPONS, INITIAL_FESTIVALS, Coupon } from '../data/mockData';

function cityIdToLabel(cityId?: string): string {
  const s = (cityId || '').toLowerCase();
  if (s === 'denhaag') return 'Den Haag';
  if (s === 'gent') return 'Gent';
  if (s === 'amsterdam') return 'Amsterdam';
  return 'Alle Festivals';
}

function couponMatchesFestival(couponCity: string, festivalId?: string): boolean {
  if (!festivalId || festivalId === 'all') return true;
  const normFest = festivalId.toLowerCase().replace(/[\s_-]/g, '');
  const normCity = (couponCity || 'Alle Festivals').toLowerCase().replace(/[\s_-]/g, '');

  if (normCity === 'allefestivals' || normCity === 'all') return true;
  if (normFest.includes('haag') && normCity.includes('haag')) return true;
  if (normFest.includes('gent') && normCity.includes('gent')) return true;
  if (normFest.includes('amsterdam') && normCity.includes('amsterdam')) return true;
  return normCity.includes(normFest) || normFest.includes(normCity);
}

export const CouponsPage: React.FC = () => {
  const { cityId } = useParams<{ cityId?: string }>();
  const activeFestival = cityId ? INITIAL_FESTIVALS.find((f) => f.id === cityId) : null;
  const [coupons, setCoupons] = useState<Coupon[]>(INITIAL_COUPONS);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // New coupon form state
  const [newCode, setNewCode] = useState('');
  const [newCity, setNewCity] = useState<string>(() => cityIdToLabel(cityId));
  const [newType, setNewType] = useState<'percentage' | 'fixed_amount'>('percentage');
  const [newValue, setNewValue] = useState<number>(10);
  const [newMaxUses, setNewMaxUses] = useState<number>(200);
  const [newValidUntil, setNewValidUntil] = useState<string>('2027-12-31');

  useEffect(() => {
    setNewCity(cityIdToLabel(cityId));
  }, [cityId]);

  const loadCoupons = async () => {
    try {
      const res = await fetch('/api/coupons');
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.coupons)) {
          setCoupons(data.coupons);
        }
      }
    } catch {
      // Keep current list on transient offline error
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCoupons();
  }, [cityId]);

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = newCode.toUpperCase().trim();
    if (!cleanCode || isSaving) return;

    setIsSaving(true);
    const payload = {
      code: cleanCode,
      city: newCity,
      type: newType,
      value: newType === 'percentage' ? Math.round(newValue) : Math.round(newValue * 100),
      maxUses: newMaxUses,
      validUntil: newValidUntil,
    };

    try {
      const res = await fetch('/api/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.coupon) {
          setCoupons((prev) => [
            data.coupon,
            ...prev.filter((c) => c.code.toUpperCase() !== data.coupon.code.toUpperCase()),
          ]);
          setIsModalOpen(false);
          setNewCode('');
          setIsSaving(false);
          return;
        }
      }
    } catch {
      // Fallback below
    }

    const fallbackCoupon: Coupon = {
      id: `coup-${Date.now()}`,
      code: payload.code,
      city: payload.city,
      type: payload.type,
      value: payload.value,
      usedCount: 0,
      maxUses: payload.maxUses,
      totalDiscountGrantedCents: 0,
      validUntil: payload.validUntil,
      isActive: true,
    };

    setCoupons((prev) => [
      fallbackCoupon,
      ...prev.filter((c) => c.code.toUpperCase() !== fallbackCoupon.code.toUpperCase()),
    ]);
    setIsModalOpen(false);
    setNewCode('');
    setIsSaving(false);
  };

  const handleToggleActive = async (coupon: Coupon) => {
    const nextState = !coupon.isActive;
    setCoupons((prev) =>
      prev.map((c) => (c.id === coupon.id || c.code === coupon.code ? { ...c, isActive: nextState } : c))
    );
    try {
      const res = await fetch(`/api/coupons/${encodeURIComponent(coupon.code)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: nextState }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.coupon) {
          setCoupons((prev) =>
            prev.map((c) => (c.code === data.coupon.code ? data.coupon : c))
          );
        }
      }
    } catch {
      // Optimistic state kept
    }
  };

  const handleDeleteCoupon = async (coupon: Coupon) => {
    setCoupons((prev) => prev.filter((c) => c.code !== coupon.code && c.id !== coupon.id));
    try {
      await fetch(`/api/coupons/${encodeURIComponent(coupon.code)}`, {
        method: 'DELETE',
      });
    } catch {
      // Ignore error
    }
  };

  const filteredCoupons = coupons.filter((c) =>
    couponMatchesFestival(c.city, activeFestival?.id)
  );

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-6 shadow-[4px_4px_0px_rgba(29,28,26,0.9)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-extrabold text-[#006448] bg-[#d8e7e2] px-2.5 py-0.5 rounded border border-[#8ba198]">
              {activeFestival ? `${activeFestival.city} · Kortingscodes` : 'Centraal voucherbeheer'}
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#1D1C1A] tracking-tight">
            Kortingscodes & vouchers
          </h1>
          <p className="text-xs sm:text-sm text-[#4c5752] mt-0.5 font-medium">
            Maak actiecodes aan voor percentage- of bedragskorting. Codes werken direct live op de festivalwebsites.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setNewCity(cityIdToLabel(cityId));
            setIsModalOpen(true);
          }}
          className="btn-letterpress w-full sm:w-auto px-4 py-2.5 rounded-lg text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4 text-[#e4d5c4]" />
          <span>Nieuwe kortingscode aanmaken</span>
        </button>
      </div>

      {/* Empty State */}
      {!isLoading && filteredCoupons.length === 0 ? (
        <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-8 sm:p-12 shadow-[4px_4px_0px_rgba(29,28,26,0.9)] text-center">
          <div className="max-w-md mx-auto space-y-2.5">
            <Ticket className="w-10 h-10 text-[#caac8e] mx-auto opacity-70" />
            <h3 className="font-extrabold text-[#1D1C1A] text-base">
              Nog geen kortingscodes {activeFestival ? `voor ${activeFestival.city}` : ''}
            </h3>
            <p className="text-xs text-[#4c5752] leading-relaxed">
              Gebruik de knop &ldquo;Nieuwe kortingscode aanmaken&rdquo; om een percentage- of bedragskorting toe te voegen die direct werkt op de ticketshop.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Mobile Coupon Cards (< md) */}
          <div className="block md:hidden space-y-3">
            {filteredCoupons.map((c) => (
              <div
                key={c.code}
                className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-4 shadow-[3px_3px_0px_rgba(29,28,26,0.9)] space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono font-extrabold text-sm text-[#006448] bg-[#d8e7e2] px-2.5 py-1 rounded border border-[#8ba198]">
                    {c.code}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(c)}
                      className="cursor-pointer"
                      title={c.isActive ? 'Klik om te pauzeren' : 'Klik om te activeren'}
                    >
                      {c.isActive ? (
                        <span className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                          <CheckCircle className="w-3 h-3" /> Actief
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-extrabold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-300">
                          <PauseCircle className="w-3 h-3" /> Gepauzeerd
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCoupon(c)}
                      className="p-1.5 rounded text-red-800 hover:bg-red-50 transition-colors cursor-pointer"
                      title="Verwijderen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div>
                    <span className="text-[#4c5752] block font-semibold text-[11px]">Korting:</span>
                    <span className="font-extrabold text-sm text-[#006448] inline-flex items-center gap-0.5">
                      {c.type === 'percentage' ? (
                        <>
                          <Percent className="w-3.5 h-3.5" /> {c.value}%
                        </>
                      ) : (
                        <>€ {(c.value / 100).toFixed(2).replace('.', ',')}</>
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#4c5752] block font-semibold text-[11px]">Geldig voor:</span>
                    <span className="font-bold text-[#1D1C1A]">{c.city}</span>
                  </div>
                  <div>
                    <span className="text-[#4c5752] block font-semibold text-[11px]">Gebruikt:</span>
                    <span className="font-bold text-[#1D1C1A]">
                      {c.usedCount} / {c.maxUses} keer
                    </span>
                  </div>
                  <div>
                    <span className="text-[#4c5752] block font-semibold text-[11px]">Totale korting:</span>
                    <span className="font-extrabold text-[#006448]">
                      € {(c.totalDiscountGrantedCents / 100).toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#c1d4ce] flex items-center justify-between text-xs text-[#4c5752] font-semibold">
                  <span>
                    Geldig tot: <strong>{c.validUntil}</strong>
                  </span>
                  <span className="text-[#006448] font-bold">Live gesynchroniseerd</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Coupons Table (>= md) */}
          <div className="hidden md:block bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg shadow-[4px_4px_0px_rgba(29,28,26,0.9)] overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#FAF7F2] border-b-2 border-[#1D1C1A] text-[#4c5752] font-extrabold">
                  <th className="py-3.5 px-4">Code</th>
                  <th className="py-3.5 px-4">Geldig voor</th>
                  <th className="py-3.5 px-4">Korting</th>
                  <th className="py-3.5 px-4">Gebruikt</th>
                  <th className="py-3.5 px-4">Totale korting</th>
                  <th className="py-3.5 px-4">Geldig tot</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actie</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c1d4ce]">
                {filteredCoupons.map((c) => (
                  <tr key={c.code} className="hover:bg-[#FAF7F2] transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-mono font-extrabold text-sm text-[#006448] bg-[#d8e7e2] px-2.5 py-0.5 rounded border border-[#8ba198]">
                        {c.code}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-[#1D1C1A]">{c.city}</td>
                    <td className="py-3 px-4 font-extrabold text-[#1D1C1A]">
                      {c.type === 'percentage' ? (
                        <span className="inline-flex items-center gap-1 text-[#006448]">
                          <Percent className="w-3.5 h-3.5" /> {c.value}%
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[#006448]">
                          € {(c.value / 100).toFixed(2).replace('.', ',')}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-bold text-[#1D1C1A]">
                      {c.usedCount} / {c.maxUses} keer
                    </td>
                    <td className="py-3 px-4 font-extrabold text-[#006448]">
                      € {(c.totalDiscountGrantedCents / 100).toFixed(2).replace('.', ',')}
                    </td>
                    <td className="py-3 px-4 text-[#4c5752] font-semibold">{c.validUntil}</td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(c)}
                        className="cursor-pointer"
                        title={c.isActive ? 'Klik om te pauzeren' : 'Klik om te activeren'}
                      >
                        {c.isActive ? (
                          <span className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300 hover:bg-emerald-200 transition-colors">
                            <CheckCircle className="w-3 h-3" /> Actief
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-extrabold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-300 hover:bg-amber-100 transition-colors">
                            <PauseCircle className="w-3 h-3" /> Gepauzeerd
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteCoupon(c)}
                        className="px-2.5 py-1 rounded text-xs font-bold text-red-800 hover:bg-red-50 inline-flex items-center gap-1 transition-colors cursor-pointer"
                        title="Kortingscode verwijderen"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Verwijderen</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modal: Nieuwe kortingscode aanmaken */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#1D1C1A]/60 overflow-y-auto">
          <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-xl shadow-xl max-w-md w-full my-auto max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 font-sans">
            <div className="bg-[#006448] text-white px-5 py-4 border-b-2 border-[#1D1C1A] flex items-center justify-between shrink-0">
              <h3 className="font-extrabold text-sm text-white">
                Nieuwe kortingscode aanmaken
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded hover:bg-black/20 text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCoupon} className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-extrabold text-[#1D1C1A] mb-1">
                  Kortingscode
                </label>
                <input
                  type="text"
                  required
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="Bijv. VRIENDEN10 of VIP2026"
                  className="w-full px-3 py-2.5 bg-[#FAF7F2] border-2 border-[#1D1C1A] rounded-lg text-sm font-mono font-bold uppercase focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-extrabold text-[#1D1C1A] mb-1">
                    Type korting
                  </label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as 'percentage' | 'fixed_amount')}
                    className="w-full px-3 py-2.5 bg-[#FAF7F2] border-2 border-[#1D1C1A] rounded-lg text-xs font-bold focus:outline-none"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed_amount">Vast bedrag (€)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-[#1D1C1A] mb-1">
                    {newType === 'percentage' ? 'Percentage (%)' : 'Bedrag in euro (€)'}
                  </label>
                  <input
                    type="number"
                    step={newType === 'percentage' ? '1' : '0.5'}
                    min="1"
                    required
                    value={newValue}
                    onChange={(e) => setNewValue(parseFloat(e.target.value) || 0)}
                    placeholder={newType === 'percentage' ? '10' : '5'}
                    className="w-full px-3 py-2.5 bg-[#FAF7F2] border-2 border-[#1D1C1A] rounded-lg text-xs font-bold focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-[#1D1C1A] mb-1">
                  Geldig voor festival
                </label>
                <select
                  value={newCity}
                  onChange={(e) => setNewCity(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#FAF7F2] border-2 border-[#1D1C1A] rounded-lg text-xs font-bold focus:outline-none"
                >
                  <option value="Alle Festivals">Alle Festivals</option>
                  <option value="Den Haag">Alleen Den Haag</option>
                  <option value="Gent">Alleen Gent</option>
                  <option value="Amsterdam">Alleen Amsterdam</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-extrabold text-[#1D1C1A] mb-1">
                    Max. aantal keer te gebruiken
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newMaxUses}
                    onChange={(e) => setNewMaxUses(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2.5 bg-[#FAF7F2] border-2 border-[#1D1C1A] rounded-lg text-xs font-bold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-[#1D1C1A] mb-1">
                    Geldig tot en met
                  </label>
                  <input
                    type="date"
                    value={newValidUntil}
                    onChange={(e) => setNewValidUntil(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#FAF7F2] border-2 border-[#1D1C1A] rounded-lg text-xs font-bold focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[#c1d4ce] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg text-xs font-bold text-[#4c5752] hover:text-[#1D1C1A] cursor-pointer"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="btn-letterpress px-4 py-2.5 rounded-lg text-xs font-extrabold cursor-pointer"
                >
                  {isSaving ? 'Opslaan...' : 'Kortingscode opslaan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
