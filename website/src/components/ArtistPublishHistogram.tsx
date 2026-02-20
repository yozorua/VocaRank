'use client';

import { useState } from 'react';
import { SongRanking } from '@/types';

interface ArtistPublishHistogramProps {
    songs: SongRanking[];
}

export default function ArtistPublishHistogram({ songs }: ArtistPublishHistogramProps) {
    const [hoveredBar, setHoveredBar] = useState<{ year: number; count: number; x: number } | null>(null);

    // Filter songs with a publish date and group by year
    const songsWithDate = songs.filter(s => s.publish_date);
    if (songsWithDate.length < 2) return null;

    const yearCounts: Record<number, number> = {};
    for (const song of songsWithDate) {
        const year = new Date(song.publish_date!).getFullYear();
        yearCounts[year] = (yearCounts[year] || 0) + 1;
    }

    const years = Object.keys(yearCounts).map(Number).sort((a, b) => a - b);
    const maxCount = Math.max(...Object.values(yearCounts));

    // SVG dimensions
    const W = 800;
    const H = 120;
    const PAD_L = 36;
    const PAD_R = 16;
    const PAD_T = 12;
    const PAD_B = 24;
    const chartW = W - PAD_L - PAD_R;
    const chartH = H - PAD_T - PAD_B;

    const barCount = years.length;
    const barGap = 3;
    const barW = Math.max(4, (chartW / barCount) - barGap);

    const toX = (i: number) => PAD_L + i * (chartW / barCount) + (chartW / barCount - barW) / 2;
    const toBarH = (count: number) => (count / maxCount) * chartH;
    const toBarY = (count: number) => PAD_T + chartH - toBarH(count);

    return (
        <div className="mt-10 border-t border-[var(--hairline)] pt-8">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <div className="w-6 h-px bg-[var(--vermilion)]"></div>
                <span className="text-xs uppercase tracking-[0.25em] text-[var(--text-secondary)] font-bold">
                    Song Activity  ·  {songsWithDate.length} songs across {years.length} year{years.length !== 1 ? 's' : ''}
                </span>
            </div>

            {/* SVG Histogram */}
            <div className="relative w-full select-none" onMouseLeave={() => setHoveredBar(null)}>
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible">
                    {/* Horizontal grid line at max */}
                    <line x1={PAD_L} y1={PAD_T} x2={W - PAD_R} y2={PAD_T} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                    <line x1={PAD_L} y1={PAD_T + chartH / 2} x2={W - PAD_R} y2={PAD_T + chartH / 2} stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="3 3" />

                    {/* Y-axis labels */}
                    <text x={PAD_L - 4} y={PAD_T + 4} textAnchor="end" fill="rgba(255,255,255,0.25)" fontSize="9" fontFamily="monospace">{maxCount}</text>
                    <text x={PAD_L - 4} y={PAD_T + chartH / 2 + 4} textAnchor="end" fill="rgba(255,255,255,0.25)" fontSize="9" fontFamily="monospace">{Math.round(maxCount / 2)}</text>

                    {/* Bars */}
                    {years.map((year, i) => {
                        const count = yearCounts[year];
                        const x = toX(i);
                        const barH = toBarH(count);
                        const barY = toBarY(count);
                        const isHovered = hoveredBar?.year === year;
                        const intensity = count / maxCount;
                        // Color interpolation: low = muted teal-ish, high = vivid vermilion
                        const r = Math.round(100 + intensity * 132);
                        const g = Math.round(100 - intensity * 26);
                        const b = Math.round(120 - intensity * 75);
                        const barColor = isHovered ? 'var(--vermilion)' : `rgb(${r},${g},${b})`;

                        return (
                            <g key={year}>
                                <rect
                                    x={x}
                                    y={barY}
                                    width={barW}
                                    height={barH}
                                    fill={barColor}
                                    opacity={isHovered ? 1 : 0.7}
                                    rx={1}
                                    onMouseEnter={() => setHoveredBar({ year, count, x: x + barW / 2 })}
                                    className="cursor-default transition-opacity duration-150"
                                />
                                {/* Year label - only show every 2nd year if many bars */}
                                {(barCount <= 12 || i % 2 === 0) && (
                                    <text
                                        x={x + barW / 2}
                                        y={H - 4}
                                        textAnchor="middle"
                                        fill={isHovered ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.25)'}
                                        fontSize="9"
                                        fontFamily="monospace"
                                    >
                                        {year}
                                    </text>
                                )}
                            </g>
                        );
                    })}
                </svg>

                {/* Floating tooltip */}
                {hoveredBar && (
                    <div
                        className="absolute pointer-events-none border border-[var(--hairline-strong)] bg-[#1a1b1f] px-3 py-2 text-xs -translate-x-1/2 -translate-y-full whitespace-nowrap"
                        style={{ left: `${(hoveredBar.x / W) * 100}%`, top: `${(PAD_T / H) * 100}%`, marginTop: '-4px' }}
                    >
                        <div className="text-[var(--text-secondary)] tracking-widest mb-0.5">{hoveredBar.year}</div>
                        <div className="font-mono font-bold text-[var(--vermilion)]">
                            {hoveredBar.count} song{hoveredBar.count !== 1 ? 's' : ''}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
