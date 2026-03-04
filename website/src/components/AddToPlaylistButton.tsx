'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { API_BASE_URL } from '@/lib/api';

type Playlist = {
    id: number;
    title: string;
    song_count: number;
};

interface Props {
    songId: number;
    /** 'button' = text+icon button (song page), 'icon' = icon-only (player) */
    variant?: 'button' | 'icon';
}

export default function AddToPlaylistButton({ songId, variant = 'button' }: Props) {
    const { data: session } = useSession();
    const router = useRouter();
    const t = useTranslations('SongDetail');
    const tPl = useTranslations('Playlist');

    const [open, setOpen] = useState(false);
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState<number | null>(null);
    const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
    const [mounted, setMounted] = useState(false);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });

    const btnRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => { setMounted(true); }, []);

    // Recalculate dropdown position relative to viewport (for fixed positioning)
    const updatePos = () => {
        if (!btnRef.current) return;
        const rect = btnRef.current.getBoundingClientRect();
        setDropdownPos({
            top: rect.bottom + 4,
            right: window.innerWidth - rect.right,
        });
    };

    useEffect(() => {
        if (!open) return;
        updatePos();
        window.addEventListener('scroll', updatePos, true);
        window.addEventListener('resize', updatePos);
        return () => {
            window.removeEventListener('scroll', updatePos, true);
            window.removeEventListener('resize', updatePos);
        };
    }, [open]);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            const insideBtn = btnRef.current?.contains(target);
            const insideDropdown = dropdownRef.current?.contains(target);
            if (!insideBtn && !insideDropdown) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const loadPlaylists = async () => {
        if (!session?.apiToken) return;
        setLoading(true);
        try {
            const headers = { Authorization: `Bearer ${session.apiToken}` };
            const [listRes, checkRes] = await Promise.all([
                fetch(`${API_BASE_URL}/playlists/mine`, { headers }),
                fetch(`${API_BASE_URL}/playlists/mine/song-check?song_id=${songId}`, { headers }),
            ]);
            if (listRes.ok) {
                const data: Array<{ id: number; title: string; song_count: number }> = await listRes.json();
                setPlaylists(data.map(pl => ({ id: pl.id, title: pl.title, song_count: pl.song_count })));
            }
            if (checkRes.ok) {
                const containingIds: number[] = await checkRes.json();
                if (containingIds.length > 0) {
                    setAddedIds(prev => new Set([...prev, ...containingIds]));
                }
            }
        } finally {
            setLoading(false);
        }
    };

    const handleOpen = () => {
        const next = !open;
        setOpen(next);
        if (next && playlists.length === 0 && !loading) loadPlaylists();
    };

    const toggleSong = async (playlistId: number) => {
        if (!session?.apiToken || busy !== null) return;
        const isAdded = addedIds.has(playlistId);
        setBusy(playlistId);
        try {
            if (isAdded) {
                const res = await fetch(`${API_BASE_URL}/playlists/${playlistId}/songs/${songId}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${session.apiToken}` },
                });
                if (res.ok) {
                    setAddedIds(prev => { const s = new Set(prev); s.delete(playlistId); return s; });
                    setPlaylists(prev => prev.map(pl =>
                        pl.id === playlistId ? { ...pl, song_count: Math.max(0, pl.song_count - 1) } : pl
                    ));
                }
            } else {
                const res = await fetch(`${API_BASE_URL}/playlists/${playlistId}/songs`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${session.apiToken}`,
                    },
                    body: JSON.stringify({ song_id: songId }),
                });
                if (res.ok) {
                    setAddedIds(prev => new Set([...prev, playlistId]));
                    setPlaylists(prev => prev.map(pl =>
                        pl.id === playlistId ? { ...pl, song_count: pl.song_count + 1 } : pl
                    ));
                } else if (res.status === 409) {
                    // Already in playlist — just mark it
                    setAddedIds(prev => new Set([...prev, playlistId]));
                }
            }
        } finally {
            setBusy(null);
        }
    };

    const handleCreateNew = () => {
        setOpen(false);
        router.push(`/playlist/new?songs=${songId}`);
    };

    if (!session?.apiToken) return null;

    const dropdownPanel = mounted && open && createPortal(
        <div
            ref={dropdownRef}
            style={{ position: 'fixed', top: dropdownPos.top, right: dropdownPos.right, zIndex: 9999 }}
            className="bg-[var(--bg-dark)] border border-[var(--hairline-strong)] shadow-2xl w-60"
        >
            <div className="px-3 py-2 border-b border-[var(--hairline)]">
                <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                    {t('add_to_playlist')}
                </span>
            </div>

            <div className="max-h-52 overflow-y-auto">
                {loading ? (
                    <div className="p-4 text-center">
                        <svg className="animate-spin h-4 w-4 text-[var(--text-secondary)] mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                    </div>
                ) : playlists.length === 0 ? (
                    <p className="text-[var(--text-secondary)] text-xs p-4 text-center">{tPl('no_mine')}</p>
                ) : (
                    playlists.map(pl => {
                        const isAdded = addedIds.has(pl.id);
                        return (
                            <button
                                key={pl.id}
                                onClick={() => toggleSong(pl.id)}
                                disabled={busy === pl.id}
                                className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/5 transition-colors border-b border-[var(--hairline)] last:border-0 text-left"
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-white truncate">{pl.title}</p>
                                    <p className="text-[10px] text-[var(--text-secondary)]">
                                        {tPl('song_count', { count: pl.song_count })}
                                    </p>
                                </div>
                                <span className={`text-[11px] shrink-0 font-bold ml-2 transition-colors ${isAdded ? 'text-[var(--vermilion)]' : 'text-[var(--text-secondary)]'}`}>
                                    {busy === pl.id ? '...' : isAdded ? '✓' : '+'}
                                </span>
                            </button>
                        );
                    })
                )}
            </div>

            <button
                onClick={handleCreateNew}
                className="w-full flex items-center gap-2 px-3 py-2.5 border-t border-[var(--hairline)] hover:bg-white/5 transition-colors text-left text-[var(--vermilion)]"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span className="text-[11px] font-bold tracking-[0.1em] uppercase">{tPl('create')}</span>
            </button>
        </div>,
        document.body
    );

    if (variant === 'icon') {
        return (
            <>
                <button
                    ref={btnRef}
                    onClick={handleOpen}
                    title={t('add_to_playlist')}
                    className={`relative transition-all duration-300 transform flex-shrink-0
                        ${open ? 'text-white scale-110' : 'text-gray-600 hover:text-white hover:scale-110'}
                    `}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="3" y1="6" x2="15" y2="6" />
                        <line x1="3" y1="12" x2="15" y2="12" />
                        <line x1="3" y1="18" x2="11" y2="18" />
                        <line x1="18" y1="14" x2="18" y2="22" />
                        <line x1="14" y1="18" x2="22" y2="18" />
                    </svg>
                </button>
                {dropdownPanel}
            </>
        );
    }

    return (
        <>
            <button
                ref={btnRef}
                onClick={handleOpen}
                className={`
                    flex items-center gap-2 px-3 py-1.5 border transition-all duration-300
                    bg-transparent
                    ${open
                        ? 'border-white/30 text-white bg-white/5'
                        : 'border-[var(--hairline-strong)] hover:border-white/30 text-[var(--text-secondary)] hover:text-white hover:bg-white/5'}
                `}
            >
                <span className="text-[10px] font-bold tracking-[0.1em] uppercase">
                    {t('add_to_playlist')}
                </span>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
            </button>
            {dropdownPanel}
        </>
    );
}
