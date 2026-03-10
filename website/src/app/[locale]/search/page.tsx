import { searchSongs, searchArtists, getArtist } from '@/lib/api';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'SearchPage' });
    return {
        title: t('title'),
        description: t('description'),
        openGraph: { title: t('title'), description: t('description') },
    };
}
import { SongRanking, Artist } from '@/types';
import { Link } from '@/i18n/navigation';
import SearchResultsClient from '@/components/SearchResultsClient';
import SearchPageInputClient from '@/components/SearchPageInputClient';
import AdvancedSearchFiltersClient from '@/components/AdvancedSearchFiltersClient';
import type { AdvancedFilters } from '@/components/AdvancedSearchFilters';
import { DEFAULT_FILTERS } from '@/components/AdvancedSearchFilters';

// Force dynamic since searchParams are used
export const dynamic = 'force-dynamic';

interface SearchPageProps {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
    params: Promise<{ locale: string }>;
}

function sp2str(v: string | string[] | undefined): string {
    return typeof v === 'string' ? v : '';
}

export default async function SearchPage({ searchParams, params }: SearchPageProps) {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'SearchPage' });
    const sp = await searchParams;

    const query = sp2str(sp.q);

    // Parse filter params from URL
    const filters: AdvancedFilters = {
        vocalist_ids: sp2str(sp.vocalist_ids),
        vocalist_exclusive: sp2str(sp.vocalist_exclusive) === 'true',
        sort_by: sp2str(sp.sort_by) || DEFAULT_FILTERS.sort_by,
        publish_date_start: sp2str(sp.date_start),
        publish_date_end: sp2str(sp.date_end),
        song_type: sp2str(sp.song_type),
    };

    let songs: SongRanking[] = [];
    let artists: Artist[] = [];

    // Pre-load vocalist names for selected IDs (needed for SSR display of tags)
    let initialSelectedVocalists: { id: number; name: string; artist_type: string; picture_url_thumb: string | null }[] = [];

    if (filters.vocalist_ids) {
        const ids = filters.vocalist_ids.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id));
        if (ids.length > 0) {
            try {
                const artistsData = await Promise.all(ids.map(id => getArtist(id)));
                initialSelectedVocalists = artistsData.filter(Boolean).map(a => ({
                    id: a.id,
                    name: a.name_default,
                    artist_type: a.artist_type,
                    picture_url_thumb: a.picture_url_thumb
                }));
            } catch (e) {
                console.error('Failed to pre-load selected vocalists', e);
            }
        }
    }

    const hasActiveFilters = filters.vocalist_ids || filters.sort_by !== DEFAULT_FILTERS.sort_by ||
        filters.publish_date_start || filters.publish_date_end || filters.song_type;

    if (query || hasActiveFilters) {
        try {
            const [songsData, artistsData] = await Promise.all([
                searchSongs(query || '', {
                    limit: 20,
                    vocaloid_only: true,
                    song_type: filters.song_type || undefined,
                    vocalist_ids: filters.vocalist_ids || undefined,
                    vocalist_exclusive: filters.vocalist_exclusive || undefined,
                    sort_by: filters.sort_by !== DEFAULT_FILTERS.sort_by ? filters.sort_by : undefined,
                    publish_date_start: filters.publish_date_start || undefined,
                    publish_date_end: filters.publish_date_end || undefined,
                }),
                query ? searchArtists(query) : Promise.resolve([]),
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
        <div className="max-w-[var(--max-width)] mx-auto px-6 py-2 md:py-2">
            <div className="mb-4 md:mb-4 pt-2">
                <h1 className="text-2xl md:text-3xl font-bold mb-2">{t('title')}</h1>
                <p className="text-[var(--text-secondary)] text-sm md:text-base">{t('description')}</p>
            </div>

            <div className="mb-6 md:mb-10">
                {/* Main search bar */}
                <div className="flex gap-2 relative">
                    <div className="flex-grow">
                        <SearchPageInputClient
                            defaultValue={query}
                            placeholder={t('placeholder')}
                        />
                    </div>
                </div>

                {/* Advanced filters — client component that writes hidden inputs into the form */}
                <AdvancedSearchFiltersClient
                    initialFilters={filters}
                    initialSelectedVocalists={initialSelectedVocalists}
                    locale={locale}
                    currentQuery={query}
                />
            </div>



            {/* Results handled by Client Component for Show More interaction */}
            {
                (artists.length > 0 || songs.length > 0) && (
                    <SearchResultsClient
                        key={`${query}-${JSON.stringify(filters)}`}
                        query={query}
                        filters={filters}
                        initialSongs={songs}
                        initialArtists={artists}
                    />
                )
            }

            {
                (query || hasActiveFilters) && !songs.length && !artists.length && (
                    <p className="text-center text-[var(--text-secondary)] mt-12">{t('no_results')}</p>
                )
            }

            {/* Empty state — shown when no query has been entered and no filters active */}
            {
                !query && !hasActiveFilters && (
                    <div className="flex flex-col items-center py-16 gap-14">
                        {/* Decorative icon */}
                        <div className="relative flex flex-col items-center gap-6">
                            <div className="w-20 h-20 border border-[var(--hairline-strong)] flex items-center justify-center text-[var(--text-secondary)]">
                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                </svg>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-px bg-[var(--hairline-strong)]" />
                                <span className="text-[10px] tracking-[0.35em] uppercase text-[var(--text-secondary)] font-bold">{t('empty_hint')}</span>
                                <div className="w-12 h-px bg-[var(--hairline-strong)]" />
                            </div>
                        </div>

                        {/* Hint cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl">
                            <div className="border border-[var(--hairline)] p-5 flex flex-col gap-2 bg-white/[0.02] hover:border-[var(--hairline-strong)] transition-colors">
                                <div className="flex items-center gap-2 text-white">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M9 18V5l12-2v13"></path>
                                        <circle cx="6" cy="18" r="3"></circle>
                                        <circle cx="18" cy="16" r="3"></circle>
                                    </svg>
                                    <span className="text-xs font-bold tracking-[0.15em] uppercase">{t('hint_songs_title')}</span>
                                </div>
                                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">{t('hint_songs_desc')}</p>
                            </div>
                            <div className="border border-[var(--hairline)] p-5 flex flex-col gap-2 bg-white/[0.02] hover:border-[var(--hairline-strong)] transition-colors">
                                <div className="flex items-center gap-2 text-white">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                        <circle cx="9" cy="7" r="4"></circle>
                                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                    </svg>
                                    <span className="text-xs font-bold tracking-[0.15em] uppercase">{t('hint_artists_title')}</span>
                                </div>
                                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">{t('hint_artists_desc')}</p>
                            </div>
                            <div className="border border-[var(--hairline)] p-5 flex flex-col gap-2 bg-white/[0.02] hover:border-[var(--hairline-strong)] transition-colors">
                                <div className="flex items-center gap-2 text-white">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                        <line x1="3" y1="9" x2="21" y2="9"></line>
                                        <line x1="9" y1="21" x2="9" y2="9"></line>
                                    </svg>
                                    <span className="text-xs font-bold tracking-[0.15em] uppercase">{t('hint_id_title')}</span>
                                </div>
                                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">{t('hint_id_desc')}</p>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
