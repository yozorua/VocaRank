'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { API_BASE_URL } from '@/lib/api';
import ThumbnailImage from '@/components/ThumbnailImage';

type SearchResult = {
    id: number;
    name_english?: string | null;
    name_japanese?: string | null;
    artist_string: string;
    youtube_id?: string | null;
    niconico_thumb_url?: string | null;
};

type Props = {
    playlistId: number;
    placeholder: string; // localised
    addLabel: string;
};

export default function AddSongToPlaylist({ playlistId, placeholder, addLabel }: Props) {
    const { data: session } = useSession();
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [adding, setAdding] = useState<number | null>(null);
    const [debounce, setDebounce] = useState<ReturnType<typeof setTimeout> | null>(null);

    if (!session) return null;

    const search = (q: string) => {
        setQuery(q);
        if (debounce) clearTimeout(debounce);
        if (!q.trim()) { setResults([]); return; }
        setDebounce(setTimeout(async () => {
            setLoading(true);
            try {
                const res = await fetch(`${API_BASE_URL}/songs/search?query=${encodeURIComponent(q)}&limit=8&vocaloid_only=true`);
                if (res.ok) setResults(await res.json());
            } finally {
                setLoading(false);
            }
        }, 350));
    };

    const addSong = async (songId: number) => {
        setAdding(songId);
        try {
            const res = await fetch(`${API_BASE_URL}/playlists/${playlistId}/songs`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${(session as any)?.apiToken}`,
                },
                body: JSON.stringify({ song_id: songId }),
            });
            if (res.ok) {
                setQuery('');
                setResults([]);
                router.refresh();
            }
        } finally {
            setAdding(null);
        }
    };

    return (
        <div className="relative">
            <div className="flex items-center gap-2 border border-[var(--hairline)] bg-white/5 px-3 py-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--text-secondary)] shrink-0">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                    value={query}
                    onChange={e => search(e.target.value)}
                    placeholder={placeholder}
                    className="bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none flex-1 min-w-0"
                />
                {loading && (
                    <svg className="animate-spin h-4 w-4 text-[var(--text-secondary)] shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                )}
            </div>

            {results.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 bg-[var(--bg-dark)] border border-[var(--hairline-strong)] shadow-2xl max-h-72 overflow-y-auto">
                    {results.map(song => {
                        const title = song.name_japanese || song.name_english || '—';
                        return (
                            <button
                                key={song.id}
                                onClick={() => addSong(song.id)}
                                disabled={adding === song.id}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left border-b border-[var(--hairline)] last:border-0"
                            >
                                {(song.youtube_id || song.niconico_thumb_url) ? (
                                    <ThumbnailImage
                                        youtubeId={song.youtube_id}
                                        niconicoThumb={song.niconico_thumb_url}
                                        alt={title}
                                        className="w-8 h-8 object-cover shrink-0"
                                    />
                                ) : (
                                    <div className="w-8 h-8 bg-white/5 shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-white truncate">{title}</p>
                                    <p className="text-xs text-[var(--text-secondary)] truncate">{song.artist_string}</p>
                                </div>
                                <span className="text-[10px] text-[var(--vermilion)] shrink-0 font-medium">
                                    {adding === song.id ? '...' : `+ ${addLabel}`}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
