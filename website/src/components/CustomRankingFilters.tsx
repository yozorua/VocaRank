'use client';

import { useState } from 'react';
import { Artist } from '@/types';
import MiniArtistSearch from './MiniArtistSearch';
import { useTranslations } from 'next-intl';

export interface CustomFilters {
    songType: string;
    publishDateStart: string;
    publishDateEnd: string;
    viewsMin: string;
    viewsMax: string;
    artistIds: string;
    artistExclusive?: boolean;
    viewsSort: string;
}

interface CustomRankingFiltersProps {
    initialFilters: CustomFilters;
    onApply: (filters: CustomFilters) => void;
}

export default function CustomRankingFilters({ initialFilters, onApply }: CustomRankingFiltersProps) {
    const t = useTranslations('CustomRanking');

    const [songTypes, setSongTypes] = useState<string[]>(
        initialFilters.songType ? initialFilters.songType.split(',') : ['Original', 'Remaster', 'Remix', 'Cover']
    );
    const [dateStart, setDateStart] = useState(initialFilters.publishDateStart || '');
    const [dateEnd, setDateEnd] = useState(initialFilters.publishDateEnd || '');
    const [viewsMin, setViewsMin] = useState(initialFilters.viewsMin || '');
    const [viewsMax, setViewsMax] = useState(initialFilters.viewsMax || '');
    const [viewsSort, setViewsSort] = useState(initialFilters.viewsSort || 'total');

    // We visually hold the selected artists as objects to render their names/avatars
    const [selectedArtists, setSelectedArtists] = useState<Artist[]>([]);
    const [artistExclusive, setArtistExclusive] = useState<boolean>(initialFilters.artistExclusive || false);

    const allTypes = ['Original', 'Remaster', 'Remix', 'Cover'];

    const toggleType = (type: string) => {
        if (songTypes.includes(type)) {
            setSongTypes(songTypes.filter(t => t !== type));
        } else {
            setSongTypes([...songTypes, type]);
        }
    };

    const handleAddArtist = (artist: Artist) => {
        if (!selectedArtists.find(a => a.id === artist.id)) {
            setSelectedArtists([...selectedArtists, artist]);
        }
    };

    const handleRemoveArtist = (id: number) => {
        setSelectedArtists(selectedArtists.filter(a => a.id !== id));
    };

    const handleApply = () => {
        onApply({
            songType: songTypes.join(','),
            publishDateStart: dateStart,
            publishDateEnd: dateEnd,
            viewsMin,
            viewsMax,
            artistIds: selectedArtists.map(a => a.id).join(','),
            artistExclusive,
            viewsSort,
        });
    };

    return (
        <div className="bg-black/20 border border-[var(--hairline-strong)] p-6 mb-8 mt-4 animate-fade-in-up">
            <h2 className="text-[var(--gold)] text-xs font-bold tracking-[0.2em] uppercase mb-6 flex items-center gap-3">
                <div className="w-8 h-px bg-[var(--gold)]"></div>
                {t('title') || "Custom Ranking Parameters"}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 min-w-0">
                {/* Left Column: Types & Artists */}
                <div className="space-y-6 min-w-0">
                    <div>
                        <label className="block text-[10px] text-[var(--text-secondary)] uppercase tracking-[0.2em] mb-2">{t('label_song_types') || "Song Types"}</label>
                        <div className="flex flex-wrap gap-2">
                            {allTypes.map(type => {
                                const active = songTypes.includes(type);
                                return (
                                    <button
                                        key={type}
                                        onClick={() => toggleType(type)}
                                        className={`px-3 py-1.5 text-xs font-bold tracking-widest transition-colors border ${active
                                            ? 'border-[var(--vermilion)] text-[var(--vermilion)] bg-[var(--vermilion)]/10'
                                            : 'border-[var(--hairline-strong)] text-[var(--text-secondary)] hover:border-white/50 hover:text-white'
                                            }`}
                                    >
                                        {type}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] text-[var(--text-secondary)] uppercase tracking-[0.2em] mb-2">{t('label_required_artists') || "Required Artists"}</label>
                        <MiniArtistSearch onSelect={handleAddArtist} />

                        {selectedArtists.length > 0 && (
                            <div className="flex flex-col gap-3 mt-3">
                                <div className="flex flex-wrap gap-2">
                                    {selectedArtists.map(artist => (
                                        <div key={artist.id} className="flex items-center gap-2 bg-white/5 border border-white/20 pl-1 pr-3 py-1 rounded-full group">
                                            <div className="w-5 h-5 rounded-full overflow-hidden bg-black flex-shrink-0">
                                                {artist.picture_url_thumb ? (
                                                    <img src={artist.picture_url_thumb} alt="" className="w-full h-full object-cover object-top" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-[8px]">👤</div>
                                                )}
                                            </div>
                                            <span className="text-xs font-bold text-white">{artist.name_default}</span>
                                            <button
                                                onClick={() => handleRemoveArtist(artist.id)}
                                                className="text-gray-400 hover:text-white ml-1 font-bold"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setArtistExclusive(!artistExclusive)}
                                    className="flex items-center gap-2.5 group w-max"
                                >
                                    <div className={`w-8 h-4 rounded-full transition-colors relative shrink-0 ${artistExclusive ? 'bg-[var(--vermilion)]' : 'bg-[var(--hairline-strong)]'
                                        }`}>
                                        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${artistExclusive ? 'translate-x-4' : 'translate-x-0.5'
                                            }`} />
                                    </div>
                                    <span className={`text-[11px] tracking-wide transition-colors ${artistExclusive ? 'text-white' : 'text-[var(--text-secondary)] group-hover:text-white'
                                        }`}>
                                        {t('filter_artist_exclusive') || "Exclusive (only these vocalists)"}
                                    </span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Views Sort, Views Range & Dates */}
                <div className="space-y-6 min-w-0 overflow-x-hidden">
                    <div>
                        <label className="block text-[10px] text-[var(--text-secondary)] uppercase tracking-[0.2em] mb-2">{t('label_sort_by') || "Sort By"}</label>
                        <div className="flex flex-wrap gap-2">
                            {(['total', 'youtube', 'niconico'] as const).map(opt => (
                                <button
                                    key={opt}
                                    onClick={() => setViewsSort(opt)}
                                    className={`px-3 py-1.5 text-xs font-bold tracking-widest transition-colors border ${viewsSort === opt
                                        ? 'border-[var(--vermilion)] text-[var(--vermilion)] bg-[var(--vermilion)]/10'
                                        : 'border-[var(--hairline-strong)] text-[var(--text-secondary)] hover:border-white/50 hover:text-white'
                                        }`}
                                >
                                    {opt === 'total' ? t('sort_total') : opt === 'youtube' ? 'YouTube' : t('sort_niconico')}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1 min-w-0">
                            <label className="block text-[10px] text-[var(--text-secondary)] uppercase tracking-[0.2em] mb-2">{t('label_min_views') || "Min Views"}</label>
                            <input
                                type="number"
                                value={viewsMin}
                                onChange={(e) => setViewsMin(e.target.value)}
                                onKeyDown={(e) => { if (['+', '-', 'e', 'E'].includes(e.key)) e.preventDefault(); }}
                                min="0"
                                placeholder={t('placeholder_min_views') || "0"}
                                className="w-full min-w-0 bg-black/40 border border-[var(--hairline-strong)] px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--vermilion)]"
                            />
                        </div>
                        <div className="flex-1 min-w-0">
                            <label className="block text-[10px] text-[var(--text-secondary)] uppercase tracking-[0.2em] mb-2">{t('label_max_views') || "Max Views"}</label>
                            <input
                                type="number"
                                value={viewsMax}
                                onChange={(e) => setViewsMax(e.target.value)}
                                onKeyDown={(e) => { if (['+', '-', 'e', 'E'].includes(e.key)) e.preventDefault(); }}
                                min="0"
                                placeholder={t('placeholder_max_views') || "∞"}
                                className="w-full min-w-0 bg-black/40 border border-[var(--hairline-strong)] px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--vermilion)]"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1 min-w-0">
                            <label className="block text-[10px] text-[var(--text-secondary)] uppercase tracking-[0.2em] mb-2">{t('label_date_start') || "Start Date"}</label>
                            <input
                                type="date"
                                value={dateStart}
                                max={dateEnd || undefined}
                                onChange={(e) => setDateStart(e.target.value)}
                                className="w-full min-w-0 bg-black/40 border border-[var(--hairline-strong)] px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--vermilion)] [color-scheme:dark]"
                            />
                        </div>
                        <div className="flex-1 min-w-0">
                            <label className="block text-[10px] text-[var(--text-secondary)] uppercase tracking-[0.2em] mb-2">{t('label_date_end') || "End Date"}</label>
                            <input
                                type="date"
                                value={dateEnd}
                                min={dateStart || undefined}
                                onChange={(e) => setDateEnd(e.target.value)}
                                className="w-full min-w-0 bg-black/40 border border-[var(--hairline-strong)] px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--vermilion)] [color-scheme:dark]"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-8 flex justify-end">
                <button
                    onClick={handleApply}
                    className="px-8 py-3 border border-[var(--vermilion)] text-[var(--vermilion)] font-bold text-xs tracking-[0.2em] uppercase transition-all hover:bg-[var(--vermilion)] hover:text-white"
                >
                    {t('apply') || "Apply Filters"}
                </button>
            </div>
        </div>
    );
}
