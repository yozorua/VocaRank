import Link from 'next/link';
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
    favorite_count: number;
    songs: PlaylistSong[];
    owner?: { id: number; name?: string | null };
};

type Props = {
    playlist: Playlist;
    locale: string;
};

export default function PlaylistCard({ playlist, locale }: Props) {
    return (
        <Link
            href={`/${locale}/playlist/${playlist.id}`}
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

            {/* Info — fixed height so all cards align */}
            <div className="p-3 flex flex-col justify-between gap-2 h-[100px]">
                <div className="flex flex-col gap-1 min-h-0">
                    <p className="text-sm font-semibold text-white truncate group-hover:text-[var(--vermilion)] transition-colors leading-snug">
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
                            {playlist.song_count} songs
                        </span>
                        {playlist.owner?.name && (
                            <span className="text-[10px] text-[var(--text-secondary)] opacity-50 truncate">
                                by {playlist.owner.name}
                            </span>
                        )}
                    </div>
                    <span className="text-xs text-[var(--text-secondary)] shrink-0">♥ {playlist.favorite_count}</span>
                </div>
            </div>
        </Link>
    );
}
