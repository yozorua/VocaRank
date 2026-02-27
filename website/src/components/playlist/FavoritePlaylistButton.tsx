'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { API_BASE_URL } from '@/lib/api';

type Props = {
    playlistId: number;
    initialFavorited: boolean;
    initialCount: number;
    label: string; // localised "favorites" label
};

export default function FavoritePlaylistButton({ playlistId, initialFavorited, initialCount, label }: Props) {
    const { data: session } = useSession();
    const [favorited, setFavorited] = useState(initialFavorited);
    const [count, setCount] = useState(initialCount);
    const [loading, setLoading] = useState(false);

    if (!session) return null;

    const toggle = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/playlists/${playlistId}/favorite`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${(session as any)?.apiToken}` },
            });
            if (res.ok) {
                const data = await res.json();
                setFavorited(data.is_favorited);
                setCount(data.favorite_count);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={toggle}
            disabled={loading}
            className={`flex items-center gap-2 px-4 py-2 text-sm border transition-all duration-200
        ${favorited
                    ? 'border-[var(--vermilion)] text-[var(--vermilion)] bg-[var(--vermilion)]/10'
                    : 'border-[var(--hairline)] text-[var(--text-secondary)] hover:border-[var(--vermilion)] hover:text-[var(--vermilion)]'
                }`}
        >
            <span>{favorited ? '♥' : '♡'}</span>
            <span>{count} {label}</span>
        </button>
    );
}
