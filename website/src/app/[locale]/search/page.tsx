import { searchSongs } from '@/lib/api';
import RankingTable from '@/components/RankingTable';
import { getTranslations } from 'next-intl/server';
import { SongRanking } from '@/types';

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
    if (query) {
        try {
            songs = await searchSongs(query);
        } catch (e) {
            console.error('Search failed', e);
        }
    }

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
                <div className="mb-4 text-[var(--text-secondary)]">
                    {t('results_for', { query })}
                </div>
            )}

            {songs.length > 0 ? (
                <RankingTable songs={songs} mode="total" />
            ) : (
                query && <p className="text-center text-[var(--text-secondary)] mt-12">{t('no_results')}</p>
            )}
        </div>
    );
}
