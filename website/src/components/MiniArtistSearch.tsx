'use client';

import { useState, useEffect, useRef } from 'react';
import { Artist } from '@/types';
import { searchArtists } from '@/lib/api';
import { useTranslations } from 'next-intl';
import { formatArtistType } from '@/lib/formatArtistType';

interface MiniArtistSearchProps {
    onSelect: (artist: Artist) => void;
}

export default function MiniArtistSearch({ onSelect }: MiniArtistSearchProps) {
    const t = useTranslations('CustomRanking');
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Artist[]>([]);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Debounced search
    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            setIsOpen(false);
            return;
        }

        const debounceId = setTimeout(async () => {
            setLoading(true);
            try {
                const data = await searchArtists(query, 5);
                setResults(data);
                setIsOpen(true);
            } catch (err) {
                console.error('Failed to search artists:', err);
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => clearTimeout(debounceId);
    }, [query]);

    const handleSelect = (artist: Artist) => {
        onSelect(artist);
        setQuery('');
        setIsOpen(false);
    };

    return (
        <div ref={wrapperRef} className="relative w-full">
            <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => { if (query.trim() && results.length > 0) setIsOpen(true); }}
                placeholder={t('search_artist_placeholder') || "Search for an artist/voicebank to require..."}
                className="w-full bg-black/40 border border-[var(--hairline-strong)] px-4 py-2 text-sm text-white focus:outline-none focus:border-[var(--vermilion)] transition-colors placeholder:text-gray-600"
            />
            {loading && (
                <div className="absolute right-3 top-2.5 w-4 h-4 rounded-full border-t-2 border-[var(--vermilion)] animate-spin"></div>
            )}

            {isOpen && results.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-black/95 border border-[var(--hairline-strong)] backdrop-blur-md shadow-2xl">
                    {results.map(artist => (
                        <button
                            key={artist.id}
                            onClick={() => handleSelect(artist)}
                            className="w-full flex items-center gap-3 p-3 hover:bg-white/10 transition-colors text-left border-b border-[var(--hairline)] last:border-0"
                        >
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-800 flex-shrink-0">
                                {artist.picture_url_thumb ? (
                                    <img src={artist.picture_url_thumb} alt="" className="w-full h-full object-cover object-top" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-[10px]">👤</div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm text-white truncate font-bold">{artist.name_default}</div>
                                <div className="text-[10px] text-[var(--vermilion)] tracking-widest uppercase">{formatArtistType(artist.artist_type)}</div>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {isOpen && query.trim() && !loading && results.length === 0 && (
                <div className="absolute z-50 w-full mt-1 bg-black/95 border border-[var(--hairline-strong)] p-3 text-xs text-gray-500 text-center backdrop-blur-md">
                    No artists found.
                </div>
            )}
        </div>
    );
}
