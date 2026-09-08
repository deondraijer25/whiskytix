import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export const TicketViewPage: React.FC = () => {
  const [searchParams] = useSearchParams();

  // Extract query parameters
  let rawCode = searchParams.get('id') || searchParams.get('code') || 'WF-2026-84387-1';
  if (!rawCode.startsWith('#')) rawCode = '#' + rawCode;

  const rawTitle = searchParams.get('title') || searchParams.get('session') || 'VIP SESSIE - VRIJDAG';
  const name = searchParams.get('name') || 'Deon Draijer';
  const time = searchParams.get('time') || '13:00 - 17:00 UUR';
  const cityKey = (searchParams.get('city') || 'gent').toLowerCase();
  const orderNumber = searchParams.get('orderNumber') || 'WF1861';

  const cleanCode = rawCode.replace(/^#/, '');
  const pdfUrl = `/api/tickets/${encodeURIComponent(cleanCode)}/pdf?city=${cityKey}&name=${encodeURIComponent(name)}&title=${encodeURIComponent(rawTitle)}&time=${encodeURIComponent(time)}&orderNumber=${encodeURIComponent(orderNumber)}`;

  useEffect(() => {
    // Direct redirect to PDF per user requirement: "Je moet de ticket niet openen op een pagina, je moet altijd de pdf openen"
    window.location.replace(pdfUrl);
  }, [pdfUrl]);

  return (
    <div className="min-h-screen bg-[#FAF7F2] flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-white border-2 border-[#1D1C1A] p-8 rounded-xl shadow-[6px_6px_0px_rgba(29,28,26,0.9)] max-w-md w-full space-y-4">
        <div className="w-12 h-12 rounded-full bg-[#1E3A8A] text-white flex items-center justify-center mx-auto text-xl font-bold animate-pulse">
          📄
        </div>
        <h2 className="text-xl font-extrabold text-[#1D1C1A]">E-Ticket PDF wordt geopend...</h2>
        <p className="text-xs text-[#4c5752]">
          Uw officiële vector E-Ticket ({rawCode}) wordt direct als PDF geopend. Als het niet automatisch opent, klik dan hieronder:
        </p>
        <div className="pt-2">
          <a
            href={pdfUrl}
            className="btn-letterpress-gold px-6 py-2.5 rounded text-xs font-extrabold inline-flex items-center gap-2 cursor-pointer shadow-[3px_3px_0px_rgba(29,28,26,0.9)]"
          >
            <span>Open PDF Direct ↗</span>
          </a>
        </div>
      </div>
    </div>
  );
};

export default TicketViewPage;
