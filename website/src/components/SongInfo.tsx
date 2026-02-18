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
        <div className="glass-panel p-8 mb-8 rounded-3xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--miku-teal)] opacity-5 blur-[100px] rounded-full pointer-events-none"></div>

            <div className="flex flex-col md:flex-row gap-8 relative z-10">
                {/* Left: Info */}
                <div className="flex-1">
                    <h1 className="text-4xl md:text-5xl font-black mb-2 tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 pl-6">
                        {displayTitle}
                    </h1>

                    <p className="text-xl text-[var(--miku-teal)] font-medium mb-8 pl-6">
                        {song.artist_string}
                    </p>

                    <div className="grid grid-cols-2 gap-y-6 gap-x-12 p-6 rounded-2xl bg-black/20 border border-white/5">
                        <div>
                            <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wider mb-1">{t('release_date')}</p>
                            <p className="font-mono text-lg text-white">
                                {formatDate(song.publish_date)}
                            </p>
                        </div>
                        <div>
                            <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wider mb-1">{t('type')}</p>
                            <p className="font-medium text-white">{song.song_type}</p>
                        </div>
                        <div className="col-span-2">
                            <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wider mb-1">{t('vocalist')}</p>
                            <p className="font-medium text-white">{song.vocaloid_string}</p>
                        </div>
                    </div>
                </div>

                {/* Right: Stats */}
                <div className="w-full md:w-80 flex flex-col gap-4">
                    <div className="p-6 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 text-center">
                        <p className="text-[var(--text-secondary)] text-sm mb-1">{t('total_views')}</p>
                        <p className="text-4xl font-bold text-[var(--miku-pink)] font-mono tracking-tight">
                            {song.total_views.toLocaleString()}
                        </p>
                    </div>

                    {/* YouTube */}
                    <a
                        href={`https://www.youtube.com/watch?v=${song.youtube_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-4 rounded-xl bg-black/40 hover:bg-[#FF0000]/20 border border-white/5 hover:border-[#FF0000]/50 transition-all group/yt"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#FF0000] flex items-center justify-center text-white">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                                    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29.07 29.07 0 0 0 1 11.75a29.07 29.07 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29.07 29.07 0 0 0 .46-5.33 29.07 29.07 0 0 0-.46-5.33zM9.75 15.02l5.75-3.27-5.75-3.27v6.54z" />
                                </svg>
                            </div>
                            <span className="font-medium text-white">YouTube</span>
                        </div>
                        <span className="font-mono text-gray-300 group-hover/yt:text-white transition-colors">
                            {(song.views_youtube !== undefined && song.views_youtube !== null) ? song.views_youtube.toLocaleString() : 'N/A'}
                        </span>
                    </a>

                    {/* Niconico */}
                    <a
                        href={`https://www.nicovideo.jp/watch/${song.niconico_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-4 rounded-xl bg-black/40 hover:bg-white/20 border border-white/5 hover:border-white/50 transition-all group/nico"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-black">
                                {/* TV Icon for Niconico */}
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect>
                                    <polyline points="17 2 12 7 7 2"></polyline>
                                </svg>
                            </div>
                            <span className="font-medium text-white">Niconico</span>
                        </div>
                        <span className="font-mono text-gray-300 group-hover/nico:text-white transition-colors">
                            {(song.views_niconico !== undefined && song.views_niconico !== null) ? song.views_niconico.toLocaleString() : 'N/A'}
                        </span>
                    </a>
                </div>
            </div>
        </div>
    );
}
