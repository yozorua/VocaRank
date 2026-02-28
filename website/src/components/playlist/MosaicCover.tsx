'use client';

import ThumbnailImage from '@/components/ThumbnailImage';

type Song = {
    song_id: number;
    youtube_id?: string | null;
    niconico_thumb_url?: string | null;
    name_english?: string | null;
    name_japanese?: string | null;
};

type Props = {
    songs: Song[];
    coverUrl?: string | null;
    size?: number; // px, default 80
};

export default function MosaicCover({ songs, coverUrl, size = 80 }: Props) {
    if (coverUrl) {
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
                src={coverUrl}
                alt="Playlist cover"
                className="w-full h-full object-cover"
            />
        );
    }

    const tiles = songs.slice(0, 4);

    if (tiles.length === 0) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-[var(--bg-panel)]">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="1" className="text-[var(--text-secondary)] opacity-40">
                    <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                </svg>
            </div>
        );
    }

    if (tiles.length === 1) {
        return (
            /* ADDED: Wrapper with overflow-hidden for 1-song playlists */
            <div className="w-full h-full overflow-hidden bg-black">
                <ThumbnailImage
                    youtubeId={tiles[0].youtube_id}
                    niconicoThumb={tiles[0].niconico_thumb_url}
                    alt={tiles[0].name_english || tiles[0].name_japanese || ''}
                    className="w-full h-full object-cover"
                />
            </div>
        );
    }

    return (
        <div className="w-full h-full grid grid-cols-2 grid-rows-2 overflow-hidden bg-black">
            {Array.from({ length: 4 }).map((_, i) => {
                const song = tiles[i];
                return song ? (
                    <div key={song.song_id} className="w-full h-full overflow-hidden relative">
                        <ThumbnailImage
                            youtubeId={song.youtube_id}
                            niconicoThumb={song.niconico_thumb_url}
                            alt={song.name_english || song.name_japanese || ''}
                            className="w-full h-full object-cover"
                        />
                    </div>
                ) : (
                    <div key={i} className="bg-white/5 w-full h-full" />
                );
            })}
        </div>
    );
}