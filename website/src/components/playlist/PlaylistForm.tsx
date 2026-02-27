'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { API_BASE_URL } from '@/lib/api';

type Props = {
    locale: string;
    existingPlaylist?: {
        id: number;
        title: string;
        description?: string | null;
        is_public: number;
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
    };
};

export default function PlaylistForm({ locale, existingPlaylist, t, iconOnly }: Props) {
    const { data: session } = useSession();
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState(existingPlaylist?.title ?? '');
    const [desc, setDesc] = useState(existingPlaylist?.description ?? '');
    const [isPublic, setIsPublic] = useState(existingPlaylist?.is_public ?? 1);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    if (!session) return null;

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
                setOpen(false);
                if (!existingPlaylist) {
                    // redirect to the new playlist's detail page
                    const created = await res.json();
                    router.push(`/${locale}/playlist/${created.id}`);
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

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    onClick={() => setOpen(false)}>
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
                    <form
                        className="relative glass-panel hairline-border p-8 w-full max-w-md flex flex-col gap-5"
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
