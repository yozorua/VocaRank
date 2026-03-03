'use client';

import { useState, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { API_BASE_URL } from '@/lib/api';
import { OfficialLive } from '@/types';
import Cropper, { Area } from 'react-easy-crop';

type Props = {
    existingLive?: OfficialLive | null;
    onClose: () => void;
    onSaved: () => void;
};

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024;

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

const getCroppedImg = (src: string, pixelCrop: Area): Promise<Blob | null> =>
    new Promise((resolve, reject) => {
        const image = new window.Image();
        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 800;
            canvas.height = 400;
            const ctx = canvas.getContext('2d');
            if (!ctx) { resolve(null); return; }
            ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, 800, 400);
            canvas.toBlob(blob => { if (blob) resolve(blob); else reject(new Error('Canvas is empty')); }, 'image/jpeg', 0.95);
        };
        image.onerror = () => reject(new Error('Image load failed'));
        image.src = src;
    });

function slugify(str: string): string {
    return str
        .toLowerCase()
        .replace(/[\s\u3000]+/g, '-')
        .replace(/[^\w\-]/g, '')
        .replace(/--+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export default function OfficialLiveForm({ existingLive, onClose, onSaved }: Props) {
    const { data: session } = useSession();
    const router = useRouter();
    const t = useTranslations('Playlist');
    const [name, setName] = useState(existingLive?.name ?? '');
    const [slug, setSlug] = useState(existingLive?.slug ?? '');
    const [desc, setDesc] = useState(existingLive?.description ?? '');
    const [order, setOrder] = useState(existingLive?.display_order ?? 0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Cover state
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [coverPreview, setCoverPreview] = useState<string | null>(null);
    const [removeCover, setRemoveCover] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [coverError, setCoverError] = useState<string | null>(null);
    const coverInputRef = useRef<HTMLInputElement>(null);

    // Crop state
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
    const [isCropApplying, setIsCropApplying] = useState(false);

    const handleNameChange = (val: string) => {
        setName(val);
        if (!existingLive) {
            setSlug(slugify(val));
        }
    };

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
            setRemoveCover(false);
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

    const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !slug.trim()) return;
        setLoading(true);
        setError(null);
        const token = session?.apiToken;
        const url = existingLive
            ? `${API_BASE_URL}/official-lives/${existingLive.id}`
            : `${API_BASE_URL}/official-lives`;
        const method = existingLive ? 'PATCH' : 'POST';
        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ name, slug, description: desc || null, display_order: order }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setError(data.detail ?? t('live_save_error'));
                return;
            }
            const saved = await res.json();
            const liveId = existingLive?.id ?? saved.id;

            if (coverFile) {
                const fd = new FormData();
                fd.append('file', coverFile);
                await fetch(`${API_BASE_URL}/official-lives/${liveId}/cover`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                    body: fd,
                });
            } else if (removeCover && existingLive) {
                await fetch(`${API_BASE_URL}/official-lives/${liveId}/cover`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` },
                });
            }

            onSaved();
            onClose();
            router.refresh();
        } finally {
            setLoading(false);
        }
    };

    const activeCover = coverPreview ?? (!removeCover ? (existingLive?.cover_url ?? null) : null);

    return (
        <>
            {/* Crop Modal */}
            {imageSrc && (
                <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center">
                    <div className="bg-[var(--bg-dark)] border border-[var(--hairline-strong)] w-full max-w-lg mx-4 shadow-2xl flex flex-col">
                        <div className="p-4 border-b border-[var(--hairline-strong)] text-center">
                            <h3 className="font-semibold tracking-widest uppercase text-white text-sm">{t('cover_crop_title')}</h3>
                        </div>
                        <div className="relative w-full h-[280px]">
                            <Cropper
                                image={imageSrc}
                                crop={crop}
                                zoom={zoom}
                                aspect={2}
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

            {/* Main Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
                <form
                    className="relative glass-panel hairline-border p-8 w-full max-w-md flex flex-col gap-5 max-h-[90vh] overflow-y-auto"
                    onClick={e => e.stopPropagation()}
                    onSubmit={handleSubmit}
                >
                    <div className="absolute -top-[1px] -left-[1px] w-3 h-3 border-t border-l border-[var(--vermilion)]" />
                    <div className="absolute -bottom-[1px] -right-[1px] w-3 h-3 border-b border-r border-[var(--vermilion)]" />

                    <h2 className="text-white font-semibold tracking-wide">
                        {existingLive ? t('edit_live') : t('add_live')}
                    </h2>

                    {error && (
                        <p className="text-sm text-red-400 border border-red-400/30 bg-red-400/10 px-3 py-2">{error}</p>
                    )}

                    <label className="flex flex-col gap-1.5">
                        <span className="text-xs text-[var(--text-secondary)] tracking-widest uppercase">{t('live_name_label')}</span>
                        <input
                            required
                            value={name}
                            onChange={e => handleNameChange(e.target.value)}
                            placeholder="e.g. マジカルミライ 2024"
                            className="bg-white/5 border border-[var(--hairline)] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[var(--vermilion)]/50"
                        />
                    </label>

                    <label className="flex flex-col gap-1.5">
                        <span className="text-xs text-[var(--text-secondary)] tracking-widest uppercase">{t('live_slug_label')}</span>
                        <input
                            required
                            value={slug}
                            onChange={e => setSlug(e.target.value)}
                            placeholder="magical-mirai-2024"
                            className="bg-white/5 border border-[var(--hairline)] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[var(--vermilion)]/50 font-mono"
                        />
                        <span className="text-[10px] text-[var(--text-secondary)] opacity-50">{t('live_slug_hint', { slug: slug || '...' })}</span>
                    </label>

                    <label className="flex flex-col gap-1.5">
                        <span className="text-xs text-[var(--text-secondary)] tracking-widest uppercase">{t('desc_label')}</span>
                        <textarea
                            value={desc}
                            onChange={e => setDesc(e.target.value)}
                            placeholder={t('desc_placeholder')}
                            rows={3}
                            className="bg-white/5 border border-[var(--hairline)] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[var(--vermilion)]/50 resize-none"
                        />
                    </label>

                    <label className="flex flex-col gap-1.5">
                        <span className="text-xs text-[var(--text-secondary)] tracking-widest uppercase">{t('live_display_order_label')}</span>
                        <input
                            type="number"
                            value={order}
                            onChange={e => setOrder(Number(e.target.value))}
                            className="bg-white/5 border border-[var(--hairline)] px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--vermilion)]/50 w-24"
                        />
                    </label>

                    {/* Cover Upload */}
                    <div className="flex flex-col gap-2">
                        <span className="text-xs text-[var(--text-secondary)] tracking-widest uppercase">{t('live_cover_label')}</span>
                        <div
                            className={`relative w-full h-28 border-2 border-dashed transition-colors cursor-pointer ${isDragging ? 'border-[var(--vermilion)] bg-[var(--vermilion)]/5' : 'border-[var(--hairline-strong)] hover:border-[var(--vermilion)]/50'}`}
                            onClick={() => coverInputRef.current?.click()}
                            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={e => { e.preventDefault(); setIsDragging(false); }}
                            onDrop={e => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) void validateAndSetCover(f); }}
                        >
                            {activeCover ? (
                                <>
                                    <img src={activeCover} alt="Cover preview" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <span className="text-white text-[11px] tracking-widest uppercase">{t('cover_change')}</span>
                                    </div>
                                </>
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-[var(--text-secondary)]">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-50">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                                    </svg>
                                    <span className="text-xs">{t('cover_drag_drop')} <span className="text-[var(--vermilion)]">{t('cover_browse')}</span></span>
                                    <span className="text-[10px] opacity-40">PNG · JPG · WEBP · Max 5MB</span>
                                </div>
                            )}
                        </div>

                        {coverFile ? (
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] text-[var(--text-secondary)] truncate max-w-[70%]">{coverFile.name}</span>
                                <button type="button" onClick={clearCover} className="text-[11px] text-[var(--text-secondary)] hover:text-red-400 transition-colors shrink-0">✕ Clear</button>
                            </div>
                        ) : existingLive?.cover_url && !removeCover ? (
                            <div className="flex justify-end">
                                <button type="button" onClick={() => setRemoveCover(true)} className="text-[11px] text-[var(--text-secondary)] hover:text-red-400 transition-colors">{t('cover_remove')}</button>
                            </div>
                        ) : removeCover ? (
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] text-[var(--text-secondary)] opacity-60">{t('live_cover_removed')}</span>
                                <button type="button" onClick={() => setRemoveCover(false)} className="text-[11px] text-[var(--text-secondary)] hover:text-white transition-colors shrink-0">{t('cover_undo')}</button>
                            </div>
                        ) : null}

                        {coverError && <p className="text-[11px] text-red-400">{coverError}</p>}

                        <input
                            ref={coverInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={e => { const f = e.target.files?.[0]; if (f) void validateAndSetCover(f); }}
                        />
                    </div>

                    <div className="flex gap-3 mt-2">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-2 text-sm border border-[var(--hairline)] text-[var(--text-secondary)] hover:text-white transition-colors">
                            {t('cancel')}
                        </button>
                        <button type="submit" disabled={loading || !name.trim() || !slug.trim()}
                            className="flex-1 py-2 text-sm border border-[var(--vermilion)] text-[var(--vermilion)] hover:bg-[var(--vermilion)]/10 transition-colors disabled:opacity-40">
                            {loading ? '...' : t('save')}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}
