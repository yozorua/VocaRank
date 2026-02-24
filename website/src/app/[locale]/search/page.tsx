import { searchSongs, searchArtists } from '@/lib/api';
import RankingTable from '@/components/RankingTable';
import { getTranslations } from 'next-intl/server';
import { SongRanking, Artist } from '@/types';
import { Link } from '@/i18n/navigation';
import SearchResultsClient from '@/components/SearchResultsClient';
import LiveSearchInput from '@/components/LiveSearchInput';

// Force dynamic since searchParams are used
export const dynamic = 'force-dynamic';

interface SearchPageProps {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
    params: Promise<{ locale: string }>;
}

export default async function SearchPage({ searchParams, params }: SearchPageProps) {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'SearchPage' });
    const sp = await searchParams;
    const query = typeof sp.q === 'string' ? sp.q : '';

    let songs: SongRanking[] = [];
    let artists: Artist[] = [];

    if (query) {
        try {
            const [songsData, artistsData] = await Promise.all([
                searchSongs(query),
                searchArtists(query)
            ]);
            songs = songsData;
            artists = artistsData;
        } catch (e) {
            console.error('Search failed', e);
        }
    }

    // Helper to pick name based on locale
    const getArtistName = (artist: Artist) => {
        if (locale === 'ja') return artist.name_japanese || artist.name_default;
        if (locale === 'en') return artist.name_english || artist.name_default;
        return artist.name_default;
    };

    return (
        <div className="max-w-[var(--max-width)] mx-auto px-6 py-12 md:py-16">
            <div className="mb-12">
                <h1 className="text-3xl lg:text-[2.5rem] font-black tracking-[0.05em] mb-8 text-white">{t('title')}</h1>
                <form action={`/${locale}/search`} method="GET" className="flex gap-2 relative">
                    <div className="flex-grow">
                        <LiveSearchInput
                            defaultValue={query}
                            placeholder={t('placeholder')}
                        />
                    </div>
                    <button
                        type="submit"
                        aria-label={t('search')}
                        className="bg-transparent border border-[var(--hairline-strong)] text-white hover:border-[var(--vermilion)] hover:text-[var(--vermilion)] font-bold px-4 md:px-10 py-3 uppercase tracking-widest text-xs transition-colors shrink-0 flex items-center justify-center"
                    >
                        <span className="hidden md:inline">{t('search')}</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="md:hidden">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                    </button>
                </form>
            </div>

            {query && (
                <div className="mb-8 text-[var(--text-secondary)]">
                    {t('results_for', { query })}
                </div>
            )}

            {/* Results handled by Client Component for Show More interaction */}
            {(artists.length > 0 || songs.length > 0) && (
                <SearchResultsClient query={query} initialSongs={songs} initialArtists={artists} />
            )}

            {!query && !songs.length && !artists.length && (
                <p className="text-center text-[var(--text-secondary)] mt-12">{t('no_query', { defaultMessage: 'Search for songs or artists...' })}</p>
            )}

            {query && !songs.length && !artists.length && (
                <p className="text-center text-[var(--text-secondary)] mt-12">{t('no_results')}</p>
            )}
        </div>
    );
}
