'use client';

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import Image from "next/image";
import { fetcher, API_BASE_URL } from "@/lib/api";
import { COUNTRIES } from "@/lib/countries";
import Cropper from "react-easy-crop";

interface UserProfile {
    id: number;
    email: string;
    name: string;
    picture_url: string;
    country: string | null;
    age_range: string | null;
    created_at: string;
    last_login?: string;
}

const AGE_RANGES = [
    { value: "Under 13", key: "age_under_13" },
    { value: "13-17", key: "age_13_17" },
    { value: "18-24", key: "age_18_24" },
    { value: "25-34", key: "age_25_34" },
    { value: "35-44", key: "age_35_44" },
    { value: "45-54", key: "age_45_54" },
    { value: "55-64", key: "age_55_64" },
    { value: "65+", key: "age_65_plus" },
    { value: "Prefer not to say", key: "age_prefer_not" }
];

export default function ProfilePage() {
    const { data: session, status, update } = useSession();
    const router = useRouter();
    const t = useTranslations('ProfilePage');
    const locale = useLocale();

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form States
    const [selectedName, setSelectedName] = useState<string>("");
    const [selectedEmail, setSelectedEmail] = useState<string>("");
    const [selectedCountry, setSelectedCountry] = useState<string>("");
    const [selectedAge, setSelectedAge] = useState<string>("");
    const [saveMessage, setSaveMessage] = useState({ text: "", type: "" });

    // Cropper States
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isAvatarModalOpen, setAvatarModalOpen] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push('/');
        }
    }, [status, router]);

    useEffect(() => {
        const loadProfile = async () => {
            if (status === "authenticated") {
                try {
                    const data = await fetcher('/auth/me');
                    setProfile(data);
                    setSelectedName(data.name || "");
                    setSelectedEmail(data.email || "");
                    setSelectedCountry(data.country || "");
                    setSelectedAge(data.age_range || "");
                } catch (error) {
                    console.error("Failed to load profile:", error);
                } finally {
                    setLoading(false);
                }
            }
        };
        loadProfile();
    }, [status]);

    const handleSave = async () => {
        setSaving(true);
        setSaveMessage({ text: "", type: "" });
        try {
            await fetcher('/auth/me', {
                method: 'PATCH',
                body: JSON.stringify({
                    name: selectedName || null,
                    country: selectedCountry || null,
                    age_range: selectedAge || null,
                    email: selectedEmail || null
                })
            });
            setSaveMessage({ text: t('save_success'), type: 'success' });
            if (profile) {
                setProfile({ ...profile, name: selectedName, country: selectedCountry, age_range: selectedAge, email: selectedEmail });
            }
            // Trigger NextAuth active session refresh
            if (update) {
                await update({ name: selectedName, email: selectedEmail });
            }
        } catch (error) {
            setSaveMessage({ text: t('save_error'), type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const hasChanges = profile && (
        selectedName !== (profile.name || "") ||
        selectedEmail !== (profile.email || "") ||
        selectedCountry !== (profile.country || "") ||
        selectedAge !== (profile.age_range || "")
    );

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    };

    // Image Upload Handlers
    const handleFile = (file: File) => {
        setUploadError(null);
        // Validation
        if (!["image/jpeg", "image/png"].includes(file.type)) {
            setUploadError("Only JPEG and PNG are allowed.");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setUploadError("File size exceeds 5MB.");
            return;
        }

        const imageDataUrl = URL.createObjectURL(file);
        setImageSrc(imageDataUrl);
    };

    const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    };

    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const onDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
            e.dataTransfer.clearData();
        }
    };

    const getCroppedImg = async (imageSrc: string, pixelCrop: any) => {
        const image = new window.Image();
        image.src = imageSrc;
        await new Promise((resolve) => (image.onload = resolve));

        const canvas = document.createElement("canvas");
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext("2d");

        if (!ctx) return null;

        ctx.drawImage(
            image,
            pixelCrop.x,
            pixelCrop.y,
            pixelCrop.width,
            pixelCrop.height,
            0,
            0,
            256,
            256
        );

        return new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((file) => {
                if (file) resolve(file);
                else reject(new Error('Canvas is empty'));
            }, 'image/jpeg', 0.95);
        });
    };

    const handleAvatarUpload = async () => {
        if (!imageSrc || !croppedAreaPixels) return;
        setIsUploading(true);

        try {
            const blob = await getCroppedImg(imageSrc, croppedAreaPixels);
            if (!blob) throw new Error("Failed to crop");

            const formData = new FormData();
            formData.append("file", blob, "avatar.jpg");

            // Direct fetch to bypass 'Content-Type: application/json' embedded in fetcher()
            const res = await fetch(`${API_BASE_URL}/auth/avatar`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${(session as any)?.apiToken}`
                },
                body: formData
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`Upload Failed [HTTP ${res.status}]: ${errText}`);
            }

            const updatedProfile = await res.json();

            setProfile(updatedProfile);
            setImageSrc(null); // Close modal
            setAvatarModalOpen(false); // Close parent

            if (update) {
                await update({ picture: updatedProfile.picture_url });
            }
            router.refresh();
        } catch (error) {
            console.error(error);
            alert("Upload failed. Please try again.");
        } finally {
            setIsUploading(false);
        }
    };

    if (status === "loading" || loading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <div className="text-[var(--text-secondary)] tracking-widest uppercase animate-pulse">{t('loading')}</div>
            </div>
        );
    }

    if (!profile) return null;

    return (
        <main className="max-w-[var(--max-width)] mx-auto px-4 md:px-6 py-6 md:py-8 animate-fade-in relative z-10">

            {/* Avatar Upload Selection Modal */}
            {isAvatarModalOpen && !imageSrc && (
                <div className="fixed inset-0 z-[300] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[var(--bg-dark)] border border-[var(--hairline-strong)] w-full max-w-md mx-auto shadow-2xl relative flex flex-col items-center p-8 animate-fade-in text-center">
                        {/* Corner accent */}
                        <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-[var(--vermilion)]" />
                        <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-[var(--vermilion)]" />

                        <button
                            onClick={() => setAvatarModalOpen(false)}
                            className="absolute top-4 right-4 text-[var(--text-secondary)] hover:text-white transition-colors text-lg leading-none"
                            aria-label="Close"
                        >
                            ✕
                        </button>

                        <p className="text-[10px] font-bold tracking-[0.3em] text-[var(--vermilion)] mb-2">{t('avatar_label', { defaultMessage: 'Avatar' })}</p>
                        <h3 className="text-xl font-black tracking-widest mb-2 text-white">{t('upload_title', { defaultMessage: 'Upload Image' })}</h3>
                        <p className="text-xs text-[var(--text-secondary)] mb-6">{t('avatar_desc', { defaultMessage: 'Max size: 5MB · JPEG or PNG' })}</p>

                        <div
                            className={`w-full border border-dashed transition-all p-10 cursor-pointer flex flex-col items-center justify-center gap-4 group ${isDragging ? 'border-[var(--vermilion)] bg-[var(--vermilion)]/5' : 'border-[var(--hairline-strong)] hover:border-[var(--vermilion)] hover:bg-[var(--vermilion)]/5'}`}
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={onDragOver}
                            onDragLeave={onDragLeave}
                            onDrop={onDrop}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-secondary)] group-hover:text-[var(--vermilion)] transition-colors">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="17 8 12 3 7 8" />
                                <line x1="12" x2="12" y1="3" y2="15" />
                            </svg>
                            <span className="font-bold text-xs text-[var(--text-secondary)] tracking-[0.2em] group-hover:text-white transition-colors uppercase">{t('drop_select', { defaultMessage: 'Drop or click to select' })}</span>
                        </div>
                        {uploadError && <p className="text-[var(--vermilion)] text-xs font-bold mt-4 tracking-wide">{uploadError}</p>}
                    </div>
                </div>
            )}

            {/* Cropping Modal */}
            {imageSrc && (
                <div className="fixed inset-0 z-[300] bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center overflow-hidden">
                    <div className="bg-[var(--bg-dark)] border border-[var(--hairline-strong)] w-full max-w-lg mx-auto shadow-2xl relative flex flex-col items-center">
                        <div className="w-full flex items-center justify-between px-6 py-4 border-b border-[var(--hairline-strong)]">
                            <p className="text-[10px] font-bold tracking-[0.3em] text-[var(--vermilion)] uppercase">Crop</p>
                            <h3 className="font-black text-sm tracking-widest uppercase">{t('crop_title', { defaultMessage: 'Crop Avatar' })}</h3>
                            <div className="w-12" />
                        </div>

                        <div className="relative w-full h-[350px]">
                            <Cropper
                                image={imageSrc}
                                crop={crop}
                                zoom={zoom}
                                aspect={1}
                                showGrid={false}
                                onCropChange={setCrop}
                                onZoomChange={setZoom}
                                onCropComplete={(_, croppedPixels) => setCroppedAreaPixels(croppedPixels)}
                            />
                        </div>

                        <div className="w-full grid grid-cols-2 border-t border-[var(--hairline-strong)]">
                            <button
                                onClick={() => setImageSrc(null)}
                                disabled={isUploading}
                                className="py-4 text-[var(--text-secondary)] hover:text-white uppercase tracking-widest text-xs font-bold transition-colors border-r border-[var(--hairline-strong)]"
                            >
                                {t('crop_cancel', { defaultMessage: 'Cancel' })}
                            </button>
                            <button
                                onClick={handleAvatarUpload}
                                disabled={isUploading}
                                className="py-4 bg-[var(--vermilion)] text-white hover:bg-red-600 uppercase tracking-widest text-xs font-black transition-colors disabled:opacity-50"
                            >
                                {isUploading ? t('avatar_uploading', { defaultMessage: 'Uploading...' }) : t('crop_apply', { defaultMessage: 'Apply' })}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden file input */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={onFileChange}
                accept="image/png, image/jpeg"
                className="hidden"
            />

            {/* Main Layout */}
            <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] border border-[var(--hairline-strong)]">

                {/* Left Panel */}
                <div className="border-b md:border-b-0 md:border-r border-[var(--hairline-strong)] flex flex-col">

                    {/* Mobile: compact horizontal identity strip */}
                    <div className="flex md:hidden items-stretch border-b border-[var(--hairline-strong)]">
                        {/* Small avatar */}
                        <div
                            className="relative group cursor-pointer overflow-hidden flex-shrink-0 w-24 border-r border-[var(--hairline-strong)]"
                            onClick={() => setAvatarModalOpen(true)}
                        >
                            {profile.picture_url ? (
                                <Image
                                    src={profile.picture_url}
                                    alt={profile.name}
                                    fill
                                    unoptimized
                                    className="object-cover transition-all duration-200 group-hover:brightness-50"
                                />
                            ) : (
                                <div className="absolute inset-0 bg-[var(--hairline)] flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--hairline-strong)]">
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                                    </svg>
                                </div>
                            )}
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
                                </svg>
                            </div>
                        </div>
                        {/* Identity + meta */}
                        <div className="flex flex-col justify-center px-4 py-4 flex-1 min-w-0 gap-1">
                            <h2 className="text-base font-black text-white tracking-wide truncate">{profile.name}</h2>
                            <p className="text-xs text-[var(--text-secondary)] truncate">{profile.email}</p>
                            <div className="flex gap-3 mt-1 font-mono text-[10px] text-[var(--text-secondary)]">
                                <span>UID <span className="text-[var(--vermilion)] font-bold">#{profile.id}</span></span>
                                <span>·</span>
                                <span>{formatDate(profile.created_at)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Desktop: full square avatar */}
                    <div
                        className="relative group cursor-pointer overflow-hidden border-b border-[var(--hairline-strong)] hidden md:block"
                        onClick={() => setAvatarModalOpen(true)}
                        style={{ aspectRatio: '1 / 1' }}
                    >
                        {profile.picture_url ? (
                            <Image
                                src={profile.picture_url}
                                alt={profile.name}
                                fill
                                unoptimized
                                className="object-cover transition-all duration-300 group-hover:brightness-40 group-hover:scale-105"
                            />
                        ) : (
                            <div className="absolute inset-0 bg-[var(--hairline)] flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--hairline-strong)]">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                                </svg>
                            </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/30">
                            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
                            </svg>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[var(--vermilion)] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    {/* Desktop: Identity Block */}
                    <div className="p-5 border-b border-[var(--hairline-strong)] hidden md:block">
                        <h2 className="text-lg font-black text-white tracking-wide truncate">{profile.name}</h2>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">{profile.email}</p>
                    </div>

                    {/* Desktop: Meta Info */}
                    <div className="font-mono text-xs flex-1 hidden md:block">
                        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--hairline)]">
                            <span className="text-[var(--text-secondary)] uppercase tracking-wider text-[10px]">{t('uid', { defaultMessage: 'User ID' })}</span>
                            <span className="text-[var(--vermilion)] font-bold">#{profile.id}</span>
                        </div>
                        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--hairline)]">
                            <span className="text-[var(--text-secondary)] uppercase tracking-wider text-[10px]">{t('joined', { defaultMessage: 'Joined' })}</span>
                            <span className="text-white">{formatDate(profile.created_at)}</span>
                        </div>
                        <div className="flex items-center justify-between px-5 py-3">
                            <span className="text-[var(--text-secondary)] uppercase tracking-wider text-[10px]">{t('last_login', { defaultMessage: 'Last Login' })}</span>
                            <span className="text-white">{profile.last_login ? formatDate(profile.last_login) : '—'}</span>
                        </div>
                    </div>
                </div>

                {/* Right Panel */}
                <div className="flex flex-col">

                    {/* Section Header */}
                    <div className="px-6 md:px-8 py-5 border-b border-[var(--hairline-strong)]">
                        <h3 className="text-base font-bold tracking-[0.05em] text-white">
                            {t('settings', { defaultMessage: 'Account Settings' })}
                        </h3>
                    </div>

                    {/* Form Fields */}
                    <div className="p-6 md:p-8 flex flex-col gap-0 flex-1">

                        {/* Display Name */}
                        <div className="border-b border-[var(--hairline)] pb-6 mb-6">
                            <label className="block text-sm font-bold tracking-[0.05em] text-[var(--vermilion)] mb-3">
                                {t('name', { defaultMessage: 'Display Name' })}
                            </label>
                            <input
                                type="text"
                                value={selectedName}
                                onChange={(e) => setSelectedName(e.target.value)}
                                placeholder={t('name_placeholder', { defaultMessage: 'Enter your display name...' })}
                                className="w-full bg-transparent border border-[var(--hairline-strong)] px-4 py-3 outline-none focus:border-[var(--vermilion)] transition-colors text-white text-sm font-medium placeholder:text-[var(--text-secondary)]/50"
                            />
                        </div>

                        {/* Email */}
                        <div className="border-b border-[var(--hairline)] pb-6 mb-6">
                            <label className="block text-sm font-bold tracking-[0.05em] text-[var(--vermilion)] mb-3">
                                {t('email', { defaultMessage: 'Email Address' })}
                            </label>
                            <input
                                type="email"
                                value={selectedEmail}
                                onChange={(e) => setSelectedEmail(e.target.value)}
                                placeholder={t('email_placeholder', { defaultMessage: 'Enter your email address...' })}
                                className="w-full bg-transparent border border-[var(--hairline-strong)] px-4 py-3 outline-none focus:border-[var(--vermilion)] transition-colors text-white text-sm font-medium placeholder:text-[var(--text-secondary)]/50"
                            />
                        </div>

                        {/* Two-column row for Age + Country */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-b border-[var(--hairline)] pb-6 mb-6">
                            {/* Age Range */}
                            <div>
                                <label className="block text-sm font-bold tracking-[0.05em] text-[var(--vermilion)] mb-1">
                                    {t('age_range', { defaultMessage: 'Age Range' })}
                                </label>
                                <p className="text-[11px] text-[var(--text-secondary)] mb-3">
                                    {t('age_range_desc', { defaultMessage: 'Helps us understand our community.' })}
                                </p>
                                <select
                                    value={selectedAge}
                                    onChange={(e) => setSelectedAge(e.target.value)}
                                    className="w-full bg-[var(--bg-dark)] border border-[var(--hairline-strong)] px-4 py-3 outline-none focus:border-[var(--vermilion)] transition-colors text-white text-sm font-medium"
                                >
                                    <option value="">{t('age_range_placeholder', { defaultMessage: 'Select age range...' })}</option>
                                    {AGE_RANGES.map((r) => (
                                        <option key={r.value} value={r.value}>
                                            {t(r.key as any, { defaultMessage: r.value })}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Country */}
                            <div>
                                <label className="block text-sm font-bold tracking-[0.05em] text-[var(--vermilion)] mb-1">
                                    {t('country', { defaultMessage: 'Country / Region' })}
                                </label>
                                <p className="text-[11px] text-[var(--text-secondary)] mb-3">
                                    {t('country_desc', { defaultMessage: 'Your region in the global community.' })}
                                </p>
                                <select
                                    value={selectedCountry}
                                    onChange={(e) => setSelectedCountry(e.target.value)}
                                    className="w-full bg-[var(--bg-dark)] border border-[var(--hairline-strong)] px-4 py-3 outline-none focus:border-[var(--vermilion)] transition-colors text-white text-sm font-medium"
                                >
                                    <option value="">{t('country_placeholder', { defaultMessage: 'Select a country...' })}</option>
                                    {COUNTRIES.map((c: { code: string, name: string }) => {
                                        let displayName = c.name;
                                        try {
                                            displayName = new Intl.DisplayNames([locale], { type: 'region' }).of(c.code) || c.name;
                                        } catch (e) {
                                            // Fallback to english
                                        }
                                        return (
                                            <option key={c.code} value={c.code}>{displayName}</option>
                                        );
                                    })}
                                </select>
                            </div>
                        </div>

                        {/* Save */}
                        <div className="flex items-center gap-4 mt-auto pt-2">
                            <button
                                onClick={handleSave}
                                disabled={saving || !hasChanges}
                                className="px-8 py-3.5 bg-[var(--vermilion)] text-white uppercase tracking-[0.25em] text-xs font-black hover:bg-red-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                {saving ? t('saving', { defaultMessage: 'Saving...' }) : t('save', { defaultMessage: 'Save Changes' })}
                            </button>

                            {saveMessage.text && (
                                <div className={`flex-1 text-xs px-4 py-3 font-bold tracking-wide border ${saveMessage.type === 'success' ? 'border-green-500/30 bg-green-500/5 text-green-400' : 'border-[var(--vermilion)]/30 bg-[var(--vermilion)]/5 text-[var(--vermilion)]'}`}>
                                    {saveMessage.text}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
