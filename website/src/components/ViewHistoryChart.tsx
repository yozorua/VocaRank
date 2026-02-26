'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslations } from 'next-intl';

interface HistoryPoint {
    date: string;
    views: number;
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

    const sorted = points.sort((a, b) => a.date.localeCompare(b.date));
    return sorted;
}



export default function ViewHistoryChart({ youtubeHistory, niconicoHistory, publishDate }: ViewHistoryChartProps) {
    const t = useTranslations('ViewHistoryChart');
    const [activeTab, setActiveTab] = useState<'youtube' | 'niconico'>(
        (youtubeHistory && youtubeHistory.length > 0) ? 'youtube' : 'niconico'
    );
    const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; views: number; date: string; source: string } | null>(null);

    // Parse once
    const { ytData, nicoData } = useMemo(() => {
        const _yt = normalizeHistory(youtubeHistory, publishDate);
        const _nico = normalizeHistory(niconicoHistory, publishDate);
        return { ytData: _yt, nicoData: _nico };
    }, [youtubeHistory, niconicoHistory, publishDate]);

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

    const ytHistory = normalizeHistory(youtubeHistory);
    const nicoHistory = normalizeHistory(niconicoHistory);

    const hasYoutube = ytHistory !== null;
    const hasNiconico = nicoHistory !== null;

    if (!hasYoutube && !hasNiconico) return null;

    const effectiveTab = (activeTab === 'youtube' && !hasYoutube) ? 'niconico'
        : (activeTab === 'niconico' && !hasNiconico) ? 'youtube' : activeTab;

    // Pick the active dataset
    const activeData: HistoryPoint[] =
        effectiveTab === 'youtube' ? (ytHistory ?? []) : (nicoHistory ?? []);

    const allViews = activeData.map(p => p.views);
    const minViews = Math.min(...allViews);
    const maxViews = Math.max(...allViews);
    const viewRange = maxViews - minViews || 1;

    const allDates = activeData.map(p => p.date); // sorted ascending

    // SVG dimensions
    const W = 800;
    const H = 250;
    const PAD_L = 100;
    const PAD_R = 16;
    const PAD_T = 16;
    const PAD_B = 60;
    const chartW = W - PAD_L - PAD_R;
    const chartH = H - PAD_T - PAD_B;

    // Time-linear X axis: map actual timestamp to SVG x position
    const minTime = new Date(activeData[0]?.date ?? 0).getTime();
    const maxTime = new Date(activeData[activeData.length - 1]?.date ?? 0).getTime();
    const timeRange = maxTime - minTime || 1;

    const toX = (date: string) => PAD_L + ((new Date(date).getTime() - minTime) / timeRange) * chartW;
    const toY = (views: number) => PAD_T + chartH - ((views - minViews) / viewRange) * chartH;

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

    // Active line/area color
    const lineColor =
        effectiveTab === 'youtube' ? '#FF4444' : '#E8954A';

    const gradId = effectiveTab === 'youtube' ? 'ytGrad' : 'nicoGrad';
    const gradColor =
        effectiveTab === 'youtube' ? '#FF4444' : '#E8954A';

    // X-axis ticks — pick up to 4 evenly-spaced ticks by time
    const tickCount = Math.min(4, allDates.length);
    const tickDates = Array.from({ length: tickCount }, (_, i) =>
        allDates[Math.floor(i * (allDates.length - 1) / (tickCount - 1 || 1))]
    );
    const yTicks = [0, 0.5, 1].map(t => minViews + t * viewRange);

    return (
        <div ref={containerRef} className="mt-10 border-t border-[var(--hairline)] pt-8">
            {/* Section header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <div className="w-6 h-px bg-[var(--vermilion)]"></div>
                    <span className="text-xs uppercase tracking-[0.25em] text-[var(--text-secondary)] font-bold">{t('title')}</span>
                </div>

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
                    {yTicks.map((v, i) => {
                        const y = toY(v);
                        return (
                            <g key={i}>
                                <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                                <text x={PAD_L - 6} y={y + 4} textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize={tickFontSize} fontFamily="monospace">
                                    {formatViews(Math.round(v))}
                                </text>
                            </g>
                        );
                    })}

                    {/* X-axis tick labels — full ISO date, rotated -30° */}
                    {tickDates.map((date, i) => {
                        if (i === 0) return null;
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

                    {/* Area fill */}
                    <path d={buildAreaPath(activeData)} fill={`url(#${gradId})`} />

                    {/* Line */}
                    <path d={buildPath(activeData)} fill="none" stroke={lineColor} strokeWidth="1.5" strokeLinejoin="round" />

                    {/* Interactive hit areas */}
                    {activeData.map((p, i) => (
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
                                source: effectiveTab === 'youtube' ? t('tab_youtube') : effectiveTab === 'niconico' ? t('tab_niconico') : t('tab_total'),
                            })}
                        />
                    ))}

                    {/* Hovered dot + crosshair */}
                    {hoveredPoint && (
                        <>
                            <line x1={hoveredPoint.x} y1={PAD_T} x2={hoveredPoint.x} y2={PAD_T + chartH} stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="3 3" />
                            <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r="4" fill={lineColor} stroke="white" strokeWidth="1.5" />
                        </>
                    )}
                </svg>

                {/* Floating tooltip */}
                {hoveredPoint && (
                    <div
                        className="absolute pointer-events-none border border-[var(--hairline-strong)] bg-[#1a1b1f] px-3 py-2 text-xs -translate-x-1/2 -translate-y-full -mt-2 whitespace-nowrap"
                        style={{ left: `${(hoveredPoint.x / W) * 100}%`, top: `${(hoveredPoint.y / H) * 100}%` }}
                    >
                        <div className="text-[var(--text-secondary)] tracking-widest mb-0.5">{hoveredPoint.date.slice(0, 16).replace('T', ' ')}</div>
                        <div className="font-mono font-bold" style={{ color: lineColor }}>
                            {hoveredPoint.source} · {hoveredPoint.views.toLocaleString()}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
