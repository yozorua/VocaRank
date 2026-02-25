'use client';

import { useState } from 'react';
import { SongRanking } from '@/types';
import { useTranslations } from 'next-intl';
import RankingTable from '@/components/RankingTable';
import { getArtistSongs } from '@/lib/api';

interface ArtistSongsClientProps {
    artistId: number;
    initialSongs: SongRanking[];
}

export default function ArtistSongsClient({ artistId, initialSongs }: ArtistSongsClientProps) {
    const tSearch = useTranslations('SearchPage'); // Reusing 'show_more' and 'loading' from SearchPage
    const tArtist = useTranslations('ArtistPage'); // For 'popular' and 'latest'

    const [songs, setSongs] = useState<SongRanking[]>(initialSongs);
    const [loading, setLoading] = useState(false);
    const [limit, setLimit] = useState(100);
    const [hasMore, setHasMore] = useState(initialSongs.length >= 100);
    const [sortBy, setSortBy] = useState<'total_views' | 'publish_date'>('total_views');

    const handleSortChange = async (newSort: 'total_views' | 'publish_date') => {
        if (loading || newSort === sortBy) return;
        setLoading(true);
        setSortBy(newSort);
        const resetLimit = 100;
        try {
            const sortedSongs = await getArtistSongs(artistId, resetLimit, newSort);
            setSongs(sortedSongs);
            setLimit(resetLimit);
            setHasMore(sortedSongs.length >= resetLimit);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleLoadMore = async () => {
        if (loading || !hasMore) return;
        setLoading(true);
        const nextLimit = limit + 100;
        try {
            const moreSongs = await getArtistSongs(artistId, nextLimit, sortBy);
            setSongs(moreSongs);
            setLimit(nextLimit);
            setHasMore(moreSongs.length >= nextLimit);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            {/* Header + Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-6 border-b border-[var(--hairline)] pb-4">
                <h2 className="text-xl font-bold tracking-[0.2em] text-[var(--text-secondary)] uppercase flex items-center gap-4">
                    {tArtist('top_songs', { defaultMessage: 'Top Songs' })}
                </h2>

                {/* Square Editorial Toggle */}
                <div className="flex gap-4">
                    <button
                        onClick={() => handleSortChange('total_views')}
                        disabled={loading}
                        className={`pb-1 border-b-2 text-sm font-bold tracking-widest uppercase transition-all ${sortBy === 'total_views' ? 'border-[var(--vermilion)] text-white' : 'border-transparent text-[var(--text-secondary)] hover:text-white hover:border-[var(--hairline-strong)]'}`}
                    >
                        {tArtist('popular', { defaultMessage: 'Popular' })}
                    </button>
                    <button
                        onClick={() => handleSortChange('publish_date')}
                        disabled={loading}
                        className={`pb-1 border-b-2 text-sm font-bold tracking-widest uppercase transition-all ${sortBy === 'publish_date' ? 'border-[var(--vermilion)] text-white' : 'border-transparent text-[var(--text-secondary)] hover:text-white hover:border-[var(--hairline-strong)]'}`}
                    >
                        {tArtist('latest', { defaultMessage: 'Latest' })}
                    </button>
                </div>
            </div>

            <RankingTable songs={songs} mode="total" showRank={false} showShowMore={false} forceShowAll={true} />

            {hasMore && (
                <div className="mt-8 flex justify-center pb-8 border-t-0">
                    <button
                        onClick={handleLoadMore}
                        disabled={loading}
                        className="group flex items-center gap-3 px-10 py-4 text-[var(--text-secondary)] hover:text-white font-medium text-xs tracking-[0.3em] uppercase transition-all border border-[var(--hairline-strong)] hover:border-[var(--vermilion)] hover:text-[var(--vermilion)] disabled:opacity-50"
                    >
                        {loading ? tSearch('loading', { defaultMessage: 'Loading...' }) : tSearch('show_more', { defaultMessage: 'Show More' })}
                        {!loading && (
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:translate-y-0.5">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}
