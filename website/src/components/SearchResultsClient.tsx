'use client';

import { useState } from 'react';
import { SongRanking, Artist } from '@/types';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import RankingTable from '@/components/RankingTable';
import { searchSongs, searchArtists } from '@/lib/api';
import { formatArtistType } from '@/lib/formatArtistType';

interface SearchResultsClientProps {
    query: string;
    initialSongs: SongRanking[];
    initialArtists: Artist[];
}

export default function SearchResultsClient({ query, initialSongs, initialArtists }: SearchResultsClientProps) {
    const t = useTranslations('SearchPage');
    const locale = useLocale();

    const [songs, setSongs] = useState<SongRanking[]>(initialSongs);
    const [artists, setArtists] = useState<Artist[]>(initialArtists);

    const [songLimit, setSongLimit] = useState(20);
    const [artistLimit, setArtistLimit] = useState(10);

    const [loadingSongs, setLoadingSongs] = useState(false);
    const [loadingArtists, setLoadingArtists] = useState(false);

    const [hasMoreSongs, setHasMoreSongs] = useState(initialSongs.length >= 20);
    const [hasMoreArtists, setHasMoreArtists] = useState(initialArtists.length >= 10);

    const getArtistName = (artist: Artist) => {
        if (locale === 'ja') return artist.name_japanese || artist.name_default;
        if (locale === 'en') return artist.name_english || artist.name_default;
        return artist.name_default;
    };

    const handleLoadMoreSongs = async () => {
        if (loadingSongs || !hasMoreSongs) return;
        setLoadingSongs(true);
        // Next limits: 20 -> 100 -> 200 -> 300...
        const nextLimit = songLimit === 20 ? 100 : songLimit + 100;
        try {
            const moreSongs = await searchSongs(query, nextLimit);
            setSongs(moreSongs);
            setSongLimit(nextLimit);
            setHasMoreSongs(moreSongs.length >= nextLimit);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingSongs(false);
        }
    };

    const handleLoadMoreArtists = async () => {
        if (loadingArtists || !hasMoreArtists) return;
        setLoadingArtists(true);
        // Next limits: 10 -> 50 -> 100 -> 150...
        const nextLimit = artistLimit === 10 ? 50 : artistLimit + 50;
        try {
            const moreArtists = await searchArtists(query, nextLimit);
            setArtists(moreArtists);
            setArtistLimit(nextLimit);
            setHasMoreArtists(moreArtists.length >= nextLimit);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingArtists(false);
        }
    };

    return (
        <>
            {/* Artists Section */}
            {artists.length > 0 && (
                <div className="mb-16">
                    <h2 className="text-sm font-bold tracking-[0.2em] text-[var(--text-secondary)] uppercase mb-6 flex items-center gap-4">
                        {t('artists', { defaultMessage: 'Artists' })}
                        <div className="h-px flex-1 bg-[var(--hairline)]"></div>
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                        {artists.map((artist) => {
                            const thumb = artist.picture_url_thumb || artist.picture_url_original;
                            return (
                                <Link
                                    key={artist.id}
                                    href={`/artist/${artist.id}`}
                                    className="p-6 border border-[var(--hairline)] hover:border-[var(--vermilion)] transition-colors flex flex-col items-center text-center gap-5 group bg-[var(--bg-dark)]"
                                >
                                    <div className="w-24 h-24 overflow-hidden bg-[var(--hairline)] flex items-center justify-center shrink-0">
                                        {thumb ? (
                                            <img src={thumb} alt={artist.name_default} className="w-full h-full object-cover object-top transition-all duration-300" />
                                        ) : (
                                            <span className="text-2xl font-serif text-[var(--text-secondary)]">{artist.name_default.charAt(0)}</span>
                                        )}
                                    </div>
                                    <div className="min-w-0 w-full flex flex-col items-center">
                                        <div
                                            className="font-bold text-white group-hover:text-[var(--gold)] w-full tracking-widest transition-colors break-words line-clamp-2"
                                            title={getArtistName(artist)}
                                        >
                                            {getArtistName(artist)}
                                        </div>
                                        <div className="text-[10px] text-[var(--text-secondary)] tracking-[0.2em] mt-2">{formatArtistType(artist.artist_type)}</div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                    {hasMoreArtists && (
                        <div className="mt-8 flex justify-center pb-8 border-b border-[var(--hairline)]">
                            <button
                                onClick={handleLoadMoreArtists}
                                disabled={loadingArtists}
                                className="group flex items-center gap-3 px-10 py-4 text-[var(--text-secondary)] hover:text-white font-medium text-xs tracking-[0.3em] uppercase transition-all border border-[var(--hairline-strong)] hover:border-[var(--vermilion)] hover:text-[var(--vermilion)] disabled:opacity-50"
                            >
                                {loadingArtists ? t('loading', { defaultMessage: 'Loading...' }) : t('show_more', { defaultMessage: 'Show More' })}
                                {!loadingArtists && (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:translate-y-0.5">
                                        <polyline points="6 9 12 15 18 9"></polyline>
                                    </svg>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Songs Section */}
            {songs.length > 0 && (
                <div className="mb-16">
                    <h2 className="text-sm font-bold tracking-[0.2em] text-[var(--text-secondary)] uppercase mb-6 flex items-center gap-4">
                        {t('songs', { defaultMessage: 'Songs' })}
                        <div className="h-px flex-1 bg-[var(--hairline)]"></div>
                    </h2>
                    <RankingTable songs={songs} mode="total" showRank={false} showShowMore={false} forceShowAll={true} />

                    {hasMoreSongs && (
                        <div className="mt-8 flex justify-center pb-8">
                            <button
                                onClick={handleLoadMoreSongs}
                                disabled={loadingSongs}
                                className="group flex items-center gap-3 px-10 py-4 text-[var(--text-secondary)] hover:text-white font-medium text-xs tracking-[0.3em] uppercase transition-all border border-[var(--hairline-strong)] hover:border-[var(--vermilion)] hover:text-[var(--vermilion)] disabled:opacity-50"
                            >
                                {loadingSongs ? t('loading', { defaultMessage: 'Loading...' }) : t('show_more', { defaultMessage: 'Show More' })}
                                {!loadingSongs && (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:translate-y-0.5">
                                        <polyline points="6 9 12 15 18 9"></polyline>
                                    </svg>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </>
    );
}
