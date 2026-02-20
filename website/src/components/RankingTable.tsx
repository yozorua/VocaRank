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
        if (type === 'Original') return <span className="text-cyan-400 font-bold uppercase text-[10px] tracking-wider">ORIGINAL</span>;
        if (type === 'Cover') return <span className="text-green-400 font-bold uppercase text-[10px] tracking-wider">COVER</span>;
        if (type === 'Remix') return <span className="text-orange-400 font-bold uppercase text-[10px] tracking-wider">REMIX</span>;
        if (type === 'Remaster') return <span className="text-blue-400 font-bold uppercase text-[10px] tracking-wider">REMASTER</span>;
        if (type === 'Vocals') return <span className="text-purple-400 font-bold uppercase text-[10px] tracking-wider">VOCALS</span>;
        return <span className="text-gray-500 font-bold uppercase text-[10px] tracking-wider">{type.toUpperCase()}</span>;
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
            {/* Mobile View: Card List */}
            <div className="flex flex-col gap-3 md:hidden">
                {displayedSongs.map((song, index) => {
                    const rank = index + 1;
                    const rankColor = rank === 1 ? "text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.6)]"
                        : rank === 2 ? "text-gray-300 drop-shadow-[0_0_10px_rgba(209,213,219,0.5)]"
                            : rank === 3 ? "text-amber-600 drop-shadow-[0_0_10px_rgba(217,119,6,0.5)]"
                                : "text-gray-500";
                    const cardBorder = rank === 1 ? "border-yellow-500/30 shadow-[0_0_20px_rgba(250,204,21,0.1)]"
                        : rank === 2 ? "border-gray-400/30"
                            : rank === 3 ? "border-amber-600/30"
                                : "border-white/5";

                    const increment = getIncrement(song);

                    return (
                        <Link key={song.id} href={`/song/${song.id}`} className={`glass-panel p-3 rounded-xl border ${cardBorder} relative overflow-hidden block active:scale-95 transition-transform`}>
                            <div className="flex items-center gap-3">
                                {/* Rank */}
                                {showRank && (
                                    <div className={`text-2xl font-black italic w-12 text-center flex-shrink-0 ${rankColor}`}>
                                        {rank}
                                    </div>
                                )}

                                {/* Thumbnail */}
                                <div className="w-24 h-16 bg-black rounded-lg overflow-hidden flex-shrink-0 relative">
                                    <ThumbnailWithFallback song={song} className="w-full h-full object-cover" />
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                    <div className="font-bold text-sm text-white line-clamp-1 leading-tight mb-1">
                                        {getSongName(song)}
                                    </div>
                                    <div className="text-xs text-gray-400 flex items-center gap-2 min-w-0">
                                        <div className="flex-shrink-0">{formatSongType(song.song_type)}</div>
                                        <div className="truncate">{song.artist_string}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Stats Row */}
                            <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/5">
                                <div className="text-xs text-gray-400 font-mono">{formatDate(song.publish_date)}</div>

                                <div className="flex items-center gap-4">
                                    {/* Views */}
                                    <div className="text-right">
                                        <div className="text-[10px] text-gray-500 uppercase tracking-wider">{t('views')}</div>
                                        <div className="font-mono font-bold text-sm text-white">{getViews(song).toLocaleString()}</div>
                                    </div>

                                    {/* Increment (Gain) */}
                                    {mode !== 'total' && (
                                        <div className="text-right min-w-[60px]">
                                            <div className="text-[10px] text-gray-500 uppercase tracking-wider">{t('increment')}</div>
                                            {increment > 0 ? (
                                                <div className="text-[var(--miku-teal)] font-mono font-bold text-sm">
                                                    ▲ {increment.toLocaleString()}
                                                </div>
                                            ) : (
                                                <div className="text-gray-600 font-mono text-sm">-</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Link>
                    );
                })}
            </div>

            {/* Desktop View: Table */}
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
                            {/* Hide Gain for total ranking */}
                            {mode !== 'total' && (
                                <th className="p-4 pr-6 text-right">{t('increment')}</th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {displayedSongs.map((song, index) => {
                            const rank = index + 1;
                            const rankColor = rank === 1 ? "text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.6)]"
                                : rank === 2 ? "text-gray-300 drop-shadow-[0_0_10px_rgba(209,213,219,0.5)]"
                                    : rank === 3 ? "text-amber-600 drop-shadow-[0_0_10px_rgba(217,119,6,0.5)]"
                                        : "text-gray-500";
                            const rowBorder = rank === 1 ? "border border-yellow-500/30 shadow-[0_0_20px_rgba(250,204,21,0.1)]"
                                : rank === 2 ? "border border-gray-400/30"
                                    : rank === 3 ? "border border-amber-600/30"
                                        : "border border-transparent";



                            return (
                                <tr
                                    key={song.id}
                                    className={`
                                        group relative bg-[var(--bg-panel)] backdrop-blur-sm 
                                        hover:bg-white/5 hover:-translate-y-[2px] hover:shadow-[0_8px_30px_rgba(57,197,187,0.15)]
                                        transition-all duration-300 ease-out rounded-xl ${rowBorder}
                                    `}
                                    onClick={() => router.push(`/song/${song.id}`)}
                                >
                                    {showRank && (
                                        <td className="p-4 text-center align-middle rounded-l-xl">
                                            <span className={`font-black text-4xl italic ${rankColor}`}>{rank}</span>
                                        </td>
                                    )}
                                    <td className="p-3">
                                        <div className="w-20 h-12 relative rounded overflow-hidden bg-black/50 shadow-lg group-hover:shadow-[0_0_15px_rgba(57,197,187,0.3)] transition-shadow">
                                            <ThumbnailWithFallback song={song} className="w-full h-full object-cover" />
                                        </div>
                                    </td>
                                    <td className="p-3">
                                        <div className="font-bold text-white text-lg mb-1 line-clamp-1 group-hover:text-[var(--miku-teal)] transition-colors">
                                            {getSongName(song)}
                                        </div>
                                        <div className="text-xs text-gray-400 flex flex-col gap-1">
                                            <div className="flex items-center gap-2">
                                                <div className="w-[70px] flex-shrink-0">
                                                    {formatSongType(song.song_type)}
                                                </div>
                                                {renderArtistList(song.artists)}
                                            </div>
                                            {song.vocalists && song.vocalists.length > 0 && (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-[70px] flex-shrink-0">
                                                        <span className="text-[10px] uppercase tracking-wider text-[var(--miku-pink)] font-bold">Vocals</span>
                                                    </div>
                                                    {renderArtistList(song.vocalists)}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-3 text-right text-gray-400 font-mono text-base">
                                        {formatDate(song.publish_date)}
                                    </td>
                                    <td className="p-3 text-right font-mono text-base">
                                        <div className="font-black text-[var(--miku-teal)] text-xl drop-shadow-[0_0_5px_rgba(57,197,187,0.3)]">
                                            {getViews(song).toLocaleString()}
                                        </div>
                                    </td>

                                    {mode !== 'total' && (
                                        <td className="p-3 text-right font-mono text-sm">
                                            <div className={`text-sm font-bold ${getIncrement(song) > 0 ? 'text-[var(--miku-teal)]' : 'text-gray-600'}`}>
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
                    <div className="flex justify-center mt-8 pb-8">
                        <button
                            onClick={() => setShowAll(true)}
                            className="group relative px-8 py-3 rounded-full bg-white/5 hover:bg-[var(--miku-teal)]/20 border border-white/10 hover:border-[var(--miku-teal)]/50 text-white font-bold transition-all hover:scale-105 active:scale-95"
                        >
                            <span className="relative z-10 flex items-center gap-2">
                                {t('show_more', { defaultMessage: 'View Top 100' })}
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-y-1 transition-transform">
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                            </span>
                        </button>
                    </div>
                )
            }
        </div >
    );
}
