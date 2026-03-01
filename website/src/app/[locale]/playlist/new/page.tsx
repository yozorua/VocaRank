'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { API_BASE_URL } from '@/lib/api';
import ThumbnailImage from '@/components/ThumbnailImage';
import { useTranslations } from 'next-intl';
import Cropper from 'react-easy-crop';

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

    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [coverPreview, setCoverPreview] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [coverError, setCoverError] = useState<string | null>(null);
    const coverInputRef = useRef<HTMLInputElement>(null);

    // Crop state
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
    const [isCropApplying, setIsCropApplying] = useState(false);

    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
    const MAX_SIZE = 5 * 1024 * 1024;

    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [saving, setSaving] = useState(false);
    const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
    const [preloading, setPreloading] = useState(false);

    // Pre-populate songs from player "Save to Playlist" button
    // The player writes full song objects to localStorage to avoid API re-fetching
    useEffect(() => {
        // Primary: localStorage handoff (set by the player button - zero API calls, all songs guaranteed)
        const stored = localStorage.getItem('vocarank_pending_playlist');
        if (stored) {
            localStorage.removeItem('vocarank_pending_playlist');
            try {
                const parsed = JSON.parse(stored) as SearchResult[];
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setSongs(parsed);
                    return;
                }
            } catch {
                // fall through to URL param method
            }
        }

        // Fallback: ?songs= URL param (sequential fetch)
        const searchParams = new URLSearchParams(window.location.search);
        const songIds = searchParams.get('songs');
        if (!songIds) return;
        window.history.replaceState({}, document.title, window.location.pathname);
        const ids = songIds.split(',').slice(0, 50).filter(Boolean);
        if (ids.length === 0) return;
        setPreloading(true);
        (async () => {
            const results: SearchResult[] = [];
            for (const id of ids) {
                try {
                    const r = await fetch(`${API_BASE_URL}/songs/${id}`);
                    if (r.ok) {
                        const data = await r.json();
                        if (data) results.push(data as SearchResult);
                    }
                } catch {
                    // skip failed individual fetches
                }
            }
            if (results.length > 0) setSongs(results);
            setPreloading(false);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const readFileAsDataURL = (file: File): Promise<string> =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
        });

    const normalizeOrientation = (dataUrl: string): Promise<string> =>
        new Promise((resolve, reject) => {
            const img = new window.Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) { resolve(dataUrl); return; }
                ctx.drawImage(img, 0, 0, img.width, img.height);
                resolve(canvas.toDataURL('image/jpeg', 0.95));
            };
            img.onerror = () => reject(new Error('Image load failed'));
            img.src = dataUrl;
        });

    const getCroppedImg = (src: string, pixelCrop: any): Promise<Blob | null> =>
        new Promise((resolve, reject) => {
            const image = new window.Image();
            image.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = 512;
                canvas.height = 512;
                const ctx = canvas.getContext('2d');
                if (!ctx) { resolve(null); return; }
                ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, 512, 512);
                canvas.toBlob((blob) => { if (blob) resolve(blob); else reject(new Error('Canvas is empty')); }, 'image/jpeg', 0.95);
            };
            image.onerror = () => reject(new Error('Image load failed'));
            image.src = src;
        });

    const validateAndSetCover = async (file: File) => {
        setCoverError(null);
        if (!ALLOWED_TYPES.includes(file.type)) {
            setCoverError(t('cover_error_type'));
            return;
        }
        if (file.size > MAX_SIZE) {
            setCoverError(t('cover_error_size'));
            return;
        }
        try {
            const dataUrl = await readFileAsDataURL(file);
            const normalized = await normalizeOrientation(dataUrl);
            setImageSrc(normalized);
        } catch {
            setCoverError(t('cover_error_type'));
        }
    };

    const clearCover = () => {
        setCoverFile(null);
        setCoverPreview(null);
        setCoverError(null);
        setImageSrc(null);
        if (coverInputRef.current) coverInputRef.current.value = '';
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) void validateAndSetCover(file);
    };

    const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) void validateAndSetCover(file);
    };

    const onCropComplete = useCallback((_: any, croppedPixels: any) => {
        setCroppedAreaPixels(croppedPixels);
    }, []);

    const applyCrop = async () => {
        if (!imageSrc || !croppedAreaPixels) return;
        setIsCropApplying(true);
        try {
            const blob = await getCroppedImg(imageSrc, croppedAreaPixels);
            if (!blob) return;
            const file = new File([blob], 'cover.jpg', { type: 'image/jpeg' });
            setCoverFile(file);
            setCoverPreview(URL.createObjectURL(blob));
            setImageSrc(null);
        } finally {
            setIsCropApplying(false);
        }
    };

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

            // 3. Upload cover if selected
            if (coverFile) {
                const fd = new FormData();
                fd.append('file', coverFile);
                await fetch(`${API_BASE_URL}/playlists/${created.id}/cover`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                    body: fd,
                });
            }

            // 4. Redirect to detail
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
        <>
            {/* Crop Modal */}
            {imageSrc && (
                <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center">
                    <div className="bg-[var(--bg-dark)] border border-[var(--hairline-strong)] w-full max-w-lg mx-4 shadow-2xl flex flex-col">
                        <div className="p-4 border-b border-[var(--hairline-strong)] text-center">
                            <h3 className="font-semibold tracking-widest uppercase text-white text-sm">{t('cover_crop_title')}</h3>
                        </div>
                        <div className="relative w-full h-[320px]">
                            <Cropper
                                image={imageSrc}
                                crop={crop}
                                zoom={zoom}
                                aspect={1}
                                showGrid={false}
                                onCropChange={setCrop}
                                onZoomChange={setZoom}
                                onCropComplete={onCropComplete}
                            />
                        </div>
                        <div className="flex gap-4 p-4 border-t border-[var(--hairline-strong)]">
                            <button
                                onClick={() => { setImageSrc(null); if (coverInputRef.current) coverInputRef.current.value = ''; }}
                                className="flex-1 py-2.5 text-sm text-[var(--text-secondary)] hover:text-white transition-colors"
                            >
                                {t('cover_crop_cancel')}
                            </button>
                            <button
                                onClick={applyCrop}
                                disabled={isCropApplying}
                                className="flex-1 py-2.5 text-sm border border-[var(--vermilion)] text-[var(--vermilion)] hover:bg-[var(--vermilion)]/10 transition-colors disabled:opacity-40"
                            >
                                {isCropApplying ? '...' : t('cover_crop_apply')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
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

                        {/* Cover Upload */}
                        <div className="flex flex-col gap-2">
                            <span className="text-xs text-[var(--text-secondary)] tracking-widest uppercase">{t('cover_upload')}</span>

                            {/* Drop zone */}
                            <div
                                className={`relative w-full h-28 border-2 border-dashed transition-colors cursor-pointer ${isDragging
                                    ? 'border-[var(--vermilion)] bg-[var(--vermilion)]/5'
                                    : 'border-[var(--hairline-strong)] hover:border-[var(--vermilion)]/50'
                                    }`}
                                onClick={() => coverInputRef.current?.click()}
                                onDragOver={onDragOver}
                                onDragLeave={onDragLeave}
                                onDrop={onDrop}
                            >
                                {coverPreview ? (
                                    <>
                                        <img src={coverPreview} alt="Cover preview" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <span className="text-white text-[11px] tracking-widest uppercase">{t('cover_change')}</span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-[var(--text-secondary)]">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-50">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                                        </svg>
                                        <span className="text-xs">
                                            {t('cover_drag_drop')} <span className="text-[var(--vermilion)]">{t('cover_browse')}</span>
                                        </span>
                                        <span className="text-[10px] opacity-40">PNG · JPG · WEBP · Max 5MB</span>
                                    </div>
                                )}
                            </div>

                            {/* Action strip */}
                            {coverFile && (
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] text-[var(--text-secondary)] truncate max-w-[70%]">{coverFile.name}</span>
                                    <button type="button" onClick={clearCover}
                                        className="text-[11px] text-[var(--text-secondary)] hover:text-red-400 transition-colors shrink-0">
                                        ✕ Clear
                                    </button>
                                </div>
                            )}

                            {coverError && (
                                <p className="text-[11px] text-red-400">{coverError}</p>
                            )}

                            <input
                                ref={coverInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="hidden"
                                onChange={handleFileInput}
                            />
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
                                                        <div className="w-8 h-8 shrink-0 overflow-hidden">
                                                            <ThumbnailImage youtubeId={song.youtube_id} niconicoThumb={song.niconico_thumb_url} alt={songTitle} className="w-full h-full object-cover" />
                                                        </div>
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

                            {/* Preloading indicator from player queue */}
                            {preloading && (
                                <div className="flex items-center gap-2 py-3 text-[var(--text-secondary)]">
                                    <svg className="animate-spin h-4 w-4 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    <span className="text-sm">{t('loading_queue')}</span>
                                </div>
                            )}

                            {/* Selected songs */}
                            {songs.length > 0 && (
                                <div className="flex flex-col divide-y divide-[var(--hairline)] border border-[var(--hairline)]">
                                    {songs.map((song, idx) => {
                                        const songTitle = song.name_japanese || song.name_english || '—';
                                        return (
                                            <div key={song.id} className="flex items-center gap-4 px-5 py-3.5">
                                                <span className="font-mono text-xs text-[var(--text-secondary)] w-6 text-right shrink-0 tabular-nums opacity-50">{idx + 1}</span>
                                                {(song.youtube_id || song.niconico_thumb_url) ? (
                                                    <div className="w-24 h-16 shrink-0 overflow-hidden border border-[var(--hairline)]">
                                                        <ThumbnailImage youtubeId={song.youtube_id} niconicoThumb={song.niconico_thumb_url} alt={songTitle} className="w-full h-full object-cover" />
                                                    </div>
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
        </>
    );
}
