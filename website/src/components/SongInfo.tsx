import { SongDetail } from '@/types';
import { useLocale, useTranslations } from 'next-intl';

export default function SongInfo({ song }: { song: SongDetail }) {
    const t = useTranslations('SongDetail');
    const locale = useLocale();

    // Select title based on locale (fallback to English)
    const displayTitle = locale === 'ja' || locale === 'zh-TW'
        ? (song.name_japanese || song.name_english)
        : (song.name_english || song.name_japanese);

    // Format date as YYYY/MM/DD explicitly
    const formatDate = (dateString: string | null | undefined) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}/${m}/${d}`;
    };

    return (
        <div className="glass-panel p-6 md:p-10 mb-10 rounded-3xl relative overflow-hidden group">
            {/* Ambient Background Glow */}
            <div className="absolute -top-20 -right-20 w-96 h-96 bg-[var(--miku-teal)] opacity-10 blur-[120px] rounded-full pointer-events-none transition-opacity duration-700 group-hover:opacity-20"></div>
            <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-[var(--miku-pink)] opacity-5 blur-[100px] rounded-full pointer-events-none transition-opacity duration-700 group-hover:opacity-15"></div>

            <div className="flex flex-col lg:flex-row gap-8 relative z-10">
                {/* Left: Main Info */}
                <div className="flex-1 min-w-0">
                    <div className="mb-6">
                        <h1 className="text-2xl md:text-3xl font-black mb-2 tracking-tight text-white leading-tight drop-shadow-lg">
                            {displayTitle}
                        </h1>
                        <p className="text-base md:text-lg text-[var(--miku-teal)] font-bold tracking-wide flex items-center flex-wrap">
                            {song.artists && song.artists.length > 0 ? (
                                song.artists.map((artist, i) => (
                                    <span key={artist.id} className="flex items-center">
                                        <a href={`/artist/${artist.id}`} className="hover:underline hover:text-white transition-colors">
                                            {artist.name}
                                        </a>
                                        {i < song.artists.length - 1 && <span className="text-white/40 font-normal">・</span>}
                                    </span>
                                ))
                            ) : (
                                <span>{song.artist_string}</span>
                            )}
                        </p>
                    </div>

                    {/* Metadata Grid - Row 1 */}
                    <div className="grid grid-cols-2 gap-3 md:gap-4 mb-3">
                        {/* Release Date Card */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-center hover:bg-white/10 transition-colors">
                            <span className="text-[10px] uppercase tracking-widest text-[#888] mb-1 flex items-center gap-1.5">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                {t('release_date')}
                            </span>
                            <span className="font-mono text-lg md:text-xl font-bold text-white">{formatDate(song.publish_date)}</span>
                        </div>

                        {/* Song Type Card */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-center hover:bg-white/10 transition-colors">
                            <span className="text-[10px] uppercase tracking-widest text-[#888] mb-1 flex items-center gap-1.5">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
                                {t('type')}
                            </span>
                            <span className="font-medium text-lg md:text-xl text-white truncate">{song.song_type}</span>
                        </div>
                    </div>

                    {/* Vocalist Card - Full Width Row */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-center hover:bg-white/10 transition-colors mb-8">
                        <span className="text-[10px] uppercase tracking-widest text-[#888] mb-2 flex items-center gap-1.5">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                            {t('vocalist')}
                        </span>
                        <div className="flex flex-wrap gap-2">
                            {song.vocalists && song.vocalists.length > 0 ? (
                                song.vocalists.map((artist) => (
                                    <a
                                        key={artist.id}
                                        href={`/artist/${artist.id}`}
                                        className="group flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[var(--miku-pink)]/50 transition-all active:scale-95"
                                    >
                                        <div className="w-6 h-6 rounded-full overflow-hidden bg-[var(--miku-pink)]/20 flex items-center justify-center shrink-0 border border-[var(--miku-pink)]/20">
                                            {artist.picture_url_thumb ? (
                                                <img src={artist.picture_url_thumb} alt={artist.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-[10px] font-bold text-[var(--miku-pink)]">{artist.name.charAt(0)}</span>
                                            )}
                                        </div>
                                        <span className="text-sm font-bold text-[var(--miku-pink)] group-hover:text-white transition-colors truncate max-w-[150px]">
                                            {artist.name}
                                        </span>
                                    </a>
                                ))
                            ) : (
                                <span className="font-medium text-base text-white truncate text-[var(--miku-pink)]">{song.vocaloid_string}</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Stats & Actions */}
                <div className="w-full lg:w-[360px] flex flex-col gap-4">
                    {/* Total Views Hero Card */}
                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a1a20] to-[#0a0a0f] border border-white/10 p-6 md:p-8 text-center group/total shadow-xl">
                        <div className="absolute inset-0 bg-gradient-to-r from-[var(--miku-teal)]/10 to-[var(--miku-pink)]/10 opacity-0 group-hover/total:opacity-100 transition-opacity duration-500"></div>
                        <p className="text-[#888] text-xs uppercase tracking-[0.2em] mb-2 relative z-10">{t('total_views')}</p>
                        <p className="text-3xl md:text-4xl font-black text-white font-mono tracking-tighter relative z-10 drop-shadow-[0_0_15px_rgba(255,255,255,0.15)]">
                            {song.total_views.toLocaleString()}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {/* YouTube Card */}
                        <a
                            href={song.youtube_id ? `https://www.youtube.com/watch?v=${song.youtube_id}` : '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`
                                relative overflow-hidden rounded-2xl p-4 flex flex-col gap-3 border transition-all duration-300 group/yt
                                ${song.youtube_id
                                    ? 'bg-[#FF0000]/10 border-[#FF0000]/30 hover:bg-[#FF0000]/20 hover:border-[#FF0000] hover:shadow-[0_0_20px_rgba(255,0,0,0.2)] hover:-translate-y-1'
                                    : 'bg-white/5 border-white/5 opacity-50 cursor-not-allowed'}
                            `}
                        >
                            <div className="flex items-center justify-between">
                                <div className="w-10 h-10 rounded-full bg-[#FF0000] flex items-center justify-center text-white shadow-lg">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29.07 29.07 0 0 0 1 11.75a29.07 29.07 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29.07 29.07 0 0 0 .46-5.33 29.07 29.07 0 0 0-.46-5.33zM9.75 15.02l5.75-3.27-5.75-3.27v6.54z" /></svg>
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase font-bold text-[#FF0000] mb-0.5">YouTube</p>
                                <p className="text-lg font-mono font-bold text-white group-hover/yt:text-white transition-colors">
                                    {(song.views_youtube !== undefined && song.views_youtube !== null) ? song.views_youtube.toLocaleString() : 'N/A'}
                                </p>
                            </div>
                        </a>

                        {/* Niconico Card */}
                        <a
                            href={song.niconico_id ? `https://www.nicovideo.jp/watch/${song.niconico_id}` : '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`
                                relative overflow-hidden rounded-2xl p-4 flex flex-col gap-3 border transition-all duration-300 group/nico
                                ${song.niconico_id
                                    ? 'bg-white/5 border-white/20 hover:bg-white/10 hover:border-white hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:-translate-y-1'
                                    : 'bg-white/5 border-white/5 opacity-50 cursor-not-allowed'}
                            `}
                        >
                            <div className="flex items-center justify-between">
                                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-black shadow-lg">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect><polyline points="17 2 12 7 7 2"></polyline></svg>
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase font-bold text-gray-400 group-hover/nico:text-white transition-colors mb-0.5">
                                    {locale === 'ja' ? 'ニコニコ' : 'Niconico'}
                                </p>
                                <p className="text-lg font-mono font-bold text-white">
                                    {(song.views_niconico !== undefined && song.views_niconico !== null) ? song.views_niconico.toLocaleString() : 'N/A'}
                                </p>
                            </div>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
