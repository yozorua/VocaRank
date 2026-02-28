'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ThumbnailImage from '@/components/ThumbnailImage';
import { API_BASE_URL } from '@/lib/api';
import { Link } from '@/i18n/navigation';

type Song = {
    song_id: number;
    position: number;
    name_english?: string | null;
    name_japanese?: string | null;
    name_romaji?: string | null;
    youtube_id?: string | null;
    niconico_thumb_url?: string | null;
    songwriter_string?: string | null;
    artist_string?: string | null;
    vocalist_string?: string | null;
    song_type?: string | null;
};

type Props = {
    songs: Song[];
    playlistId: number;
    apiToken: string;
    locale: string;
    isOwner: boolean;
};

const TYPE_COLORS: Record<string, string> = {
    Original: 'text-[var(--cyan-subtle)]',
    Cover: 'text-[#E8954A]',
    Remix: 'text-[var(--gold)]',
    Remaster: 'text-[#B284BE]',
};

export default function PlaylistSongList({ songs: initialSongs, playlistId, apiToken, locale, isOwner }: Props) {
    const [songs, setSongs] = useState<Song[]>(initialSongs);
    const [removing, setRemoving] = useState<number | null>(null);
    const router = useRouter();

    // Sync when parent re-fetches (e.g. after AddSongToPlaylist calls router.refresh())
    useEffect(() => {
        setSongs(initialSongs);
    }, [initialSongs]);

    // ── Drag state ──
    const dragIdx = useRef<number | null>(null);
    const dragOverIdx = useRef<number | null>(null);
    const [dragOver, setDragOver] = useState<number | null>(null);

    const authHeaders = {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
    };

    const removeSong = useCallback(async (songId: number) => {
        setRemoving(songId);
        try {
            const res = await fetch(`${API_BASE_URL}/playlists/${playlistId}/songs/${songId}`, {
                method: 'DELETE',
                headers: authHeaders,
            });
            if (res.ok) {
                setSongs(prev => prev.filter(s => s.song_id !== songId));
                router.refresh();
            }
        } finally {
            setRemoving(null);
        }
    }, [playlistId, apiToken]);

    const saveOrder = useCallback(async (ordered: Song[]) => {
        try {
            await fetch(`${API_BASE_URL}/playlists/${playlistId}/songs/reorder`, {
                method: 'PATCH',
                headers: authHeaders,
                body: JSON.stringify({ song_ids: ordered.map(s => s.song_id) }),
            });
        } catch { }
    }, [playlistId, apiToken]);

    // ── Drag handlers ──
    const onDragStart = (idx: number) => {
        dragIdx.current = idx;
    };

    const onDragEnter = (idx: number) => {
        dragOverIdx.current = idx;
        setDragOver(idx);
    };

    const onDragEnd = () => {
        const from = dragIdx.current;
        const to = dragOverIdx.current;
        dragIdx.current = null;
        dragOverIdx.current = null;
        setDragOver(null);
        if (from === null || to === null || from === to) return;
        const next = [...songs];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        setSongs(next);
        saveOrder(next);
    };

    const typeEl = (songType: string | null | undefined) => {
        if (!songType) return null;
        return (
            <span className={`${TYPE_COLORS[songType] ?? 'text-[var(--text-secondary)]'} font-bold uppercase text-[10px] tracking-widest`}>
                {songType.toUpperCase()}
            </span>
        );
    };

    return (
        <div className="divide-y divide-[var(--hairline)]">
            {songs.map((song, idx) => {
                const title = song.name_japanese || song.name_english || song.name_romaji || '—';
                const isDragOver = dragOver === idx;

                return (
                    <div
                        key={song.song_id}
                        draggable={isOwner}
                        onDragStart={() => onDragStart(idx)}
                        onDragEnter={() => onDragEnter(idx)}
                        onDragOver={e => e.preventDefault()}
                        onDragEnd={onDragEnd}
                        className={`flex items-center gap-4 px-5 py-3.5 transition-colors group relative
                            ${isDragOver ? 'bg-[var(--vermilion)]/10 border-t-2 border-[var(--vermilion)]/50' : 'hover:bg-[var(--hairline)]'}
                            ${isOwner ? 'cursor-grab active:cursor-grabbing' : ''}
                        `}
                    >
                        {/* Drag handle indicator (owner only) */}
                        {isOwner && (
                            <div className="hidden sm:block shrink-0 text-[var(--hairline-strong)] group-hover:text-[var(--text-secondary)] transition-colors opacity-0 group-hover:opacity-100">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" />
                                </svg>
                            </div>
                        )}



                        {/* Thumbnail */}
                        {(song.youtube_id || song.niconico_thumb_url) ? (
                            <ThumbnailImage
                                youtubeId={song.youtube_id}
                                niconicoThumb={song.niconico_thumb_url}
                                alt={title}
                                className="w-24 h-16 object-cover shrink-0 border border-[var(--hairline)]"
                            />
                        ) : (
                            <div className="w-24 h-16 bg-white/5 border border-[var(--hairline)] shrink-0" />
                        )}

                        {/* Song Info */}
                        <Link
                            href={`/song/${song.song_id}`}
                            className="flex-1 min-w-0 group/title"
                            onClick={e => e.stopPropagation()}
                            draggable={false}
                        >
                            <p className="font-bold text-white text-base line-clamp-1 group-hover/title:text-[var(--vermilion)] transition-colors tracking-wide mb-1.5">{title}</p>
                            <div className="flex flex-col gap-1">
                                <div className="text-[11px] text-[var(--text-secondary)] flex items-center gap-2 min-w-0">
                                    <div className="w-[72px] flex-shrink-0">{typeEl(song.song_type)}</div>
                                    <div className="truncate min-w-0">{song.songwriter_string || song.artist_string}</div>
                                </div>
                                {song.vocalist_string && (
                                    <div className="text-[11px] text-[var(--text-secondary)] flex items-center gap-2 min-w-0">
                                        <div className="w-[72px] flex-shrink-0 text-[9px] uppercase tracking-widest text-white/40">VOCALS</div>
                                        <div className="truncate min-w-0">{song.vocalist_string}</div>
                                    </div>
                                )}
                            </div>
                        </Link>

                        {/* Arrow (non-owner) */}
                        {!isOwner && (
                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-[var(--hairline-strong)] group-hover:text-[var(--vermilion)] transition-colors">
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                        )}

                        {/* Remove button (owner only) */}
                        {isOwner && (
                            <button
                                onClick={e => { e.stopPropagation(); removeSong(song.song_id); }}
                                disabled={removing === song.song_id}
                                title="Remove from playlist"
                                className="shrink-0 p-1.5 text-[var(--text-secondary)] hover:text-red-400 disabled:opacity-30 transition-colors opacity-0 group-hover:opacity-100"
                            >
                                {removing === song.song_id
                                    ? <div className="w-3.5 h-3.5 border border-white/30 border-t-white/70 rounded-full animate-spin" />
                                    : <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                }
                            </button>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
