import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Ticket, Plus, CheckCircle, Clock, X, Percent, Euro } from 'lucide-react';
import { INITIAL_COUPONS, INITIAL_FESTIVALS, Coupon } from '../data/mockData';

export const CouponsPage: React.FC = () => {
  const { cityId } = useParams<{ cityId?: string }>();
  const activeFestival = cityId ? INITIAL_FESTIVALS.find((f) => f.id === cityId) : null;
  const [coupons, setCoupons] = useState<Coupon[]>(INITIAL_COUPONS);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New coupon form state
  const [newCode, setNewCode] = useState('');
  const [newCity, setNewCity] = useState(activeFestival ? activeFestival.name : 'Alle Festivals');
  const [newType, setNewType] = useState<'percentage' | 'fixed_amount'>('percentage');
  const [newValue, setNewValue] = useState(10);
  const [newMaxUses, setNewMaxUses] = useState(200);
  const [newValidUntil, setNewValidUntil] = useState('2026-12-31');

  const handleCreateCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode) return;

    const newCoupon: Coupon = {
      id: `coup-${Date.now()}`,
      code: newCode.toUpperCase().trim(),
      city: newCity,
      type: newType,
      value: newType === 'percentage' ? newValue : newValue * 100,
      usedCount: 0,
      maxUses: newMaxUses,
      totalDiscountGrantedCents: 0,
      validUntil: newValidUntil,
      isActive: true,
    };

    setCoupons([newCoupon, ...coupons]);
    setIsModalOpen(false);
    setNewCode('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-6 shadow-[5px_5px_0px_rgba(29,28,26,0.9)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-extrabold uppercase tracking-widest text-[#006448] bg-[#d8e7e2] px-2 py-0.5 rounded border border-[#8ba198]">
              Marketing & Society
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1D1C1A] tracking-tight">
            Kortingscodes & Vouchers
          </h1>
          <p className="text-xs sm:text-sm text-[#4c5752] mt-0.5 font-medium">
            Beheer promotiecodes, standhoudersvouchers en de exclusieve kortingen voor Whisky Society leden.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-letterpress w-full sm:w-auto px-4 py-2.5 rounded text-xs font-extrabold flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4 text-[#e4d5c4]" />
          <span>Nieuwe Kortingscode Aanmaken</span>
        </button>
      </div>

      {/* Mobile Coupon Cards Stream (< md) */}
      <div className="block md:hidden space-y-3">
        {coupons.map((c) => (
          <div
            key={c.id}
            className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-4 shadow-[3px_3px_0px_rgba(29,28,26,0.9)] space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-mono font-extrabold text-sm text-[#006448] bg-[#d8e7e2] px-2.5 py-1 rounded border border-[#8ba198]">
                {c.code}
              </span>
              {c.isActive ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                  <CheckCircle className="w-3 h-3" /> Actief
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-300">
                  Verlopen / Vol
                </span>
              )}
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
                    <>
                      € {(c.value / 100).toFixed(2).replace('.', ',')}
                    </>
                  )}
                </span>
              </div>
              <div>
                <span className="text-[#4c5752] block font-semibold text-[11px]">Geldig voor:</span>
                <span className="font-bold text-[#1D1C1A]">{c.city}</span>
              </div>
              <div>
                <span className="text-[#4c5752] block font-semibold text-[11px]">Gebruikt:</span>
                <span className="font-bold text-[#1D1C1A]">{c.usedCount} / {c.maxUses} keer</span>
              </div>
              <div>
                <span className="text-[#4c5752] block font-semibold text-[11px]">Totale Korting:</span>
                <span className="font-extrabold text-[#006448]">
                  € {(c.totalDiscountGrantedCents / 100).toFixed(2).replace('.', ',')}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-[#c1d4ce] flex items-center justify-between text-[11px] text-[#4c5752] font-semibold">
              <span>Geldig tot: <strong>{c.validUntil}</strong></span>
              <span className="text-[#006448] font-extrabold">Geconfigureerd</span>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Coupons Table (>= md) */}
      <div className="hidden md:block bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg shadow-[4px_4px_0px_rgba(29,28,26,0.9)] overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[#FAF7F2] border-b-2 border-[#1D1C1A] text-[#4c5752] font-extrabold uppercase tracking-wider">
              <th className="py-3 px-4">Code</th>
              <th className="py-3 px-4">Toepassen op</th>
              <th className="py-3 px-4">Korting</th>
              <th className="py-3 px-4">Gebruikt</th>
              <th className="py-3 px-4">Totale Korting Vergeefs</th>
              <th className="py-3 px-4">Geldig Tot</th>
              <th className="py-3 px-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#c1d4ce]">
            {coupons.map((c) => (
              <tr key={c.id} className="hover:bg-[#FAF7F2]">
                <td className="py-3 px-4">
                  <span className="font-mono font-extrabold text-sm text-[#006448] bg-[#d8e7e2] px-2 py-0.5 rounded border border-[#8ba198]">
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
                  {c.isActive ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                      <CheckCircle className="w-3 h-3" /> Actief
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-300">
                      Verlopen / Vol
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal: Nieuwe Kortingscode */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-[#FCFAF7] border-3 border-[#1D1C1A] rounded-lg shadow-[8px_8px_0px_rgba(29,28,26,0.9)] max-w-md w-full my-auto max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-[#006448] text-white px-5 sm:px-6 py-4 border-b-2 border-[#1D1C1A] flex items-center justify-between shrink-0">
              <h3 className="font-extrabold text-xs sm:text-sm uppercase tracking-wider text-[#e4d5c4]">
                + Nieuwe Kortingscode Aanmaken
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded hover:bg-black/20 text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCoupon} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-[#1D1C1A] mb-1">
                  Kortingscode:
                </label>
                <input
                  type="text"
                  required
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="Bijv. WS-LID-2026 of VIP-EXTRA"
                  className="w-full px-3 py-2 bg-white border-2 border-[#1D1C1A] rounded text-base sm:text-xs font-mono font-bold uppercase"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-[#1D1C1A] mb-1">
                    Type:
                  </label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border-2 border-[#1D1C1A] rounded text-base sm:text-xs font-bold"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed_amount">Vast Bedrag (€)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-[#1D1C1A] mb-1">
                    Waarde:
                  </label>
                  <input
                    type="number"
                    required
                    value={newValue}
                    onChange={(e) => setNewValue(parseFloat(e.target.value) || 0)}
                    placeholder={newType === 'percentage' ? '10' : '5'}
                    className="w-full px-3 py-2 bg-white border-2 border-[#1D1C1A] rounded text-base sm:text-xs font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-[#1D1C1A] mb-1">
                  Toepassen op Festival:
                </label>
                <select
                  value={newCity}
                  onChange={(e) => setNewCity(e.target.value)}
                  className="w-full px-3 py-2 bg-white border-2 border-[#1D1C1A] rounded text-base sm:text-xs font-bold"
                >
                  <option value="Alle Festivals">Alle Festivals</option>
                  <option value="Den Haag">Alleen Den Haag</option>
                  <option value="Amsterdam">Alleen Amsterdam</option>
                  <option value="Gent">Alleen Gent</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-[#1D1C1A] mb-1">
                    Max. Aantal Keer:
                  </label>
                  <input
                    type="number"
                    value={newMaxUses}
                    onChange={(e) => setNewMaxUses(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-white border-2 border-[#1D1C1A] rounded text-base sm:text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-[#1D1C1A] mb-1">
                    Geldig Tot:
                  </label>
                  <input
                    type="date"
                    value={newValidUntil}
                    onChange={(e) => setNewValidUntil(e.target.value)}
                    className="w-full px-3 py-2 bg-white border-2 border-[#1D1C1A] rounded text-base sm:text-xs font-bold"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[#c1d4ce] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-2 text-xs font-bold text-[#4c5752] hover:text-[#1D1C1A]"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  className="btn-letterpress px-4 py-2 rounded text-xs font-extrabold uppercase tracking-wider"
                >
                  Kortingscode Aanmaken
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
