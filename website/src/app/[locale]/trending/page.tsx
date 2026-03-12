'use client';

import { getCustomRankings } from '@/lib/api';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { SongRanking } from '@/types';

type SortKey = 'total' | 'youtube' | 'niconico';

function getThumbUrl(song: SongRanking): string | null {
    if (song.youtube_id) {
        return `https://i.ytimg.com/vi/${song.youtube_id}/hqdefault.jpg`;
    }
    if (song.niconico_thumb_url) return song.niconico_thumb_url;
    return null;
}

function daysAgo(publishDate: string | null, t: (key: string, opts?: Record<string, string | number | Date>) => string): string {
    if (!publishDate) return '';
    const diff = Math.floor((Date.now() - new Date(publishDate).getTime()) / 86400000);
    if (diff === 0) return t('time_today');
    if (diff === 1) return t('time_yesterday');
    return t('time_days_ago', { count: diff });
}

function getSongName(song: SongRanking, locale: string): string {
    if (locale === 'zh-TW' || locale === 'ja') {
        return song.name_japanese || song.name_english || song.name_romaji || '';
    }
    return song.name_english || song.name_romaji || song.name_japanese || '';
}

function isNew(publishDate: string | null): boolean {
    if (!publishDate) return false;
    return Math.floor((Date.now() - new Date(publishDate).getTime()) / 86400000) <= 2;
}

function songTypeColor(type: string | null): string {
    if (type === 'Original') return 'var(--cyan-subtle)';
    if (type === 'Cover')    return '#E8954A';
    if (type === 'Remix')    return 'var(--gold)';
    if (type === 'Remaster') return '#B284BE';
    return 'rgba(255,255,255,0.45)';
}

// Gold / Silver / Bronze styling for #1-3 cards
const PODIUM_STYLES: Record<number, { color: string; border: string; glow: string }> = {
    0: { color: '#FFD700', border: 'rgba(255,215,0,0.30)', glow: 'rgba(255,215,0,0.08)' },
    1: { color: '#C0C0C0', border: 'rgba(192,192,192,0.25)', glow: 'rgba(192,192,192,0.06)' },
    2: { color: '#CD7F32', border: 'rgba(205,127,50,0.25)', glow: 'rgba(205,127,50,0.06)' },
};

function TrendingContent() {
    const t = useTranslations('TrendingPage');
    const locale = useLocale();
    const sp = useSearchParams();
    const sort = (sp.get('sort') ?? 'total') as SortKey;

    const [songs, setSongs] = useState<SongRanking[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const requestIdRef = useRef(0);

    const fetchSongs = useCallback((sortBy: SortKey, reqId: number) => {
        const today = new Date();
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(today.getDate() - 14);
        const fmt = (d: Date) => d.toISOString().split('T')[0];

        getCustomRankings(
            50,
            'Original,Remaster,Remix',
            true,
            fmt(twoWeeksAgo),
            fmt(today),
            undefined,
            undefined,
            undefined,
            undefined,
            sortBy,
        ).then(data => {
            if (reqId !== requestIdRef.current) return;
            setSongs(data);
            setLoading(false);
        }).catch(() => {
            if (reqId !== requestIdRef.current) return;
            setError(true);
            setLoading(false);
        });
    }, []);

    useEffect(() => {
        setLoading(true);
        setError(false);
        const id = ++requestIdRef.current;
        fetchSongs(sort, id);
    }, [sort, fetchSongs]);

    const cards = songs.slice(0, 24);
    const list  = songs.slice(24);

    const sortOptions: { key: SortKey; label: string }[] = [
        { key: 'total',    label: t('sort_total') },
        { key: 'youtube',  label: t('sort_youtube') },
        { key: 'niconico', label: t('sort_niconico') },
    ];

    return (
        <div className="max-w-[var(--max-width)] mx-auto px-6 py-4">

            {/* ── Page Header ── */}
            <div className="mb-6 pt-2">
                <h1 className="text-2xl md:text-3xl font-bold mb-2">{t('title')}</h1>
                <p className="text-[var(--text-secondary)] text-sm md:text-base">{t('description')}</p>
            </div>

            {/* ── Sort Bar ── */}
            <div className="flex justify-end mb-6 md:mb-8 border-b border-[var(--hairline-strong)] pb-0">
                <div className="flex items-center gap-6 pb-3">
                    {sortOptions.map(opt => (
                        <Link
                            key={opt.key}
                            href={`/trending?sort=${opt.key}`}
                            className={`text-[10px] md:text-xs uppercase font-bold transition-all tracking-widest ${
                                sort === opt.key
                                    ? 'text-white'
                                    : 'text-[var(--text-secondary)] hover:text-white'
                            }`}
                        >
                            {opt.label}
                        </Link>
                    ))}
                </div>
            </div>

            {/* ── Loading ── */}
            {loading && (
                <div className="flex items-center gap-3 py-24 justify-center text-[var(--text-secondary)] text-xs tracking-widest uppercase animate-pulse">
                    <span className="w-4 h-px bg-[var(--vermilion)]" />
                    Loading
                    <span className="w-4 h-px bg-[var(--vermilion)]" />
                </div>
            )}

            {/* ── Error ── */}
            {!loading && error && (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                    <p className="text-white font-bold tracking-widest uppercase text-sm">Failed to Load</p>
                    <button
                        onClick={() => {
                            setLoading(true);
                            setError(false);
                            const id = ++requestIdRef.current;
                            fetchSongs(sort, id);
                        }}
                        className="px-6 py-2 text-xs border border-[var(--hairline-strong)] text-[var(--text-secondary)] hover:border-[var(--vermilion)] hover:text-[var(--vermilion)] transition-all uppercase tracking-widest"
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* ── Empty ── */}
            {!loading && !error && songs.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 gap-3 text-[var(--text-secondary)] text-xs tracking-widest uppercase">
                    <span className="w-4 h-px bg-[var(--hairline-strong)]" />
                    {t('no_songs')}
                    <span className="w-4 h-px bg-[var(--hairline-strong)]" />
                </div>
            )}

            {!loading && !error && songs.length > 0 && (
                <>
                    {/* ── Card Grid (#1 – #15) ── */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-10">
                        {cards.map((song, idx) => {
                            const thumb = getThumbUrl(song);
                            const ps = PODIUM_STYLES[idx];
                            const name = getSongName(song, locale);
                            const fresh = isNew(song.publish_date);
                            const isPodium = idx < 3;
                            return (
                                <Link
                                    key={song.id}
                                    href={`/song/${song.id}`}
                                    className="relative group overflow-hidden block aspect-video"
                                    style={isPodium
                                        ? { border: `1px solid ${ps.border}`, boxShadow: `inset 0 0 40px ${ps.glow}` }
                                        : { border: '1px solid var(--hairline)' }
                                    }
                                >
                                    {/* Thumbnail */}
                                    {thumb ? (
                                        <img
                                            src={thumb}
                                            alt={name}
                                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                                            loading={idx < 6 ? 'eager' : 'lazy'}
                                        />
                                    ) : (
                                        <div className="absolute inset-0 bg-[#0d0d0d]" />
                                    )}

                                    {/* Gradient overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

                                    {/* Bottom accent for podium */}
                                    {isPodium && (
                                        <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ backgroundColor: ps.border }} />
                                    )}

                                    {/* Rank number */}
                                    <div
                                        className="absolute top-1.5 left-2 font-black leading-none select-none text-xl"
                                        style={isPodium
                                            ? { color: ps.color, textShadow: '0 1px 8px rgba(0,0,0,0.9)' }
                                            : { color: 'rgba(255,255,255,0.5)', textShadow: '0 1px 6px rgba(0,0,0,0.9)' }
                                        }
                                    >
                                        {idx + 1}
                                    </div>

                                    {/* Top-right badges */}
                                    <div className="absolute top-1.5 right-1.5 flex flex-col items-end gap-0.5">
                                        {fresh && (
                                            <span className="text-[7px] font-black uppercase tracking-widest px-1 py-px bg-[var(--vermilion)] text-white">
                                                NEW
                                            </span>
                                        )}
                                        <span
                                            className="text-[9px] font-bold uppercase tracking-widest px-1 py-px bg-black/70 border border-white/10"
                                            style={{ color: songTypeColor(song.song_type) }}
                                        >
                                            {song.song_type}
                                        </span>
                                    </div>

                                    {/* Info */}
                                    <div className="absolute bottom-0 left-0 right-0 px-2 py-2">
                                        <p className="text-white group-hover:text-[var(--gold)] font-semibold text-sm leading-tight line-clamp-2 mb-1 drop-shadow transition-colors duration-200">
                                            {name}
                                        </p>
                                        <div className="flex items-center justify-between gap-1">
                                            <p className="text-white/60 text-[13px] truncate leading-none">{song.artist_string}</p>
                                            <span className="text-white/30 text-[10px] font-mono shrink-0 leading-none">{daysAgo(song.publish_date, t)}</span>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>

                    {/* ── List (#16+) ── */}
                    {list.length > 0 && (
                        <>
                            <div className="border-t border-[var(--hairline)]">
                                {list.map((song, idx) => {
                                    const rank = idx + 25;
                                    const thumb = getThumbUrl(song);
                                    const name = getSongName(song, locale);
                                    const fresh = isNew(song.publish_date);
                                    return (
                                        <Link
                                            key={song.id}
                                            href={`/song/${song.id}`}
                                            className="flex items-center gap-3 py-3.5 px-2 border-b border-[var(--hairline)] hover:bg-white/[0.025] transition-colors group"
                                        >
                                            <span className="w-8 text-right font-mono text-base text-[var(--text-secondary)] opacity-40 shrink-0 select-none tabular-nums">
                                                {rank}
                                            </span>

                                            <div className="w-[72px] h-[40px] shrink-0 overflow-hidden bg-[#0d0d0d]">
                                                {thumb && (
                                                    <img src={thumb} alt={name} className="w-full h-full object-cover" loading="lazy" />
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5 mb-1">
                                                    <p className="text-white font-medium text-base truncate group-hover:text-[var(--gold)] transition-colors leading-tight">
                                                        {name}
                                                    </p>
                                                    {fresh && (
                                                        <span className="text-[7px] font-black uppercase tracking-wider px-1 py-px bg-[var(--vermilion)] text-white shrink-0">
                                                            NEW
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[var(--text-secondary)] text-sm truncate opacity-60">
                                                    {song.artist_string}
                                                </p>
                                            </div>

                                            <span
                                                className="text-[9px] font-bold uppercase tracking-widest shrink-0"
                                                style={{ color: songTypeColor(song.song_type) }}
                                            >
                                                {song.song_type}
                                            </span>

                                            <span className="text-[10px] font-mono text-[var(--text-secondary)] opacity-40 shrink-0 hidden sm:block w-14 text-right tabular-nums">
                                                {daysAgo(song.publish_date, t)}
                                            </span>
                                        </Link>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
}

export default function TrendingPage() {
    return (
        <Suspense>
            <TrendingContent />
        </Suspense>
    );
}
