'use client';

import { useState, useEffect, useRef } from 'react';
import { SongRanking, Artist } from '@/types';
import { searchSongs, searchArtists } from '@/lib/api';
import { formatArtistType } from '@/lib/formatArtistType';
import { useRouter } from '@/i18n/navigation';

interface LiveSearchInputProps {
    defaultValue: string;
    placeholder: string;
}

export default function LiveSearchInput({ defaultValue, placeholder }: LiveSearchInputProps) {
    const [query, setQuery] = useState(defaultValue);
    const [artists, setArtists] = useState<Artist[]>([]);
    const [songs, setSongs] = useState<SongRanking[]>([]);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!query.trim()) {
            setArtists([]);
            setSongs([]);
            setIsOpen(false);
            return;
        }

        const debounceId = setTimeout(async () => {
            setLoading(true);
            try {
                const [aData, sData] = await Promise.all([
                    searchArtists(query, 3),
                    searchSongs(query, 5)
                ]);
                setArtists(aData || []);
                setSongs(sData || []);
                setIsOpen(true);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => clearTimeout(debounceId);
    }, [query]);

    const handleSelectArtist = (id: number) => {
        setIsOpen(false);
        router.push(`/artist/${id}`);
    };

    const handleSelectSong = (id: number) => {
        setIsOpen(false);
        router.push(`/song/${id}`);
    };

    const getSongThumbnail = (song: SongRanking) => {
        if (song.youtube_id) return `https://i.ytimg.com/vi/${song.youtube_id}/mqdefault.jpg`;
        if (song.niconico_thumb_url) return song.niconico_thumb_url;
        if (song.niconico_id) {
            const match = song.niconico_id.match(/\d+/);
            return match ? `https://nicovideo.cdn.nimg.jp/thumbnails/${match[0]}/${match[0]}` : null;
        }
        return null;
    };

    const getArtistsString = (song: SongRanking) => {
        const artistNames = song.artists ? song.artists.map(a => a.name) : [];
        const vocalNames = song.vocalists ? song.vocalists.map(a => a.name) : [];
        const combined = [...artistNames, ...vocalNames].join(' ・ ');
        return combined || `${song.artist_string} ・ ${song.vocaloid_string}`;
    };

    return (
        <div ref={wrapperRef} className="relative w-full">
            <input
                type="text"
                name="q"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => { if (query.trim() && (artists.length > 0 || songs.length > 0)) setIsOpen(true); }}
                placeholder={placeholder}
                autoComplete="off"
                className="w-full bg-[var(--bg-dark)] border-b-2 border-[var(--hairline-strong)] text-white text-lg px-2 py-4 pr-10 focus:outline-none focus:border-[var(--vermilion)] transition-colors placeholder:text-[var(--text-secondary)] placeholder:text-sm placeholder:tracking-wider placeholder:font-sans font-bold"
            />
            {loading ? (
                <div className="absolute right-3 top-5 w-5 h-5 rounded-full border-t-2 border-[var(--vermilion)] animate-spin"></div>
            ) : query ? (
                <button
                    type="button"
                    onClick={() => { setQuery(''); setArtists([]); setSongs([]); setIsOpen(false); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-white transition-colors p-1"
                    aria-label="Clear"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
            ) : null}

            {isOpen && (artists.length > 0 || songs.length > 0) && (
                <div className="absolute z-50 w-full mt-1 bg-black/95 border border-[var(--hairline-strong)] backdrop-blur-md shadow-2xl max-h-[60vh] overflow-y-auto">
                    {artists.length > 0 && (
                        <div>
                            <div className="px-3 py-1 bg-[var(--surface-light)] text-[10px] text-[var(--text-secondary)] uppercase tracking-widest font-bold">Artists</div>
                            {artists.map(artist => (
                                <button
                                    type="button"
                                    key={`artist-${artist.id}`}
                                    onClick={() => handleSelectArtist(artist.id)}
                                    className="w-full flex items-center gap-3 p-3 hover:bg-white/10 transition-colors text-left border-b border-[var(--hairline)]"
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
                    {songs.length > 0 && (
                        <div>
                            <div className="px-3 py-1 bg-[var(--surface-light)] text-[10px] text-[var(--text-secondary)] uppercase tracking-widest font-bold">Songs</div>
                            {songs.map(song => (
                                <button
                                    type="button"
                                    key={`song-${song.id}`}
                                    onClick={() => handleSelectSong(song.id)}
                                    className="w-full flex items-center gap-3 p-3 hover:bg-white/10 transition-colors text-left border-b border-[var(--hairline)] last:border-0"
                                >
                                    <div className="w-12 h-8 bg-black border border-[var(--hairline)] flex-shrink-0 flex items-center justify-center overflow-hidden">
                                        {getSongThumbnail(song) ? (
                                            <img src={getSongThumbnail(song)!} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="text-[10px]">🎵</div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm text-white truncate font-bold">{song.name_japanese || song.name_english || song.name_romaji || 'Unknown Song'}</div>
                                        <div className="text-[10px] text-[var(--text-secondary)] truncate">{getArtistsString(song)}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
