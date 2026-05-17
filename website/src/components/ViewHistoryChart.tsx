'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';

interface HistoryPoint {
    date: string;
    views: number;
}

interface DailyBar {
    date: string; // YYYY-MM-DD
    delta: number;
}

interface ViewHistoryChartProps {
    youtubeHistory?: HistoryPoint[] | null;
    niconicoHistory?: HistoryPoint[] | null;
    publishDate?: string | null;
}

function formatViews(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return n.toString();
}

/** Sort + deduplicate a history array by date, keeping the latest view count per timestamp */
function normalizeHistory(pts: HistoryPoint[] | null | undefined, publishDate?: string | null): HistoryPoint[] | null {
    if (!pts || pts.length === 0) return null;

    const points = [...pts];

    // Feature: if a song is brand new and only has 1 fetch, append a 0-view publish origin
    // to allow recharts to draw a line instead of hiding the chart
    if (points.length === 1 && publishDate) {
        if (publishDate < points[0].date) {
            points.push({ date: publishDate, views: 0 });
        } else {
            // Fallback if publish date is same/later: assume 1 day before
            const d = new Date(points[0].date);
            d.setDate(d.getDate() - 1);
            points.push({ date: d.toISOString(), views: 0 });
        }
    } else if (points.length < 2) {
        return null; // hide charts that have < 2 points
    }

    return points.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Collapse multiple intra-day recordings into one averaged point per calendar day.
 * Used for Niconico line chart: the API updates views once/day, so multiple fetches
 * on the same day should be treated as one measurement.
 */
function averageDailyViews(data: HistoryPoint[]): HistoryPoint[] {
    const dailyMap = new Map<string, number[]>();
    for (const p of data) {
        const day = p.date.slice(0, 10);
        if (!dailyMap.has(day)) dailyMap.set(day, []);
        dailyMap.get(day)!.push(p.views);
    }
    return Array.from(dailyMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, views]) => ({
            date: date + 'T00:00:00.000Z',
            views: Math.round(views.reduce((s, v) => s + v, 0) / views.length),
        }));
}

/**
 * Compute per-day view gain by summing all consecutive deltas that fall on the same
 * calendar day. Negative deltas (view corrections) are clamped to 0.
 */
function normalizeDailyIncrements(data: HistoryPoint[]): DailyBar[] {
    if (data.length < 2) return [];
    const dailyDeltas = new Map<string, number>();
    for (let i = 1; i < data.length; i++) {
        const delta = Math.max(0, data[i].views - data[i - 1].views);
        const day = data[i].date.slice(0, 10);
        dailyDeltas.set(day, (dailyDeltas.get(day) ?? 0) + delta);
    }
    return Array.from(dailyDeltas.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, delta]) => ({ date, delta }));
}

export default function ViewHistoryChart({ youtubeHistory, niconicoHistory, publishDate }: ViewHistoryChartProps) {
    const t = useTranslations('ViewHistoryChart');
    const locale = useLocale();
    const [activeTab, setActiveTab] = useState<'youtube' | 'niconico'>(
        (youtubeHistory && youtubeHistory.length > 0) ? 'youtube' : 'niconico'
    );
    const [showIncremental, setShowIncremental] = useState(false);
    const [hoveredPoint, setHoveredPoint] = useState<{
        x: number; y: number; views: number; date: string; source: string;
        delta?: number;
    } | null>(null);

    const { ytHistory, nicoHistory, nicoHistoryAvg, ytDailyBars, nicoDailyBars } = useMemo(() => {
        const yt = normalizeHistory(youtubeHistory);
        const nicoRaw = normalizeHistory(niconicoHistory);
        // Average Niconico per day: API updates once/day so multiple fetches same day = noise
        const nicoAvg = nicoRaw ? averageDailyViews(nicoRaw) : null;
        return {
            ytHistory: yt,
            nicoHistory: nicoRaw,
            // Fall back to raw if averaging collapses to < 2 days (edge case: all recordings same day)
            nicoHistoryAvg: nicoAvg && nicoAvg.length >= 2 ? nicoAvg : nicoRaw,
            // Bar chart: sum all intra-day deltas per calendar day
            ytDailyBars: normalizeDailyIncrements(yt ?? []),
            nicoDailyBars: normalizeDailyIncrements(nicoAvg ?? nicoRaw ?? []),
        };
    }, [youtubeHistory, niconicoHistory]);

    // Adaptive font size: always renders at TARGET_PX actual CSS pixels
    const containerRef = useRef<HTMLDivElement>(null);
    const TARGET_PX = 12;
    const [tickFontSize, setTickFontSize] = useState(18); // SVG user units

    useEffect(() => {
        if (!containerRef.current) return;
        const obs = new ResizeObserver(([entry]) => {
            const w = entry.contentRect.width;
            if (w > 0) setTickFontSize(Math.round(TARGET_PX * (800 / w)));
        });
        obs.observe(containerRef.current);
        return () => obs.disconnect();
    }, []);

    const hasYoutube = ytHistory !== null;
    const hasNiconico = nicoHistory !== null;

    if (!hasYoutube && !hasNiconico) return null;

    const effectiveTab = (activeTab === 'youtube' && !hasYoutube) ? 'niconico'
        : (activeTab === 'niconico' && !hasNiconico) ? 'youtube' : activeTab;

    // Line chart data (Niconico uses day-averaged data)
    const activeLineData: HistoryPoint[] =
        effectiveTab === 'youtube' ? (ytHistory ?? []) : (nicoHistoryAvg ?? []);

    // Bar chart data (one bar per calendar day)
    const activeDailyBars: DailyBar[] =
        effectiveTab === 'youtube' ? ytDailyBars : nicoDailyBars;

    const maxDelta = Math.max(...activeDailyBars.map(d => d.delta), 1);

    const allViews = activeLineData.map(p => p.views);
    const minViews = Math.min(...allViews);
    const maxViews = Math.max(...allViews);
    const viewRange = maxViews - minViews || 1;

    // SVG dimensions
    const W = 800;
    const H = 250;
    const PAD_L = 100;
    const PAD_R = 16;
    const PAD_T = 16;
    const PAD_B = 60;
    const chartW = W - PAD_L - PAD_R;
    const chartH = H - PAD_T - PAD_B;

    // Time axis — anchored to the line data's full span
    const minTime = new Date(activeLineData[0]?.date ?? 0).getTime();
    const maxTime = new Date(activeLineData[activeLineData.length - 1]?.date ?? 0).getTime();
    const timeRange = maxTime - minTime || 1;

    const toX = (date: string) => PAD_L + ((new Date(date).getTime() - minTime) / timeRange) * chartW;
    const toY = (views: number) => PAD_T + chartH - ((views - minViews) / viewRange) * chartH;
    const toBarY = (delta: number) => PAD_T + chartH - (delta / maxDelta) * chartH;

    const buildPath = (data: HistoryPoint[]) => {
        if (!data || data.length === 0) return "";
        return data.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.date).toFixed(1)} ${toY(p.views).toFixed(1)}`).join(' ');
    };

    const buildAreaPath = (data: HistoryPoint[]) => {
        if (!data || data.length === 0) return "";
        const linePath = data.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.date).toFixed(1)} ${toY(p.views).toFixed(1)}`).join(' ');
        const baseY = (PAD_T + chartH).toFixed(1);
        const firstX = toX(data[0].date).toFixed(1);
        const lastX = toX(data[data.length - 1].date).toFixed(1);
        return `${linePath} L ${lastX} ${baseY} L ${firstX} ${baseY} Z`;
    };

    const lineColor = effectiveTab === 'youtube' ? '#FF4444' : '#E8954A';
    const gradId = effectiveTab === 'youtube' ? 'ytGrad' : 'nicoGrad';
    const gradColor = effectiveTab === 'youtube' ? '#FF4444' : '#E8954A';

    // Bar width = 1 calendar day wide on the time-linear axis, minimum 2px
    const oneDayMs = 86_400_000;
    const dayBarW = Math.max((oneDayMs / timeRange) * chartW, 2);

    // X-axis ticks: use bar dates in incremental mode, line data dates otherwise
    const lineTickDates = (() => {
        const dates = activeLineData.map(p => p.date);
        const tc = Math.min(4, dates.length);
        return Array.from({ length: tc }, (_, i) => dates[Math.floor(i * (dates.length - 1) / (tc - 1 || 1))]);
    })();
    const barTickDates = (() => {
        const dates = activeDailyBars.map(d => d.date + 'T00:00:00.000Z');
        const tc = Math.min(4, dates.length);
        return Array.from({ length: tc }, (_, i) => dates[Math.floor(i * (dates.length - 1) / (tc - 1 || 1))]);
    })();
    const tickDates = showIncremental ? barTickDates : lineTickDates;

    const yTicks = showIncremental
        ? [0, 0.5, 1].map(frac => frac * maxDelta)
        : [0, 0.5, 1].map(frac => minViews + frac * viewRange);

    const sourceName = effectiveTab === 'youtube' ? t('tab_youtube') : t('tab_niconico');

    return (
        <div ref={containerRef} className="mt-10 pt-8">
            {/* Section header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <div className="w-6 h-px bg-[var(--vermilion)]"></div>
                    <span className="text-xs uppercase tracking-[0.25em] text-[var(--text-secondary)] font-bold">{t('title')}</span>
                </div>

                <div className="flex items-center gap-3">
                    {/* Daily gains toggle */}
                    <button
                        onClick={() => { setShowIncremental(v => !v); setHoveredPoint(null); }}
                        className={`px-3 py-1 text-[10px] uppercase tracking-widest font-bold transition-all border ${
                            showIncremental
                                ? 'border-[var(--vermilion)] text-[var(--vermilion)]'
                                : 'border-[var(--hairline)] text-[var(--text-secondary)] hover:text-white hover:border-white/40'
                        }`}
                    >
                        {t('toggle_daily_gains')}
                    </button>

                    {/* Tab switcher */}
                    <div className="flex gap-1 border border-[var(--hairline)] p-1">
                        {hasYoutube && (
                            <button
                                onClick={() => setActiveTab('youtube')}
                                className={`px-3 py-1 text-[10px] uppercase tracking-widest font-bold transition-all ${activeTab === 'youtube' ? 'bg-white/10 text-white' : 'text-[var(--text-secondary)] hover:text-white'}`}
                            >
                                {t('tab_youtube')}
                            </button>
                        )}
                        {hasNiconico && (
                            <button
                                onClick={() => setActiveTab('niconico')}
                                className={`px-3 py-1 text-[10px] uppercase tracking-widest font-bold transition-all ${activeTab === 'niconico' ? 'bg-white/10 text-white' : 'text-[var(--text-secondary)] hover:text-white'}`}
                            >
                                {t('tab_niconico')}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* SVG Chart */}
            <div className="relative w-full select-none overflow-visible">
                <svg
                    viewBox={`0 0 ${W} ${H}`}
                    className="w-full overflow-visible"
                    onMouseLeave={() => setHoveredPoint(null)}
                >
                    <defs>
                        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={gradColor} stopOpacity="0.3" />
                            <stop offset="100%" stopColor={gradColor} stopOpacity="0.02" />
                        </linearGradient>
                    </defs>

                    {/* Y-axis grid lines + labels */}
                    {yTicks.map((v, idx) => {
                        const y = showIncremental ? toBarY(v) : toY(v);
                        return (
                            <g key={idx}>
                                <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                                <text x={PAD_L - 6} y={y + 4} textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize={tickFontSize} fontFamily="monospace">
                                    {formatViews(Math.round(v))}
                                </text>
                            </g>
                        );
                    })}

                    {/* X-axis tick labels — full ISO date, rotated -30° */}
                    {tickDates.map((date) => {
                        const x = toX(date);
                        const labelY = H - 20;
                        return (
                            <text
                                key={date}
                                x={x}
                                y={labelY}
                                textAnchor="end"
                                fill="rgba(255,255,255,0.35)"
                                fontSize={tickFontSize}
                                fontFamily="monospace"
                                transform={`rotate(-30, ${x}, ${labelY})`}
                            >
                                {date.slice(0, 10)}
                            </text>
                        );
                    })}

                    {showIncremental ? (
                        /* Bar chart: one bar per calendar day, height = total view gain that day */
                        activeDailyBars.map((d, i) => {
                            const cx = toX(d.date + 'T12:00:00.000Z');
                            const x1 = Math.max(PAD_L, cx - dayBarW / 2);
                            const x2 = Math.min(W - PAD_R, cx + dayBarW / 2);
                            const barW = Math.max(x2 - x1, 1);
                            const barH = Math.max((d.delta / maxDelta) * chartH, 0);
                            const barY = PAD_T + chartH - barH;
                            return (
                                <rect
                                    key={i}
                                    x={x1}
                                    y={barY}
                                    width={barW}
                                    height={barH}
                                    fill={lineColor}
                                    opacity={hoveredPoint?.date === d.date ? 0.9 : 0.5}
                                    onMouseEnter={() => setHoveredPoint({
                                        x: cx,
                                        y: barY,
                                        views: 0,
                                        date: d.date,
                                        source: sourceName,
                                        delta: d.delta,
                                    })}
                                />
                            );
                        })
                    ) : (
                        /* Line chart: cumulative views */
                        <>
                            {/* Area fill */}
                            <path d={buildAreaPath(activeLineData)} fill={`url(#${gradId})`} />

                            {/* Line */}
                            <path d={buildPath(activeLineData)} fill="none" stroke={lineColor} strokeWidth="1.5" strokeLinejoin="round" />

                            {/* Interactive hit areas */}
                            {activeLineData.map((p, i) => (
                                <circle
                                    key={i}
                                    cx={toX(p.date)}
                                    cy={toY(p.views)}
                                    r="12"
                                    fill="transparent"
                                    onMouseEnter={() => setHoveredPoint({
                                        x: toX(p.date),
                                        y: toY(p.views),
                                        views: p.views,
                                        date: p.date,
                                        source: sourceName,
                                    })}
                                />
                            ))}
                        </>
                    )}

                    {/* Hovered dot + crosshair */}
                    {hoveredPoint && (
                        <>
                            <line x1={hoveredPoint.x} y1={PAD_T} x2={hoveredPoint.x} y2={PAD_T + chartH} stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="3 3" />
                            {!showIncremental && (
                                <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r="4" fill={lineColor} stroke="white" strokeWidth="1.5" />
                            )}
                        </>
                    )}
                </svg>

                {/* Floating tooltip */}
                {hoveredPoint && (
                    <div
                        className="absolute pointer-events-none border border-[var(--hairline-strong)] bg-[#1a1b1f] px-3 py-2 text-xs -translate-x-1/2 -translate-y-full -mt-2 whitespace-nowrap"
                        style={{ left: `${(hoveredPoint.x / W) * 100}%`, top: `${(hoveredPoint.y / H) * 100}%` }}
                    >
                        {showIncremental && hoveredPoint.delta !== undefined ? (
                            <>
                                <div className="text-[var(--text-secondary)] tracking-widest mb-0.5">
                                    {hoveredPoint.date.slice(0, 10)} ({new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(hoveredPoint.date + 'T12:00:00.000Z'))})
                                </div>
                                <div className="font-mono font-bold" style={{ color: lineColor }}>
                                    {hoveredPoint.source} · +{hoveredPoint.delta.toLocaleString()} {t('views')}
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="text-[var(--text-secondary)] tracking-widest mb-0.5">{hoveredPoint.date.slice(0, 16).replace('T', ' ')} (UTC)</div>
                                <div className="font-mono font-bold" style={{ color: lineColor }}>
                                    {hoveredPoint.source} · {hoveredPoint.views.toLocaleString()}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
