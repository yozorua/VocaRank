'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { API_BASE_URL } from '@/lib/api';
import { OfficialLive } from '@/types';
import OfficialLiveCard from '@/components/playlist/OfficialLiveCard';
import OfficialLiveForm from '@/components/playlist/OfficialLiveForm';

type Props = {
    initialLives: OfficialLive[];
};

export default function OfficialLivesSection({ initialLives }: Props) {
    const t = useTranslations('Playlist');
    const { data: session } = useSession();
    const router = useRouter();
    const isAdmin = session?.isAdmin;

    const [lives, setLives] = useState<OfficialLive[]>(initialLives);
    const [open, setOpen] = useState(() => {
        try { return localStorage.getItem('playlist_section_lives') === 'true'; } catch { return false; }
    });
    const [formOpen, setFormOpen] = useState(false);
    const [editingLive, setEditingLive] = useState<OfficialLive | null>(null);

    const handleDelete = async (live: OfficialLive) => {
        if (!confirm(t('live_delete_confirm', { name: live.name }))) return;
        const token = session?.apiToken;
        await fetch(`${API_BASE_URL}/official-lives/${live.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        });
        setLives(prev => prev.filter(l => l.id !== live.id));
    };

    const handleEdit = (live: OfficialLive) => {
        setEditingLive(live);
        setFormOpen(true);
    };

    const handleAdd = () => {
        setEditingLive(null);
        setFormOpen(true);
    };

    const handleSaved = () => {
        router.refresh();
    };

    if (lives.length === 0 && !isAdmin) return null;

    return (
        <div className="flex flex-col gap-3">
            {/* Section header — clickable to toggle */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => setOpen(v => {
                        const next = !v;
                        try { localStorage.setItem('playlist_section_lives', String(next)); } catch { /* */ }
                        return next;
                    })}
                    className="flex items-center gap-2 group"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="11" height="11"
                        viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" strokeWidth="2.5"
                        className={`text-[var(--text-secondary)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                    >
                        <polyline points="6 9 12 15 18 9" />
                    </svg>
                    <h2 className="text-sm font-semibold text-[var(--text-secondary)] tracking-[0.3em] uppercase group-hover:text-white transition-colors">
                        {t('official_lives')}
                    </h2>
                    <span className="text-xs text-[var(--text-secondary)] opacity-40">({lives.length})</span>
                </button>
                {isAdmin && (
                    <button
                        onClick={handleAdd}
                        className="text-xs text-[var(--text-secondary)] hover:text-[var(--vermilion)] border border-[var(--hairline)] hover:border-[var(--vermilion)]/40 px-3 py-1.5 transition-all"
                    >
                        + {t('add_live')}
                    </button>
                )}
            </div>

            {open && (
                <>
                    {lives.length === 0 ? (
                        <div className="glass-panel hairline-border px-8 py-8 text-center text-[var(--text-secondary)] text-sm">
                            {t('official_lives_empty')}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                            {lives.map(live => (
                                <OfficialLiveCard
                                    key={live.id}
                                    live={live}
                                    onEdit={isAdmin ? handleEdit : undefined}
                                    onDelete={isAdmin ? handleDelete : undefined}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}

            {formOpen && (
                <OfficialLiveForm
                    existingLive={editingLive}
                    onClose={() => { setFormOpen(false); setEditingLive(null); }}
                    onSaved={handleSaved}
                />
            )}
        </div>
    );
}
