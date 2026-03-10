'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { searchArtists } from '@/lib/api';
import { Artist } from '@/types';
import { formatArtistType } from '@/lib/formatArtistType';

export interface AdvancedFilters {
    vocalist_ids: string; // comma-separated IDs
    vocalist_exclusive: boolean;
    sort_by: string;
    publish_date_start: string;
    publish_date_end: string;
    song_type: string; // '' means all
}

export const DEFAULT_FILTERS: AdvancedFilters = {
    vocalist_ids: '',
    vocalist_exclusive: false,
    sort_by: 'total_views',
    publish_date_start: '',
    publish_date_end: '',
    song_type: '',
};

interface SelectedVocalist {
    id: number;
    name: string;
    artist_type: string;
    picture_url_thumb: string | null;
}

interface AdvancedSearchFiltersProps {
    /** Must be a stable parsed object from URL params, not a new object each render */
    initialFilters: AdvancedFilters;
    /** initialSelectedVocalists pre-loaded from the server if vocalist_ids in URL */
    initialSelectedVocalists?: SelectedVocalist[];
    onApply: (filters: AdvancedFilters) => void;
}

const SONG_TYPES = ['', 'Original', 'Remix', 'Remaster', 'Cover'];
const SORT_OPTIONS = [
    { value: 'total_views', labelKey: 'filter_sort_views' },
    { value: 'publish_date', labelKey: 'filter_sort_date' },
];

const SYNTH_ARTIST_TYPES = [
    'Vocaloid', 'UTAU', 'CeVIO', 'SynthesizerV', 'NEUTRINO',
    'AIVOICE', 'VOICEVOX', 'NewType', 'Voiceroid', 'ACEVirtualSinger',
    'VoiSona', 'OtherVoiceSynthesizer',
];

function isSynthType(type: string) {
    return SYNTH_ARTIST_TYPES.includes(type);
}

export default function AdvancedSearchFilters({
    initialFilters,
    initialSelectedVocalists = [],
    onApply,
}: AdvancedSearchFiltersProps) {
    const t = useTranslations('SearchPage');

    const [open, setOpen] = useState(false);
    const [filters, setFilters] = useState<AdvancedFilters>(initialFilters);
    const [selectedVocalists, setSelectedVocalists] = useState<SelectedVocalist[]>(initialSelectedVocalists);

    // Vocalist autocomplete state
    const [vocalistQuery, setVocalistQuery] = useState('');
    const [vocalistResults, setVocalistResults] = useState<Artist[]>([]);
    const [vocalistLoading, setVocalistLoading] = useState(false);
    const [vocalistOpen, setVocalistOpen] = useState(false);
    const vocalistRef = useRef<HTMLDivElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Track if any non-default filters are active
    const activeFilterCount = [
        selectedVocalists.length > 0,
        filters.sort_by !== 'total_views',
        filters.publish_date_start !== '',
        filters.publish_date_end !== '',
        filters.song_type !== '',
    ].filter(Boolean).length;

    // Sync filters when initialFilters change (e.g. on URL navigation)
    useEffect(() => {
        setFilters(initialFilters);
    }, [initialFilters]);

    useEffect(() => {
        setSelectedVocalists(initialSelectedVocalists);
    }, [initialSelectedVocalists]);

    // Close vocalist dropdown on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (vocalistRef.current && !vocalistRef.current.contains(e.target as Node)) {
                setVocalistOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    // Debounced vocalist search (synth types only)
    const searchVocalists = useCallback((q: string) => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (!q.trim()) {
            setVocalistResults([]);
            setVocalistOpen(false);
            return;
        }
        debounceRef.current = setTimeout(async () => {
            setVocalistLoading(true);
            try {
                const results = await searchArtists(q, 20);
                setVocalistResults(results);
                setVocalistOpen(true);
            } catch {
                /* ignore */
            } finally {
                setVocalistLoading(false);
            }
        }, 250);
    }, []);

    const updateFilters = (recipe: (f: AdvancedFilters) => AdvancedFilters) => {
        setFilters(prev => {
            const next = recipe(prev);
            onApply(next);
            return next;
        });
    };

    const addVocalist = (artist: Artist) => {
        if (selectedVocalists.find(v => v.id === artist.id)) return;
        const next: SelectedVocalist[] = [
            ...selectedVocalists,
            { id: artist.id, name: artist.name_default, artist_type: artist.artist_type, picture_url_thumb: artist.picture_url_thumb },
        ];
        setSelectedVocalists(next);
        updateFilters(f => ({ ...f, vocalist_ids: next.map(v => v.id).join(',') }));
        setVocalistQuery('');
        setVocalistResults([]);
        setVocalistOpen(false);
    };

    const removeVocalist = (id: number) => {
        const next = selectedVocalists.filter(v => v.id !== id);
        setSelectedVocalists(next);
        updateFilters(f => ({
            ...f,
            vocalist_ids: next.map(v => v.id).join(','),
            vocalist_exclusive: next.length === 0 ? false : f.vocalist_exclusive,
        }));
    };

    const handleReset = () => {
        setFilters(DEFAULT_FILTERS);
        setSelectedVocalists([]);
        setVocalistQuery('');
        onApply(DEFAULT_FILTERS);
    };

    const songTypeLabel = (type: string) => {
        if (type === '') return t('filter_type_all');
        return type;
    };

    return (
        <div className="mt-3">
            {/* Toggle row */}
            <div className="flex items-center gap-4">
                <button
                    type="button"
                    onClick={() => setOpen(o => !o)}
                    className={`flex items-center gap-2 text-[11px] tracking-[0.2em] uppercase font-bold transition-colors ${open ? 'text-[var(--vermilion)]' : 'text-[var(--text-secondary)] hover:text-white'
                        }`}
                    aria-expanded={open}
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                    >
                        <polyline points="6 9 12 15 18 9" />
                    </svg>
                    {t('advanced_search')}
                    {activeFilterCount > 0 && !open && (
                        <span className="ml-1 px-1.5 py-0.5 bg-[var(--vermilion)]/20 text-[var(--vermilion)] text-[9px] rounded-sm font-bold">
                            {activeFilterCount}
                        </span>
                    )}
                </button>
            </div>

            {/* Collapsible panel */}
            <div
                className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-[800px] opacity-100 mt-4' : 'max-h-0 opacity-0'
                    }`}
            >
                <div className="border border-[var(--hairline)] bg-white/[0.02] p-5 flex flex-col gap-6">

                    {/* ── Vocalist Filter ── */}
                    <div>
                        <label className="block text-[10px] tracking-[0.25em] uppercase font-bold text-[var(--text-secondary)] mb-3">
                            {t('filter_vocalist')}
                        </label>

                        {/* Selected vocalist tags */}
                        {selectedVocalists.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-3">
                                {selectedVocalists.map(v => (
                                    <span
                                        key={v.id}
                                        className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--vermilion)]/10 border border-[var(--vermilion)]/30 text-white text-[11px] font-bold"
                                    >
                                        {v.picture_url_thumb && (
                                            <img
                                                src={v.picture_url_thumb}
                                                alt=""
                                                className="w-4 h-4 rounded-full object-cover object-top shrink-0"
                                            />
                                        )}
                                        {v.name}
                                        <button
                                            type="button"
                                            onClick={() => removeVocalist(v.id)}
                                            className="ml-1 text-[var(--text-secondary)] hover:text-[var(--vermilion)] transition-colors"
                                            aria-label={`Remove ${v.name}`}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                                <line x1="18" y1="6" x2="6" y2="18" />
                                                <line x1="6" y1="6" x2="18" y2="18" />
                                            </svg>
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Vocalist autocomplete input */}
                        <div ref={vocalistRef} className="relative">
                            <input
                                type="text"
                                value={vocalistQuery}
                                onChange={e => { setVocalistQuery(e.target.value); searchVocalists(e.target.value); }}
                                placeholder={t('filter_vocalist_placeholder')}
                                className="w-full bg-transparent border border-[var(--hairline-strong)] text-white text-sm px-3 py-2 focus:outline-none focus:border-[var(--vermilion)] transition-colors placeholder:text-[var(--text-secondary)] placeholder:text-xs"
                                autoComplete="off"
                            />
                            {vocalistLoading && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-t-2 border-[var(--vermilion)] animate-spin" />
                            )}

                            {vocalistOpen && vocalistResults.length > 0 && (
                                <div className="absolute z-50 w-full mt-1 bg-black/95 border border-[var(--hairline-strong)] shadow-2xl max-h-52 overflow-y-auto">
                                    {vocalistResults.map(artist => {
                                        const alreadyAdded = selectedVocalists.some(v => v.id === artist.id);
                                        return (
                                            <button
                                                key={artist.id}
                                                type="button"
                                                onClick={() => !alreadyAdded && addVocalist(artist)}
                                                disabled={alreadyAdded}
                                                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left border-b border-[var(--hairline)] last:border-0 transition-colors ${alreadyAdded
                                                    ? 'opacity-40 cursor-not-allowed'
                                                    : 'hover:bg-white/10 cursor-pointer'
                                                    }`}
                                            >
                                                <div className="w-7 h-7 rounded-full overflow-hidden bg-gray-800 flex-shrink-0">
                                                    {artist.picture_url_thumb ? (
                                                        <img src={artist.picture_url_thumb} alt="" className="w-full h-full object-cover object-top" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-[9px]">♪</div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm text-white font-bold truncate">{artist.name_default}</div>
                                                    <div className="text-[10px] text-[var(--vermilion)] tracking-widest uppercase">{formatArtistType(artist.artist_type)}</div>
                                                </div>
                                                {alreadyAdded && (
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--vermilion)] shrink-0">
                                                        <polyline points="20 6 9 17 4 12" />
                                                    </svg>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Exclusive toggle — only show when vocalist(s) selected */}
                        {selectedVocalists.length > 0 && (
                            <button
                                type="button"
                                onClick={() => updateFilters(f => ({ ...f, vocalist_exclusive: !f.vocalist_exclusive }))}
                                className="mt-3 flex items-center gap-2.5 group"
                            >
                                <div className={`w-8 h-4 rounded-full transition-colors relative shrink-0 ${filters.vocalist_exclusive ? 'bg-[var(--vermilion)]' : 'bg-[var(--hairline-strong)]'
                                    }`}>
                                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${filters.vocalist_exclusive ? 'translate-x-4' : 'translate-x-0.5'
                                        }`} />
                                </div>
                                <span className={`text-[11px] tracking-wide transition-colors ${filters.vocalist_exclusive ? 'text-white' : 'text-[var(--text-secondary)] group-hover:text-white'
                                    }`}>
                                    {t('filter_vocalist_exclusive')}
                                </span>
                            </button>
                        )}
                    </div>

                    {/* ── Bottom row: Song Type + Sort + Dates ── */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                        {/* Song Type pills */}
                        <div>
                            <label className="block text-[10px] tracking-[0.25em] uppercase font-bold text-[var(--text-secondary)] mb-3">
                                {t('filter_song_type')}
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                                {SONG_TYPES.map(type => (
                                    <button
                                        key={type || 'all'}
                                        type="button"
                                        onClick={() => updateFilters(f => ({ ...f, song_type: type }))}
                                        className={`px-3 py-1.5 text-[10px] tracking-[0.15em] uppercase font-bold border transition-colors ${filters.song_type === type
                                            ? 'border-[var(--vermilion)] text-[var(--vermilion)] bg-[var(--vermilion)]/10'
                                            : 'border-[var(--hairline)] text-[var(--text-secondary)] hover:border-[var(--hairline-strong)] hover:text-white'
                                            }`}
                                    >
                                        {songTypeLabel(type)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Sort By */}
                        <div>
                            <label className="block text-[10px] tracking-[0.25em] uppercase font-bold text-[var(--text-secondary)] mb-3">
                                {t('filter_sort')}
                            </label>
                            <div className="flex gap-1.5">
                                {SORT_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => updateFilters(f => ({ ...f, sort_by: opt.value }))}
                                        className={`px-3 py-1.5 text-[10px] tracking-[0.15em] uppercase font-bold border transition-colors ${(filters.sort_by === opt.value || (!filters.sort_by && opt.value === 'total_views'))
                                            ? 'border-[var(--vermilion)] text-[var(--vermilion)] bg-[var(--vermilion)]/10'
                                            : 'border-[var(--hairline)] text-[var(--text-secondary)] hover:border-[var(--hairline-strong)] hover:text-white'
                                            }`}
                                    >
                                        {t(opt.labelKey)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Date From */}
                        <div>
                            <label className="block text-[10px] tracking-[0.25em] uppercase font-bold text-[var(--text-secondary)] mb-2">
                                {t('filter_date_from')}
                            </label>
                            <input
                                type="date"
                                value={filters.publish_date_start}
                                onChange={e => {
                                    const val = e.target.value;
                                    updateFilters(f => ({ ...f, publish_date_start: val }));
                                }}
                                className="bg-transparent border border-[var(--hairline-strong)] text-white text-sm px-3 py-2 w-full focus:outline-none focus:border-[var(--vermilion)] transition-colors [color-scheme:dark]"
                            />
                        </div>

                        {/* Date To */}
                        <div>
                            <label className="block text-[10px] tracking-[0.25em] uppercase font-bold text-[var(--text-secondary)] mb-2">
                                {t('filter_date_to')}
                            </label>
                            <input
                                type="date"
                                value={filters.publish_date_end}
                                onChange={e => {
                                    const val = e.target.value;
                                    updateFilters(f => ({ ...f, publish_date_end: val }));
                                }}
                                className="bg-transparent border border-[var(--hairline-strong)] text-white text-sm px-3 py-2 w-full focus:outline-none focus:border-[var(--vermilion)] transition-colors [color-scheme:dark]"
                            />
                        </div>
                    </div>

                    {/* ── Action Buttons ── */}
                    <div className="flex items-center gap-3 pt-1 border-t border-[var(--hairline)]">
                        {activeFilterCount > 0 && (
                            <button
                                type="button"
                                onClick={handleReset}
                                className="px-4 py-2.5 border border-[var(--hairline-strong)] text-[var(--text-secondary)] hover:text-white hover:border-white text-[11px] tracking-[0.2em] uppercase font-bold transition-colors"
                            >
                                {t('filter_reset')}
                            </button>
                        )}
                        {activeFilterCount > 0 && (
                            <span className="text-[10px] text-[var(--text-secondary)] ml-auto">
                                {t('filter_active', { count: activeFilterCount })}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
