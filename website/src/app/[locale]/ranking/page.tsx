import { getRankings } from '@/lib/api';
import RankingTable from '@/components/RankingTable';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

// Force dynamic rendering since we rely on searchParams
export const dynamic = 'force-dynamic';

interface RankingPageProps {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
    params: Promise<{ locale: string }>;
}

export default async function RankingPage({ searchParams, params }: RankingPageProps) {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'RankingPage' });
    const sp = await searchParams;
    const mode = (typeof sp.mode === 'string' ? sp.mode : 'daily') as 'daily' | 'weekly' | 'monthly' | 'total';
    const sort = (typeof sp.sort === 'string' ? sp.sort : 'total');

    // Fetch data with sort and limit 100
    const songs = await getRankings(mode, 100, sort);

    const tabs = [
        { key: 'daily', label: t('daily') },
        { key: 'weekly', label: t('weekly') },
        { key: 'monthly', label: t('monthly') },
        { key: 'total', label: t('total') },
    ];

    const sortOptions = [
        { key: 'total', label: t('sort_total') },
        { key: 'youtube', label: t('sort_youtube') },
        { key: 'niconico', label: t('sort_niconico') },
    ];

    return (
        <div className="max-w-[var(--max-width)] mx-auto px-6 py-2 md:py-2">
            <div className="mb-4 md:mb-4 pt-2">
                <h1 className="text-2xl md:text-3xl font-bold mb-2">{t('title')}</h1>
                <p className="text-[var(--text-secondary)] text-sm md:text-base">{t('description')}</p>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 mb-6 md:mb-8 border-b border-gray-800/50 pb-2">
                {/* Ranking Mode Tabs */}
                <div className="flex gap-4 overflow-x-auto pb-2 -mb-2">
                    {tabs.map((tab) => (
                        <Link
                            key={tab.key}
                            href={`/ranking?mode=${tab.key}&sort=${sort}`}
                            className={`px-6 py-3 rounded-t-lg transition-all font-bold whitespace-nowrap text-sm tracking-wide relative overflow-hidden group flex items-center justify-center ${mode === tab.key
                                ? 'text-white bg-gradient-to-t from-[var(--miku-teal)]/20 to-transparent border-b-2 border-[var(--miku-teal)] shadow-[0_4px_20px_rgba(57,197,187,0.3)]'
                                : 'text-gray-500 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <span className="relative z-10">{tab.label}</span>
                            {mode === tab.key && (
                                <span className="absolute inset-0 bg-[var(--miku-teal)]/10 blur-xl"></span>
                            )}
                        </Link>
                    ))}
                </div>

                {/* Sort Controls (For all modes) */}
                <div className="flex items-center gap-2 bg-black/20 p-1 rounded-lg border border-white/5">
                    {sortOptions.map((option) => (
                        <Link
                            key={option.key}
                            href={`/ranking?mode=${mode}&sort=${option.key}`}
                            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${sort === option.key
                                ? 'bg-[var(--miku-pink)] text-white shadow-lg'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            {option.label}
                        </Link>
                    ))}
                </div>
            </div>

            <RankingTable songs={songs} mode={mode} sort={sort} />
        </div>
    );
}
