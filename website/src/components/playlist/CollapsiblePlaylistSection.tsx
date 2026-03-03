'use client';

import { useState } from 'react';
import PlaylistCard from '@/components/playlist/PlaylistCard';

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
    label: string;
    storageKey: string;
    playlists: Playlist[];
    defaultOpen?: boolean;
};

export default function CollapsiblePlaylistSection({ label, storageKey, playlists, defaultOpen = true }: Props) {
    const [open, setOpen] = useState(() => {
        try {
            const saved = localStorage.getItem(storageKey);
            return saved !== null ? saved === 'true' : defaultOpen;
        } catch {
            return defaultOpen;
        }
    });

    if (playlists.length === 0) return null;

    const toggle = () => setOpen(v => {
        const next = !v;
        try { localStorage.setItem(storageKey, String(next)); } catch { /* */ }
        return next;
    });

    return (
        <div className="flex flex-col gap-3">
            <button onClick={toggle} className="flex items-center gap-2 group w-fit">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="11" height="11"
                    viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="2.5"
                    className={`text-[var(--text-secondary)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                >
                    <polyline points="6 9 12 15 18 9" />
                </svg>
                <h2 className="text-sm font-semibold text-[var(--text-secondary)] tracking-[0.3em] uppercase group-hover:text-white transition-colors">
                    {label}
                </h2>
                <span className="text-xs text-[var(--text-secondary)] opacity-40">({playlists.length})</span>
            </button>

            {open && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {playlists.map(pl => (
                        <PlaylistCard key={pl.id} playlist={pl} />
                    ))}
                </div>
            )}
        </div>
    );
}
