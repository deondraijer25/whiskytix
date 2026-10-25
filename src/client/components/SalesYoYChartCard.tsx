import React, { useState, useEffect, useMemo } from 'react';
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

  // SVG Chart Geometry (wide aspect ratio so it fills the full card width)
  const svgWidth = 1140;
  const svgHeight = 220;
  const padLeft = 48;
  const padRight = 56;
  const padTop = 20;
  const padBottom = 32;
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
      return `${val}`;
    }
    return `€ ${val.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const lastCurPoint = validCurPoints.length > 0 ? validCurPoints[validCurPoints.length - 1] : null;
  const lastPrevIdx = points.length - 1;
  const lastPrevVal =
    lastPrevIdx >= 0
      ? metricMode === 'orders'
        ? points[lastPrevIdx].prevOrders
        : points[lastPrevIdx].prevRevenueEur
      : null;

  return (
    <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-4 sm:p-5 shadow-[3px_3px_0px_rgba(29,28,26,0.9)] space-y-4 font-sans">
      {/* 1. Compact Header & Switches */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: accent.primaryHex }}
          />
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-[#1D1C1A]">
              Verkoop t.o.v. vorig jaar
            </h2>
          </div>
        </div>

        {/* Clean Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex bg-[#FAF7F2] border-2 border-[#1D1C1A] rounded p-0.5">
            <button
              type="button"
              onClick={() => {
                setPeriodMode('season');
                setHoverIndex(null);
              }}
              className={`px-2.5 py-1 rounded-sm text-xs font-bold transition-all cursor-pointer ${
                periodMode === 'season'
                  ? accent.btnActiveBg
                  : 'text-[#4c5752] hover:text-[#1D1C1A]'
              }`}
            >
              Tot vandaag
            </button>
            {cityId === 'gent' && (
              <button
                type="button"
                onClick={() => {
                  setPeriodMode('post_event');
                  setHoverIndex(null);
                }}
                className={`px-2.5 py-1 rounded-sm text-xs font-bold transition-all cursor-pointer ${
                  periodMode === 'post_event'
                    ? accent.btnActiveBg
                    : 'text-[#4c5752] hover:text-[#1D1C1A]'
                }`}
              >
                Na event
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setPeriodMode('full_year');
                setHoverIndex(null);
              }}
              className={`px-2.5 py-1 rounded-sm text-xs font-bold transition-all cursor-pointer ${
                periodMode === 'full_year'
                  ? accent.btnActiveBg
                  : 'text-[#4c5752] hover:text-[#1D1C1A]'
              }`}
            >
              Heel jaar
            </button>
          </div>

          <div className="inline-flex bg-[#FAF7F2] border-2 border-[#1D1C1A] rounded p-0.5">
            <button
              type="button"
              onClick={() => setMetricMode('orders')}
              className={`px-2.5 py-1 rounded-sm text-xs font-bold transition-all cursor-pointer ${
                metricMode === 'orders'
                  ? 'bg-[#caac8e] text-[#1D1C1A]'
                  : 'text-[#4c5752] hover:text-[#1D1C1A]'
              }`}
            >
              Sales
            </button>
            <button
              type="button"
              onClick={() => setMetricMode('revenue')}
              className={`px-2.5 py-1 rounded-sm text-xs font-bold transition-all cursor-pointer ${
                metricMode === 'revenue'
                  ? 'bg-[#caac8e] text-[#1D1C1A]'
                  : 'text-[#4c5752] hover:text-[#1D1C1A]'
              }`}
            >
              Omzet
            </button>
          </div>
        </div>
      </div>

      {/* 2. Three Clear Number Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Dit Jaar */}
        <div className="bg-[#FAF7F2] border-2 border-[#1D1C1A] rounded p-3.5 sm:p-4">
          <div className="flex items-center justify-between text-xs font-bold text-[#4c5752]">
            <span>Dit jaar</span>
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: accent.primaryHex }}
            />
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl sm:text-4xl font-extrabold text-[#1D1C1A] tracking-tight leading-none">
              {metricMode === 'orders'
                ? curOrders
                : `€ ${curRevenue.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            </span>
            {metricMode === 'orders' && (
              <span className="text-xs sm:text-sm font-bold text-[#4c5752]">sales</span>
            )}
          </div>
          <div className="mt-1.5 text-xs font-bold text-[#4c5752]">
            {metricMode === 'orders'
              ? `€ ${curRevenue.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · ${activeSeries?.currentTickets ?? liveKpiTicketsCount} tickets`
              : `${curOrders} sales · ${activeSeries?.currentTickets ?? liveKpiTicketsCount} tickets`}
          </div>
        </div>

        {/* Vorig Jaar */}
        <div className="bg-[#FAF7F2] border-2 border-[#c1d4ce] rounded p-3.5 sm:p-4">
          <div className="flex items-center justify-between text-xs font-bold text-[#4c5752]">
            <span>{periodMode === 'full_year' ? 'Vorig jaar (totaal)' : 'Vorig jaar (zelfde datum)'}</span>
            <span className="w-4 h-0.5 border-t-2 border-dashed border-[#4c5752]" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl sm:text-4xl font-extrabold text-[#4c5752] tracking-tight leading-none">
              {metricMode === 'orders'
                ? prevOrders
                : `€ ${prevRevenue.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            </span>
            {metricMode === 'orders' && (
              <span className="text-xs sm:text-sm font-bold text-[#4c5752]">sales</span>
            )}
          </div>
          <div className="mt-1.5 text-xs font-bold text-[#4c5752]">
            {metricMode === 'orders'
              ? `€ ${prevRevenue.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : `${prevOrders} sales`}
          </div>
        </div>

        {/* Verschil */}
        <div className="bg-[#FAF7F2] border-2 border-[#1D1C1A] rounded p-3.5 sm:p-4">
          <div className="flex items-center justify-between text-xs font-bold text-[#4c5752]">
            <span>Verschil</span>
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-extrabold ${
                isAhead
                  ? 'bg-[#d8e7e2] text-[#006448]'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {metricMode === 'orders'
                ? `${ordersPctDiff >= 0 ? '+' : ''}${ordersPctDiff}%`
                : `${revenuePctDiff >= 0 ? '+' : ''}${revenuePctDiff}%`}
            </span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span
              className={`text-2xl sm:text-4xl font-extrabold tracking-tight leading-none ${
                isAhead ? 'text-[#006448]' : 'text-red-800'
              }`}
            >
              {metricMode === 'orders'
                ? `${ordersDiff >= 0 ? '+' : ''}${ordersDiff}`
                : `${revenueDiff >= 0 ? '+ € ' : '- € '}${Math.abs(revenueDiff).toLocaleString('nl-NL', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}`}
            </span>
            {metricMode === 'orders' && (
              <span className={`text-xs sm:text-sm font-bold ${isAhead ? 'text-[#006448]' : 'text-red-800'}`}>
                sales
              </span>
            )}
          </div>
          <div className="mt-1.5 text-xs font-bold text-[#4c5752]">
            {metricMode === 'orders'
              ? `${revenueDiff >= 0 ? '+ € ' : '- € '}${Math.abs(revenueDiff).toLocaleString('nl-NL', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })} omzet`
              : `${ordersDiff >= 0 ? '+' : ''}${ordersDiff} sales`}
          </div>
        </div>
      </div>

      {/* 3. Clean Interactive Chart */}
      <div className="bg-[#FAF7F2] border border-[#c1d4ce] rounded p-3 sm:p-4">
        {/* Minimal Legend + Hover Readout */}
        <div className="flex items-center justify-between gap-2 mb-2 min-h-[24px] text-xs">
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 font-extrabold text-[#1D1C1A]">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: accent.primaryHex }}
              />
              Dit jaar
            </span>
            <span className="inline-flex items-center gap-1.5 font-bold text-[#4c5752]">
              <span className="w-4 h-0.5 border-t-2 border-dashed border-[#4c5752]" />
              Vorig jaar
            </span>
          </div>

          {hoveredPoint && (
            <div className="bg-[#FCFAF7] border border-[#1D1C1A] rounded px-2.5 py-0.5 text-xs font-extrabold flex items-center gap-3">
              <span className="text-[#1D1C1A]">{hoveredPoint.label}</span>
              <span style={{ color: accent.primaryHex }}>
                Dit jaar: {formatMetric(metricMode === 'orders' ? hoveredPoint.curOrders : hoveredPoint.curRevenueEur)}
              </span>
              <span className="text-[#4c5752]">
                Vorig jaar: {formatMetric(metricMode === 'orders' ? hoveredPoint.prevOrders : hoveredPoint.prevRevenueEur)}
              </span>
            </div>
          )}
        </div>

        {loading && points.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-xs font-bold text-[#4c5752]">
            Grafiek laden...
          </div>
        ) : (
          <div className="w-full">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-auto max-h-[230px] select-none overflow-visible"
              onMouseLeave={() => setHoverIndex(null)}
            >
              {/* Grid Lines & Y-Axis Numbers */}
              {[0, 0.5, 1].map((ratio, idx) => {
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
                      strokeDasharray={ratio === 0 ? undefined : '4 4'}
                      strokeWidth={ratio === 0 ? 1.5 : 1}
                    />
                    <text
                      x={padLeft - 10}
                      y={y + 4}
                      textAnchor="end"
                      className="fill-[#1D1C1A] text-[12px] font-extrabold"
                    >
                      {metricMode === 'orders' ? val : `€${val}`}
                    </text>
                  </g>
                );
              })}

              {/* Current Year Area */}
              {curAreaPath && <path d={curAreaPath} fill={accent.primaryFill} />}

              {/* Previous Year Dashed Line */}
              {prevPath && (
                <path
                  d={prevPath}
                  fill="none"
                  stroke="#6b7872"
                  strokeWidth={2.5}
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
                  strokeWidth={3.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* End-of-line value callout for Vorig Jaar */}
              {lastPrevVal !== null && lastPrevIdx >= 0 && (
                <g>
                  <circle
                    cx={getX(lastPrevIdx)}
                    cy={getY(lastPrevVal)}
                    r={4.5}
                    fill="#FCFAF7"
                    stroke="#4c5752"
                    strokeWidth={2.5}
                  />
                  <text
                    x={getX(lastPrevIdx) + 8}
                    y={getY(lastPrevVal) + 4}
                    className="fill-[#4c5752] text-[12px] font-extrabold"
                  >
                    {formatMetric(lastPrevVal)}
                  </text>
                </g>
              )}

              {/* End-of-line value callout for Dit Jaar */}
              {lastCurPoint && (
                <g>
                  <circle
                    cx={lastCurPoint.x}
                    cy={lastCurPoint.y}
                    r={5.5}
                    fill={accent.primaryHex}
                    stroke="#FCFAF7"
                    strokeWidth={2}
                  />
                  <text
                    x={lastCurPoint.x + 8}
                    y={lastCurPoint.y + 4}
                    style={{ fill: accent.primaryHex }}
                    className="text-[13px] font-extrabold"
                  >
                    {formatMetric(lastCurPoint.val)}
                  </text>
                </g>
              )}

              {/* Hovered Day Dots & Vertical Line */}
              {hoverIndex !== null && points[hoverIndex] && (
                <g>
                  <line
                    x1={getX(hoverIndex)}
                    y1={padTop}
                    x2={getX(hoverIndex)}
                    y2={padTop + plotH}
                    stroke="#1D1C1A"
                    strokeWidth={1.5}
                    strokeDasharray="2 2"
                  />
                  <circle
                    cx={getX(hoverIndex)}
                    cy={getY(
                      metricMode === 'orders'
                        ? points[hoverIndex].prevOrders
                        : points[hoverIndex].prevRevenueEur
                    )}
                    r={5}
                    fill="#FCFAF7"
                    stroke="#4c5752"
                    strokeWidth={2.5}
                  />
                  {(() => {
                    const cVal =
                      metricMode === 'orders'
                        ? points[hoverIndex].curOrders
                        : points[hoverIndex].curRevenueEur;
                    if (cVal === null || cVal === undefined) return null;
                    return (
                      <circle
                        cx={getX(hoverIndex)}
                        cy={getY(cVal)}
                        r={5.5}
                        fill={accent.primaryHex}
                        stroke="#FCFAF7"
                        strokeWidth={2}
                      />
                    );
                  })()}
                </g>
              )}

              {/* X-Axis Labels */}
              {points.map((p, idx) => {
                const step = points.length > 18 ? 4 : points.length > 10 ? 2 : 1;
                if (idx !== 0 && idx !== points.length - 1 && idx % step !== 0) return null;
                const x = getX(idx);
                return (
                  <text
                    key={`lbl-${idx}`}
                    x={x}
                    y={svgHeight - 8}
                    textAnchor="middle"
                    className="fill-[#4c5752] text-[11px] font-bold"
                  >
                    {p.label}
                  </text>
                );
              })}

              {/* Hover Hit Areas */}
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

