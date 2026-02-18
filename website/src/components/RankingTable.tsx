'use client';

import { SongRanking } from '@/types';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useLocale } from 'next-intl';

interface RankingTableProps {
    songs: SongRanking[];
    mode: string;
    sort?: string;
}

export default function RankingTable({ songs, mode, sort = 'total' }: RankingTableProps) {
    const t = useTranslations('RankingTable');
    const locale = useLocale();

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
        <div className="w-full overflow-x-auto px-1 pb-4">
            <table className="w-full text-left border-separate border-spacing-y-3 min-w-[800px]">
                <thead>
                    <tr className="text-[var(--text-secondary)] text-sm uppercase tracking-wider">
                        <th className="p-4 text-center w-20">#</th>
                        <th className="p-4 w-24"></th>
                        <th className="p-4">{t('song')}</th>
                        <th className="p-4 text-right">
                            {sort === 'youtube' ? t('sort_youtube') : sort === 'niconico' ? t('sort_niconico') : t('views')}
                        </th>
                        {/* Hide Gain for total ranking */}
                        {mode !== 'total' && (
                            <th className="p-4 pr-6 text-right">{t('increment')}</th>
                        )}
                        <th className="p-4 text-right w-32">{t('published')}</th>
                    </tr>
                </thead>
                <tbody>
                    {songs.map((song, index) => {
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

                        const increment = getIncrement(song);
                        const thumbnailUrl = getThumbnailUrl(song);

                        return (
                            <tr
                                key={song.id}
                                className={`
                    group relative bg-[var(--bg-panel)] backdrop-blur-sm 
                    hover:bg-white/5 hover:scale-[1.005] hover:shadow-[0_0_30px_rgba(57,197,187,0.1)]
                    transition-all duration-300 ease-out rounded-xl ${rowBorder}
                `}
                            >
                                <td className="p-4 text-center align-middle rounded-l-xl">
                                    <span className={`font-black text-3xl italic ${rankColor}`}>{rank}</span>
                                </td>
                                <td className="p-4 align-middle">
                                    <div className="w-20 h-12 bg-black rounded-lg overflow-hidden relative shadow-lg group-hover:ring-2 ring-[var(--miku-teal)] transition-all">
                                        {thumbnailUrl ? (
                                            <img
                                                src={thumbnailUrl}
                                                alt="Thumbnail"
                                                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                                loading="lazy"
                                                onError={(e) => {
                                                    // Smart Fallback: If YT fails, try Nico
                                                    const currentSrc = e.currentTarget.src;
                                                    const nicoUrl = song.niconico_id ? getNicoUrl(song.niconico_id) : null;

                                                    if (currentSrc.includes('i.ytimg.com') && nicoUrl) {
                                                        // Try Niconico fallback
                                                        e.currentTarget.src = nicoUrl;
                                                        return;
                                                    }

                                                    // Final Fallback: Hide and show NO IMG
                                                    e.currentTarget.style.display = 'none';
                                                    const parent = e.currentTarget.parentElement;
                                                    if (parent) {
                                                        parent.innerText = 'NO IMG';
                                                        parent.className = "w-full h-full flex items-center justify-center bg-[#2b2b2b] text-[10px] text-gray-500";
                                                    }
                                                }}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-[#2b2b2b] text-[10px] text-gray-500">
                                                NO IMG
                                            </div>
                                        )}
                                    </div>
                                </td>

                                <td className="p-4 align-middle">
                                    <div className="flex flex-col">
                                        <Link href={`/song/${song.id}`} className="font-bold text-lg text-white group-hover:text-[var(--miku-teal)] transition-colors line-clamp-1 leading-tight">
                                            {getSongName(song)}
                                        </Link>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-sm text-gray-400 truncate max-w-[200px]">{song.artist_string}</span>
                                            {song.vocaloid_string && (
                                                <span className="text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-wider bg-white/5 text-gray-400 border border-white/10">
                                                    {song.vocaloid_string}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </td>

                                <td className="p-4 text-right align-middle font-mono text-xl font-bold tracking-tighter text-gray-200">
                                    {getViews(song).toLocaleString()}
                                </td>

                                {mode !== 'total' && (
                                    <td className="p-4 text-right hidden md:table-cell align-middle font-mono">
                                        {increment > 0 ? (
                                            <div className="inline-flex items-center gap-1 text-[var(--miku-teal)] bg-[var(--miku-teal)]/10 px-2 py-1 rounded">
                                                <span className="text-xs">▲</span>
                                                {increment.toLocaleString()}
                                            </div>
                                        ) : (
                                            <span className="text-gray-600">-</span>
                                        )}
                                    </td>
                                )}

                                <td className="p-4 text-right align-middle text-sm text-gray-400 font-mono rounded-r-xl whitespace-nowrap">
                                    {formatDate(song.publish_date)}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
