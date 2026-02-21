'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { SongRanking } from '@/types';

interface YearCount {
    year: number;
    count: number;
}

interface ArtistPublishHistogramProps {
    /** Pre-aggregated from /song-dates endpoint — preferred, fastest */
    yearCounts?: YearCount[];
    /** Full song objects — fallback if yearCounts not provided */
    songs?: SongRanking[];
    /**
     * "default"  — full-width standalone block (mobile / bottom of card)
     * "inline"   — compact, sits beside the weblinks row on desktop
     */
    variant?: 'default' | 'inline';
}

export default function ArtistPublishHistogram({ yearCounts: yearCountsProp, songs, variant = 'default' }: ArtistPublishHistogramProps) {
    const t = useTranslations('ArtistPublishHistogram');
    const [hoveredBar, setHoveredBar] = useState<{ year: number; count: number; x: number } | null>(null);

    // Build yearCounts from whichever data source is available
    const yearCounts: Record<number, number> = {};
    let totalSongs = 0;
    if (yearCountsProp && yearCountsProp.length > 0) {
        for (const { year, count } of yearCountsProp) {
            yearCounts[year] = count;
            totalSongs += count;
        }
    } else if (songs) {
        for (const s of songs) {
            if (!s.publish_date) continue;
            const year = new Date(s.publish_date).getFullYear();
            yearCounts[year] = (yearCounts[year] || 0) + 1;
            totalSongs++;
        }
    }

    if (totalSongs < 2) return null;

    const minYear = Math.min(...Object.keys(yearCounts).map(Number));
    const maxYear = Math.max(...Object.keys(yearCounts).map(Number));

    const years: number[] = [];
    for (let y = minYear; y <= maxYear; y++) years.push(y);

    const maxCount = Math.max(...Object.values(yearCounts));

    const isInline = variant === 'inline';

    // No y-axis labels → less left padding needed
    const W = isInline ? 260 : 500;
    const H = isInline ? 90 : 130;
    const PAD_L = 6;
    const PAD_R = 6;
    const PAD_T = 8;
    const PAD_B = 18;  // room for x-axis year labels

    // Font: inline uses 8px (SVG units ≈ CSS px at ~1:1 scale in that column)
    // default uses 10px (SVG scales down to ~0.5× on desktop → ~5px CSS, fine for decorative labels)
    const FONT_SIZE = isInline ? 8 : 12;

    const chartW = W - PAD_L - PAD_R;
    const chartH = H - PAD_T - PAD_B;

    const barCount = years.length;
    const barGap = isInline ? 1.5 : 2;
    const barW = Math.max(isInline ? 3 : 4, (chartW / barCount) - barGap);

    const toX = (i: number) => PAD_L + i * (chartW / barCount) + (chartW / barCount - barW) / 2;
    const toBarH = (count: number) => count > 0 ? Math.max(2, (count / maxCount) * chartH) : 0;
    const toBarY = (count: number) => PAD_T + chartH - toBarH(count);

    // Year labels: every Nth so they don't crowd
    const labelStep = barCount > 20 ? Math.ceil(barCount / 8) : barCount > 10 ? 2 : 1;

    return (
        <div className={`flex flex-col h-full ${isInline ? 'min-w-0' : ''}`} onMouseLeave={() => setHoveredBar(null)}>
            {/* Header */}
            <div className="flex items-center gap-2 mb-2 flex-shrink-0">
                <div className="w-4 h-px bg-[var(--vermilion)]"></div>
                <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-secondary)] font-bold">
                    {t('title')}
                </span>
                <span className="text-[10px] text-[var(--text-secondary)] opacity-60">
                    {totalSongs} {t('songs')} / {years.length} {t('years')}
                </span>
            </div>

            {/* SVG — no y-axis labels or grid lines */}
            <div className="relative flex-1">
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full overflow-visible">
                    {/* Baseline only */}
                    <line x1={PAD_L} y1={PAD_T + chartH} x2={W - PAD_R} y2={PAD_T + chartH}
                        stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

                    {/* Bars */}
                    {years.map((year, i) => {
                        const count = yearCounts[year] ?? 0;
                        const x = toX(i);
                        const barH = toBarH(count);
                        const barY = toBarY(count);
                        const isHovered = hoveredBar?.year === year;
                        const intensity = count / maxCount;
                        const r = Math.round(100 + intensity * 132);
                        const g = Math.round(100 - intensity * 26);
                        const b = Math.round(120 - intensity * 75);
                        const barColor = count === 0
                            ? 'rgba(255,255,255,0.07)'
                            : isHovered ? 'var(--vermilion)' : `rgb(${r},${g},${b})`;

                        return (
                            <g key={year}>
                                <rect
                                    x={x}
                                    y={count === 0 ? PAD_T + chartH - 1 : barY}
                                    width={barW}
                                    height={count === 0 ? 1 : barH}
                                    fill={barColor}
                                    opacity={count === 0 ? 1 : isHovered ? 1 : 0.8}
                                    rx={count === 0 ? 0 : 1}
                                    onMouseEnter={count > 0 ? () => setHoveredBar({ year, count, x: x + barW / 2 }) : undefined}
                                    className={count > 0 ? 'cursor-default' : ''}
                                />
                                {i % labelStep === 0 && (
                                    <text
                                        x={x + barW / 2}
                                        y={H - 2}
                                        textAnchor="middle"
                                        fill={isHovered ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)'}
                                        fontSize={FONT_SIZE}
                                        fontFamily="monospace"
                                    >
                                        {year}
                                    </text>
                                )}
                            </g>
                        );
                    })}
                </svg>

                {/* Tooltip */}
                {hoveredBar && (
                    <div
                        className="absolute pointer-events-none border border-[var(--hairline-strong)] bg-[#1a1b1f] px-2.5 py-1.5 -translate-x-1/2 -translate-y-full whitespace-nowrap z-10"
                        style={{ left: `${(hoveredBar.x / W) * 100}%`, top: `${(PAD_T / H) * 100}%`, marginTop: '-4px' }}
                    >
                        <div className="text-[var(--text-secondary)] tracking-widest mb-0.5 text-[9px]">{hoveredBar.year}</div>
                        <div className="font-mono font-bold text-[var(--vermilion)] text-[10px]">
                            {hoveredBar.count} {t('songs')}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
