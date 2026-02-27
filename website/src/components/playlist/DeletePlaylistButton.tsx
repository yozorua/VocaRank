'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { API_BASE_URL } from '@/lib/api';

type Props = {
    playlistId: number;
    ownerId: number;
    locale: string;
    label: string;
    confirmLabel: string;
    cancelLabel: string;
};

export default function DeletePlaylistButton({ playlistId, ownerId, locale, label, confirmLabel, cancelLabel }: Props) {
    const { data: session } = useSession();
    const [confirming, setConfirming] = useState(false);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    if (!session) return null;

    const handleDelete = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/playlists/${playlistId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${(session as any)?.apiToken}` },
            });
            if (res.ok || res.status === 204) {
                router.push(`/${locale}/playlist`);
            }
        } finally {
            setLoading(false);
        }
    };

    if (!confirming) {
        return (
            <button
                onClick={() => setConfirming(true)}
                title={label}
                className="w-10 h-10 flex items-center justify-center border border-[var(--hairline)] text-[var(--text-secondary)] hover:border-red-500/50 hover:text-red-400 transition-all"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
                </svg>
            </button>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <button
                onClick={handleDelete}
                disabled={loading}
                className="px-3 py-1.5 text-xs border border-red-500/50 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
            >
                {loading ? (
                    <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                ) : confirmLabel}
            </button>
            <button
                onClick={() => setConfirming(false)}
                className="px-3 py-1.5 text-xs border border-[var(--hairline)] text-[var(--text-secondary)] hover:text-white transition-colors"
            >
                {cancelLabel}
            </button>
        </div>
    );
}
