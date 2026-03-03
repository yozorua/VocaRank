'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import PlaylistCard from '@/components/playlist/PlaylistCard';
import { API_BASE_URL } from '@/lib/api';

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
    initialPlaylists: Playlist[];
};

export default function PlaylistSearchSection({ initialPlaylists }: Props) {
    const t = useTranslations('Playlist');
    const [query, setQuery] = useState('');
    const [playlists, setPlaylists] = useState<Playlist[]>(initialPlaylists);
    const [loading, setLoading] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            setLoading(true);
            try {
                const url = query.trim()
                    ? `${API_BASE_URL}/playlists?per_page=40&query=${encodeURIComponent(query)}`
                    : `${API_BASE_URL}/playlists?per_page=40`;
                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    setPlaylists(data);
                }
            } catch {
                // keep current list on error
            } finally {
                setLoading(false);
            }
        }, 300);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [query]);

    return (
        <div className="flex flex-col gap-4">
            {/* Search bar */}
            <div className="relative flex items-center max-w-sm">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="absolute left-3 text-[var(--text-secondary)] pointer-events-none"
                >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder={t('search_playlists')}
                    className="w-full pl-9 pr-4 py-2 text-sm bg-transparent border border-[var(--hairline-strong)] text-white placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--vermilion)] transition-colors"
                />
                {loading && (
                    <span className="absolute right-3 text-[var(--text-secondary)] text-xs animate-pulse">…</span>
                )}
            </div>

            {/* Grid */}
            {playlists.length === 0 ? (
                <div className="glass-panel hairline-border px-8 py-12 text-center text-[var(--text-secondary)] text-sm">
                    {t('no_playlists')}
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {playlists.map(pl => (
                        <PlaylistCard key={pl.id} playlist={pl} />
                    ))}
                </div>
            )}
        </div>
    );
}
