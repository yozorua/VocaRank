'use client';

import { Link } from '@/i18n/navigation';
import { useTranslations, useLocale } from 'next-intl';
import MosaicCover from '@/components/playlist/MosaicCover';

type PlaylistSong = {
    song_id: number;
    youtube_id?: string | null;
    niconico_thumb_url?: string | null;
    name_english?: string | null;
    name_japanese?: string | null;
};

type Playlist = {
    id: number;
    title: string;
    description?: string | null;
    cover_url?: string | null;
    is_public: number;
    song_count: number;
    total_duration_seconds?: number | null;
    favorite_count: number;
    songs: PlaylistSong[];
    owner?: { id: number; name?: string | null };
};

type Props = {
    playlist: Playlist;
    locale?: string;
};

function formatDuration(seconds: number, t: ReturnType<typeof useTranslations<'Playlist'>>): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return t('duration_hr_min', { hrs, mins });
    return t('duration_min_only', { mins: mins || 1 });
}

export default function PlaylistCard({ playlist }: Props) {
    const t = useTranslations('Playlist');

    return (
        <Link
            href={`/playlist/${playlist.id}`}
            className="group flex flex-col glass-panel hairline-border overflow-hidden hover:border-[var(--vermilion)]/30 transition-all duration-300"
        >
            {/* Cover */}
            <div className="aspect-square w-full overflow-hidden bg-[var(--bg-panel)] relative shrink-0">
                <MosaicCover songs={playlist.songs} coverUrl={playlist.cover_url} />
                {!playlist.is_public && (
                    <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-0.5 text-[9px] text-[var(--text-secondary)] tracking-widest uppercase border border-[var(--hairline)]">
                        Private
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="p-3 flex flex-col justify-between gap-2 flex-1 min-h-[100px]">
                <div className="flex flex-col gap-1">
                    <p className="text-sm font-semibold text-white truncate group-hover:text-[var(--gold)] transition-colors leading-snug">
                        {playlist.title}
                    </p>
                    {/* Always reserve space for description — show 2-line clamped text or empty line */}
                    <p className="text-xs text-[var(--text-secondary)] leading-snug line-clamp-2 overflow-hidden">
                        {playlist.description || '\u00A0'}
                    </p>
                </div>
                <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-[var(--text-secondary)]">
                            {t('song_count', { count: playlist.song_count })}
                            {playlist.total_duration_seconds ? (
                                <> <span className="opacity-40 mx-1">·</span>{formatDuration(playlist.total_duration_seconds, t)}</>
                            ) : null}
                        </span>
                        {playlist.owner?.name && (
                            <span className="text-[10px] text-[var(--text-secondary)] opacity-50 truncate">
                                {playlist.owner.name}
                            </span>
                        )}
                    </div>
                    <span className="text-xs text-[var(--text-secondary)] shrink-0">♥ {playlist.favorite_count}</span>
                </div>
            </div>
        </Link>
    );
}
