'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { API_BASE_URL } from '@/lib/api';
import ThumbnailImage from '@/components/ThumbnailImage';
import { useTranslations } from 'next-intl';

type SearchResult = {
    id: number;
    name_english?: string | null;
    name_japanese?: string | null;
    name_romaji?: string | null;
    artist_string: string;
    youtube_id?: string | null;
    niconico_thumb_url?: string | null;
};

export default function NewPlaylistPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const params = useParams();
    const locale = (params?.locale as string) || 'en';
    const t = useTranslations('Playlist');

    const [title, setTitle] = useState('');
    const [desc, setDesc] = useState('');
    const [isPublic, setIsPublic] = useState(1);
    const [songs, setSongs] = useState<SearchResult[]>([]);

    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [saving, setSaving] = useState(false);
    const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

    const canSave = title.trim().length > 0 && songs.length > 0;

    const search = (q: string) => {
        setQuery(q);
        if (debounceTimer) clearTimeout(debounceTimer);
        if (!q.trim()) { setResults([]); return; }
        setDebounceTimer(setTimeout(async () => {
            setSearching(true);
            try {
                const res = await fetch(`${API_BASE_URL}/songs/search?query=${encodeURIComponent(q)}&limit=8&vocaloid_only=true`);
                if (res.ok) setResults(await res.json());
            } finally {
                setSearching(false);
            }
        }, 350));
    };

    const addSong = (song: SearchResult) => {
        if (songs.find(s => s.id === song.id)) return;
        setSongs(prev => [...prev, song]);
        setQuery('');
        setResults([]);
    };

    const removeSong = (id: number) => {
        setSongs(prev => prev.filter(s => s.id !== id));
    };

    const handleSave = async () => {
        if (!canSave || !session) return;
        setSaving(true);
        const token = (session as any)?.apiToken;
        try {
            // 1. Create playlist
            const createRes = await fetch(`${API_BASE_URL}/playlists`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ title: title.trim(), description: desc, is_public: isPublic }),
            });
            if (!createRes.ok) { setSaving(false); return; }
            const created = await createRes.json();

            // 2. Add songs sequentially
            for (const song of songs) {
                await fetch(`${API_BASE_URL}/playlists/${created.id}/songs`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ song_id: song.id }),
                });
            }

            // 3. Redirect to detail
            router.push(`/${locale}/playlist/${created.id}`);
        } finally {
            setSaving(false);
        }
    };

    if (status === 'loading') return null;
    if (!session) {
        router.push(`/${locale}/playlist`);
        return null;
    }

    return (
        <div className="min-h-screen">
            <div className="max-w-4xl mx-auto px-6 pt-4 pb-16 flex flex-col gap-8">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-white">{t('create')}</h1>
                    <button onClick={() => router.back()}
                        className="text-sm text-[var(--text-secondary)] hover:text-white transition-colors">
                        ← {t('cancel')}
                    </button>
                </div>

                {/* Form */}
                <div className="glass-panel hairline-border p-8 flex flex-col gap-6 relative">
                    <div className="absolute -top-[1px] -left-[1px] w-3 h-3 border-t border-l border-[var(--vermilion)]" />
                    <div className="absolute -bottom-[1px] -right-[1px] w-3 h-3 border-b border-r border-[var(--vermilion)]" />

                    {/* Title */}
                    <label className="flex flex-col gap-1.5">
                        <span className="text-xs text-[var(--text-secondary)] tracking-widest uppercase">{t('name_label')} *</span>
                        <input
                            required
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder={t('name_placeholder')}
                            className="bg-white/5 border border-[var(--hairline)] px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[var(--vermilion)]/50"
                        />
                    </label>

                    {/* Description */}
                    <label className="flex flex-col gap-1.5">
                        <span className="text-xs text-[var(--text-secondary)] tracking-widest uppercase">{t('desc_label')}</span>
                        <textarea
                            value={desc}
                            onChange={e => setDesc(e.target.value)}
                            placeholder={t('desc_placeholder')}
                            rows={2}
                            className="bg-white/5 border border-[var(--hairline)] px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[var(--vermilion)]/50 resize-none"
                        />
                    </label>

                    {/* Visibility */}
                    <div className="flex flex-col gap-1.5">
                        <span className="text-xs text-[var(--text-secondary)] tracking-widest uppercase">{t('visibility')}</span>
                        <div className="flex gap-3">
                            {[{ val: 1, label: t('public') }, { val: 0, label: t('private') }].map(opt => (
                                <button key={opt.val} type="button" onClick={() => setIsPublic(opt.val)}
                                    className={`flex-1 py-2 text-sm border transition-colors ${isPublic === opt.val
                                        ? 'border-[var(--vermilion)] text-[var(--vermilion)] bg-[var(--vermilion)]/10'
                                        : 'border-[var(--hairline)] text-[var(--text-secondary)]'}`}>
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Song search */}
                    <div className="flex flex-col gap-3">
                        <span className="text-xs text-[var(--text-secondary)] tracking-widest uppercase">{t('add_song')} * <span className="normal-case tracking-normal opacity-60">{t('at_least_one')}</span></span>
                        <div className="relative">
                            <div className="flex items-center gap-2 border border-[var(--hairline)] bg-white/5 px-3 py-2.5">
                                {searching ? (
                                    <svg className="animate-spin h-4 w-4 text-[var(--text-secondary)] shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--text-secondary)] shrink-0">
                                        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                                    </svg>
                                )}
                                <input
                                    value={query}
                                    onChange={e => search(e.target.value)}
                                    placeholder={t('add_song_placeholder')}
                                    className="bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none flex-1"
                                />
                            </div>
                            {results.length > 0 && (
                                <div className="absolute top-full left-0 right-0 z-50 bg-[var(--bg-dark)] border border-[var(--hairline-strong)] shadow-2xl max-h-60 overflow-y-auto">
                                    {results.map(song => {
                                        const songTitle = song.name_japanese || song.name_english || '—';
                                        const already = !!songs.find(s => s.id === song.id);
                                        return (
                                            <button key={song.id} onClick={() => addSong(song)} disabled={already}
                                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left border-b border-[var(--hairline)] last:border-0 disabled:opacity-40">
                                                {(song.youtube_id || song.niconico_thumb_url) ? (
                                                    <ThumbnailImage youtubeId={song.youtube_id} niconicoThumb={song.niconico_thumb_url} alt={songTitle} className="w-8 h-8 object-cover shrink-0" />
                                                ) : <div className="w-8 h-8 bg-white/5 shrink-0" />}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm text-white truncate">{songTitle}</p>
                                                    <p className="text-xs text-[var(--text-secondary)] truncate">{(song.artist_string || '').replace(/, /g, ' · ')}</p>
                                                </div>
                                                <span className="text-sm text-[var(--vermilion)] shrink-0 font-medium">
                                                    {already ? '✓' : '+'}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Selected songs */}
                        {songs.length > 0 && (
                            <div className="flex flex-col divide-y divide-[var(--hairline)] border border-[var(--hairline)]">
                                {songs.map((song, idx) => {
                                    const songTitle = song.name_japanese || song.name_english || '—';
                                    return (
                                        <div key={song.id} className="flex items-center gap-4 px-5 py-3.5">
                                            <span className="font-mono text-xs text-[var(--text-secondary)] w-6 text-right shrink-0 tabular-nums opacity-50">{idx + 1}</span>
                                            {(song.youtube_id || song.niconico_thumb_url) ? (
                                                <ThumbnailImage youtubeId={song.youtube_id} niconicoThumb={song.niconico_thumb_url} alt={songTitle} className="w-24 h-16 object-cover shrink-0 border border-[var(--hairline)]" />
                                            ) : <div className="w-24 h-16 bg-white/5 border border-[var(--hairline)] shrink-0" />}
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-white text-base line-clamp-1 tracking-wide mb-1">{songTitle}</p>
                                                <p className="text-[11px] text-[var(--text-secondary)] truncate">{(song.artist_string || '').replace(/, /g, ' · ')}</p>
                                            </div>
                                            <button onClick={() => removeSong(song.id)}
                                                className="text-[var(--text-secondary)] hover:text-red-400 transition-colors shrink-0 p-1">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Save button */}
                <button
                    onClick={handleSave}
                    disabled={!canSave || saving}
                    className="w-full py-4 text-sm font-medium tracking-[0.15em] border transition-all duration-200
                        disabled:opacity-30 disabled:cursor-not-allowed
                        enabled:border-[var(--vermilion)] enabled:text-[var(--vermilion)] enabled:hover:bg-[var(--vermilion)]/10"
                >
                    {saving ? (
                        <span className="flex items-center justify-center gap-2">
                            <svg className="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                            {t('save')}...
                        </span>
                    ) : (
                        `${t('save')} ${songs.length > 0 ? `(${songs.length} ${t('add_song').toLowerCase()})` : '— ' + t('no_songs')}`
                    )}
                </button>

            </div>
        </div>
    );
}
