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
    const [error, setError] = useState(false);

    // Filters state
    const currentFilters: CustomFilters = {
        songType: sp.get('song_type') || '',
        publishDateStart: sp.get('publish_date_start') || '',
        publishDateEnd: sp.get('publish_date_end') || '',
        viewsMin: sp.get('views_min') || '',
        viewsMax: sp.get('views_max') || '',
        artistIds: sp.get('artist_ids') || '',
        viewsSort: sp.get('views_sort') || 'total',
    };

    // Cache key incorporates all custom filters if mode is custom
    const getCacheKey = () => {
        if (mode === 'custom') {
            return `custom:${currentFilters.songType}:${currentFilters.publishDateStart}:${currentFilters.publishDateEnd}:${currentFilters.viewsMin}:${currentFilters.viewsMax}:${currentFilters.artistIds}:${currentFilters.viewsSort}`;
        }
        return `${mode}:${sort}`;
    };

    const cache = useRef<Map<string, SongRanking[]>>(new Map());
    // Stale-request guard: only apply results from the most recent fetch
    const requestIdRef = useRef(0);

    useEffect(() => {
        // For custom mode, only fetch when the user has explicitly applied filters
        if (mode === 'custom' && !sp.get('applied')) {
            setSongs([]);
            setLoading(false);
            setError(false);
            return;
        }

        const key = getCacheKey();

        // Cache hit: instant, no network needed
        if (cache.current.has(key)) {
            setSongs(cache.current.get(key)!);
            setLoading(false);
            setError(false);
            return;
        }

        setLoading(true);
        setError(false);
        // Don't clear songs here — keep the previous list visible while loading
        // to avoid an empty-state flash when switching tabs quickly.

        // Invalidate any previous in-flight request so stale responses are ignored
        const thisRequestId = ++requestIdRef.current;

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
                currentFilters.artistIds,
                currentFilters.viewsSort || 'total'
            );
        } else {
            fetchPromise = getRankings(mode, 100, sort);
        }

        fetchPromise
            .then(data => {
                if (thisRequestId !== requestIdRef.current) return;
                cache.current.set(key, data);
                setSongs(data);
            })
            .catch(err => {
                if (thisRequestId !== requestIdRef.current) return;
                console.error("Failed to fetch rankings:", err);
                setError(true);
            })
            .finally(() => {
                if (thisRequestId !== requestIdRef.current) return;
                setLoading(false);
            });
    }, [mode, sort, sp]);


    const handleApplyFilters = (filters: CustomFilters) => {
        const params = new URLSearchParams();
        params.set('mode', 'custom');
        params.set('applied', '1');
        if (filters.songType) params.set('song_type', filters.songType);
        if (filters.publishDateStart) params.set('publish_date_start', filters.publishDateStart);
        if (filters.publishDateEnd) params.set('publish_date_end', filters.publishDateEnd);
        if (filters.viewsMin) params.set('views_min', filters.viewsMin);
        if (filters.viewsMax) params.set('views_max', filters.viewsMax);
        if (filters.artistIds) params.set('artist_ids', filters.artistIds);
        if (filters.viewsSort && filters.viewsSort !== 'total') params.set('views_sort', filters.viewsSort);

        router.push(`/ranking?${params.toString()}`);
    };

    const tabs = [
        { key: 'daily', label: t('daily'), unstable: false },
        { key: 'weekly', label: t('weekly'), unstable: true },
        { key: 'monthly', label: t('monthly'), unstable: true },
        { key: 'total', label: t('total'), unstable: false },
        { key: 'custom', label: t('custom') ?? 'CUSTOM', unstable: false },
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
                            className={`pb-3 border-b-2 transition-all font-bold whitespace-nowrap text-sm tracking-[0.1em] flex items-center gap-1.5 ${mode === tab.key
                                ? 'text-white border-[var(--vermilion)]'
                                : 'text-[var(--text-secondary)] border-transparent hover:text-white'
                                }`}
                        >
                            {tab.label}
                            {tab.unstable && (
                                <span title={t('unstable_hint')} className="shrink-0 text-[var(--text-secondary)] opacity-60 hover:opacity-100 transition-opacity">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10"/>
                                        <line x1="12" y1="8" x2="12" y2="12"/>
                                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                                    </svg>
                                </span>
                            )}
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

            {/* Custom mode: prompt user to apply filters */}
            {mode === 'custom' && !sp.get('applied') && !loading && (
                <div className="flex flex-col items-center justify-center py-24 gap-3 border-t border-[var(--hairline)] text-[var(--text-secondary)] text-xs tracking-widest uppercase">
                    <span className="w-4 h-px bg-[var(--hairline-strong)]"></span>
                    {t('custom_apply_prompt') ?? 'Configure filters above and click Apply'}
                    <span className="w-4 h-px bg-[var(--hairline-strong)]"></span>
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="flex items-center gap-3 py-12 justify-center text-[var(--text-secondary)] text-xs tracking-widest uppercase animate-pulse">
                    <span className="w-4 h-px bg-[var(--vermilion)]"></span>
                    Loading
                    <span className="w-4 h-px bg-[var(--vermilion)]"></span>
                </div>
            )}

            {/* Error – fetch failed, show a retry option instead of the misleading skeleton */}
            {!loading && error && (
                <div className="flex flex-col items-center justify-center py-24 gap-6 border-t border-[var(--hairline)]">
                    <div className="w-14 h-14 border border-[var(--hairline-strong)] flex items-center justify-center text-[var(--text-secondary)]">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                    </div>
                    <div className="text-center space-y-2 max-w-sm">
                        <p className="text-white font-bold tracking-[0.15em] uppercase text-sm">Failed to Load Rankings</p>
                        <p className="text-[var(--text-secondary)] text-sm leading-relaxed">Something went wrong while fetching the ranking data. Please try again.</p>
                    </div>
                    <button
                        onClick={() => { setError(false); setLoading(true); cache.current.delete(getCacheKey()); const thisId = ++requestIdRef.current; getRankings(mode as any, 100, sort).then(d => { if (thisId !== requestIdRef.current) return; cache.current.set(getCacheKey(), d); setSongs(d); }).catch(() => { if (thisId !== requestIdRef.current) return; setError(true); }).finally(() => { if (thisId !== requestIdRef.current) return; setLoading(false); }); }}
                        className="px-8 py-3 text-[10px] uppercase tracking-widest font-bold border border-[var(--hairline-strong)] text-[var(--text-secondary)] hover:border-[var(--vermilion)] hover:text-[var(--vermilion)] transition-all"
                    >
                        Retry
                    </button>
                </div>
            )}

            {!loading && !error && <RankingTable songs={songs} mode={mode} sort={mode === 'custom' ? (currentFilters.viewsSort || 'total') : sort} />}

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
