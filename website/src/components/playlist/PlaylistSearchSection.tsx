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
    initialTotal: number;
    browseLabel: string;
};

const PAGE_SIZE = 10;

export default function PlaylistSearchSection({ initialPlaylists, initialTotal, browseLabel }: Props) {
    const t = useTranslations('Playlist');
    const [query, setQuery] = useState('');
    const [playlists, setPlaylists] = useState<Playlist[]>(initialPlaylists);
    const [total, setTotal] = useState(initialTotal);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Fetch first page + total when query changes
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            setLoading(true);
            try {
                const q = query.trim();
                const baseUrl = q
                    ? `${API_BASE_URL}/playlists?per_page=${PAGE_SIZE}&query=${encodeURIComponent(q)}`
                    : `${API_BASE_URL}/playlists?per_page=${PAGE_SIZE}`;
                const countUrl = q
                    ? `${API_BASE_URL}/playlists/count?query=${encodeURIComponent(q)}`
                    : `${API_BASE_URL}/playlists/count`;

                const [listRes, countRes] = await Promise.all([fetch(baseUrl), fetch(countUrl)]);
                if (listRes.ok) setPlaylists(await listRes.json());
                if (countRes.ok) {
                    const cd = await countRes.json();
                    setTotal(cd.total ?? 0);
                }
                setPage(1);
            } catch {
                // keep current list on error
            } finally {
                setLoading(false);
            }
        }, 300);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [query]);

    const loadMore = async () => {
        setLoadingMore(true);
        try {
            const nextPage = page + 1;
            const q = query.trim();
            const url = q
                ? `${API_BASE_URL}/playlists?per_page=${PAGE_SIZE}&page=${nextPage}&query=${encodeURIComponent(q)}`
                : `${API_BASE_URL}/playlists?per_page=${PAGE_SIZE}&page=${nextPage}`;
            const res = await fetch(url);
            if (res.ok) {
                const more: Playlist[] = await res.json();
                setPlaylists(prev => [...prev, ...more]);
                setPage(nextPage);
            }
        } catch {
            // keep current list on error
        } finally {
            setLoadingMore(false);
        }
    };

    const hasMore = playlists.length < total;

    return (
        <div className="flex flex-col gap-4">
            {/* Section heading */}
            <div className="flex items-center gap-4">
                <h2 className="text-sm md:text-base font-bold tracking-[0.05em] text-[var(--text-secondary)] flex-shrink-0">
                    {browseLabel}
                </h2>
                <span className="text-xs text-[var(--text-secondary)] opacity-40 flex-shrink-0">({total})</span>
                <div className="flex-1 h-px bg-[var(--hairline)]" />
            </div>

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
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {playlists.map(pl => (
                            <PlaylistCard key={pl.id} playlist={pl} />
                        ))}
                    </div>

                    {hasMore && (
                        <div className="flex justify-center pt-2">
                            <button
                                onClick={loadMore}
                                disabled={loadingMore}
                                className="px-6 py-2 text-xs tracking-[0.2em] text-[var(--text-secondary)] border border-[var(--hairline-strong)] hover:text-white hover:border-white/30 transition-all disabled:opacity-50"
                            >
                                {loadingMore ? '…' : t('show_more')}
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
