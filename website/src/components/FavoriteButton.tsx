'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { API_BASE_URL } from '@/lib/api';
import { useLocale } from 'next-intl';

interface FavoriteButtonProps {
    id: number;
    type: 'song' | 'artist';
    initialState?: boolean;
    variant?: 'icon' | 'block' | 'small';
}

export default function FavoriteButton({ id, type, initialState = false, variant = 'icon' }: FavoriteButtonProps) {
    const { data: session } = useSession();
    const [isFavorite, setIsFavorite] = useState(initialState);
    const [isLoading, setIsLoading] = useState(false);
    const locale = useLocale();

    const favText = locale === 'ja' ? 'お気に入りに追加' : locale === 'zh-TW' ? '加入最愛' : 'Favorite';
    const favedText = locale === 'ja' ? 'お気に入り済み' : locale === 'zh-TW' ? '已加入最愛' : 'Favorited';

    useEffect(() => {
        if (!session?.apiToken) return;

        const checkStatus = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/favorites/${type}/${id}/check`, {
                    headers: { 'Authorization': `Bearer ${session.apiToken}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setIsFavorite(data.is_favorite);
                }
            } catch (e) {
                console.error(e);
            }
        };

        checkStatus();
    }, [session, id, type]);

    const toggleFavorite = async () => {
        if (!session?.apiToken) {
            alert("Please login via the top menu to favorite entries!");
            return;
        }

        setIsLoading(true);
        const method = isFavorite ? 'DELETE' : 'POST';
        const url = `${API_BASE_URL}/favorites/${type}/${id}`;

        try {
            const res = await fetch(url, {
                method,
                headers: {
                    'Authorization': `Bearer ${session.apiToken}`
                }
            });
            if (res.ok) {
                const data = await res.json();
                setIsFavorite(data.is_favorite);
            }
        } catch (e) {
            console.error("Failed to favorite:", e);
        } finally {
            setIsLoading(false);
        }
    };

    if (variant === 'small') {
        return (
            <button
                onClick={toggleFavorite}
                disabled={isLoading}
                className={`
                    flex items-center gap-2 px-3 py-1.5 border rounded-none transition-all duration-300 group
                    bg-transparent
                    ${isFavorite
                        ? 'border-[var(--vermilion)] text-[var(--vermilion)] shadow-[inset_0_0_8px_rgba(255,68,51,0.2)]'
                        : 'border-[var(--hairline-strong)] hover:border-white/30 text-[var(--text-secondary)] hover:text-white hover:bg-white/5'}
                `}
            >
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold tracking-[0.1em] uppercase transition-colors">
                        {isFavorite ? favedText : favText}
                    </span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`${isLoading ? "animate-pulse" : ""} ${isFavorite ? '' : 'group-hover:scale-110'} transition-transform`}>
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                </div>
            </button>
        );
    }

    if (variant === 'block') {
        return (
            <button
                onClick={toggleFavorite}
                disabled={isLoading}
                className={`
                    relative p-4 md:p-5 flex items-center justify-between border transition-all duration-300 group
                    w-full h-full
                    ${isFavorite
                        ? 'border-[var(--vermilion)] bg-[var(--vermilion)]/5 text-[var(--vermilion)]'
                        : 'border-[var(--hairline)] bg-transparent hover:border-white/30 text-[var(--text-secondary)] hover:text-white'}
                `}
            >
                <div className="flex items-center gap-3">
                    <span className="text-[10px] md:text-sm font-bold tracking-[0.2em] uppercase transition-colors">
                        {isFavorite ? favedText : favText}
                    </span>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={`${isLoading ? "animate-pulse" : ""} ${isFavorite ? 'drop-shadow-[0_0_8px_rgba(255,68,51,0.5)]' : 'group-hover:scale-110'} transition-transform`}>
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
            </button>
        );
    }

    return (
        <button
            onClick={toggleFavorite}
            disabled={isLoading}
            className={`transition-all duration-300 transform hover:scale-110 flex-shrink-0 ${isFavorite ? 'text-[var(--vermilion)]' : 'text-gray-600 hover:text-white'}`}
            title={isFavorite ? "Unfavorite" : "Favorite"}
        >
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={isLoading ? "animate-pulse" : ""}>
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
        </button>
    );
}
