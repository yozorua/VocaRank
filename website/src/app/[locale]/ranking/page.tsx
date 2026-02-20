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

            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6 mb-6 md:mb-8 border-b border-[var(--hairline-strong)] pb-0">
                {/* Ranking Mode Tabs */}
                <div className="flex gap-6 overflow-x-auto">
                    {tabs.map((tab) => (
                        <Link
                            key={tab.key}
                            href={`/ranking?mode=${tab.key}&sort=${sort}`}
                            className={`pb-3 border-b-2 transition-all font-bold whitespace-nowrap text-sm tracking-[0.1em] ${mode === tab.key
                                ? 'text-white border-[var(--vermilion)]'
                                : 'text-[var(--text-secondary)] border-transparent hover:text-white'
                                }`}
                        >
                            {tab.label}
                        </Link>
                    ))}
                </div>

                {/* Sort Controls (For all modes) */}
                <div className="flex items-center gap-6 pb-3">
                    {sortOptions.map((option) => (
                        <Link
                            key={option.key}
                            href={`/ranking?mode=${mode}&sort=${option.key}`}
                            className={`text-[10px] uppercase font-bold transition-all tracking-widest ${sort === option.key
                                ? 'text-white'
                                : 'text-[var(--text-secondary)] hover:text-white'
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
