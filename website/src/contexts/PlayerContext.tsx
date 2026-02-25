'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { SongRanking } from '@/types';

interface PlayerContextType {
    queue: SongRanking[];
    currentIndex: number;
    currentSong: SongRanking | null;
    isPlaying: boolean;
    loopMode: 'off' | 'list' | 'song';
    isShuffled: boolean;
    volume: number;
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
    const [queue, setQueue] = useState<SongRanking[]>([]);
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [isPlaying, setIsPlaying] = useState(false);
    const [loopMode, setLoopMode] = useState<'off' | 'list' | 'song'>('off');
    const [isShuffled, setIsShuffled] = useState(false);
    const [volume, setVolumeState] = useState(0.5);

    const currentSong = currentIndex >= 0 && currentIndex < queue.length ? queue[currentIndex] : null;

    const playSong = (song: SongRanking, list?: SongRanking[]) => {
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
        const shouldPlay = !isMobile;

        // If a new list is provided, use it as the queue
        if (list && list.length > 0) {
            // Filter out songs without youtube_id since we only play YouTube
            const validQueue = list.filter(s => !!s.youtube_id);
            setQueue(validQueue);

            const index = validQueue.findIndex(s => s.id === song.id);
            // If the song isn't in the list (or has no YT id), just play it explicitly
            if (index === -1) {
                if (song.youtube_id) {
                    setQueue([song]);
                    setCurrentIndex(0);
                    setIsPlaying(shouldPlay);
                }
            } else {
                setCurrentIndex(index);
                setIsPlaying(shouldPlay);
            }
        } else {
            // Standalone play
            if (song.youtube_id) {
                setQueue([song]);
                setCurrentIndex(0);
                setIsPlaying(shouldPlay);
            }
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
            queue, currentIndex, currentSong, isPlaying, loopMode, isShuffled, volume,
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
