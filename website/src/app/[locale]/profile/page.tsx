'use client';

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { fetcher } from "@/lib/api";
import { COUNTRIES } from "@/lib/countries";

interface UserProfile {
    id: number;
    email: string;
    name: string;
    picture_url: string;
    country: string | null;
    created_at: string;
}

export default function ProfilePage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const t = useTranslations('ProfilePage');

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedCountry, setSelectedCountry] = useState<string>("");
    const [saveMessage, setSaveMessage] = useState({ text: "", type: "" });

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
                    if (data.country) {
                        setSelectedCountry(data.country);
                    }
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
                body: JSON.stringify({ country: selectedCountry || null })
            });
            setSaveMessage({ text: t('save_success', { defaultMessage: 'Profile updated successfully!' }), type: 'success' });

            // Update local state
            if (profile) {
                setProfile({ ...profile, country: selectedCountry || null });
            }
        } catch (error) {
            console.error("Failed to update profile:", error);
            setSaveMessage({ text: t('save_error', { defaultMessage: 'Failed to update profile.' }), type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    if (status === "loading" || loading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <div className="text-[var(--text-secondary)] tracking-widest uppercase">{t('loading')}</div>
            </div>
        );
    }

    if (!profile) return null;

    return (
        <main className="max-w-4xl mx-auto px-6 py-12 md:py-20 animate-fade-in relative z-10">
            <h1 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight drop-shadow-md">
                {t('title')}
            </h1>

            <div className="bg-[var(--surface-light)] border border-[var(--hairline-strong)] p-8 mt-8 flex flex-col md:flex-row gap-12">
                {/* Left Column: Avatar & Basic Info */}
                <div className="flex flex-col items-center md:items-start md:w-1/3">
                    {profile.picture_url ? (
                        <Image
                            src={profile.picture_url}
                            alt={profile.name}
                            width={128}
                            height={128}
                            className="rounded-full border-2 border-[var(--hairline)] shadow-xl mb-6"
                        />
                    ) : (
                        <div className="w-32 h-32 rounded-full bg-[var(--hairline-strong)] mb-6"></div>
                    )}

                    <h2 className="text-2xl font-bold text-center md:text-left">{profile.name}</h2>
                    <p className="text-[var(--text-secondary)] text-sm mb-6">{profile.email}</p>

                    <div className="w-full bg-black/40 p-4 border border-[var(--hairline)] font-mono text-xs text-[var(--text-secondary)]">
                        <div className="mb-2"><span className="text-white">UID:</span> #{profile.id}</div>
                        <div><span className="text-white">Joined:</span> {new Date(profile.created_at).toLocaleDateString()}</div>
                    </div>
                </div>

                {/* Right Column: Editable Settings */}
                <div className="flex-1 border-t md:border-t-0 md:border-l border-[var(--hairline-strong)] pt-8 md:pt-0 md:pl-12">
                    <h3 className="text-xl font-bold mb-6 text-[var(--vermilion)] uppercase tracking-widest text-sm text-center md:text-left">
                        {t('settings', { defaultMessage: 'Account Settings' })}
                    </h3>

                    <div className="mb-8">
                        <label className="block text-sm uppercase tracking-wider text-[var(--text-secondary)] mb-3">
                            {t('country', { defaultMessage: 'Country / Region' })}
                        </label>
                        <p className="text-xs text-[var(--text-secondary)] mb-4">
                            {t('country_desc', { defaultMessage: 'Your region helps us understand the global Vocaloid community.' })}
                        </p>

                        <select
                            value={selectedCountry}
                            onChange={(e) => setSelectedCountry(e.target.value)}
                            className="w-full bg-black/40 border border-[var(--hairline-strong)] p-3 outline-none focus:border-[var(--vermilion)] transition-colors text-white mb-6"
                        >
                            <option value="">{t('country_placeholder', { defaultMessage: 'Select a country...' })}</option>
                            {COUNTRIES.map((c: { code: string, name: string }) => (
                                <option key={c.code} value={c.code}>{c.name}</option>
                            ))}
                        </select>

                        <button
                            onClick={handleSave}
                            disabled={saving || profile.country === selectedCountry || (!profile.country && !selectedCountry)}
                            className="px-8 py-3 bg-[var(--vermilion)] text-white uppercase tracking-widest text-sm font-bold hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto"
                        >
                            {saving ? t('saving', { defaultMessage: 'Saving...' }) : t('save', { defaultMessage: 'Save Changes' })}
                        </button>

                        {saveMessage.text && (
                            <div className={`mt-4 text-sm px-4 py-3 border ${saveMessage.type === 'success' ? 'border-green-500/50 bg-green-500/10 text-green-400' : 'border-red-500/50 bg-red-500/10 text-red-400'}`}>
                                {saveMessage.text}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
}
