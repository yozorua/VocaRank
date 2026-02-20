'use client';

import { SongRanking } from '@/types';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { useLocale } from 'next-intl';

import { useState } from 'react';

interface RankingTableProps {
    songs: SongRanking[];
    mode: string;
    sort?: string;
    showRank?: boolean;
}

import NoThumbnail from './NoThumbnail';

function ThumbnailWithFallback({ song, className }: { song: SongRanking, className?: string }) {
    const [src, setSrc] = useState<string | null>(() => {
        // Initial strategy
        if (song.youtube_id) return `https://i.ytimg.com/vi/${song.youtube_id}/mqdefault.jpg`;
        if (song.niconico_id) {
            const match = song.niconico_id.match(/\d+/);
            return match ? `https://nicovideo.cdn.nimg.jp/thumbnails/${match[0]}/${match[0]}` : null;
        }
        return null;
    });
    const [error, setError] = useState(false);

    const handleError = () => {
        if (!src) return;

        // Strategy: MQ -> HQ -> Nico -> Fail
        if (src.includes('mqdefault')) {
            setSrc(prev => prev ? prev.replace('mqdefault', 'hqdefault') : null);
        } else if (src.includes('hqdefault') && song.niconico_id) {
            const match = song.niconico_id.match(/\d+/);
            const nicoUrl = match ? `https://nicovideo.cdn.nimg.jp/thumbnails/${match[0]}/${match[0]}` : null;
            // If we are already trying nico or nico is invalid, fail
            if (nicoUrl && src !== nicoUrl) {
                setSrc(nicoUrl);
            } else {
                setError(true);
            }
        } else {
            setError(true);
        }
    };

    if (error || !src) {
        return <NoThumbnail className={className} />;
    }

    return (
        <img
            src={src}
            alt={song.name_english || "Thumbnail"}
            className={className}
            onError={handleError}
            loading="lazy"
        />
    );
}

export default function RankingTable({ songs, mode, sort = 'total', showRank = true }: RankingTableProps) {
    const t = useTranslations('RankingTable');
    const locale = useLocale();
    const router = useRouter();
    const [showAll, setShowAll] = useState(false);

    // Limit to 20 unless expanded
    const displayedSongs = showAll ? songs : songs.slice(0, 20);

    const getSongName = (song: SongRanking) => {
        if (locale === 'ja') return song.name_japanese || song.name_romaji || song.name_english;
        if (locale === 'zh-TW') return song.name_japanese || song.name_romaji || song.name_english;
        return song.name_english || song.name_romaji || song.name_japanese;
    };

    const formatDate = (dateString: string | null | undefined) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}/${m}/${d}`;
    };

    const getViews = (song: SongRanking) => {
        if (sort === 'youtube') return song.views_youtube;
        if (sort === 'niconico') return song.views_niconico;
        return song.total_views;
    };

    const getIncrement = (song: SongRanking) => {
        if (sort === 'youtube') return song.increment_youtube ?? 0;
        if (sort === 'niconico') return song.increment_niconico ?? 0;
        return song.increment_total ?? 0;
    };



    const formatSongType = (type: string | null) => {
        if (!type) return null;
        if (type === 'Original') return <span className="text-white border border-white/30 px-1 py-[2px] font-medium uppercase text-[9px] tracking-widest">ORIGINAL</span>;
        if (type === 'Cover') return <span className="text-[var(--cyan-subtle)] border border-[var(--cyan-subtle)]/40 px-1 py-[2px] font-medium uppercase text-[9px] tracking-widest">COVER</span>;
        if (type === 'Remix') return <span className="text-[var(--gold)] border border-[var(--gold)]/40 px-1 py-[2px] font-medium uppercase text-[9px] tracking-widest">REMIX</span>;
        return <span className="text-[var(--text-secondary)] border border-[var(--hairline-strong)] px-1 py-[2px] font-medium uppercase text-[9px] tracking-widest">{type.toUpperCase()}</span>;
    };

    const renderArtistList = (artists: any[]) => {
        if (!artists || artists.length === 0) return <span className="text-gray-500">Unknown</span>;

        return (
            <div className="flex flex-wrap gap-1 items-center">
                {artists.map((artist, idx) => (
                    <span key={artist.id} className="flex items-center">
                        <Link
                            href={`/artist/${artist.id}`}
                            className="hover:text-[var(--miku-teal)] transition-colors"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {artist.name}
                        </Link>
                        {idx < artists.length - 1 && <span className="text-gray-600 ml-1">・</span>}
                    </span>
                ))}
            </div>
        );
    };

    if (songs.length === 0) {
        const skeletonRows = Array.from({ length: 5 });
        return (
            <div className="w-full animate-pulse">
                {/* Mobile View Skeleton */}
                <div className="flex flex-col gap-3 md:hidden">
                    {skeletonRows.map((_, i) => (
                        <div key={i} className="glass-panel p-3 rounded-xl border border-white/5 flex items-center gap-3">
                            {showRank && <div className="w-8 h-8 bg-white/10 rounded-md"></div>}
                            <div className="w-24 h-16 bg-white/10 rounded-lg flex-shrink-0"></div>
                            <div className="flex-1 space-y-3 py-1">
                                <div className="h-4 bg-white/20 rounded w-3/4"></div>
                                <div className="h-3 bg-white/10 rounded w-1/2"></div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Desktop View Skeleton */}
                <div className="hidden md:block overflow-x-auto px-1 pb-4">
                    <table className="w-full text-left border-separate border-spacing-y-3 min-w-[800px]">
                        <thead>
                            <tr className="text-[var(--text-secondary)] text-sm uppercase tracking-wider">
                                {showRank && <th className="p-4 text-center w-20">#</th>}
                                <th className="p-4 w-24"></th>
                                <th className="p-4">{t('song')}</th>
                                <th className="p-4 text-right w-36">{t('published')}</th>
                                <th className="p-4 text-right">
                                    {sort === 'youtube' ? t('sort_youtube') : sort === 'niconico' ? t('sort_niconico') : t('views')}
                                </th>
                                {mode !== 'total' && (
                                    <th className="p-4 pr-6 text-right">{t('increment')}</th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {skeletonRows.map((_, i) => (
                                <tr key={i} className="bg-[var(--bg-panel)] backdrop-blur-sm rounded-xl border border-transparent">
                                    {showRank && <td className="p-4 text-center"><div className="w-6 h-8 bg-white/10 rounded mx-auto"></div></td>}
                                    <td className="p-3"><div className="w-20 h-12 bg-white/10 rounded shadow-lg"></div></td>
                                    <td className="p-3 space-y-3 py-4">
                                        <div className="h-5 bg-white/20 rounded w-1/3"></div>
                                        <div className="h-3 bg-white/10 rounded w-1/4"></div>
                                    </td>
                                    <td className="p-3 text-right"><div className="h-4 bg-white/10 rounded w-20 ml-auto"></div></td>
                                    <td className="p-3 text-right"><div className="h-6 bg-white/10 rounded w-24 ml-auto"></div></td>
                                    {mode !== 'total' && <td className="p-3 text-right"><div className="h-4 bg-white/10 rounded w-16 ml-auto"></div></td>}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full">
            {/* Mobile View: Editorial List */}
            <div className="flex flex-col gap-4 md:hidden">
                {displayedSongs.map((song, index) => {
                    const rank = index + 1;
                    const rankColor = rank === 1 ? "text-[var(--gold)]"
                        : rank === 2 ? "text-white"
                            : rank === 3 ? "text-[var(--cyan-subtle)]"
                                : "text-[var(--text-secondary)] opacity-50";

                    const increment = getIncrement(song);

                    return (
                        <Link key={song.id} href={`/song/${song.id}`} className="group hairline-border p-4 bg-transparent active:bg-[var(--hairline)] transition-colors block">
                            <div className="flex items-center gap-4">
                                {/* Rank */}
                                {showRank && (
                                    <div className={`font-serif text-3xl italic w-8 text-center flex-shrink-0 ${rankColor} -mt-2`}>
                                        {rank}
                                    </div>
                                )}

                                {/* Thumbnail */}
                                <div className="w-24 h-16 bg-black border border-[var(--hairline)] flex-shrink-0 relative">
                                    <ThumbnailWithFallback song={song} className="w-full h-full object-cover grayscale-[50%] group-hover:grayscale-0 transition-all duration-500" />
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                    <div className="font-bold text-sm text-white line-clamp-1 leading-relaxed mb-1 group-hover:text-[var(--vermilion)] transition-colors tracking-wide">
                                        {getSongName(song)}
                                    </div>
                                    <div className="text-[11px] text-[var(--text-secondary)] flex flex-wrap items-center gap-2 min-w-0">
                                        <div className="flex-shrink-0">{formatSongType(song.song_type)}</div>
                                        <div className="truncate">{song.artist_string}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Stats Row */}
                            <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--hairline)]">
                                <div className="text-[10px] text-[var(--text-secondary)] font-mono tracking-widest">{formatDate(song.publish_date)}</div>

                                <div className="flex items-center gap-6">
                                    {/* Views */}
                                    <div className="text-right">
                                        <div className="text-[9px] text-[var(--text-secondary)] uppercase tracking-[0.2em] mb-1">{t('views')}</div>
                                        <div className="font-mono text-sm text-white tracking-wider">{getViews(song).toLocaleString()}</div>
                                    </div>

                                    {/* Increment (Gain) */}
                                    {mode !== 'total' && (
                                        <div className="text-right min-w-[60px]">
                                            <div className="text-[9px] text-[var(--text-secondary)] uppercase tracking-[0.2em] mb-1">{t('increment')}</div>
                                            {increment > 0 ? (
                                                <div className="text-[var(--vermilion)] font-mono text-sm tracking-wider">
                                                    +{increment.toLocaleString()}
                                                </div>
                                            ) : (
                                                <div className="text-[var(--text-secondary)] font-mono text-sm tracking-wider">-</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Link>
                    );
                })}
            </div>

            {/* Desktop View: Editorial Table */}
            <div className="hidden md:block overflow-x-auto px-1 pb-4">
                <table className="w-full text-left border-collapse min-w-[800px] table-fixed">
                    <thead>
                        <tr className="text-[var(--text-secondary)] text-[10px] uppercase tracking-[0.2em] border-b border-[var(--hairline-strong)]">
                            {showRank && <th className="py-4 font-normal text-center w-20">RANK</th>}
                            <th className="py-4 font-normal w-28">PV</th>
                            <th className="py-4 font-normal pl-2">{t('song')}</th>
                            <th className="py-4 font-normal text-right w-36">{t('published')}</th>
                            <th className="py-4 font-normal text-right w-32">
                                {sort === 'youtube' ? t('sort_youtube') : sort === 'niconico' ? t('sort_niconico') : t('views')}
                            </th>
                            {/* Hide Gain for total ranking */}
                            {mode !== 'total' && (
                                <th className="py-4 font-normal pr-4 text-right w-32">{t('increment')}</th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {displayedSongs.map((song, index) => {
                            const rank = index + 1;
                            const rankColor = rank === 1 ? "text-[var(--gold)] drop-shadow-[0_0_8px_rgba(212,175,55,0.4)]"
                                : rank === 2 ? "text-white"
                                    : rank === 3 ? "text-[var(--cyan-subtle)]"
                                        : "text-[var(--text-secondary)] opacity-50";

                            return (
                                <tr
                                    key={song.id}
                                    className={`
                                        group bg-transparent border-b border-[var(--hairline)]
                                        hover:bg-[var(--hairline)] hover:cursor-pointer
                                        transition-colors duration-300
                                    `}
                                    onClick={() => router.push(`/song/${song.id}`)}
                                >
                                    {showRank && (
                                        <td className="py-4 text-center align-middle">
                                            <span className={`font-serif text-3xl italic ${rankColor}`}>{rank}</span>
                                        </td>
                                    )}
                                    <td className="py-4">
                                        <div className="w-24 h-16 relative border border-[var(--hairline)] bg-black mr-4 overflow-hidden">
                                            <ThumbnailWithFallback song={song} className="w-full h-full object-cover grayscale-[50%] group-hover:-translate-y-1 group-hover:scale-105 group-hover:grayscale-0 transition-all duration-700 ease-out" />
                                        </div>
                                    </td>
                                    <td className="py-4 pl-2 pr-4 text-ellipsis overflow-hidden">
                                        <div className="font-bold text-white text-base mb-2 line-clamp-1 group-hover:text-[var(--vermilion)] transition-colors tracking-wide w-full" title={getSongName(song) ?? ""}>
                                            {getSongName(song)}
                                        </div>
                                        <div className="text-[11px] text-[var(--text-secondary)] flex items-center gap-3">
                                            <div className="flex-shrink-0">
                                                {formatSongType(song.song_type)}
                                            </div>
                                            <div className="flex items-center gap-2 line-clamp-1 truncate min-w-0">
                                                {renderArtistList(song.artists)}
                                            </div>
                                            {song.vocalists && song.vocalists.length > 0 && (
                                                <>
                                                    <span className="text-[var(--hairline-strong)]">|</span>
                                                    <div className="flex items-center gap-2 line-clamp-1 truncate min-w-0">
                                                        <span className="text-[9px] uppercase tracking-widest text-white/40">Vocals</span>
                                                        {renderArtistList(song.vocalists)}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-4 text-right text-[var(--text-secondary)] font-mono text-sm tracking-widest">
                                        {formatDate(song.publish_date)}
                                    </td>
                                    <td className="py-4 text-right font-mono text-base tracking-wider">
                                        <div className="text-white group-hover:text-[var(--gold)] transition-colors duration-300">
                                            {getViews(song).toLocaleString()}
                                        </div>
                                    </td>

                                    {mode !== 'total' && (
                                        <td className="py-4 pr-4 text-right font-mono text-sm tracking-wider">
                                            <div className={`${getIncrement(song) > 0 ? 'text-[var(--vermilion)]' : 'text-[var(--text-secondary)]'}`}>
                                                {getIncrement(song) > 0 ? `+${getIncrement(song).toLocaleString()}` : '-'}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            {/* Show More Button */}
            {
                !showAll && songs.length > 20 && (
                    <div className="flex justify-center mt-12 pb-8">
                        <button
                            onClick={() => setShowAll(true)}
                            className="group relative px-10 py-4 text-[var(--text-secondary)] hover:text-white font-medium text-xs tracking-[0.3em] uppercase transition-all"
                        >
                            <span className="absolute inset-0 border border-[var(--hairline-strong)] group-hover:border-[var(--vermilion)] transition-colors duration-500"></span>
                            <span className="relative z-10 flex items-center gap-3">
                                {t('show_more', { defaultMessage: 'View Top 100' })}
                                <span className="font-serif">◇</span>
                            </span>
                        </button>
                    </div>
                )
            }
        </div >
    );
}
