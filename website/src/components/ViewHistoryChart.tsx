'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';

interface HistoryPoint {
    date: string;
    views: number;
}

interface ViewHistoryChartProps {
    youtubeHistory?: HistoryPoint[] | null;
    niconicoHistory?: HistoryPoint[] | null;
}

function formatViews(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return n.toString();
}

/** Safely normalise any ISO timestamp or date string to YYYY-MM-DD */
function toDateKey(dateStr: string): string {
    return dateStr.slice(0, 10);
}

function formatDate(dateStr: string): string {
    const d = toDateKey(dateStr);
    return d; // already YYYY-MM-DD
}

export default function ViewHistoryChart({ youtubeHistory, niconicoHistory }: ViewHistoryChartProps) {
    const t = useTranslations('ViewHistoryChart');
    const [activeTab, setActiveTab] = useState<'youtube' | 'niconico' | 'combined'>('combined');
    const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; views: number; date: string; source: string } | null>(null);
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

    // Normalize all dates to YYYY-MM-DD
    const norm = (pts: HistoryPoint[] | null | undefined): HistoryPoint[] | null =>
        pts ? pts.map(p => ({ date: toDateKey(p.date), views: p.views })) : null;

    const ytHistory = norm(youtubeHistory);
    const nicoHistory = norm(niconicoHistory);

    const hasYoutube = ytHistory && ytHistory.length > 1;
    const hasNiconico = nicoHistory && nicoHistory.length > 1;

    if (!hasYoutube && !hasNiconico) return null;

    const buildDataset = () => {
        if (activeTab === 'youtube') return { primary: ytHistory || [], secondary: null };
        if (activeTab === 'niconico') return { primary: nicoHistory || [], secondary: null };
        return { primary: ytHistory || [], secondary: nicoHistory || [] };
    };

    const { primary, secondary } = buildDataset();

    const allPoints = secondary ? [...primary, ...secondary] : primary;
    const allViews = allPoints.map(p => p.views);
    const minViews = Math.min(...allViews);
    const maxViews = Math.max(...allViews);
    const viewRange = maxViews - minViews || 1;

    const allDates = [...new Set(allPoints.map(p => p.date))].sort();
    const dateRange = allDates.length - 1 || 1;

    // SVG dimensions
    const W = 800;
    const H = 200;
    const PAD_L = 56;
    const PAD_R = 16;
    const PAD_T = 16;
    const PAD_B = 30;
    const chartW = W - PAD_L - PAD_R;
    const chartH = H - PAD_T - PAD_B;

    const toX = (date: string) => {
        const idx = allDates.indexOf(date);
        return PAD_L + (idx / dateRange) * chartW;
    };
    const toY = (views: number) => PAD_T + chartH - ((views - minViews) / viewRange) * chartH;

    const buildPath = (data: HistoryPoint[]) => {
        const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
        return sorted.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.date).toFixed(1)} ${toY(p.views).toFixed(1)}`).join(' ');
    };

    const buildAreaPath = (data: HistoryPoint[]) => {
        const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
        const linePath = sorted.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.date).toFixed(1)} ${toY(p.views).toFixed(1)}`).join(' ');
        const firstX = toX(sorted[0].date).toFixed(1);
        const lastX = toX(sorted[sorted.length - 1].date).toFixed(1);
        const baseY = (PAD_T + chartH).toFixed(1);
        return `${linePath} L ${lastX} ${baseY} L ${firstX} ${baseY} Z`;
    };

    // Tick labels on X axis — max 4 ticks (fewer = larger font fits better on mobile)
    const tickCount = Math.min(4, allDates.length);
    const tickIndices = Array.from({ length: tickCount }, (_, i) => Math.floor(i * (allDates.length - 1) / (tickCount - 1 || 1)));
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
                    {hasYoutube && hasNiconico && (
                        <button
                            onClick={() => setActiveTab('combined')}
                            className={`px-3 py-1 text-[10px] uppercase tracking-widest font-bold transition-all ${activeTab === 'combined' ? 'bg-white/10 text-white' : 'text-[var(--text-secondary)] hover:text-white'}`}
                        >
                            {t('tab_all')}
                        </button>
                    )}
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
            <div className="relative w-full select-none">
                <svg
                    viewBox={`0 0 ${W} ${H}`}
                    className="w-full overflow-visible"
                    onMouseLeave={() => setHoveredPoint(null)}
                >
                    <defs>
                        <linearGradient id="ytGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#FF4444" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#FF4444" stopOpacity="0.02" />
                        </linearGradient>
                        <linearGradient id="nicoGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#E8954A" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#E8954A" stopOpacity="0.02" />
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

                    {/* X-axis tick labels */}
                    {tickIndices.map((idx) => {
                        const date = allDates[idx];
                        const x = toX(date);
                        return (
                            <text key={idx} x={x} y={H - 4} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize={tickFontSize} fontFamily="monospace">
                                {date.slice(0, 7)}
                            </text>
                        );
                    })}

                    {/* Niconico area + line */}
                    {(activeTab === 'niconico' || activeTab === 'combined') && hasNiconico && (
                        <>
                            <path d={buildAreaPath(nicoHistory!)} fill="url(#nicoGradient)" />
                            <path d={buildPath(nicoHistory!)} fill="none" stroke="#E8954A" strokeWidth="1.5" strokeLinejoin="round" />
                        </>
                    )}

                    {/* YouTube area + line */}
                    {(activeTab === 'youtube' || activeTab === 'combined') && hasYoutube && (
                        <>
                            <path d={buildAreaPath(ytHistory!)} fill="url(#ytGradient)" />
                            <path d={buildPath(ytHistory!)} fill="none" stroke="#FF4444" strokeWidth="1.5" strokeLinejoin="round" />
                        </>
                    )}

                    {/* Interactive hit areas */}
                    {(activeTab === 'youtube' || activeTab === 'combined') && hasYoutube && ytHistory!.map((p, i) => (
                        <circle
                            key={`yt-${i}`}
                            cx={toX(p.date)}
                            cy={toY(p.views)}
                            r="12"
                            fill="transparent"
                            onMouseEnter={() => setHoveredPoint({ x: toX(p.date), y: toY(p.views), views: p.views, date: p.date, source: t('tab_youtube') })}
                        />
                    ))}
                    {(activeTab === 'niconico' || activeTab === 'combined') && hasNiconico && nicoHistory!.map((p, i) => (
                        <circle
                            key={`nico-${i}`}
                            cx={toX(p.date)}
                            cy={toY(p.views)}
                            r="12"
                            fill="transparent"
                            onMouseEnter={() => setHoveredPoint({ x: toX(p.date), y: toY(p.views), views: p.views, date: p.date, source: t('tab_niconico') })}
                        />
                    ))}

                    {/* Hovered dot + crosshair */}
                    {hoveredPoint && (
                        <>
                            <line x1={hoveredPoint.x} y1={PAD_T} x2={hoveredPoint.x} y2={PAD_T + chartH} stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="3 3" />
                            <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r="4" fill={hoveredPoint.source === t('tab_youtube') ? '#FF4444' : '#E8954A'} stroke="white" strokeWidth="1.5" />
                        </>
                    )}
                </svg>

                {/* Floating tooltip */}
                {hoveredPoint && (
                    <div
                        className="absolute pointer-events-none border border-[var(--hairline-strong)] bg-[#1a1b1f] px-3 py-2 text-xs -translate-x-1/2 -translate-y-full -mt-2 whitespace-nowrap"
                        style={{ left: `${(hoveredPoint.x / W) * 100}%`, top: `${(hoveredPoint.y / H) * 100}%` }}
                    >
                        <div className="text-[var(--text-secondary)] tracking-widest mb-0.5">{formatDate(hoveredPoint.date)}</div>
                        <div className="font-mono font-bold" style={{ color: hoveredPoint.source === t('tab_youtube') ? '#FF4444' : '#E8954A' }}>
                            {hoveredPoint.source} · {hoveredPoint.views.toLocaleString()}
                        </div>
                    </div>
                )}

                {/* Legend */}
                {activeTab === 'combined' && hasYoutube && hasNiconico && (
                    <div className="flex gap-6 mt-3 justify-end">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-px bg-[#FF4444]"></div>
                            <span className="text-[10px] tracking-widest text-[var(--text-secondary)] uppercase">{t('tab_youtube')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-px bg-[#E8954A]"></div>
                            <span className="text-[10px] tracking-widest text-[var(--text-secondary)] uppercase">{t('tab_niconico')}</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
