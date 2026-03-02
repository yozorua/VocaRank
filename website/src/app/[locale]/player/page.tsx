'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import ReactPlayer from 'react-player/youtube';
import { usePlayer } from '@/contexts/PlayerContext';
import { useRouter } from 'next/navigation';
import FavoriteButton from '@/components/FavoriteButton';
import { useTranslations, useLocale } from 'next-intl';
import { API_BASE_URL } from '@/lib/api';
import { SongRanking } from '@/types';
import { useSession, signIn } from 'next-auth/react';

export default function PlayerPage() {
    const {
        currentSong,
        isPlaying,
        togglePlay,
        setIsPlaying,
        volume,
        setVolume,
        nextSong,
        prevSong,
        currentIndex,
        queue,
        loopMode,
        toggleLoop,
        isShuffled,
        toggleShuffle,
        playSong,
        isInitialized,
        removeFromQueue,
        addToQueue,
        reorderQueue,
    } = usePlayer();

    const router = useRouter();
    const t = useTranslations();
    const locale = useLocale();
    const { data: session } = useSession();
    const playerRef = useRef<ReactPlayer>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isMounted, setIsMounted] = useState(false);
    const [savedProgress, setSavedProgress] = useState<number | null>(null);
    const [showCopied, setShowCopied] = useState(false);
    const [queueSearch, setQueueSearch] = useState('');
    const [queueSearchResults, setQueueSearchResults] = useState<SongRanking[]>([]);
    const [queueSearchLoading, setQueueSearchLoading] = useState(false);
    const queueSearchTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const isLoadingFromUrl = React.useRef(false);
    const queueDragIdx = React.useRef<number | null>(null);
    const queueDragOverIdx = React.useRef<number | null>(null);
    const [queueDragOver, setQueueDragOver] = React.useState<number | null>(null);

    useEffect(() => {
        setIsMounted(true);
        // Load progress keyed by the current song ID to prevent cross-playlist leaking
        // (Legacy: clear the old generic key)
        localStorage.removeItem('vocarank_progress');
    }, []);

    // Redirect to home if no song is in the queue, BUT wait until Context is Initialized
    useEffect(() => {
        if (!isMounted || !isInitialized) return;

        // Check if loading a shared queue
        const searchParams = new URLSearchParams(window.location.search);
        // Check if loading a playlist by ID (from /playlist/[id] "Play All" button or specific song click)
        const playlistId = searchParams.get('playlist');
        const songIndexStr = searchParams.get('index');

        if (playlistId) {
            window.history.replaceState({}, document.title, window.location.pathname);
            isLoadingFromUrl.current = true;
            const loadPlaylist = async () => {
                try {
                    const apiToken = (session as any)?.apiToken;
                    const headers: HeadersInit = apiToken ? { Authorization: `Bearer ${apiToken}` } : {};
                    const res = await fetch(`${API_BASE_URL}/playlists/${playlistId}`, { headers });
                    if (!res.ok) {
                        console.warn(`[Player] Could not load playlist ${playlistId}: HTTP ${res.status}`);
                        return;
                    }
                    const pl = await res.json();
                    if (!pl.songs || pl.songs.length === 0) return;
                    // Map playlist songs directly — the playlist endpoint already returns all needed fields.
                    // Avoids N individual /songs/{id} fetches which caused random timeouts and dropped songs.
                    const valid: SongRanking[] = (pl.songs as any[])
                        .filter((s) => !!s.youtube_id)
                        .map((s): SongRanking => ({
                            id: s.song_id,
                            name_english: s.name_english ?? null,
                            name_japanese: s.name_japanese ?? null,
                            name_romaji: s.name_romaji ?? null,
                            youtube_id: s.youtube_id,
                            niconico_id: s.niconico_id ?? null,
                            niconico_thumb_url: s.niconico_thumb_url ?? null,
                            artist_string: s.artist_string ?? 'Unknown',
                            vocaloid_string: s.vocalist_string ?? '',
                            total_views: 0,
                            views_youtube: 0,
                            views_niconico: 0,
                            external_links: null,
                            song_type: s.song_type ?? null,
                            publish_date: null,
                            artists: s.artists ?? [],
                            vocalists: s.vocalists ?? [],
                        }));

                    let targetSong = valid[0];
                    if (songIndexStr) {
                        const targetIdx = parseInt(songIndexStr, 10);
                        if (!isNaN(targetIdx) && targetIdx >= 0 && targetIdx < valid.length) {
                            targetSong = valid[targetIdx];
                        }
                    }

                    if (valid.length > 0) playSong(targetSong, valid);
                } catch { }
                finally { isLoadingFromUrl.current = false; }
            };
            loadPlaylist();
            return;
        }

        // Check if loading a shared queue
        const listIds = searchParams.get('list');
        if (listIds) {
            window.history.replaceState({}, document.title, window.location.pathname);
            isLoadingFromUrl.current = true;
            const fetchQueue = async () => {
                try {
                    // Single batch request — avoids N parallel fetches which caused random timeouts/drops
                    const ids = listIds.split(',').filter(x => x.trim()).slice(0, 50).join(',');
                    const res = await fetch(`${API_BASE_URL}/songs/batch?ids=${encodeURIComponent(ids)}`);
                    if (!res.ok) return;
                    const songs: SongRanking[] = await res.json();
                    const validSongs = songs.filter(s => !!s.youtube_id);
                    if (validSongs.length > 0) playSong(validSongs[0], validSongs);
                } catch { }
                finally { isLoadingFromUrl.current = false; }
            };
            fetchQueue();
            return;
        }

        if (!currentSong && !isLoadingFromUrl.current) {
            router.push('/');
        }
    }, [currentSong, isMounted, isInitialized, router, playSong]);

    const handleProgress = useCallback((state: { played: number, playedSeconds: number, loaded: number }) => {
        setProgress(state.played);
        if (state.playedSeconds > 0 && currentSong) {
            localStorage.setItem(`vocarank_progress_${currentSong.id}`, state.playedSeconds.toString());
        }
    }, [currentSong]);

    const handleReady = useCallback(() => {
        if (!currentSong) return;
        const savedKey = `vocarank_progress_${currentSong.id}`;
        const saved = localStorage.getItem(savedKey);
        if (saved && savedProgress === null) {
            const seconds = parseFloat(saved);
            if (seconds > 0 && playerRef.current) {
                playerRef.current.seekTo(seconds, 'seconds');
            }
        } else if (savedProgress !== null && savedProgress > 0 && playerRef.current) {
            playerRef.current.seekTo(savedProgress, 'seconds');
            setSavedProgress(null);
        }
    }, [currentSong, savedProgress]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only trigger if we aren't typing in an input field
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            if (e.code === 'Space') {
                e.preventDefault();
                togglePlay();
            } else if (e.key === 'f' || e.key === 'F') {
                e.preventDefault();
                toggleFullscreen();
            } else if (e.key === 'm' || e.key === 'M') {
                e.preventDefault();
                setVolume(volume === 0 ? 0.8 : 0);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [togglePlay, setVolume, volume]);

    const handleDuration = useCallback((d: number) => {
        setDuration(d);
    }, []);

    const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!playerRef.current) return;
        const bounds = e.currentTarget.getBoundingClientRect();
        const percent = (e.clientX - bounds.left) / bounds.width;
        playerRef.current.seekTo(percent);
        setProgress(percent);
    }, []);

    const formatTime = (seconds: number) => {
        if (!seconds) return '0:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    if (!isMounted || !currentSong) return null;

    const isLooping = loopMode !== 'off';

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    };

    const displayTitle = locale === 'ja' || locale === 'zh-TW'
        ? (currentSong.name_japanese || currentSong.name_romaji || currentSong.name_english)
        : (currentSong.name_english || currentSong.name_romaji || currentSong.name_japanese);

    return (
        <div ref={containerRef} className="min-h-[calc(100vh-16px)] w-full max-w-[var(--max-width)] mx-auto animate-in fade-in duration-500 fullscreen:max-w-none fullscreen:bg-black">

            {/* NEW FULL-HEIGHT WRAPPER: This protects our flexbox from browser fullscreen overrides */}
            <div className="w-full h-full min-h-[calc(100vh-16px)] fullscreen:min-h-screen flex flex-col justify-center pt-4 pb-12 sm:pb-8 px-4 sm:px-6 md:px-8 fullscreen:p-4 lg:fullscreen:p-12">

                {/* Main Content Area */}
                <div className="w-full max-w-screen-2xl mx-auto flex flex-col lg:flex-row gap-4 lg:gap-8 items-center lg:items-start justify-center">

                    {/* Left Side: The Video Player (TOS Compliant) */}
                    <div className="w-full lg:flex-1 max-w-4xl flex flex-col gap-6 min-w-0">
                        {/* Video Container with Overlaid Protection Shield */}
                        <div className="relative w-full aspect-video rounded-xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-[var(--hairline-strong)] bg-black group shrink-0">

                            <ReactPlayer
                                ref={playerRef}
                                url={`https://www.youtube.com/watch?v=${currentSong.youtube_id}`}
                                playing={isPlaying}
                                volume={volume}
                                loop={loopMode === 'song'}
                                onProgress={handleProgress as any}
                                onDuration={handleDuration}
                                onReady={handleReady}
                                onPlay={() => setIsPlaying(true)}
                                onPause={() => setIsPlaying(false)}
                                onEnded={loopMode === 'song' ? undefined : nextSong}
                                width="100%"
                                height="100%"
                                className="absolute inset-0"
                                config={{
                                    playerVars: {
                                        showinfo: 0 as any, controls: 0 as any, autoplay: 1 as any, playsinline: 1 as any,
                                        disablekb: 1 as any, fs: 0 as any, iv_load_policy: 3 as any, rel: 0 as any, modestbranding: 1 as any
                                    }
                                }}
                            />

                        </div>

                        {/* Meta & Controls Bar */}
                        <div className="w-full bg-[var(--bg-dark)]/80 backdrop-blur-xl border border-[var(--hairline)] rounded-2xl p-4 sm:p-6 flex flex-col gap-6 shadow-xl">

                            {/* Title, Artist, and Favorite */}
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <a
                                        href={`/song/${currentSong.id}`}
                                        onClick={(e) => { e.preventDefault(); router.push(`/song/${currentSong.id}`); }}
                                        className="block group/title w-max max-w-full pb-1"
                                    >
                                        <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-[0.05em] text-white leading-tight truncate mb-2 group-hover/title:text-[var(--gold)] transition-colors" title={displayTitle || ''}>
                                            {displayTitle}
                                        </h1>
                                    </a>
                                    <div className="flex flex-col gap-1.5">
                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                            {currentSong.artists && currentSong.artists.map((artist, idx) => (
                                                <React.Fragment key={artist.id}>
                                                    <a
                                                        href={`/artist/${artist.id}`}
                                                        className="text-base sm:text-lg font-serif text-[var(--gold)] hover:text-[#ff8f83] truncate transition-colors cursor-pointer tracking-widest"
                                                        onClick={(e) => { e.preventDefault(); router.push(`/artist/${artist.id}`); }}
                                                    >
                                                        {artist.name}
                                                    </a>
                                                    {idx < currentSong.artists.length - 1 && (
                                                        <span className="text-[var(--text-tertiary)] opacity-50 px-1.5 text-[10px]">•</span>
                                                    )}
                                                </React.Fragment>
                                            ))}
                                        </div>
                                        {/* Desktop Vocalists (Capsules - Square corners) */}
                                        <div className="hidden sm:flex flex-wrap gap-3 mt-3">
                                            {currentSong.vocalists && currentSong.vocalists.length > 0 ? (
                                                currentSong.vocalists.map((artist: any) => (
                                                    <a
                                                        key={artist.id}
                                                        href={`/artist/${artist.id}`}
                                                        onClick={(e) => { e.preventDefault(); router.push(`/artist/${artist.id}`); }}
                                                        className="group inline-flex w-max items-center gap-2 pr-3 border border-[var(--hairline)] hover:border-[var(--vermilion)] transition-all bg-[var(--bg-dark)]"
                                                    >
                                                        <div className="w-6 h-6 flex justify-center items-center bg-[var(--hairline)] shrink-0 overflow-hidden">
                                                            {artist.picture_url_thumb ? (
                                                                <img src={artist.picture_url_thumb} alt={artist.name} className="w-full h-full object-cover object-top grayscale-[10%] group-hover:grayscale-0 transition-transform scale-[1.3] origin-top" />
                                                            ) : (
                                                                <span className="text-[8px] font-serif text-[var(--text-secondary)]">{artist.name.charAt(0)}</span>
                                                            )}
                                                        </div>
                                                        <span className="text-xs font-bold text-[var(--text-secondary)] group-hover:text-white transition-colors tracking-widest">
                                                            {artist.name}
                                                        </span>
                                                    </a>
                                                ))
                                            ) : currentSong.vocaloid_string ? (
                                                <span className="font-bold text-[10px] text-[var(--text-tertiary)] uppercase tracking-[0.2em] mt-1">{currentSong.vocaloid_string}</span>
                                            ) : null}
                                        </div>

                                        {/* Mobile Vocalists (Overlapping Circles, Head Cropped) */}
                                        <div className="flex sm:hidden flex-wrap items-center gap-2 mt-3">
                                            {currentSong.vocalists && currentSong.vocalists.length > 0 ? (
                                                currentSong.vocalists.map((artist: any) => (
                                                    <a
                                                        key={artist.id}
                                                        href={`/artist/${artist.id}`}
                                                        title={artist.name}
                                                        onClick={(e) => { e.preventDefault(); router.push(`/artist/${artist.id}`); }}
                                                        className="group relative w-8 h-8 rounded-full overflow-hidden border border-[var(--hairline)] hover:border-[var(--vermilion)] transition-all bg-[var(--hairline-strong)] flex items-center justify-center hover:z-10 shadow-sm"
                                                    >
                                                        {artist.picture_url_thumb ? (
                                                            <img src={artist.picture_url_thumb} alt={artist.name} className="w-full h-full object-cover object-top grayscale-[20%] group-hover:grayscale-0 transition-transform scale-[1.4] origin-top" />
                                                        ) : (
                                                            <span className="text-[10px] font-serif text-[var(--text-secondary)]">{artist.name.charAt(0)}</span>
                                                        )}
                                                    </a>
                                                ))
                                            ) : currentSong.vocaloid_string ? (
                                                <span className="font-bold text-[10px] text-[var(--text-tertiary)] uppercase tracking-[0.2em] mt-1">{currentSong.vocaloid_string}</span>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex-shrink-0 flex items-center self-start mt-2 sm:mt-1">
                                    <FavoriteButton id={currentSong.id} type="song" variant="icon" />
                                </div>
                            </div>

                            {/* Interactive Progress Bar */}
                            <div className="w-full flex items-center gap-4">
                                <span className="text-xs font-mono text-[var(--text-secondary)] w-10 text-left">{formatTime(progress * duration)}</span>
                                <div className="flex-1 flex items-center group/progress relative py-4 cursor-pointer">
                                    {/* Visual Track */}
                                    <div className="absolute inset-x-0 w-full h-1.5 sm:h-2 bg-black/40 rounded-full pointer-events-none m-auto" style={{ top: 'calc(50% - 3px)' }}>
                                        <div className="absolute left-0 top-0 bottom-0 h-full bg-[var(--vermilion)] rounded-full transition-all duration-75 ease-out" style={{ width: `${Math.max(0, Math.min(100, progress * 100))}%` }} />
                                    </div>
                                    {/* Invisible Range Slider for huge hitbox */}
                                    <input
                                        type="range"
                                        min={0}
                                        max={1}
                                        step="0.001"
                                        value={progress}
                                        onChange={(e) => {
                                            const v = parseFloat(e.target.value);
                                            setProgress(v);
                                            if (playerRef.current) playerRef.current.seekTo(v, 'fraction');
                                        }}
                                        className="w-full h-8 opacity-0 z-10 cursor-pointer absolute inset-0 m-auto"
                                    />
                                    {/* Custom Thumb Dot */}
                                    <div
                                        className="absolute w-3 h-3 bg-white rounded-full shadow-md z-20 pointer-events-none transition-transform sm:scale-0 sm:group-hover/progress:scale-100"
                                        style={{ left: `calc(${progress * 100}% - 6px)`, top: '50%', transform: 'translateY(-50%)' }}
                                    />
                                </div>
                                <span className="text-xs font-mono text-[var(--text-secondary)] w-10">{formatTime(duration)}</span>
                            </div>

                            {/* Transport Controls */}
                            <div className="flex items-center justify-between w-full pt-2">
                                {/* Left Side: Volume */}
                                <div className="hidden sm:flex items-center group/volume gap-3 w-32 border border-transparent hover:border-white/10 rounded-full pl-0 pr-2 py-1 transition-all">
                                    <button
                                        className="text-[var(--text-secondary)] hover:text-white transition-colors"
                                        onClick={() => setVolume(volume === 0 ? 0.5 : 0)}
                                    >
                                        {volume === 0 ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
                                        ) : volume < 0.5 ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>
                                        )}
                                    </button>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.01"
                                        value={volume}
                                        onChange={(e) => setVolume(parseFloat(e.target.value))}
                                        className="w-16 h-1 flex-1 opacity-50 group-hover/volume:opacity-100 transition-all duration-300 accent-white cursor-pointer bg-[var(--hairline-strong)] rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                                    />
                                </div>

                                {/* Center: Play Controls */}
                                <div className="flex items-center justify-center gap-4 sm:gap-6 flex-1 sm:flex-none">
                                    {/* Shuffle */}
                                    <button
                                        onClick={toggleShuffle}
                                        className={`p-2 transition-colors ${isShuffled ? 'text-white' : 'text-[var(--text-secondary)] hover:text-white'}`}
                                        title={isShuffled ? t('Player.shuffle_on') : t('Player.shuffle_off')}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="16 3 21 3 21 8"></polyline>
                                            <line x1="4" y1="20" x2="21" y2="3"></line>
                                            <polyline points="21 16 21 21 16 21"></polyline>
                                            <line x1="15" y1="15" x2="21" y2="21"></line>
                                            <line x1="4" y1="4" x2="9" y2="9"></line>
                                        </svg>
                                    </button>

                                    {/* Prev */}
                                    <button
                                        onClick={prevSong}
                                        disabled={currentIndex === 0}
                                        className="text-white hover:text-[var(--vermilion)] disabled:opacity-30 disabled:hover:text-white transition-colors p-2"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></line></svg>
                                    </button>

                                    {/* Play/Pause */}
                                    <button
                                        onClick={togglePlay}
                                        className="w-12 h-12 sm:w-14 sm:h-14 bg-white/10 hover:bg-white/20 border border-[var(--hairline)] text-white backdrop-blur-md rounded-full flex items-center justify-center transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105 flex-shrink-0"
                                    >
                                        {isPlaying ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-1"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                                        )}
                                    </button>

                                    {/* Next */}
                                    <button
                                        onClick={nextSong}
                                        disabled={currentIndex === queue.length - 1 && loopMode === 'off' && !isShuffled}
                                        className="text-white hover:text-[var(--vermilion)] disabled:opacity-30 disabled:hover:text-white transition-colors p-2"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></line></svg>
                                    </button>

                                    {/* Loop */}
                                    <button
                                        onClick={toggleLoop}
                                        className={`relative p-2 transition-colors ${loopMode !== 'off' ? 'text-[var(--vermilion)] drop-shadow-[0_0_8px_rgba(255,100,80,0.5)]' : 'text-[var(--text-secondary)] hover:text-white'}`}
                                        title={loopMode === 'song' ? t('Player.loop_song') : loopMode === 'list' ? t('Player.loop_list') : t('Player.loop_off')}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
                                        {loopMode === 'song' && (
                                            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black mt-0.5 pointer-events-none" style={{ textShadow: '0 0 4px black' }}>1</span>
                                        )}
                                    </button>
                                </div>

                                {/* Right side spacer for flex centering on desktop */}
                                <div className="hidden sm:flex w-32 items-center justify-end">
                                    <button
                                        onClick={toggleFullscreen}
                                        className="text-[var(--text-secondary)] hover:text-white transition-colors p-2"
                                        title={t('Player.toggle_fullscreen')}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Side: Up Next Sidebar */}
                    <div className="w-full shrink-0 lg:w-96 flex flex-col gap-4 bg-[var(--bg-dark)]/50 backdrop-blur-md rounded-2xl border border-[var(--hairline)] p-4 max-h-[60vh] lg:max-h-[800px] overflow-hidden">
                        <div className="flex items-center justify-between pb-2 border-b border-[var(--hairline-strong)]">
                            <h2 className="text-lg font-bold text-white">{t('Player.up_next')}</h2>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-[var(--text-secondary)] bg-white/5 px-2 py-0.5 rounded-full">{queue.length} {t('Player.tracks')}</span>

                                {/* Share Queue Link */}
                                {queue.length > 0 && (
                                    <button
                                        onClick={() => {
                                            const ids = queue.map(s => s.id).join(',');
                                            const url = `${window.location.origin}/${locale}/player?list=${ids}`;
                                            navigator.clipboard.writeText(url);
                                            setShowCopied(true);
                                            setTimeout(() => setShowCopied(false), 3000);
                                        }}
                                        title={t('Player.copy_playlist_link')}
                                        className="p-1.5 text-[var(--text-secondary)] hover:text-white transition-colors rounded-full hover:bg-white/5 relative"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-10z" /></svg>
                                    </button>
                                )}

                                {queue.length > 0 && (
                                    <a
                                        href={`https://www.youtube.com/watch_videos?video_ids=${queue.filter((s: SongRanking) => s.youtube_id).map((s: SongRanking) => s.youtube_id).slice(0, 50).join(',')}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title={t('Player.open_youtube_playlist')}
                                        className="p-1.5 text-[var(--text-secondary)] hover:text-[#FF0000] transition-colors rounded-full hover:bg-white/5"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29.07 29.07 0 0 0 1 11.75a29.07 29.07 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29.07 29.07 0 0 0 .46-5.33 29.07 29.07 0 0 0-.46-5.33zM9.75 15.02l5.75-3.27-5.75-3.27v6.54z" /></svg>
                                    </a>
                                )}

                                {/* Save Queue to Playlist */}
                                {queue.length > 0 && (
                                    <button
                                        onClick={() => {
                                            if (session) {
                                                // Pass full song objects via localStorage to avoid API re-fetching
                                                localStorage.setItem('vocarank_pending_playlist', JSON.stringify(queue));
                                                window.open(`/${locale}/playlist/new`, '_blank');
                                            } else {
                                                signIn('google');
                                            }
                                        }}
                                        title={t('Player.save_to_playlist')}
                                        className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--vermilion)] transition-colors rounded-full hover:bg-white/5"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="8" y1="6" x2="21" y2="6" />
                                            <line x1="8" y1="12" x2="21" y2="12" />
                                            <line x1="8" y1="18" x2="16" y2="18" />
                                            <line x1="3" y1="6" x2="3.01" y2="6" />
                                            <line x1="3" y1="12" x2="3.01" y2="12" />
                                            <line x1="19" y1="18" x2="19" y2="24" />
                                            <line x1="22" y1="21" x2="16" y2="21" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-1 pr-1 hover:pr-0 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full transition-all duration-300 [scrollbar-width:none] hover:[scrollbar-width:thin]">
                            {queue.map((song: SongRanking, idx: number) => {
                                const isCurrent = idx === currentIndex;
                                const queueSongTitle = locale === 'ja' || locale === 'zh-TW'
                                    ? (song.name_japanese || song.name_romaji || song.name_english)
                                    : (song.name_english || song.name_romaji || song.name_japanese);

                                return (
                                    <div
                                        key={`${song.id}-${idx}`}
                                        draggable
                                        onDragStart={() => { queueDragIdx.current = idx; }}
                                        onDragEnter={() => { queueDragOverIdx.current = idx; setQueueDragOver(idx); }}
                                        onDragOver={e => e.preventDefault()}
                                        onDragEnd={() => {
                                            const from = queueDragIdx.current;
                                            const to = queueDragOverIdx.current;
                                            queueDragIdx.current = null;
                                            queueDragOverIdx.current = null;
                                            setQueueDragOver(null);
                                            if (from !== null && to !== null && from !== to) reorderQueue(from, to);
                                        }}
                                        className={`flex items-center gap-3 p-2 rounded-lg group transition-colors cursor-grab active:cursor-grabbing
                                            ${isCurrent ? 'bg-white/10 border border-white/20' : 'border border-transparent hover:bg-white/5'}
                                            ${queueDragOver === idx ? 'border-t-2 border-t-[var(--vermilion)]/60' : ''}
                                        `}
                                        onClick={() => { if (!isCurrent) playSong(song, queue); }}
                                    >
                                        {/* Drag handle */}
                                        <div className="hidden sm:flex shrink-0 opacity-0 group-hover:opacity-40 transition-opacity text-white">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" /></svg>
                                        </div>
                                        <div className="relative w-12 h-12 rounded overflow-hidden flex-shrink-0 bg-black">
                                            <img src={`https://i.ytimg.com/vi/${song.youtube_id}/mqdefault.jpg`} alt="" className="w-full h-full object-cover" />
                                            {isCurrent && (
                                                <div className="absolute inset-0 bg-[var(--vermilion)]/20 flex items-center justify-center">
                                                    <div className="w-1.5 h-3 bg-white mx-0.5 animate-[bounce_1s_infinite]"></div>
                                                    <div className="w-1.5 h-4 bg-white mx-0.5 animate-[bounce_1.2s_infinite]"></div>
                                                    <div className="w-1.5 h-2.5 bg-white mx-0.5 animate-[bounce_0.8s_infinite]"></div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-bold truncate ${isCurrent ? 'text-white' : 'text-[var(--text-secondary)] group-hover:text-white'}`}>
                                                {queueSongTitle}
                                            </p>
                                            <p className="text-[11px] truncate mt-0.5 text-[var(--text-secondary)]">
                                                {song.artists?.map((a: any) => a.name).join(' · ')}
                                            </p>
                                        </div>
                                        {/* Remove from queue button */}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); removeFromQueue(idx); }}
                                            title="Remove from queue"
                                            className="shrink-0 opacity-0 group-hover:opacity-100 text-[var(--text-secondary)] hover:text-red-400 transition-all p-1 rounded"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                        </button>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Add to Queue search */}
                        <div className="border-t border-[var(--hairline-strong)] pt-3 flex flex-col gap-2">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder={t('Player.add_to_queue')}
                                    value={queueSearch}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setQueueSearch(val);
                                        if (queueSearchTimeout.current) clearTimeout(queueSearchTimeout.current);
                                        if (!val.trim()) { setQueueSearchResults([]); return; }
                                        setQueueSearchLoading(true);
                                        queueSearchTimeout.current = setTimeout(async () => {
                                            try {
                                                const res = await fetch(`${API_BASE_URL}/songs/search?query=${encodeURIComponent(val)}&limit=5`);
                                                if (res.ok) setQueueSearchResults(await res.json());
                                            } catch { }
                                            setQueueSearchLoading(false);
                                        }, 350);
                                    }}
                                    className="w-full bg-white/5 border border-[var(--hairline)] rounded-lg px-3 py-2 pr-8 text-sm text-white placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--vermilion)]/50 transition-colors"
                                />
                                {queueSearch ? (
                                    <button
                                        onClick={() => { setQueueSearch(''); setQueueSearchResults([]); }}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-white transition-colors p-0.5"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                    </button>
                                ) : queueSearchLoading && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
                                    </div>
                                )}
                            </div>
                            {queueSearchResults.length > 0 && (
                                <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                                    {queueSearchResults.map((song) => {
                                        const title = locale === 'ja' || locale === 'zh-TW'
                                            ? (song.name_japanese || song.name_romaji || song.name_english)
                                            : (song.name_english || song.name_romaji || song.name_japanese);
                                        const inQueue = queue.some(s => s.id === song.id);
                                        const producers = song.artists
                                            ?.filter((a: any) => !['Vocaloid', 'UTAU', 'OtherVoiceSynthesizer'].includes(a.artist_type))
                                            .map((a: any) => a.name).join(' · ')
                                            || song.artist_string?.replace(/, /g, ' · ');
                                        return (
                                            <div key={song.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                                                <img src={`https://i.ytimg.com/vi/${song.youtube_id}/mqdefault.jpg`} alt="" className="w-10 h-10 object-cover rounded shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs text-white font-semibold truncate">{title}</p>
                                                    {producers && <p className="text-[10px] text-[var(--text-secondary)] truncate mt-0.5">{producers}</p>}
                                                </div>
                                                <button
                                                    onClick={() => { if (!inQueue) addToQueue(song); }}
                                                    className={`shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${inQueue
                                                        ? 'text-[var(--vermilion)] cursor-default'
                                                        : 'text-[var(--text-secondary)] hover:text-white hover:bg-white/10'
                                                        }`}
                                                >
                                                    {inQueue
                                                        ? <><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg><span>{t('Player.already_in_queue')}</span></>
                                                        : <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                                                    }
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            </div> {/* <-- END NEW FULL-HEIGHT WRAPPER */}

            {/* Toast Notification overlay */}
            <div className={`fixed bottom-8 sm:bottom-12 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 pointer-events-none ${showCopied ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                <div className="bg-white/10 backdrop-blur-xl text-white px-6 py-3 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.6)] font-bold text-sm tracking-wide flex items-center gap-3 border border-white/20">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-[#3fc15f]">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    {t('Player.link_copied')}
                </div>
            </div>
        </div>
    );
}
