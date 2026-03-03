'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import PlaylistCard from '@/components/playlist/PlaylistCard';
import OfficialLiveForm from '@/components/playlist/OfficialLiveForm';
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
    live_id?: number | null;
};

type Props = {
    slug: string;
    initialPlaylists: Playlist[];
    isAdmin: boolean;
    apiToken?: string;
};

export default function LiveDetailClient({ slug, initialPlaylists, isAdmin, apiToken }: Props) {
    const t = useTranslations('Playlist');
    const router = useRouter();
    const [playlists, setPlaylists] = useState<Playlist[]>(initialPlaylists);
    const [editFormOpen, setEditFormOpen] = useState(false);
    const [assignQuery, setAssignQuery] = useState('');
    const [assignResults, setAssignResults] = useState<Playlist[]>([]);
    const [assignOpen, setAssignOpen] = useState(false);
    const [assignLoading, setAssignLoading] = useState(false);

    const handleUnassign = async (playlist: Playlist) => {
        if (!apiToken) return;
        // live_id=0 is a sentinel for "unassign" — send null via API
        const res = await fetch(`${API_BASE_URL}/playlists/${playlist.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` },
            body: JSON.stringify({ live_id: 0 }),  // 0 means null/unassign in our API
        });
        if (res.ok) {
            setPlaylists(prev => prev.filter(p => p.id !== playlist.id));
        }
    };

    const searchAssign = async (q: string) => {
        if (!q.trim()) { setAssignResults([]); return; }
        setAssignLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/playlists?query=${encodeURIComponent(q)}&per_page=20`);
            if (res.ok) {
                const data: Playlist[] = await res.json();
                // Exclude already-assigned playlists
                const assignedIds = new Set(playlists.map(p => p.id));
                setAssignResults(data.filter(p => !assignedIds.has(p.id)));
            }
        } finally {
            setAssignLoading(false);
        }
    };

    const handleAssign = async (playlist: Playlist) => {
        if (!apiToken) return;
        // Fetch the live_id from slug
        const liveRes = await fetch(`${API_BASE_URL}/official-lives/${slug}`);
        if (!liveRes.ok) return;
        const live = await liveRes.json();

        const res = await fetch(`${API_BASE_URL}/playlists/${playlist.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` },
            body: JSON.stringify({ live_id: live.id }),
        });
        if (res.ok) {
            setPlaylists(prev => [...prev, { ...playlist, live_id: live.id }]);
            setAssignResults(prev => prev.filter(p => p.id !== playlist.id));
        }
    };

    return (
        <div className="flex flex-col gap-6">
            {/* Admin controls */}
            {isAdmin && (
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => setEditFormOpen(true)}
                        className="text-xs text-[var(--text-secondary)] hover:text-[var(--vermilion)] border border-[var(--hairline)] hover:border-[var(--vermilion)]/40 px-4 py-2 transition-all"
                    >
                        {t('edit_live')}
                    </button>
                    <button
                        onClick={() => setAssignOpen(v => !v)}
                        className="text-xs text-[var(--text-secondary)] hover:text-[var(--vermilion)] border border-[var(--hairline)] hover:border-[var(--vermilion)]/40 px-4 py-2 transition-all"
                    >
                        {t('assign_playlist')}
                    </button>
                </div>
            )}

            {/* Assign playlist search panel */}
            {isAdmin && assignOpen && (
                <div className="glass-panel hairline-border p-4 flex flex-col gap-3">
                    <p className="text-xs text-[var(--text-secondary)] tracking-widest uppercase">{t('assign_playlist')}</p>
                    <input
                        type="text"
                        value={assignQuery}
                        onChange={e => { setAssignQuery(e.target.value); void searchAssign(e.target.value); }}
                        placeholder={t('search_playlists')}
                        className="w-full px-3 py-2 text-sm bg-transparent border border-[var(--hairline-strong)] text-white placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--vermilion)] transition-colors"
                    />
                    {assignLoading && <p className="text-xs text-[var(--text-secondary)] animate-pulse">Searching…</p>}
                    {assignResults.length > 0 && (
                        <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                            {assignResults.map(pl => (
                                <button
                                    key={pl.id}
                                    onClick={() => void handleAssign(pl)}
                                    className="flex items-center justify-between px-3 py-2 text-sm text-white hover:bg-white/5 transition-colors text-left border-b border-[var(--hairline)] last:border-0"
                                >
                                    <span className="truncate">{pl.title}</span>
                                    <span className="text-xs text-[var(--text-secondary)] shrink-0 ml-2">{pl.song_count} songs</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Playlist grid */}
            {playlists.length === 0 ? (
                <div className="glass-panel hairline-border px-8 py-12 text-center text-[var(--text-secondary)] text-sm">
                    {t('no_playlists')}
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {playlists.map(pl => (
                        <div key={pl.id} className="relative group/item">
                            <PlaylistCard playlist={pl} />
                            {isAdmin && (
                                <button
                                    onClick={() => void handleUnassign(pl)}
                                    title={t('unassign_playlist')}
                                    className="absolute top-1.5 left-1.5 w-6 h-6 flex items-center justify-center bg-black/70 backdrop-blur-sm border border-[var(--hairline)] text-[var(--text-secondary)] hover:text-red-400 hover:border-red-400/40 transition-all opacity-0 group-hover/item:opacity-100 text-xs z-10"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Edit live form modal */}
            {editFormOpen && (
                <EditLiveWrapper
                    slug={slug}
                    onClose={() => setEditFormOpen(false)}
                    onSaved={() => router.refresh()}
                />
            )}
        </div>
    );
}

// Thin wrapper that fetches the live by slug before opening the form
function EditLiveWrapper({ slug, onClose, onSaved }: { slug: string; onClose: () => void; onSaved: () => void }) {
    const [live, setLive] = useState<import('@/types').OfficialLive | null>(null);
    const [loaded, setLoaded] = useState(false);

    if (!loaded) {
        fetch(`${API_BASE_URL}/official-lives/${slug}`)
            .then(r => r.json())
            .then(data => { setLive(data); setLoaded(true); })
            .catch(() => setLoaded(true));
        return null;
    }

    return (
        <OfficialLiveForm
            existingLive={live}
            onClose={onClose}
            onSaved={onSaved}
        />
    );
}
