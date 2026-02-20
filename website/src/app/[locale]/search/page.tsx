import { searchSongs, searchArtists } from '@/lib/api';
import RankingTable from '@/components/RankingTable';
import { getTranslations } from 'next-intl/server';
import { SongRanking, Artist } from '@/types';
import { Link } from '@/i18n/navigation';

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
                <form action={`/${locale}/search`} method="GET" className="flex gap-2">
                    <div className="relative flex-grow">
                        <input
                            type="text"
                            name="q"
                            defaultValue={query}
                            placeholder={t('placeholder')}
                            className="w-full bg-[var(--bg-dark)] border-b-2 border-[var(--hairline-strong)] text-white text-lg px-2 py-4 focus:outline-none focus:border-[var(--vermilion)] transition-colors placeholder:text-[var(--text-secondary)] placeholder:text-sm placeholder:tracking-wider placeholder:font-sans font-bold"
                        />
                    </div>
                    <button
                        type="submit"
                        className="bg-transparent border border-[var(--hairline-strong)] text-white hover:border-[var(--vermilion)] hover:text-[var(--vermilion)] font-bold px-10 py-3 uppercase tracking-widest text-xs transition-colors shrink-0"
                    >
                        {t('search')}
                    </button>
                </form>
            </div>

            {query && (
                <div className="mb-8 text-[var(--text-secondary)]">
                    {t('results_for', { query })}
                </div>
            )}

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
                                            className="font-bold text-white group-hover:text-[var(--vermilion)] w-full tracking-widest transition-colors break-words line-clamp-2"
                                            title={getArtistName(artist)}
                                        >
                                            {getArtistName(artist)}
                                        </div>
                                        <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-[0.2em] mt-2">{artist.artist_type.replace(/([a-z])([A-Z])/g, '$1 $2').replace('SynthesizerV', 'Synthesizer V')}</div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Songs Section */}
            {songs.length > 0 && (
                <div className="mb-16">
                    <h2 className="text-sm font-bold tracking-[0.2em] text-[var(--text-secondary)] uppercase mb-6 flex items-center gap-4">
                        {t('songs', { defaultMessage: 'Songs' })}
                        <div className="h-px flex-1 bg-[var(--hairline)]"></div>
                    </h2>
                    <RankingTable songs={songs} mode="total" showRank={false} />
                </div>
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
