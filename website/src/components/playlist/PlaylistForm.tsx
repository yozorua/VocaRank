'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { API_BASE_URL } from '@/lib/api';
import Cropper from 'react-easy-crop';

type Props = {
    locale: string;
    existingPlaylist?: {
        id: number;
        title: string;
        description?: string | null;
        is_public: number;
        cover_url?: string | null;
    } | null;
    iconOnly?: boolean;
    t: {
        create: string;
        edit: string;
        name_label: string;
        name_placeholder: string;
        desc_label: string;
        desc_placeholder: string;
        visibility: string;
        public: string;
        private: string;
        save: string;
        cancel: string;
        cover_upload: string;
        cover_remove: string;
        cover_drag_drop: string;
        cover_browse: string;
        cover_change: string;
        cover_mosaic_hint: string;
        cover_undo: string;
        cover_error_type: string;
        cover_error_size: string;
        cover_crop_title: string;
        cover_crop_apply: string;
        cover_crop_cancel: string;
    };
};

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024;

// Reads a file to a data URL using FileReader (more reliable than blob URLs on mobile).
const readFileAsDataURL = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });

// Loads a data URL into an Image, re-draws onto a canvas to bake in EXIF orientation,
// and returns a corrected data URL. react-easy-crop then operates on orientation-corrected pixels.
const normalizeOrientation = (dataUrl: string): Promise<string> =>
    new Promise((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            // After browser applies EXIF, img.width/height are the DISPLAYED dimensions.
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

export default function PlaylistForm({ locale, existingPlaylist, t, iconOnly }: Props) {
    const { data: session } = useSession();
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState(existingPlaylist?.title ?? '');
    const [desc, setDesc] = useState(existingPlaylist?.description ?? '');
    const [isPublic, setIsPublic] = useState(existingPlaylist?.is_public ?? 1);
    const [loading, setLoading] = useState(false);

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
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
    const [isCropApplying, setIsCropApplying] = useState(false);

    const router = useRouter();

    const validateAndSetCover = async (file: File) => {
        setCoverError(null);
        if (!ALLOWED_TYPES.includes(file.type)) {
            setCoverError(t.cover_error_type);
            return;
        }
        if (file.size > MAX_SIZE) {
            setCoverError(t.cover_error_size);
            return;
        }
        try {
            const dataUrl = await readFileAsDataURL(file);
            const normalized = await normalizeOrientation(dataUrl);
            setImageSrc(normalized);
            setRemoveCover(false);
        } catch {
            setCoverError(t.cover_error_type);
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

    if (!session) return null;

    const activeCover = coverPreview ?? (!removeCover ? (existingPlaylist?.cover_url ?? null) : null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const token = (session as any)?.apiToken;
        const url = existingPlaylist
            ? `${API_BASE_URL}/playlists/${existingPlaylist.id}`
            : `${API_BASE_URL}/playlists`;
        const method = existingPlaylist ? 'PATCH' : 'POST';
        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ title, description: desc, is_public: isPublic }),
            });
            if (res.ok) {
                const saved = await res.json();
                const playlistId = existingPlaylist ? existingPlaylist.id : saved.id;

                if (coverFile && playlistId) {
                    const fd = new FormData();
                    fd.append('file', coverFile);
                    await fetch(`${API_BASE_URL}/playlists/${playlistId}/cover`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${token}` },
                        body: fd,
                    });
                } else if (removeCover && existingPlaylist) {
                    await fetch(`${API_BASE_URL}/playlists/${existingPlaylist.id}/cover`, {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${token}` },
                    });
                }

                setOpen(false);
                if (!existingPlaylist) {
                    router.push(`/${locale}/playlist/${playlistId}`);
                } else {
                    router.refresh();
                }
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {iconOnly ? (
                <button
                    onClick={() => setOpen(true)}
                    title={existingPlaylist ? t.edit : t.create}
                    className="w-10 h-10 flex items-center justify-center border border-[var(--hairline)] text-[var(--text-secondary)] hover:border-[var(--vermilion)]/50 hover:text-[var(--vermilion)] transition-all"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                </button>
            ) : (
                <button
                    onClick={() => setOpen(true)}
                    className="group relative px-6 py-3 text-white text-sm tracking-[0.15em] transition-all hover:text-[var(--vermilion)] border border-[var(--hairline-strong)] hover:border-[var(--vermilion)]/50"
                >
                    {existingPlaylist ? t.edit : t.create}
                </button>
            )}

            {/* Crop Modal — above the playlist form modal */}
            {imageSrc && (
                <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center">
                    <div className="bg-[var(--bg-dark)] border border-[var(--hairline-strong)] w-full max-w-lg mx-4 shadow-2xl flex flex-col">
                        <div className="p-4 border-b border-[var(--hairline-strong)] text-center">
                            <h3 className="font-semibold tracking-widest uppercase text-white text-sm">{t.cover_crop_title}</h3>
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
                                {t.cover_crop_cancel}
                            </button>
                            <button
                                onClick={applyCrop}
                                disabled={isCropApplying}
                                className="flex-1 py-2.5 text-sm border border-[var(--vermilion)] text-[var(--vermilion)] hover:bg-[var(--vermilion)]/10 transition-colors disabled:opacity-40"
                            >
                                {isCropApplying ? '...' : t.cover_crop_apply}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    onClick={() => setOpen(false)}>
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
                    <form
                        className="relative glass-panel hairline-border p-8 w-full max-w-md flex flex-col gap-5 max-h-[90vh] overflow-y-auto"
                        onClick={e => e.stopPropagation()}
                        onSubmit={handleSubmit}
                    >
                        <div className="absolute -top-[1px] -left-[1px] w-3 h-3 border-t border-l border-[var(--vermilion)]" />
                        <div className="absolute -bottom-[1px] -right-[1px] w-3 h-3 border-b border-r border-[var(--vermilion)]" />

                        <h2 className="text-white font-semibold tracking-wide">
                            {existingPlaylist ? t.edit : t.create}
                        </h2>

                        <label className="flex flex-col gap-1.5">
                            <span className="text-xs text-[var(--text-secondary)] tracking-widest uppercase">{t.name_label}</span>
                            <input
                                required
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder={t.name_placeholder}
                                className="bg-white/5 border border-[var(--hairline)] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[var(--vermilion)]/50"
                            />
                        </label>

                        <label className="flex flex-col gap-1.5">
                            <span className="text-xs text-[var(--text-secondary)] tracking-widest uppercase">{t.desc_label}</span>
                            <textarea
                                value={desc}
                                onChange={e => setDesc(e.target.value)}
                                placeholder={t.desc_placeholder}
                                rows={3}
                                className="bg-white/5 border border-[var(--hairline)] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[var(--vermilion)]/50 resize-none"
                            />
                        </label>

                        <label className="flex flex-col gap-1.5">
                            <span className="text-xs text-[var(--text-secondary)] tracking-widest uppercase">{t.visibility}</span>
                            <div className="flex gap-3">
                                {[{ val: 1, label: t.public }, { val: 0, label: t.private }].map(opt => (
                                    <button
                                        key={opt.val}
                                        type="button"
                                        onClick={() => setIsPublic(opt.val)}
                                        className={`flex-1 py-2 text-sm border transition-colors ${isPublic === opt.val
                                            ? 'border-[var(--vermilion)] text-[var(--vermilion)] bg-[var(--vermilion)]/10'
                                            : 'border-[var(--hairline)] text-[var(--text-secondary)]'
                                            }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </label>

                        {/* Cover Upload */}
                        <div className="flex flex-col gap-2">
                            <span className="text-xs text-[var(--text-secondary)] tracking-widest uppercase">{t.cover_upload}</span>

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
                                {activeCover ? (
                                    <>
                                        <img src={activeCover} alt="Cover preview" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <span className="text-white text-[11px] tracking-widest uppercase">{t.cover_change}</span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-[var(--text-secondary)]">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-50">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                                        </svg>
                                        <span className="text-xs">
                                            {t.cover_drag_drop} <span className="text-[var(--vermilion)]">{t.cover_browse}</span>
                                        </span>
                                        <span className="text-[10px] opacity-40">PNG · JPG · WEBP · Max 5MB</span>
                                    </div>
                                )}
                            </div>

                            {/* Actions below the drop zone */}
                            {coverFile ? (
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] text-[var(--text-secondary)] truncate max-w-[70%]">{coverFile.name}</span>
                                    <button type="button" onClick={clearCover}
                                        className="text-[11px] text-[var(--text-secondary)] hover:text-red-400 transition-colors shrink-0">
                                        ✕ Clear
                                    </button>
                                </div>
                            ) : existingPlaylist?.cover_url && !removeCover ? (
                                <div className="flex justify-end">
                                    <button type="button" onClick={() => setRemoveCover(true)}
                                        className="text-[11px] text-[var(--text-secondary)] hover:text-red-400 transition-colors">
                                        {t.cover_remove}
                                    </button>
                                </div>
                            ) : removeCover ? (
                                <div className="flex items-center justify-between">
                                                    <span className="text-[11px] text-[var(--text-secondary)] opacity-60">{t.cover_mosaic_hint}</span>
                                    <button type="button" onClick={() => setRemoveCover(false)}
                                        className="text-[11px] text-[var(--text-secondary)] hover:text-white transition-colors shrink-0">
                                        {t.cover_undo}
                                    </button>
                                </div>
                            ) : null}

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

                        <div className="flex gap-3 mt-2">
                            <button type="button" onClick={() => setOpen(false)}
                                className="flex-1 py-2 text-sm border border-[var(--hairline)] text-[var(--text-secondary)] hover:text-white transition-colors">
                                {t.cancel}
                            </button>
                            <button type="submit" disabled={loading}
                                className="flex-1 py-2 text-sm border border-[var(--vermilion)] text-[var(--vermilion)] hover:bg-[var(--vermilion)]/10 transition-colors disabled:opacity-40">
                                {loading ? '...' : t.save}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </>
    );
}
