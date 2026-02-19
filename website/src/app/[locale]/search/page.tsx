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
        <div className="max-w-[var(--max-width)] mx-auto px-6 py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
                <form action={`/${locale}/search`} method="GET" className="flex gap-2">
                    <input
                        type="text"
                        name="q"
                        defaultValue={query}
                        placeholder={t('placeholder')}
                        className="flex-grow bg-[var(--bg-card)] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[var(--miku-teal)]"
                    />
                    <button
                        type="submit"
                        className="bg-[var(--miku-teal)] text-black font-bold px-6 py-3 rounded-lg hover:bg-[var(--miku-teal-dark)] transition-colors"
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
                <div className="mb-10">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        {t('artists', { defaultMessage: 'Artists' })}
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {artists.map((artist) => {
                            const thumb = artist.picture_url_thumb || artist.picture_url_original;
                            return (
                                <Link
                                    key={artist.id}
                                    href={`/artist/${artist.id}`}
                                    className="glass-panel p-4 rounded-xl border border-white/5 hover:bg-white/5 hover:scale-105 transition-all flex flex-col items-center text-center gap-3 relative overflow-hidden group"
                                >
                                    <div className="w-20 h-20 rounded-full overflow-hidden bg-black/50 border-2 border-[var(--miku-teal)]/30 group-hover:border-[var(--miku-teal)] transition-colors">
                                        {thumb ? (
                                            <img src={thumb} alt={artist.name_default} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-xl text-gray-500">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                            </div>
                                        )}
                                    </div>
                                    <div className="min-w-0 w-full">
                                        <div className="font-bold text-white truncate">{getArtistName(artist)}</div>
                                        <div className="text-xs text-[var(--miku-teal)] uppercase tracking-wider mt-1">{artist.artist_type.replace('SynthesizerV', 'Synthesizer V')}</div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Songs Section */}
            {songs.length > 0 && (
                <div>
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        {t('songs', { defaultMessage: 'Songs' })}
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
