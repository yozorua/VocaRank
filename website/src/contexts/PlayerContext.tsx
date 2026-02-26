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
    toggleLoop: () => void;
    toggleShuffle: () => void;
    setLoopMode: (mode: 'off' | 'list' | 'song') => void;
    nextSong: () => void;
    prevSong: () => void;
    setVolume: (level: number) => void;
    clearPlayer: () => void;
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
            if (savedIsPlaying === 'true') setIsPlaying(true);
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
            // Filter out songs without youtube_id since we only play YouTube
            const validQueue = list.filter(s => !!s.youtube_id);
            newQueue = validQueue;

            const index = validQueue.findIndex(s => s.id === song.id);
            // If the song isn't in the list (or has no YT id), just play it explicitly
            if (index === -1) {
                if (song.youtube_id) {
                    newQueue = [song];
                    newIndex = 0;
                }
            } else {
                newIndex = index;
            }
        } else {
            // Standalone play
            if (song.youtube_id) {
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
            setCurrentIndex(nextIdx);
            setIsPlaying(true);
        } else if (currentIndex < queue.length - 1) {
            setCurrentIndex(currentIndex + 1);
            setIsPlaying(true);
        } else if (loopMode === 'list') {
            setCurrentIndex(0);
            setIsPlaying(true);
        }
    };

    const prevSong = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
            setIsPlaying(true);
        }
    };

    const setVolume = (level: number) => setVolumeState(level);

    const clearPlayer = () => {
        setQueue([]);
        setCurrentIndex(-1);
        setIsPlaying(false);
    };

    return (
        <PlayerContext.Provider value={{
            queue, currentIndex, currentSong, isPlaying, loopMode, isShuffled, volume, isInitialized,
            playSong, togglePlay, toggleLoop, toggleShuffle, setLoopMode, nextSong, prevSong, setVolume, clearPlayer
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
