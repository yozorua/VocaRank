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

    const getNicoUrl = (id: string) => {
        const match = id.match(/\d+/);
        if (!match) return null;
        return `https://nicovideo.cdn.nimg.jp/thumbnails/${match[0]}/${match[0]}`;
    };

    const getThumbnailUrl = (song: SongRanking) => {
        // ALWAYS prioritize YouTube first as requested
        if (song.youtube_id) {
            return `https://i.ytimg.com/vi/${song.youtube_id}/mqdefault.jpg`;
        }

        // Fallback to Niconico if no YouTube
        if (song.niconico_id) {
            return getNicoUrl(song.niconico_id);
        }

        return null;
    };

    const formatSongType = (type: string | null) => {
        if (!type) return null;
        if (type === 'Cover') return <span className="text-green-400 font-bold uppercase text-[10px] tracking-wider">COVER</span>;
        if (type === 'Remix') return <span className="text-orange-400 font-bold uppercase text-[10px] tracking-wider">REMIX</span>;
        if (type === 'Remaster') return <span className="text-cyan-400 font-bold uppercase text-[10px] tracking-wider">REMASTER</span>;
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
                        {idx < artists.length - 1 && <span className="text-gray-600">・</span>}
                    </span>
                ))}
            </div>
        );
    };

    if (songs.length === 0) {
        return (
            <div className="w-full py-20 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 mb-4 rounded-full bg-[var(--bg-card)] border border-[var(--miku-teal)] flex items-center justify-center shadow-[0_0_15px_var(--miku-teal)] animate-pulse">
                    <span className="text-2xl">⏳</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{t('no_data_title', { defaultMessage: 'Ranking Calculating...' })}</h3>
                <p className="text-[var(--text-secondary)] max-w-md">
                    {t('no_data_desc', { defaultMessage: 'We are currently collecting data for this period. Please check back later!' })}
                </p>
            </div>
        );
    }

    return (
        <div className="w-full">
            {/* Mobile View: Card List */}
            <div className="flex flex-col gap-3 md:hidden">
                {displayedSongs.map((song, index) => {
                    const rank = index + 1;
                    let rankColor = "text-gray-500";
                    let cardBorder = "border-white/5";

                    if (rank === 1) {
                        rankColor = "text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.6)]";
                        cardBorder = "border-yellow-500/30 shadow-[0_0_20px_rgba(250,204,21,0.1)]";
                    } else if (rank === 2) {
                        rankColor = "text-gray-300 drop-shadow-[0_0_10px_rgba(209,213,219,0.5)]";
                        cardBorder = "border-gray-400/30";
                    } else if (rank === 3) {
                        rankColor = "text-amber-600 drop-shadow-[0_0_10px_rgba(217,119,6,0.5)]";
                        cardBorder = "border-amber-600/30";
                    }

                    const increment = getIncrement(song);
                    const thumbnailUrl = getThumbnailUrl(song);

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
                                    {thumbnailUrl ? (
                                        <img src={thumbnailUrl} alt="Thumb" className="w-full h-full object-cover" loading="lazy" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-[#2b2b2b] text-[8px] text-gray-500">NO IMG</div>
                                    )}
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
                            let rankColor = "text-gray-500";
                            let rowBorder = "border border-transparent";

                            if (rank === 1) {
                                rankColor = "text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.6)]";
                                rowBorder = "border border-yellow-500/30 shadow-[0_0_20px_rgba(250,204,21,0.1)]";
                            } else if (rank === 2) {
                                rankColor = "text-gray-300 drop-shadow-[0_0_10px_rgba(209,213,219,0.5)]";
                                rowBorder = "border border-gray-400/30";
                            } else if (rank === 3) {
                                rankColor = "text-amber-600 drop-shadow-[0_0_10px_rgba(217,119,6,0.5)]";
                                rowBorder = "border border-amber-600/30";
                            }

                            const thumbnail = getThumbnailUrl(song);

                            return (
                                <tr
                                    key={song.id}
                                    className={`
                                        group relative bg-[var(--bg-panel)] backdrop-blur-sm 
                                        hover:bg-white/5 hover:scale-[1.005] hover:shadow-[0_0_30px_rgba(57,197,187,0.1)]
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
                                            <img
                                                src={thumbnail || "/images/no-thumb.png"} // Use thumbnail or default
                                                alt={song.name_english || song.name_japanese || "Song thumbnail"}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    // Fallback sequence: YT Max -> YT HQ -> Nico -> Placeholder
                                                    const target = e.target as HTMLImageElement;
                                                    const currentSrc = target.src;

                                                    if (song.youtube_id && currentSrc.includes('mqdefault')) { // Changed from maxresdefault to mqdefault
                                                        target.src = `https://img.youtube.com/vi/${song.youtube_id}/hqdefault.jpg`;
                                                    } else if (song.youtube_id && currentSrc.includes('hqdefault')) {
                                                        // Try Nico if YT fails
                                                        if (song.niconico_id) {
                                                            const nicoId = song.niconico_id.replace('sm', '').replace('nm', '');
                                                            target.src = `https://nicovideo.cdn.nimg.jp/thumbnails/${nicoId}/${nicoId}`;
                                                        } else {
                                                            target.src = "/images/no-thumb.png"; // Local placeholder
                                                        }
                                                    } else {
                                                        target.src = "/images/no-thumb.png";
                                                    }
                                                }}
                                            />
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
