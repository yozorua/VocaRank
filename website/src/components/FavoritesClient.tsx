'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { API_BASE_URL } from '@/lib/api';
import { SongRanking, Artist } from '@/types';
import RankingTable from '@/components/RankingTable';
import { Link } from '@/i18n/navigation';
import NoThumbnail from '@/components/NoThumbnail';
import { formatArtistType } from '@/lib/formatArtistType';

export default function FavoritesClient() {
    const { data: session, status } = useSession();
    const t = useTranslations('Favorites');
    const tSearch = useTranslations('SearchPage'); // For loading states

    const [activeTab, setActiveTab] = useState<'songs' | 'artists'>('songs');
    const [songs, setSongs] = useState<SongRanking[]>([]);
    const [artists, setArtists] = useState<Artist[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (status === 'unauthenticated') {
            window.location.href = '/'; // Direct bounce if not logged in
            return;
        }

        if (status === 'authenticated' && session?.apiToken) {
            fetchFavorites();
        }
    }, [status, session, activeTab]);

    const fetchFavorites = async () => {
        setLoading(true);
        try {
            const endpoint = activeTab === 'songs' ? 'songs' : 'artists';
            const res = await fetch(`${API_BASE_URL}/favorites/${endpoint}`, {
                headers: {
                    'Authorization': `Bearer ${session?.apiToken}`
                }
            });

            if (res.ok) {
                const data = await res.json();
                if (activeTab === 'songs') {
                    setSongs(data);
                } else {
                    setArtists(data);
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    if (status === 'loading') {
        return (
            <div className="w-full h-64 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-[var(--vermilion)] border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-5xl mx-auto flex flex-col gap-8">
            {/* Header row */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6 mb-6 md:mb-8 border-b border-[var(--hairline-strong)] pb-0">
                <div className="mb-4 md:mb-4 pt-2">
                    <h1 className="text-2xl md:text-3xl font-bold mb-2">{t('title')}</h1>
                    <p className="text-[var(--text-secondary)] text-sm md:text-base">
                        {t('description', { defaultMessage: 'Manage your saved content.' })}
                    </p>
                </div>

                {/* Tab Navigation */}
                <div className="flex gap-6 overflow-x-auto pb-3">
                    <button
                        onClick={() => setActiveTab('songs')}
                        className={`pb-3 border-b-2 transition-all font-bold whitespace-nowrap text-sm tracking-[0.1em] ${activeTab === 'songs' ? 'text-white border-[var(--vermilion)]' : 'text-[var(--text-secondary)] border-transparent hover:text-white'}`}
                    >
                        {t('songs', { defaultMessage: 'Songs' })}
                    </button>
                    <button
                        onClick={() => setActiveTab('artists')}
                        className={`pb-3 border-b-2 transition-all font-bold whitespace-nowrap text-sm tracking-[0.1em] ${activeTab === 'artists' ? 'text-white border-[var(--vermilion)]' : 'text-[var(--text-secondary)] border-transparent hover:text-white'}`}
                    >
                        {t('artists', { defaultMessage: 'Artists' })}
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="w-full min-h-[400px]">
                {loading ? (
                    <div className="w-full h-64 flex flex-col items-center justify-center gap-4 text-[var(--text-secondary)]">
                        <div className="w-6 h-6 border-2 border-[var(--hairline-strong)] border-t-[var(--vermilion)] rounded-full animate-spin"></div>
                        <p className="text-xs tracking-widest uppercase">{tSearch('loading', { defaultMessage: 'Loading...' })}</p>
                    </div>
                ) : activeTab === 'songs' ? (
                    songs.length > 0 ? (
                        <RankingTable songs={songs} mode="total" showRank={false} showShowMore={false} forceShowAll={true} />
                    ) : (
                        <div className="w-full h-64 flex flex-col items-center justify-center text-center gap-4 text-[var(--text-secondary)] border border-[var(--hairline)] bg-[var(--surface)]">
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-50">
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                            </svg>
                            <p className="text-sm tracking-widest uppercase opacity-70">
                                {t('no_favorites', { defaultMessage: 'No favorites found' })}
                            </p>
                        </div>
                    )
                ) : (
                    artists.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
                            {artists.map((artist) => (
                                <Link
                                    key={artist.id}
                                    href={`/artist/${artist.id}`}
                                    className="p-6 border border-[var(--hairline)] hover:border-[var(--vermilion)] transition-colors flex flex-col items-center text-center gap-5 group bg-[var(--surface)]"
                                >
                                    <div className="w-24 h-24 overflow-hidden bg-[var(--hairline)] flex items-center justify-center shrink-0">
                                        {artist.picture_url_thumb || artist.picture_url_original ? (
                                            <img
                                                src={artist.picture_url_thumb || artist.picture_url_original || ""}
                                                alt={artist.name_default}
                                                className="w-full h-full object-cover object-top transition-all duration-300"
                                            />
                                        ) : (
                                            <span className="text-2xl font-serif text-[var(--text-secondary)]">{artist.name_default.charAt(0)}</span>
                                        )}
                                    </div>
                                    <div className="min-w-0 w-full flex flex-col items-center">
                                        <div
                                            className="font-bold text-white group-hover:text-[var(--vermilion)] w-full tracking-widest transition-colors break-words line-clamp-2"
                                            title={artist.name_default}
                                        >
                                            {artist.name_default}
                                        </div>
                                        {artist.artist_type && (
                                            <div className="text-[10px] text-[var(--text-secondary)] tracking-[0.2em] mt-2">
                                                {formatArtistType(artist.artist_type)}
                                            </div>
                                        )}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <div className="w-full h-64 flex flex-col items-center justify-center text-center gap-4 text-[var(--text-secondary)] border border-[var(--hairline)] bg-[var(--surface)]">
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-50">
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                            </svg>
                            <p className="text-sm tracking-widest uppercase opacity-70">
                                {t('no_favorites', { defaultMessage: 'No favorites found' })}
                            </p>
                        </div>
                    )
                )}
            </div>
        </div>
    );
}
