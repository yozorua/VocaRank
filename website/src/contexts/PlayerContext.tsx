'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { SongRanking } from '@/types';

interface PlayerContextType {
    queue: SongRanking[];
    currentIndex: number;
    currentSong: SongRanking | null;
    isPlaying: boolean;
    loopMode: 'off' | 'list' | 'song';
    isShuffled: boolean;
    volume: number;
    isInitialized: boolean;
    playSong: (song: SongRanking, list?: SongRanking[]) => void;
    togglePlay: () => void;
    setIsPlaying: (playing: boolean) => void;
    toggleLoop: () => void;
    toggleShuffle: () => void;
    setLoopMode: (mode: 'off' | 'list' | 'song') => void;
    nextSong: () => void;
    prevSong: () => void;
    setVolume: (level: number) => void;
    clearPlayer: () => void;
    removeFromQueue: (index: number) => void;
    addToQueue: (song: SongRanking) => void;
    reorderQueue: (fromIdx: number, toIdx: number) => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export function PlayerProvider({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const [queue, setQueue] = useState<SongRanking[]>([]);
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [isPlaying, setIsPlaying] = useState(false);
    const [loopMode, setLoopMode] = useState<'off' | 'list' | 'song'>('off');
    const [isShuffled, setIsShuffled] = useState(false);
    const [volume, setVolumeState] = useState(0.5);
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        try {
            const savedQueue = localStorage.getItem('vocarank_queue');
            if (savedQueue) setQueue(JSON.parse(savedQueue));

            const savedIndex = localStorage.getItem('vocarank_currentIndex');
            if (savedIndex) setCurrentIndex(parseInt(savedIndex, 10));

            const savedLoopMode = localStorage.getItem('vocarank_loopMode');
            if (savedLoopMode) setLoopMode(savedLoopMode as any);

            const savedIsShuffled = localStorage.getItem('vocarank_isShuffled');
            if (savedIsShuffled) setIsShuffled(savedIsShuffled === 'true');

            const savedVolume = localStorage.getItem('vocarank_volume');
            if (savedVolume) setVolumeState(parseFloat(savedVolume));

            const savedIsPlaying = localStorage.getItem('vocarank_isPlaying');
            const isMobile = window.innerWidth <= 768;
            if (savedIsPlaying === 'true' && !isMobile) {
                setIsPlaying(true);
            } else if (isMobile) {
                setIsPlaying(false);
            }
        } catch (e) {
            console.error('Failed to parse player state', e);
        }
        setIsInitialized(true);
    }, []);

    useEffect(() => {
        if (!isInitialized) return;
        localStorage.setItem('vocarank_queue', JSON.stringify(queue));
        localStorage.setItem('vocarank_currentIndex', currentIndex.toString());
        localStorage.setItem('vocarank_loopMode', loopMode);
        localStorage.setItem('vocarank_isShuffled', isShuffled.toString());
        localStorage.setItem('vocarank_volume', volume.toString());
        localStorage.setItem('vocarank_isPlaying', isPlaying.toString());
    }, [queue, currentIndex, loopMode, isShuffled, volume, isPlaying, isInitialized]);

    const currentSong = currentIndex >= 0 && currentIndex < queue.length ? queue[currentIndex] : null;

    const playSong = (song: SongRanking, list?: SongRanking[]) => {
        let newQueue = queue;
        let newIndex = currentIndex;

        // If a new list is provided, use it as the queue
        if (list && list.length > 0) {
            // Filter out songs without any playable video
            const validQueue = list.filter(s => !!(s.youtube_id || s.niconico_id));
            newQueue = validQueue;

            const index = validQueue.findIndex(s => s.id === song.id);
            // If the song isn't in the list (or has no playable video), just play it explicitly
            if (index === -1) {
                if (song.youtube_id || song.niconico_id) {
                    newQueue = [song];
                    newIndex = 0;
                }
            } else {
                newIndex = index;
            }
        } else {
            // Standalone play
            if (song.youtube_id || song.niconico_id) {
                newQueue = [song];
                newIndex = 0;
            }
        }

        setQueue(newQueue);
        setCurrentIndex(newIndex);
        setIsPlaying(true);

        // Save immediately before tab jump
        if (typeof window !== 'undefined') {
            localStorage.setItem('vocarank_queue', JSON.stringify(newQueue));
            localStorage.setItem('vocarank_currentIndex', newIndex.toString());
            localStorage.setItem('vocarank_isPlaying', 'true');
            localStorage.removeItem(`vocarank_progress_${song.id}`); // Start from the beginning on active manual play
        }

        // Navigate to the dedicated player page (new tab) ONLY if not already there
        const isPlayerPage = pathname && pathname.includes('/player');
        if (!isPlayerPage && typeof window !== 'undefined') {
            const locale = pathname ? pathname.split('/')[1] : 'en';
            window.open(`/${locale || 'en'}/player`, '_blank');
        }
    };

    const togglePlay = () => setIsPlaying(!isPlaying);
    const toggleLoop = () => {
        if (loopMode === 'off') setLoopMode('list');
        else if (loopMode === 'list') setLoopMode('song');
        else setLoopMode('off');
    };
    const toggleShuffle = () => setIsShuffled(!isShuffled);

    const nextSong = () => {
        if (isShuffled && queue.length > 1) {
            let nextIdx;
            do {
                nextIdx = Math.floor(Math.random() * queue.length);
            } while (nextIdx === currentIndex);
            // Clear saved progress so the song starts from the beginning
            if (queue[nextIdx]) localStorage.removeItem(`vocarank_progress_${queue[nextIdx].id}`);
            setCurrentIndex(nextIdx);
            setIsPlaying(true);
        } else if (currentIndex < queue.length - 1) {
            const nxt = currentIndex + 1;
            if (queue[nxt]) localStorage.removeItem(`vocarank_progress_${queue[nxt].id}`);
            setCurrentIndex(nxt);
            setIsPlaying(true);
        } else if (loopMode === 'list') {
            // Looping back to first song — clear its progress so it starts from 0
            if (queue[0]) localStorage.removeItem(`vocarank_progress_${queue[0].id}`);
            setCurrentIndex(0);
            setIsPlaying(true);
        }
    };

    const prevSong = () => {
        if (currentIndex > 0) {
            const prev = currentIndex - 1;
            // Clear saved progress so the song starts from the beginning
            if (queue[prev]) localStorage.removeItem(`vocarank_progress_${queue[prev].id}`);
            setCurrentIndex(prev);
            setIsPlaying(true);
        }
    };

    const setVolume = (level: number) => setVolumeState(level);

    const clearPlayer = () => {
        setQueue([]);
        setCurrentIndex(-1);
        setIsPlaying(false);
    };

    const removeFromQueue = (index: number) => {
        setQueue(prev => {
            const next = prev.filter((_, i) => i !== index);
            // Adjust currentIndex if needed
            if (index < currentIndex) setCurrentIndex(ci => ci - 1);
            else if (index === currentIndex) {
                // Stay on same index (now points to next song), or go back one
                if (index >= next.length) setCurrentIndex(Math.max(0, next.length - 1));
            }
            return next;
        });
    };

    const addToQueue = (song: SongRanking) => {
        setQueue(prev => {
            if (prev.some(s => s.id === song.id)) return prev;
            return [...prev, song];
        });
    };

    const reorderQueue = (fromIdx: number, toIdx: number) => {
        if (fromIdx === toIdx) return;
        setQueue(prev => {
            const next = [...prev];
            const [moved] = next.splice(fromIdx, 1);
            next.splice(toIdx, 0, moved);
            return next;
        });
        // Keep currentIndex tracking the same playing song
        setCurrentIndex(ci => {
            if (ci === fromIdx) return toIdx;
            if (fromIdx < ci && toIdx >= ci) return ci - 1;
            if (fromIdx > ci && toIdx <= ci) return ci + 1;
            return ci;
        });
    };

    return (
        <PlayerContext.Provider value={{
            queue, currentIndex, currentSong, isPlaying, loopMode, isShuffled, volume, isInitialized,
            playSong, togglePlay, setIsPlaying, toggleLoop, toggleShuffle, setLoopMode, nextSong, prevSong, setVolume, clearPlayer,
            removeFromQueue, addToQueue, reorderQueue
        }}>
            {children}
        </PlayerContext.Provider>
    );
}

export function usePlayer() {
    const context = useContext(PlayerContext);
    if (context === undefined) {
        throw new Error('usePlayer must be used within a PlayerProvider');
    }
    return context;
}
