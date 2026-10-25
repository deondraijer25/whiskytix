import React, { useState, useEffect, useMemo } from 'react';
import { TrendingUp, TrendingDown, Calendar, BarChart3, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Order } from '../data/mockData';

interface YoYPoint {
  label: string;
  dateCur: string;
  curOrders: number | null;
  prevOrders: number;
  curRevenueEur: number | null;
  prevRevenueEur: number;
}

interface YoYSeriesData {
  currentOrders: number;
  previousOrders: number;
  currentRevenueEur: number;
  previousRevenueEur: number;
  currentTickets?: number;
  ordersDiff?: number;
  revenueDiffEur?: number;
  points: YoYPoint[];
}

interface YoYApiResponse {
  success: boolean;
  city: string;
  env: string;
  hasLiveHistory: boolean;
  seasonToDate: YoYSeriesData;
  postEventToDate: YoYSeriesData;
  fullYearCycle: YoYSeriesData;
}

interface SalesYoYChartCardProps {
  cityId: string;
  festivalName: string;
  mollieEnv: 'test' | 'live';
  paidOrders: Order[];
}

type PeriodMode = 'season' | 'post_event' | 'full_year';
type MetricMode = 'orders' | 'revenue';

const CITY_ACCENTS: Record<
  string,
  {
    primaryHex: string;
    primaryFill: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    btnActiveBg: string;
  }
> = {
  gent: {
    primaryHex: '#1E3A8A',
    primaryFill: 'rgba(30, 58, 138, 0.14)',
    badgeBg: 'bg-[#EBF3FB]',
    badgeText: 'text-[#1E3A8A]',
    badgeBorder: 'border-[#BFDBFE]',
    btnActiveBg: 'bg-[#1E3A8A] text-white',
  },
  denhaag: {
    primaryHex: '#006448',
    primaryFill: 'rgba(0, 100, 72, 0.14)',
    badgeBg: 'bg-[#d8e7e2]',
    badgeText: 'text-[#006448]',
    badgeBorder: 'border-[#8ba198]',
    btnActiveBg: 'bg-[#006448] text-white',
  },
  amsterdam: {
    primaryHex: '#8C0223',
    primaryFill: 'rgba(140, 2, 35, 0.14)',
    badgeBg: 'bg-[#FCE8EC]',
    badgeText: 'text-[#8C0223]',
    badgeBorder: 'border-[#F5B7C2]',
    btnActiveBg: 'bg-[#8C0223] text-white',
  },
};

export const SalesYoYChartCard: React.FC<SalesYoYChartCardProps> = ({
  cityId,
  festivalName,
  mollieEnv,
  paidOrders,
}) => {
  const [data, setData] = useState<YoYApiResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [periodMode, setPeriodMode] = useState<PeriodMode>('season');
  const [metricMode, setMetricMode] = useState<MetricMode>('orders');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const accent = CITY_ACCENTS[cityId] || CITY_ACCENTS.denhaag;

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/admin/analytics/yoy?city=${encodeURIComponent(cityId)}&env=${encodeURIComponent(mollieEnv)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!active) return;
        if (json && json.success) {
          setData(json);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [cityId, mollieEnv, paidOrders.length]);

  // Exact live KPI totals from paidOrders prop so 'season' mode always matches the KPI cards 100%
  const liveKpiOrdersCount = paidOrders.length;
  const liveKpiRevenueEur = useMemo(
    () => Math.round(paidOrders.reduce((acc, o) => acc + (o.totalCents || 0), 0)) / 100,
    [paidOrders]
  );
  const liveKpiTicketsCount = useMemo(
    () => paidOrders.reduce((acc, o) => acc + (o.tickets?.length || 1), 0),
    [paidOrders]
  );

  const activeSeries: YoYSeriesData | null = useMemo(() => {
    if (!data) return null;
    if (periodMode === 'post_event') return data.postEventToDate;
    if (periodMode === 'full_year') return data.fullYearCycle;

    // For 'season' (Tot Vandaag), ensure the final point and summary match liveKpiOrdersCount & liveKpiRevenueEur
    const base = data.seasonToDate;
    if (!base) return null;
    const pts = base.points.map((pt, idx) => {
      if (idx === base.points.length - 1) {
        return {
          ...pt,
          curOrders: liveKpiOrdersCount,
          curRevenueEur: liveKpiRevenueEur,
        };
      }
      return pt;
    });

    return {
      ...base,
      currentOrders: liveKpiOrdersCount,
      currentRevenueEur: liveKpiRevenueEur,
      currentTickets: liveKpiTicketsCount,
      ordersDiff: liveKpiOrdersCount - base.previousOrders,
      revenueDiffEur: Math.round((liveKpiRevenueEur - base.previousRevenueEur) * 100) / 100,
      points: pts,
    };
  }, [data, periodMode, liveKpiOrdersCount, liveKpiRevenueEur, liveKpiTicketsCount]);

  const points = activeSeries?.points || [];
  const curOrders = activeSeries?.currentOrders ?? liveKpiOrdersCount;
  const prevOrders = activeSeries?.previousOrders ?? 0;
  const curRevenue = activeSeries?.currentRevenueEur ?? liveKpiRevenueEur;
  const prevRevenue = activeSeries?.previousRevenueEur ?? 0;

  const ordersDiff = curOrders - prevOrders;
  const revenueDiff = Math.round((curRevenue - prevRevenue) * 100) / 100;
  const ordersPctDiff =
    prevOrders > 0 ? Math.round(((curOrders - prevOrders) / prevOrders) * 100) : curOrders > 0 ? 100 : 0;
  const revenuePctDiff =
    prevRevenue > 0 ? Math.round(((curRevenue - prevRevenue) / prevRevenue) * 100) : curRevenue > 0 ? 100 : 0;

  const isAhead = metricMode === 'orders' ? ordersDiff >= 0 : revenueDiff >= 0;

  // SVG Chart Geometry
  const svgWidth = 920;
  const svgHeight = 250;
  const padLeft = 56;
  const padRight = 24;
  const padTop = 22;
  const padBottom = 36;
  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;

  const maxVal = useMemo(() => {
    if (points.length === 0) return 10;
    let m = 1;
    for (const p of points) {
      const cVal = metricMode === 'orders' ? p.curOrders ?? 0 : p.curRevenueEur ?? 0;
      const pVal = metricMode === 'orders' ? p.prevOrders : p.prevRevenueEur;
      if (cVal > m) m = cVal;
      if (pVal > m) m = pVal;
    }
    return Math.ceil(m * 1.15);
  }, [points, metricMode]);

  const getX = (idx: number) => {
    if (points.length <= 1) return padLeft + plotW / 2;
    return padLeft + (idx / (points.length - 1)) * plotW;
  };

  const getY = (val: number) => {
    const clamped = Math.max(0, Math.min(maxVal, val));
    return padTop + plotH - (clamped / maxVal) * plotH;
  };

  const prevPath = useMemo(() => {
    if (points.length === 0) return '';
    return points
      .map((p, idx) => {
        const val = metricMode === 'orders' ? p.prevOrders : p.prevRevenueEur;
        return `${idx === 0 ? 'M' : 'L'} ${getX(idx).toFixed(1)} ${getY(val).toFixed(1)}`;
      })
      .join(' ');
  }, [points, metricMode, maxVal]);

  const { curPath, curAreaPath, validCurPoints } = useMemo(() => {
    const valid: Array<{ idx: number; x: number; y: number; val: number; point: YoYPoint }> = [];
    points.forEach((p, idx) => {
      const rawVal = metricMode === 'orders' ? p.curOrders : p.curRevenueEur;
      if (rawVal !== null && rawVal !== undefined) {
        valid.push({
          idx,
          x: getX(idx),
          y: getY(rawVal),
          val: rawVal,
          point: p,
        });
      }
    });

    if (valid.length === 0) {
      return { curPath: '', curAreaPath: '', validCurPoints: [] };
    }

    const line = valid
      .map((v, i) => `${i === 0 ? 'M' : 'L'} ${v.x.toFixed(1)} ${v.y.toFixed(1)}`)
      .join(' ');

    const firstX = valid[0].x.toFixed(1);
    const lastX = valid[valid.length - 1].x.toFixed(1);
    const baseY = (padTop + plotH).toFixed(1);
    const area = `${line} L ${lastX} ${baseY} L ${firstX} ${baseY} Z`;

    return { curPath: line, curAreaPath: area, validCurPoints: valid };
  }, [points, metricMode, maxVal]);

  const hoveredPoint = hoverIndex !== null && points[hoverIndex] ? points[hoverIndex] : null;

  const formatMetric = (val: number | null | undefined) => {
    if (val === null || val === undefined) return '—';
    if (metricMode === 'orders') {
      return `${val} sales`;
    }
    return `€ ${val.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-4 sm:p-6 shadow-[4px_4px_0px_rgba(29,28,26,0.9)] space-y-5 font-sans">
      {/* 1. Header & Mode Switches */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#c1d4ce] pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded border ${accent.badgeBg} ${accent.badgeText} ${accent.badgeBorder}`}
            >
              Jaar-op-Jaar Verkoopanalyse (YoY)
            </span>
            <span className="text-[11px] font-semibold text-[#4c5752] flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-[#006448]" />
              Stand tot vandaag (25 okt) t.o.v. vorig jaar
            </span>
          </div>
          <h2 className="text-base sm:text-xl font-extrabold text-[#1D1C1A] tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#006448] shrink-0" />
            <span>Verkoopcurve & Benchmark: {festivalName}</span>
          </h2>
          <p className="text-xs text-[#4c5752] font-medium mt-0.5">
            Vergelijk het aantal sales en de omzet tot de dag van vandaag direct met exact hetzelfde punt vorig jaar.
          </p>
        </div>

        {/* Controls: Period & Metric */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Period Switcher */}
          <div className="inline-flex bg-[#FAF7F2] border-2 border-[#1D1C1A] rounded-lg p-0.5 shadow-[2px_2px_0px_rgba(29,28,26,0.9)]">
            <button
              type="button"
              onClick={() => {
                setPeriodMode('season');
                setHoverIndex(null);
              }}
              className={`px-2.5 py-1 rounded text-[11px] font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                periodMode === 'season'
                  ? `${accent.btnActiveBg} shadow-[1px_1px_0px_rgba(29,28,26,0.9)]`
                  : 'text-[#4c5752] hover:text-[#1D1C1A]'
              }`}
              title="Alle actieve Whiskytix bestellingen tot vandaag vergeleken met dezelfde dagen vorig jaar"
            >
              Tot Vandaag ({liveKpiOrdersCount})
            </button>
            {cityId === 'gent' && (
              <button
                type="button"
                onClick={() => {
                  setPeriodMode('post_event');
                  setHoverIndex(null);
                }}
                className={`px-2.5 py-1 rounded text-[11px] font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                  periodMode === 'post_event'
                    ? `${accent.btnActiveBg} shadow-[1px_1px_0px_rgba(29,28,26,0.9)]`
                    : 'text-[#4c5752] hover:text-[#1D1C1A]'
                }`}
                title="Puur de verkopen sinds het einde van het festivalweekend (5 okt t/m vandaag)"
              >
                Na Event (Sinds 5 okt)
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setPeriodMode('full_year');
                setHoverIndex(null);
              }}
              className={`px-2.5 py-1 rounded text-[11px] font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                periodMode === 'full_year'
                  ? `${accent.btnActiveBg} shadow-[1px_1px_0px_rgba(29,28,26,0.9)]`
                  : 'text-[#4c5752] hover:text-[#1D1C1A]'
              }`}
              title="Bekijk de volledige 12-maanden verkoopcurve van vorig jaar richting het festival"
            >
              12-Mnd Cyclus
            </button>
          </div>

          {/* Metric Switcher */}
          <div className="inline-flex bg-[#FAF7F2] border-2 border-[#1D1C1A] rounded-lg p-0.5 shadow-[2px_2px_0px_rgba(29,28,26,0.9)]">
            <button
              type="button"
              onClick={() => setMetricMode('orders')}
              className={`px-2.5 py-1 rounded text-[11px] font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                metricMode === 'orders'
                  ? 'bg-[#caac8e] text-[#1D1C1A] border border-[#1D1C1A]'
                  : 'text-[#4c5752] hover:text-[#1D1C1A]'
              }`}
            >
              Aantal Sales
            </button>
            <button
              type="button"
              onClick={() => setMetricMode('revenue')}
              className={`px-2.5 py-1 rounded text-[11px] font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                metricMode === 'revenue'
                  ? 'bg-[#caac8e] text-[#1D1C1A] border border-[#1D1C1A]'
                  : 'text-[#4c5752] hover:text-[#1D1C1A]'
              }`}
            >
              Omzet (€)
            </button>
          </div>
        </div>
      </div>

      {/* 2. Three Summary Benchmark Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        {/* Card 1: Dit Jaar tot Vandaag */}
        <div className="bg-[#FAF7F2] border-2 border-[#1D1C1A] rounded-lg p-3.5 shadow-[2px_2px_0px_rgba(29,28,26,0.9)]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#4c5752]">
              {periodMode === 'post_event'
                ? 'Dit Jaar (Na Event: 5–25 okt)'
                : 'Dit Jaar (Tot Vandaag)'}
            </span>
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: accent.primaryHex }}></span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-extrabold text-[#1D1C1A]">
              {metricMode === 'orders'
                ? `${curOrders} bestellingen`
                : `€ ${curRevenue.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </span>
          </div>
          <div className="mt-1 text-[11px] font-semibold text-[#4c5752]">
            {metricMode === 'orders'
              ? `Omzet: € ${curRevenue.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${activeSeries?.currentTickets ?? liveKpiTicketsCount} tickets)`
              : `${curOrders} betaalde bestellingen (${activeSeries?.currentTickets ?? liveKpiTicketsCount} tickets)`}
          </div>
        </div>

        {/* Card 2: Vorig Jaar op exact dit punt */}
        <div className="bg-[#FAF7F2] border-2 border-[#c1d4ce] rounded-lg p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#4c5752]">
              {periodMode === 'post_event'
                ? 'Vorig Jaar (Na Event: 5–25 okt 2025)'
                : periodMode === 'full_year'
                ? 'Vorig Jaar (Volledige 12 mnd)'
                : 'Vorig Jaar (Zelfde periode t/m 25 okt)'}
            </span>
            <span className="w-4 h-0.5 border-t-2 border-dashed border-[#4c5752]"></span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-extrabold text-[#4c5752]">
              {metricMode === 'orders'
                ? `${prevOrders} bestellingen`
                : `€ ${prevRevenue.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </span>
          </div>
          <div className="mt-1 text-[11px] font-medium text-[#4c5752]">
            {metricMode === 'orders'
              ? `Omzet vorig jaar op dit punt: € ${prevRevenue.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : `${prevOrders} betaalde bestellingen vorig jaar op dit punt`}
          </div>
        </div>

        {/* Card 3: Delta & Marketing Actie-Signaal */}
        <div
          className={`border-2 border-[#1D1C1A] rounded-lg p-3.5 shadow-[2px_2px_0px_rgba(29,28,26,0.9)] ${
            isAhead ? 'bg-[#d8e7e2]/70' : 'bg-amber-50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#1D1C1A]">
              Verschil t.o.v. Vorig Jaar
            </span>
            {isAhead ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-[#006448] text-white">
                <TrendingUp className="w-3 h-3" /> Vóór op schema
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-amber-200 text-amber-950 border border-amber-500">
                <TrendingDown className="w-3 h-3" /> Actie vereist
              </span>
            )}
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className={`text-xl sm:text-2xl font-extrabold ${
                isAhead ? 'text-[#006448]' : 'text-red-800'
              }`}
            >
              {metricMode === 'orders'
                ? `${ordersDiff >= 0 ? '+' : ''}${ordersDiff} sales (${ordersPctDiff >= 0 ? '+' : ''}${ordersPctDiff}%)`
                : `${revenueDiff >= 0 ? '+ € ' : '- € '}${Math.abs(revenueDiff).toLocaleString('nl-NL', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} (${revenuePctDiff >= 0 ? '+' : ''}${revenuePctDiff}%)`}
            </span>
          </div>
          <div className="mt-1 text-[11px] font-bold text-[#1D1C1A] flex items-center gap-1.5">
            {isAhead ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-[#006448] shrink-0" />
                <span>Verkoop loopt voor op vorig jaar op dit punt!</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span>
                  {Math.abs(ordersDiff)} sales minder dan vorig jaar — tip: zet een mailing of actie uit.
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 3. Full-Width Interactive SVG Comparison Chart */}
      <div className="relative bg-[#FAF7F2] border-2 border-[#c1d4ce] rounded-lg p-3 sm:p-4">
        {/* Legend & Hover Readout Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="inline-flex items-center gap-1.5 font-extrabold text-[#1D1C1A]">
              <span
                className="w-3 h-3 rounded-sm border border-[#1D1C1A]"
                style={{ backgroundColor: accent.primaryHex }}
              ></span>
              Dit Jaar ({periodMode === 'post_event' ? 'Nieuwe Editie sinds 5 okt' : 'Actieve Verkoop'})
            </span>
            <span className="inline-flex items-center gap-1.5 font-bold text-[#4c5752]">
              <span className="w-4 h-0.5 border-t-2 border-dashed border-[#4c5752]"></span>
              Vorig Jaar (Zelfde punt in de tijd)
            </span>
          </div>

          {hoveredPoint ? (
            <div className="bg-[#FCFAF7] border border-[#1D1C1A] rounded px-2.5 py-1 text-[11px] font-bold flex items-center gap-3 shadow-sm">
              <span className="text-[#1D1C1A] font-extrabold">{hoveredPoint.label}:</span>
              <span style={{ color: accent.primaryHex }}>
                Dit jaar:{' '}
                <strong>
                  {formatMetric(
                    metricMode === 'orders' ? hoveredPoint.curOrders : hoveredPoint.curRevenueEur
                  )}
                </strong>
              </span>
              <span className="text-[#4c5752]">
                Vorig jaar:{' '}
                <strong>
                  {formatMetric(
                    metricMode === 'orders' ? hoveredPoint.prevOrders : hoveredPoint.prevRevenueEur
                  )}
                </strong>
              </span>
            </div>
          ) : (
            <span className="text-[11px] text-[#4c5752] font-medium">
              Beweeg met je muis over de grafiek voor dag-tot-dag cijfers
            </span>
          )}
        </div>

        {loading && points.length === 0 ? (
          <div className="h-[230px] flex items-center justify-center text-xs font-bold text-[#4c5752]">
            Historische vergelijking laden...
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-[220px] sm:h-[250px] select-none overflow-visible"
              onMouseLeave={() => setHoverIndex(null)}
            >
              {/* Horizontal Grid Lines & Y-Axis Labels */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                const val = Math.round(maxVal * ratio);
                const y = getY(val);
                return (
                  <g key={idx}>
                    <line
                      x1={padLeft}
                      y1={y}
                      x2={svgWidth - padRight}
                      y2={y}
                      stroke="#c1d4ce"
                      strokeDasharray={ratio === 0 ? undefined : '3 3'}
                      strokeWidth={ratio === 0 ? 1.5 : 1}
                    />
                    <text
                      x={padLeft - 8}
                      y={y + 4}
                      textAnchor="end"
                      className="fill-[#4c5752] text-[10px] font-bold"
                    >
                      {metricMode === 'orders' ? val : `€${val}`}
                    </text>
                  </g>
                );
              })}

              {/* Current Year Shaded Area */}
              {curAreaPath && <path d={curAreaPath} fill={accent.primaryFill} />}

              {/* Previous Year Dashed Line */}
              {prevPath && (
                <path
                  d={prevPath}
                  fill="none"
                  stroke="#6b7872"
                  strokeWidth={2.25}
                  strokeDasharray="6 4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Current Year Solid Line */}
              {curPath && (
                <path
                  d={curPath}
                  fill="none"
                  stroke={accent.primaryHex}
                  strokeWidth={3.25}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Previous Year Data Dots */}
              {points.map((p, idx) => {
                const val = metricMode === 'orders' ? p.prevOrders : p.prevRevenueEur;
                const x = getX(idx);
                const y = getY(val);
                const showDot =
                  hoverIndex === idx || idx === 0 || idx === points.length - 1 || idx % 4 === 0;
                if (!showDot) return null;
                return (
                  <circle
                    key={`prev-${idx}`}
                    cx={x}
                    cy={y}
                    r={hoverIndex === idx ? 5 : 3}
                    fill="#FCFAF7"
                    stroke="#6b7872"
                    strokeWidth={2}
                  />
                );
              })}

              {/* Current Year Data Dots */}
              {validCurPoints.map((v) => {
                const isLast = v.idx === validCurPoints[validCurPoints.length - 1]?.idx;
                const isHovered = hoverIndex === v.idx;
                if (!isLast && !isHovered && v.idx % 3 !== 0) return null;
                return (
                  <circle
                    key={`cur-${v.idx}`}
                    cx={v.x}
                    cy={v.y}
                    r={isHovered || isLast ? 5.5 : 3.5}
                    fill={accent.primaryHex}
                    stroke="#FCFAF7"
                    strokeWidth={2}
                  />
                );
              })}

              {/* X-Axis Labels */}
              {points.map((p, idx) => {
                const step = points.length > 16 ? 3 : points.length > 10 ? 2 : 1;
                if (idx !== 0 && idx !== points.length - 1 && idx % step !== 0) return null;
                const x = getX(idx);
                return (
                  <text
                    key={`lbl-${idx}`}
                    x={x}
                    y={svgHeight - 10}
                    textAnchor="middle"
                    className="fill-[#4c5752] text-[10px] font-bold"
                  >
                    {p.label}
                  </text>
                );
              })}

              {/* Hover Vertical Indicator Line */}
              {hoverIndex !== null && points[hoverIndex] && (
                <line
                  x1={getX(hoverIndex)}
                  y1={padTop}
                  x2={getX(hoverIndex)}
                  y2={padTop + plotH}
                  stroke="#1D1C1A"
                  strokeWidth={1.5}
                  strokeDasharray="2 2"
                />
              )}

              {/* Invisible Hover Columns for Smooth Scrubbing */}
              {points.map((_, idx) => {
                const colW = plotW / Math.max(1, points.length);
                const x = getX(idx) - colW / 2;
                return (
                  <rect
                    key={`hit-${idx}`}
                    x={Math.max(padLeft, x)}
                    y={padTop}
                    width={colW}
                    height={plotH}
                    fill="transparent"
                    className="cursor-crosshair"
                    onMouseEnter={() => setHoverIndex(idx)}
                  />
                );
              })}
            </svg>
          </div>
        )}
      </div>
    </div>
  );
};
