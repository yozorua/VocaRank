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
        <main className="max-w-4xl mx-auto px-6 py-12 md:py-20 animate-fade-in relative z-10">
            {/* Avatar Upload Selection Modal */}
            {isAvatarModalOpen && !imageSrc && (
                <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-4">
                    <div className="bg-[var(--surface-light)] border border-[var(--hairline-strong)] w-full max-w-md mx-auto shadow-2xl relative flex flex-col items-center p-8 rounded-xl animate-fade-in text-center">
                        <button
                            onClick={() => setAvatarModalOpen(false)}
                            className="absolute top-4 right-4 text-[var(--text-secondary)] hover:text-white transition-colors"
                            aria-label="Close"
                        >
                            ✕
                        </button>
                        <h3 className="text-xl font-bold tracking-widest uppercase mb-2 text-white">{t('crop_title', { defaultMessage: 'Upload Avatar' })}</h3>
                        <p className="text-sm text-[var(--text-secondary)] mb-6">{t('avatar_desc', { defaultMessage: 'Click to upload a custom avatar. Max size: 5MB (JPEG, PNG).' })}</p>

                        <div
                            className={`w-full border-2 border-dashed transition-all rounded-xl p-10 cursor-pointer flex flex-col items-center justify-center gap-4 group ${isDragging ? 'border-[var(--vermilion)] bg-[var(--vermilion)]/10' : 'border-[var(--hairline-strong)] hover:border-[var(--vermilion)] hover:bg-[var(--vermilion)]/5'}`}
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={onDragOver}
                            onDragLeave={onDragLeave}
                            onDrop={onDrop}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-secondary)] group-hover:text-[var(--vermilion)] transition-colors">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="17 8 12 3 7 8" />
                                <line x1="12" x2="12" y1="3" y2="15" />
                            </svg>
                            <span className="font-bold text-sm text-[var(--text-secondary)] tracking-wider group-hover:text-white transition-colors">SELECT IMAGE FILE</span>
                        </div>
                        {uploadError && <p className="text-[var(--vermilion)] text-sm font-bold mt-4 animate-shake">{uploadError}</p>}
                    </div>
                </div>
            )}

            {/* Cropping Modal */}
            {imageSrc && (
                <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center overflow-hidden">
                    <div className="bg-[var(--surface-light)] border border-[var(--hairline-strong)] w-full max-w-lg mx-auto shadow-2xl relative flex flex-col items-center">
                        <div className="w-full text-center p-4 border-b border-[var(--hairline-strong)]">
                            <h3 className="font-bold text-lg tracking-widest uppercase">{t('crop_title', { defaultMessage: 'Crop Avatar' })}</h3>
                        </div>

                        <div className="relative w-full h-[350px]">
                            <Cropper
                                image={imageSrc}
                                crop={crop}
                                zoom={zoom}
                                aspect={1}
                                cropShape="round"
                                showGrid={false}
                                onCropChange={setCrop}
                                onZoomChange={setZoom}
                                onCropComplete={(_, croppedPixels) => setCroppedAreaPixels(croppedPixels)}
                            />
                        </div>

                        <div className="w-full p-4 flex gap-4 border-t border-[var(--hairline-strong)]">
                            <button
                                onClick={() => setImageSrc(null)}
                                disabled={isUploading}
                                className="flex-1 py-3 text-[var(--text-secondary)] hover:text-white uppercase tracking-widest text-xs font-bold transition-colors"
                            >
                                {t('crop_cancel', { defaultMessage: 'Cancel' })}
                            </button>
                            <button
                                onClick={handleAvatarUpload}
                                disabled={isUploading}
                                className="flex-1 py-3 bg-[var(--vermilion)] text-white hover:bg-red-600 uppercase tracking-widest text-xs font-bold transition-colors disabled:opacity-50"
                            >
                                {isUploading ? t('avatar_uploading', { defaultMessage: 'Uploading...' }) : t('crop_apply', { defaultMessage: 'Apply' })}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <h1 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight drop-shadow-md">
                {t('title')}
            </h1>

            <div className="bg-[var(--bg-dark)]/50 backdrop-blur-xl border border-[var(--hairline-strong)] p-8 mt-8 flex flex-col md:flex-row gap-12 rounded-xl shadow-[0_0_40px_rgba(255,51,51,0.03)] relative overflow-hidden">

                {/* Decorative Elements */}
                <div className="absolute -top-[100px] -right-[100px] w-[300px] h-[300px] bg-[var(--vermilion)]/10 rounded-full blur-[100px] pointer-events-none"></div>

                {/* Left Column: Avatar & Basic Info */}
                <div className="flex flex-col items-center md:w-1/3 relative z-10">
                    <div
                        className="relative group cursor-pointer mb-6 rounded-full overflow-hidden border-4 border-[var(--vermilion)]/30 shadow-[0_0_30px_rgba(255,51,51,0.2)]"
                        onClick={() => setAvatarModalOpen(true)}
                    >
                        {profile.picture_url ? (
                            <Image
                                src={profile.picture_url}
                                alt={profile.name}
                                width={140}
                                height={140}
                                unoptimized
                                className="transition-all duration-300 group-hover:brightness-50 object-cover w-[140px] h-[140px]"
                            />
                        ) : (
                            <div className="w-[140px] h-[140px] bg-[var(--hairline-strong)] transition-colors group-hover:brightness-50 shadow-inner"></div>
                        )}

                        <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-1">
                                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                                <circle cx="12" cy="13" r="4"></circle>
                            </svg>
                            <span className="text-[10px] uppercase font-bold text-white tracking-widest text-center px-2 leading-tight">
                                {t('avatar', { defaultMessage: 'Profile Picture' })}
                            </span>
                        </div>
                    </div>

                    <h2 className="text-xl font-black mb-8 text-white tracking-widest drop-shadow-md text-center">{profile.name}</h2>

                    {/* Hidden input for Avatar */}
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={onFileChange}
                        accept="image/png, image/jpeg"
                        className="hidden"
                    />

                    <div className="w-full bg-[var(--surface-light)] p-5 border border-[var(--hairline)] rounded-lg font-mono text-xs text-[var(--text-secondary)] shadow-inner">
                        <div className="mb-3 flex justify-between items-center border-b border-[var(--hairline)] pb-2">
                            <span className="text-white">{t('uid', { defaultMessage: 'User ID' })}:</span>
                            <span className="text-[var(--vermilion)] font-bold">#{profile.id}</span>
                        </div>
                        <div className="mb-3 flex justify-between items-center border-b border-[var(--hairline)] pb-2">
                            <span className="text-white">{t('joined', { defaultMessage: 'Joined' })}:</span>
                            <span>{new Date(profile.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-white">{t('last_login', { defaultMessage: 'Last Login' })}:</span>
                            <span>{profile.last_login ? new Date(profile.last_login).toLocaleDateString() : 'N/A'}</span>
                        </div>
                    </div>
                </div>

                {/* Right Column: Editable Settings */}
                <div className="flex-1 pt-8 md:pt-0 relative z-10">
                    <h3 className="text-2xl font-black mb-8 text-white uppercase tracking-widest border-b border-[var(--hairline-strong)] pb-4">
                        {t('settings', { defaultMessage: 'Account Settings' })}
                    </h3>

                    {/* Display Name Input */}
                    <div className="mb-8 group">
                        <label className="block text-xs font-bold uppercase tracking-[0.2em] text-[var(--vermilion)] mb-3">
                            {t('name', { defaultMessage: 'Display Name' })}
                        </label>
                        <input
                            type="text"
                            value={selectedName}
                            onChange={(e) => setSelectedName(e.target.value)}
                            placeholder={t('name_placeholder', { defaultMessage: 'Enter your display name...' })}
                            className="w-full bg-[var(--surface-light)] border border-[var(--hairline-strong)] p-4 outline-none focus:border-[var(--vermilion)] focus:bg-[var(--surface)] transition-all text-white rounded-lg shadow-sm font-medium"
                        />
                    </div>

                    {/* Email Input */}
                    <div className="mb-8 group">
                        <label className="block text-xs font-bold uppercase tracking-[0.2em] text-[var(--vermilion)] mb-3">
                            {t('email', { defaultMessage: 'Email Address' })}
                        </label>
                        <input
                            type="email"
                            value={selectedEmail}
                            onChange={(e) => setSelectedEmail(e.target.value)}
                            placeholder={t('email_placeholder', { defaultMessage: 'Enter your email address...' })}
                            className="w-full bg-[var(--surface-light)] border border-[var(--hairline-strong)] p-4 outline-none focus:border-[var(--vermilion)] focus:bg-[var(--surface)] transition-all text-white rounded-lg shadow-sm font-medium"
                        />
                    </div>

                    {/* Age Range Dropdown */}
                    <div className="mb-8 group">
                        <label className="block text-xs font-bold uppercase tracking-[0.2em] text-[var(--vermilion)] mb-2">
                            {t('age_range', { defaultMessage: 'Age Range' })}
                        </label>
                        <p className="text-xs text-[var(--text-secondary)] mb-4 pl-1">
                            {t('age_range_desc', { defaultMessage: 'This helps us understand our demographic.' })}
                        </p>
                        <select
                            value={selectedAge}
                            onChange={(e) => setSelectedAge(e.target.value)}
                            className="w-full bg-[var(--surface-light)] border border-[var(--hairline-strong)] p-4 outline-none focus:border-[var(--vermilion)] transition-all text-white rounded-lg shadow-sm font-medium"
                        >
                            <option value="">{t('age_range_placeholder', { defaultMessage: 'Select an age range...' })}</option>
                            {AGE_RANGES.map((r) => (
                                <option key={r.value} value={r.value}>
                                    {t(r.key as any, { defaultMessage: r.value })}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Country Dropdown */}
                    <div className="mb-10 group">
                        <label className="block text-xs font-bold uppercase tracking-[0.2em] text-[var(--vermilion)] mb-2">
                            {t('country', { defaultMessage: 'Country / Region' })}
                        </label>
                        <p className="text-xs text-[var(--text-secondary)] mb-4 pl-1">
                            {t('country_desc', { defaultMessage: 'Your region helps us understand the global Vocaloid community.' })}
                        </p>

                        <select
                            value={selectedCountry}
                            onChange={(e) => setSelectedCountry(e.target.value)}
                            className="w-full bg-[var(--surface-light)] border border-[var(--hairline-strong)] p-4 outline-none focus:border-[var(--vermilion)] transition-all text-white rounded-lg shadow-sm font-medium"
                        >
                            <option value="">{t('country_placeholder', { defaultMessage: 'Select a country...' })}</option>
                            {COUNTRIES.map((c: { code: string, name: string }) => {
                                let displayName = c.name;
                                try {
                                    displayName = new Intl.DisplayNames([locale], { type: 'region' }).of(c.code) || c.name;
                                } catch (e) {
                                    // Fallback to english if unsupported
                                }
                                return (
                                    <option key={c.code} value={c.code}>{displayName}</option>
                                );
                            })}
                        </select>
                    </div>

                    {/* Save Button */}
                    <button
                        onClick={handleSave}
                        disabled={saving || !hasChanges}
                        className="px-8 py-4 bg-[var(--vermilion)] text-white uppercase tracking-[0.3em] text-sm font-black hover:bg-red-600 transition-all disabled:opacity-30 disabled:hover:scale-100 disabled:cursor-not-allowed w-full rounded-lg shadow-[0_10px_20px_rgba(255,51,51,0.2)] hover:shadow-[0_15px_30px_rgba(255,51,51,0.4)] hover:-translate-y-1"
                    >
                        {saving ? t('saving', { defaultMessage: 'Saving...' }) : t('save', { defaultMessage: 'Save Changes' })}
                    </button>

                    {saveMessage.text && (
                        <div className={`mt-6 text-sm px-6 py-4 rounded-lg font-medium border ${saveMessage.type === 'success' ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>
                            {saveMessage.text}
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
