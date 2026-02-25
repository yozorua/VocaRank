'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { usePlayer } from '@/contexts/PlayerContext';

const ReactPlayer = dynamic(() => import('react-player'), { ssr: false });
import { SongRanking } from '@/types';
import { useRouter } from '@/i18n/navigation';
import FavoriteButton from './FavoriteButton';

export default function GlobalPlayer() {
    const {
        currentSong,
        isPlaying,
        togglePlay,
        nextSong,
        prevSong,
        queue,
        currentIndex,
        volume,
        setVolume,
        loopMode,
        toggleLoop,
        isShuffled,
        toggleShuffle,
        clearPlayer
    } = usePlayer();

    const router = useRouter();
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const playerRef = useRef<any>(null);
    const handleProgress = (state: any) => {
        setProgress(state.played);
    };

    const handleDuration = (duration: number) => {
        setDuration(duration);
    };

    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        const bounds = e.currentTarget.getBoundingClientRect();
        const percent = (e.clientX - bounds.left) / bounds.width;
        if (playerRef.current) {
            playerRef.current.seekTo(percent);
            setProgress(percent);
        }
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <>
            {/* The hidden YouTube player stays permanently mounted to fix iOS/Safari double-click autoplay policies. Must not be display:none or 0x0 */}
            <div className="fixed bottom-0 right-0 w-px h-px opacity-0 pointer-events-none z-[-1] overflow-hidden">
                <ReactPlayer
                    ref={playerRef}
                    url={currentSong?.youtube_id ? `https://www.youtube.com/watch?v=${currentSong.youtube_id}` : undefined}
                    playing={isPlaying}
                    volume={volume}
                    loop={loopMode === 'song'}
                    onProgress={handleProgress as any}
                    onDuration={handleDuration}
                    onEnded={nextSong}
                    width="0"
                    height="0"
                    config={{
                        youtube: {
                            playerVars: { showinfo: 0, controls: 0, autoplay: 1, playsinline: 1 } as any
                        }
                    }}
                />
            </div>

            {currentSong && (
                <div className="fixed bottom-0 left-0 w-full z-[100] animate-in slide-in-from-bottom-full duration-500">
                    {/* Global Player UI container */}
                    <div className="bg-[var(--bg-dark)]/90 backdrop-blur-xl border-t border-[var(--hairline-strong)] shadow-[0_-10px_30px_rgba(0,0,0,0.5)] safe-area-pb">

                        {/* Progress Bar (Interactive) */}
                        <div
                            className="w-full h-1 bg-white/10 cursor-pointer group relative"
                            onClick={handleSeek}
                        >
                            <div
                                className="h-full bg-[var(--vermilion)] relative"
                                style={{ width: `${progress * 100}%` }}
                            >
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-1/2 shadow-lg"></div>
                            </div>
                        </div>

                        <div className="max-w-[var(--max-width)] mx-auto px-2 sm:px-6 h-[72px] flex items-center justify-between gap-2 sm:gap-4">

                            {/* 1. Track Info Section */}
                            <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0 h-full py-2">
                                {/* Thumbnail */}
                                <div className="h-full aspect-video bg-black rounded overflow-hidden flex-shrink-0 relative group cursor-pointer border border-[var(--hairline)]" onClick={() => router.push(`/song/${currentSong.id}`)}>
                                    <img
                                        src={`https://i.ytimg.com/vi/${currentSong.youtube_id}/mqdefault.jpg`}
                                        alt="Thumbnail"
                                        className="w-full h-full object-cover grayscale-[30%] group-hover:grayscale-0 transition-all duration-300"
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                                    </div>
                                </div>

                                {/* Title & Artists */}
                                <div className="flex flex-col flex-1 min-w-0 justify-center">
                                    <span
                                        className="text-white font-bold text-xs sm:text-sm line-clamp-1 hover:text-[var(--vermilion)] cursor-pointer transition-colors"
                                        onClick={() => router.push(`/song/${currentSong.id}`)}
                                        title={currentSong.name_japanese || currentSong.name_english || "Unknown Song"}
                                    >
                                        {currentSong.name_japanese || currentSong.name_english || "Unknown Song"}
                                    </span>
                                    <div className="text-[9px] sm:text-[10px] text-gray-300 line-clamp-1 mt-0.5 select-none">
                                        {currentSong.artists?.map((a, i) => (
                                            <React.Fragment key={a.id}>
                                                <span
                                                    className="hover:text-[var(--vermilion)] cursor-pointer transition-colors"
                                                    onClick={(e) => { e.stopPropagation(); router.push(`/artist/${a.id}`); }}
                                                >
                                                    {a.name}
                                                </span>
                                                {i < (currentSong.artists?.length || 0) - 1 ? ' ・ ' : ''}
                                            </React.Fragment>
                                        )) || 'Unknown Artist'}
                                    </div>
                                </div>
                            </div>

                            {/* 2. Controls Section */}
                            <div className="flex items-center justify-center gap-1.5 sm:gap-3 md:gap-4 lg:gap-5 flex-shrink-0 mx-1">
                                {/* Loop */}
                                <button
                                    onClick={toggleLoop}
                                    className={`p-1.5 sm:p-2 transition-colors ${loopMode !== 'off' ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'text-[var(--text-secondary)] hover:text-white'}`}
                                    title={`Loop: ${loopMode === 'off' ? 'Off' : loopMode === 'list' ? 'List' : 'Song'}`}
                                >
                                    {loopMode === 'song' ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="sm:w-5 sm:h-5"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path><text x="12" y="16" textAnchor="middle" fontSize="9" fontWeight="bold" strokeWidth="1" fill="currentColor">1</text></svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="sm:w-5 sm:h-5"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
                                    )}
                                </button>

                                {/* Prev */}
                                <button
                                    onClick={prevSong}
                                    disabled={currentIndex === 0}
                                    className="text-[var(--text-secondary)] hover:text-white disabled:opacity-30 disabled:hover:text-[var(--text-secondary)] transition-colors p-1.5 sm:p-2"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none" className="sm:w-6 sm:h-6"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></line></svg>
                                </button>

                                {/* Play/Pause */}
                                <button
                                    onClick={togglePlay}
                                    className="w-10 h-10 sm:w-12 sm:h-12 bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 rounded-full flex items-center justify-center text-white transition-all duration-300 shadow-[0_0_15px_rgba(255,255,255,0.05)] hover:shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:scale-105 flex-shrink-0"
                                >
                                    {isPlaying ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sm:w-6 sm:h-6"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-1 sm:w-6 sm:h-6"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                                    )}
                                </button>

                                {/* Next */}
                                <button
                                    onClick={nextSong}
                                    disabled={currentIndex === queue.length - 1 && loopMode !== 'list' && !isShuffled}
                                    className="text-[var(--text-secondary)] hover:text-white disabled:opacity-30 disabled:hover:text-[var(--text-secondary)] transition-colors p-1.5 sm:p-2"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none" className="sm:w-6 sm:h-6"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></line></svg>
                                </button>

                                {/* Shuffle */}
                                <button
                                    onClick={toggleShuffle}
                                    className={`p-1.5 sm:p-2 transition-colors ${isShuffled ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'text-[var(--text-secondary)] hover:text-white'}`}
                                    title={isShuffled ? "Shuffle On" : "Shuffle Off"}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="sm:w-5 sm:h-5">
                                        <polyline points="16 3 21 3 21 8"></polyline>
                                        <line x1="4" y1="20" x2="21" y2="3"></line>
                                        <polyline points="21 16 21 21 16 21"></polyline>
                                        <line x1="15" y1="15" x2="21" y2="21"></line>
                                        <line x1="4" y1="4" x2="9" y2="9"></line>
                                    </svg>
                                </button>

                                {/* Favorite - Mobile only */}
                                <div className="sm:hidden flex items-center justify-center scale-[0.65] ml-0">
                                    <FavoriteButton id={currentSong.id} type="song" variant="icon" />
                                </div>
                            </div>

                            {/* 3. Extra controls (Volume, Close, Time) - Hidden on very small screens */}
                            <div className="hidden sm:flex items-center gap-4 flex-1 justify-end min-w-0">
                                <div className="text-[10px] font-mono text-[var(--text-secondary)] w-20 text-right">
                                    {formatTime(progress * duration)} / {formatTime(duration)}
                                </div>

                                {/* Volume icon and slider */}
                                <div className="flex items-center group/volume gap-1">
                                    <button
                                        className="text-[var(--text-secondary)] hover:text-white transition-colors p-2"
                                        onClick={() => setVolume(volume === 0 ? 0.5 : 0)}
                                    >
                                        {volume === 0 ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                                        )}
                                    </button>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.01"
                                        value={volume}
                                        onChange={(e) => setVolume(parseFloat(e.target.value))}
                                        className="w-0 opacity-0 group-hover/volume:w-16 group-hover/volume:opacity-100 transition-all duration-300 accent-[var(--vermilion)] cursor-pointer bg-[var(--hairline-strong)] h-1 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                                    />
                                </div>

                                {/* Favorite */}
                                <div className="flex items-center justify-center scale-75 transform -ml-2">
                                    <FavoriteButton id={currentSong.id} type="song" variant="icon" />
                                </div>

                                <div className="w-px h-6 bg-[var(--hairline-strong)] mx-1"></div>

                                {/* Close Player */}
                                <button
                                    className="text-[var(--text-secondary)] hover:text-[var(--vermilion)] transition-colors p-2"
                                    onClick={clearPlayer}
                                    title="Close Player"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>

                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
