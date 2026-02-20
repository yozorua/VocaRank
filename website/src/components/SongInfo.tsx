import { SongDetail } from '@/types';
import { useLocale, useTranslations } from 'next-intl';

export default function SongInfo({ song }: { song: SongDetail }) {
    const t = useTranslations('SongDetail');
    const locale = useLocale();

    // Select title based on locale (fallback to English)
    const displayTitle = locale === 'ja' || locale === 'zh-TW'
        ? (song.name_japanese || song.name_romaji || song.name_english)
        : (song.name_english || song.name_romaji || song.name_japanese);

    // Format date as YYYY/MM/DD explicitly
    const formatDate = (dateString: string | null | undefined) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}/${m}/${d}`;
    };

    const getTypeColor = (type: string | null) => {
        return 'text-white';
    };

    // Format duration MM:SS
    const formatDuration = (seconds: number | null | undefined) => {
        if (!seconds) return '-';
        const m = Math.floor(seconds / 60);
        const s = String(seconds % 60).padStart(2, '0');
        return `${m}:${s}`;
    };

    // Get original song name
    const getOriginalSongName = () => {
        if (!song.original_song) return null;
        return (locale === 'ja' || locale === 'zh-TW')
            ? song.original_song.name_japanese || song.original_song.name_romaji || song.original_song.name_english
            : song.original_song.name_english || song.original_song.name_romaji || song.original_song.name_japanese;
    };

    return (
        <div className="relative py-12 md:py-16 border-y border-[var(--hairline)] mb-10 overflow-hidden">
            {/* Ambient Background Glow (Removed for Neo-Traditional, replaced with decorative text) */}
            <div className="absolute left-2 md:left-4 top-16 hidden lg:block vertical-text text-[var(--text-secondary)] text-[10px] tracking-[0.4em] z-0 select-none opacity-50">
                SONG DETAILS / 楽曲詳細
            </div>

            <div className="flex flex-col lg:flex-row gap-12 lg:gap-20 relative z-10 lg:pl-16">

                {/* Left: Main Info */}
                <div className="flex-1 min-w-0">
                    <div className="mb-10">
                        <div className="w-12 h-px bg-[var(--vermilion)] mb-6 opacity-80"></div>
                        <h1 className="text-3xl lg:text-[2.5rem] font-black mb-6 tracking-[0.05em] text-white leading-none">
                            {displayTitle}
                        </h1>
                        <p className="text-lg md:text-xl text-[var(--gold)] font-serif tracking-wider flex items-center flex-wrap">
                            {song.artists && song.artists.length > 0 ? (
                                song.artists.map((artist, i) => (
                                    <span key={artist.id} className="flex items-center">
                                        <a href={`/artist/${artist.id}`} className="hover:text-white transition-colors">
                                            {artist.name}
                                        </a>
                                        {i < song.artists.length - 1 && <span className="text-white/40 font-normal mx-2 font-sans">・</span>}
                                    </span>
                                ))
                            ) : (
                                <span>{song.artist_string}</span>
                            )}
                        </p>
                    </div>

                    {/* Metadata Grid - Traditional Table Style */}
                    <div className="grid grid-cols-2 md:grid-cols-4 border-t border-[var(--hairline)] mb-10">

                        {/* Release Date Cell */}
                        <div className="border-b md:border-r border-[var(--hairline)] p-5 flex flex-col justify-center">
                            <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-secondary)] mb-2">
                                {t('release_date')}
                            </span>
                            <span className="font-sans text-xl font-bold text-white tracking-wider leading-none">{formatDate(song.publish_date)}</span>
                        </div>

                        {/* Song Type Cell */}
                        <div className="border-b md:border-r border-[var(--hairline)] p-5 flex flex-col justify-center">
                            <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-secondary)] mb-2">
                                {t('type')}
                            </span>
                            <span className={`font-sans font-bold text-xl tracking-wider leading-none ${getTypeColor(song.song_type)}`}>{song.song_type}</span>
                        </div>

                        {/* Duration Cell */}
                        <div className="border-b md:border-r border-[var(--hairline)] p-5 flex flex-col justify-center">
                            <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-secondary)] mb-2">
                                {t('duration')}
                            </span>
                            <span className="font-sans text-xl font-bold text-white tracking-wider leading-none">{formatDuration(song.length_seconds)}</span>
                        </div>

                        {/* Original Song Cell (Conditional) */}
                        <div className="border-b border-[var(--hairline)] p-5 flex flex-col justify-center relative group/orig">
                            <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-secondary)] mb-2 group-hover/orig:text-[var(--vermilion)] transition-colors">
                                {t('original_song')}
                            </span>
                            {song.original_song ? (
                                <a
                                    href={`/song/${song.original_song.id}`}
                                    className="font-sans font-bold text-xl text-white truncate group-hover/orig:text-[var(--vermilion)] transition-colors leading-none"
                                >
                                    {getOriginalSongName()}
                                </a>
                            ) : (
                                <span className="font-sans font-bold text-xl text-[var(--text-secondary)] leading-none">-</span>
                            )}
                        </div>
                    </div>

                    {/* Vocalist List */}
                    <div className="mb-0">
                        <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-secondary)] mb-4 flex items-center gap-3">
                            {t('vocalist')}
                        </span>
                        <div className="flex flex-wrap gap-4">
                            {song.vocalists && song.vocalists.length > 0 ? (
                                song.vocalists.map((artist) => (
                                    <a
                                        key={artist.id}
                                        href={`/artist/${artist.id}`}
                                        className="group inline-flex w-max items-center gap-3 pr-4 transition-all"
                                    >
                                        <div className="w-8 h-8 overflow-hidden bg-[var(--hairline)] flex items-center justify-center shrink-0">
                                            {artist.picture_url_thumb ? (
                                                <img src={artist.picture_url_thumb} alt={artist.name} className="w-full h-full object-cover object-top grayscale-[10%] group-hover:grayscale-0 transition-all" />
                                            ) : (
                                                <span className="text-[10px] font-serif text-[var(--text-secondary)]">{artist.name.charAt(0)}</span>
                                            )}
                                        </div>
                                        <span className="text-sm font-bold text-[var(--text-secondary)] group-hover:text-white transition-colors tracking-widest">
                                            {artist.name}
                                        </span>
                                    </a>
                                ))
                            ) : (
                                <span className="font-bold text-sm text-white tracking-widest">{song.vocaloid_string}</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Stats & Actions */}
                <div className="w-full lg:w-[320px] flex flex-col gap-6 lg:border-l border-[var(--hairline)] lg:pl-10">

                    {/* Total Views */}
                    <div className="relative group/total mb-6 pt-2">
                        <p className="text-[var(--text-secondary)] text-[10px] uppercase tracking-[0.3em] mb-4 flex justify-between items-center">
                            <span>{t('total_views')}</span>
                        </p>
                        <p className="text-3xl lg:text-[2.5rem] leading-none font-black text-white font-mono tracking-wider">
                            {song.total_views.toLocaleString()}
                        </p>
                    </div>

                    <div className="flex flex-col gap-4">
                        {/* YouTube Card */}
                        <a
                            href={song.youtube_id ? `https://www.youtube.com/watch?v=${song.youtube_id}` : '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`
                                relative p-4 flex items-center justify-between border transition-all duration-300 group/yt
                                ${song.youtube_id
                                    ? 'border-[var(--hairline)] hover:border-[#FF0000] bg-[var(--bg-dark)]'
                                    : 'border-[var(--hairline)] opacity-30 cursor-not-allowed'}
                            `}
                        >
                            <div>
                                <p className="text-[9px] uppercase font-bold text-[#FF0000] mb-1 tracking-widest">YouTube</p>
                                <p className="text-lg font-mono font-bold text-white group-hover/yt:text-[#FF0000] transition-colors tracking-wider">
                                    {(song.views_youtube !== undefined && song.views_youtube !== null) ? song.views_youtube.toLocaleString() : '-'}
                                </p>
                            </div>
                            <div className="text-[var(--text-secondary)] group-hover/yt:text-[#FF0000] transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29.07 29.07 0 0 0 1 11.75a29.07 29.07 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29.07 29.07 0 0 0 .46-5.33 29.07 29.07 0 0 0-.46-5.33zM9.75 15.02l5.75-3.27-5.75-3.27v6.54z" /></svg>
                            </div>
                        </a>

                        {/* Niconico Card */}
                        <a
                            href={song.niconico_id ? `https://www.nicovideo.jp/watch/${song.niconico_id}` : '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`
                                relative p-4 flex items-center justify-between border transition-all duration-300 group/nico
                                ${song.niconico_id
                                    ? 'border-[var(--hairline)] hover:border-white bg-[var(--bg-dark)]'
                                    : 'border-[var(--hairline)] opacity-30 cursor-not-allowed'}
                            `}
                        >
                            <div>
                                <p className="text-[9px] uppercase font-bold text-[var(--text-secondary)] group-hover/nico:text-white transition-colors mb-1 tracking-widest">
                                    {locale === 'ja' ? 'ニコニコ' : 'Niconico'}
                                </p>
                                <p className="text-lg font-mono font-bold text-white tracking-wider">
                                    {(song.views_niconico !== undefined && song.views_niconico !== null) ? song.views_niconico.toLocaleString() : '-'}
                                </p>
                            </div>
                            <div className="text-[var(--text-secondary)] group-hover/nico:text-white transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect><polyline points="17 2 12 7 7 2"></polyline></svg>
                            </div>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
