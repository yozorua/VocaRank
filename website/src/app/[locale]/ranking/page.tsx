'use client';

import { getRankings, getCustomRankings } from '@/lib/api';
import RankingTable from '@/components/RankingTable';
import CustomRankingFilters, { CustomFilters } from '@/components/CustomRankingFilters';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, Suspense } from 'react';
import { SongRanking, RankingMode } from '@/types';

function RankingContent() {
    const t = useTranslations('RankingPage');
    const sp = useSearchParams();
    const router = useRouter();

    const mode = (sp.get('mode') ?? 'daily') as RankingMode;
    const sort = sp.get('sort') ?? 'youtube';

    const [songs, setSongs] = useState<SongRanking[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters state
    const currentFilters: CustomFilters = {
        songType: sp.get('song_type') || '',
        publishDateStart: sp.get('publish_date_start') || '',
        publishDateEnd: sp.get('publish_date_end') || '',
        viewsMin: sp.get('views_min') || '',
        viewsMax: sp.get('views_max') || '',
        artistIds: sp.get('artist_ids') || ''
    };

    // Cache key incorporates all custom filters if mode is custom
    const getCacheKey = () => {
        if (mode === 'custom') {
            return `custom:${currentFilters.songType}:${currentFilters.publishDateStart}:${currentFilters.publishDateEnd}:${currentFilters.viewsMin}:${currentFilters.viewsMax}:${currentFilters.artistIds}`;
        }
        return `${mode}:${sort}`;
    };

    const cache = useRef<Map<string, SongRanking[]>>(new Map());

    useEffect(() => {
        const key = getCacheKey();
        if (cache.current.has(key)) {
            setSongs(cache.current.get(key)!);
            setLoading(false);
            return;
        }

        setLoading(true);

        let fetchPromise: Promise<SongRanking[]>;
        if (mode === 'custom') {
            const types = currentFilters.songType || 'Original,Remaster,Remix,Cover';
            const vMin = currentFilters.viewsMin ? parseInt(currentFilters.viewsMin) : undefined;
            const vMax = currentFilters.viewsMax ? parseInt(currentFilters.viewsMax) : undefined;
            fetchPromise = getCustomRankings(
                100,
                types,
                undefined,
                currentFilters.publishDateStart,
                currentFilters.publishDateEnd,
                vMin,
                vMax,
                currentFilters.artistIds
            );
        } else {
            fetchPromise = getRankings(mode, 100, sort);
        }

        fetchPromise
            .then(data => {
                cache.current.set(key, data);
                setSongs(data);
            })
            .catch(err => {
                console.error("Failed to fetch rankings:", err);
                setSongs([]);
            })
            .finally(() => setLoading(false));
    }, [mode, sort, sp]);

    const handleApplyFilters = (filters: CustomFilters) => {
        const params = new URLSearchParams();
        params.set('mode', 'custom');
        if (filters.songType) params.set('song_type', filters.songType);
        if (filters.publishDateStart) params.set('publish_date_start', filters.publishDateStart);
        if (filters.publishDateEnd) params.set('publish_date_end', filters.publishDateEnd);
        if (filters.viewsMin) params.set('views_min', filters.viewsMin);
        if (filters.viewsMax) params.set('views_max', filters.viewsMax);
        if (filters.artistIds) params.set('artist_ids', filters.artistIds);

        router.push(`/ranking?${params.toString()}`);
    };

    const tabs = [
        { key: 'daily', label: t('daily') },
        { key: 'weekly', label: t('weekly') },
        { key: 'monthly', label: t('monthly') },
        { key: 'total', label: t('total') },
        { key: 'custom', label: t('custom') ?? 'CUSTOM' },
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

                {/* Sort Controls (Hidden in custom mode since custom sorts by total) */}
                {mode !== 'custom' && (
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
                )}
            </div>

            {mode === 'custom' && (
                <CustomRankingFilters initialFilters={currentFilters} onApply={handleApplyFilters} />
            )}

            {/* Loading */}
            {loading && (
                <div className="flex items-center gap-3 py-12 justify-center text-[var(--text-secondary)] text-xs tracking-widest uppercase animate-pulse">
                    <span className="w-4 h-px bg-[var(--vermilion)]"></span>
                    Loading
                    <span className="w-4 h-px bg-[var(--vermilion)]"></span>
                </div>
            )}

            {!loading && <RankingTable songs={songs} mode={mode} sort={mode === 'custom' ? 'total' : sort} />}
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
