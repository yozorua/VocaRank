'use client';

import { getRankings } from '@/lib/api';
import RankingTable from '@/components/RankingTable';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, Suspense } from 'react';
import { SongRanking } from '@/types';

type RankingMode = 'daily' | 'weekly' | 'monthly' | 'total';

function RankingContent() {
    const t = useTranslations('RankingPage');
    const sp = useSearchParams();

    const mode = (sp.get('mode') ?? 'daily') as RankingMode;
    const sort = sp.get('sort') ?? 'youtube';

    const [songs, setSongs] = useState<SongRanking[]>([]);
    const [loading, setLoading] = useState(true);

    // Session-scoped cache: key = "mode:sort" → SongRanking[]
    const cache = useRef<Map<string, SongRanking[]>>(new Map());

    useEffect(() => {
        const key = `${mode}:${sort}`;
        if (cache.current.has(key)) {
            setSongs(cache.current.get(key)!);
            setLoading(false);
            return;
        }
        setLoading(true);
        getRankings(mode, 100, sort)
            .then(data => {
                cache.current.set(key, data);
                setSongs(data);
            })
            .finally(() => setLoading(false));
    }, [mode, sort]);

    const tabs = [
        { key: 'daily', label: t('daily') },
        { key: 'weekly', label: t('weekly') },
        { key: 'monthly', label: t('monthly') },
        { key: 'total', label: t('total') },
    ];

    const sortOptions = [
        { key: 'youtube', label: t('sort_youtube') },
        { key: 'niconico', label: t('sort_niconico') },
        { key: 'total', label: t('sort_total') },
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

                {/* Sort Controls */}
                <div className="flex items-center gap-6 pb-3">
                    {sortOptions.map((option) => (
                        <Link
                            key={option.key}
                            href={`/ranking?mode=${mode}&sort=${option.key}`}
                            className={`text-[10px] md:text-xs uppercase font-bold transition-all tracking-widest ${sort === option.key
                                ? 'text-white'
                                : 'text-[var(--text-secondary)] hover:text-white'
                                }`}
                        >
                            {option.label}
                        </Link>
                    ))}
                </div>
            </div>

            {/* Loading */}
            {loading && (
                <div className="flex items-center gap-3 py-12 justify-center text-[var(--text-secondary)] text-xs tracking-widest uppercase animate-pulse">
                    <span className="w-4 h-px bg-[var(--vermilion)]"></span>
                    Loading
                    <span className="w-4 h-px bg-[var(--vermilion)]"></span>
                </div>
            )}

            {!loading && <RankingTable songs={songs} mode={mode} sort={sort} />}
        </div>
    );
}

export default function RankingPage() {
    return (
        <Suspense>
            <RankingContent />
        </Suspense>
    );
}
