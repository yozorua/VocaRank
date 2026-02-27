'use client';

import { useEffect, useRef, useState } from 'react';
import { Link } from '@/i18n/navigation';

type SongRow = {
    id: number;
    name_japanese: string | null;
    name_english: string | null;
    name_romaji: string | null;
    artist_string: string;
    artists?: { name: string }[] | null;
    increment_total: number;
    increment_niconico?: number;
    niconico_thumb_url?: string | null;
    youtube_id?: string | null;
};

type Props = {
    songs: SongRow[];
    locale: string;
};

const MEDAL: Record<number, string> = { 1: '#D4AF37', 2: '#A8A9AD', 3: '#CD7F32' };
const rankColor = (rank: number) => MEDAL[rank] ?? 'rgba(255,255,255,0.35)';

const CARD_W = 540;   // px — uniform width for all cards
const CARD_H = 440;   // px — uniform height for all cards
const SCROLL_INTERVAL = 8000;

/** Podium-specific thumbnail: maxresdefault → hqdefault → mqdefault → niconico */
function PodiumImage({ youtubeId, niconicoThumb, alt }: { youtubeId?: string | null; niconicoThumb?: string | null; alt: string }) {
    const buildSrc = () => {
        if (youtubeId) return `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
        if (niconicoThumb) return niconicoThumb;
        return null;
    };
    const [src, setSrc] = useState<string | null>(buildSrc);
    if (!src) return <div className="absolute inset-0 bg-[var(--bg-panel)]" />;
    const handleError = () => {
        if (!youtubeId) return;
        const hq = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
        const mq = `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`;
        const max = `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
        if (src === max) setSrc(hq);
        else if (src === hq) setSrc(mq);
        else if (src === mq && niconicoThumb) setSrc(niconicoThumb);
    };
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className="absolute inset-0 w-full h-full object-cover" onError={handleError} />;
}

export default function PodiumScroll({ songs, locale }: Props) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const currentIdx = useRef(0);
    const timer = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el || songs.length === 0) return;

        // Smooth scroll to a card by index
        const scrollToCard = (idx: number) => {
            const cardWidth = CARD_W + 12; // card + gap-3 (12px)
            const containerCenter = el.clientWidth / 2;
            const targetScrollLeft = idx * cardWidth - containerCenter + CARD_W / 2;
            el.scrollTo({ left: Math.max(0, targetScrollLeft), behavior: 'smooth' });
        };

        // Start centered on card 0
        scrollToCard(0);

        timer.current = setInterval(() => {
            currentIdx.current = (currentIdx.current + 1) % songs.length;
            scrollToCard(currentIdx.current);
        }, SCROLL_INTERVAL);

        return () => {
            if (timer.current) clearInterval(timer.current);
        };
    }, [songs.length]);

    // Pause auto-scroll on manual interaction, resume after 5s
    const handleInteraction = () => {
        if (timer.current) {
            clearInterval(timer.current);
            timer.current = null;
        }
        const el = scrollRef.current;
        if (!el) return;
        setTimeout(() => {
            timer.current = setInterval(() => {
                currentIdx.current = (currentIdx.current + 1) % songs.length;
                const cardWidth = CARD_W + 12;
                const containerCenter = el.clientWidth / 2;
                const targetScrollLeft = currentIdx.current * cardWidth - containerCenter + CARD_W / 2;
                el.scrollTo({ left: Math.max(0, targetScrollLeft), behavior: 'smooth' });
            }, SCROLL_INTERVAL);
        }, 5000);
    };

    return (
        <div
            ref={scrollRef}
            onMouseDown={handleInteraction}
            onTouchStart={handleInteraction}
            className="flex gap-3 overflow-x-auto px-4 md:px-6 pb-2 scroll-smooth"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
        >
            {songs.map((song, idx) => {
                const rank = idx + 1;
                const title = song.name_japanese || song.name_english || song.name_romaji || '—';
                const artistLabel = song.artists?.map(a => a.name).join(' · ') || song.artist_string?.replace(/, /g, ' · ');

                return (
                    <Link
                        key={song.id}
                        href={`/song/${song.id}`}
                        className="group flex-none relative overflow-hidden cursor-pointer transition-all duration-300"
                        style={{
                            width: CARD_W,
                            height: CARD_H,
                            border: `1px solid ${rank <= 3 ? `${rankColor(rank)}50` : 'var(--hairline)'}`,
                        }}
                    >
                        {/* Thumbnail */}
                        {(song.youtube_id || song.niconico_thumb_url) ? (
                            <PodiumImage
                                youtubeId={song.youtube_id || ''}
                                niconicoThumb={song.niconico_thumb_url}
                                alt={title}
                            />
                        ) : (
                            <div className="absolute inset-0 bg-[var(--bg-panel)]" />
                        )}

                        {/* Gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

                        {/* Rank badge */}
                        <span
                            className="absolute top-3 left-4 font-black text-2xl select-none drop-shadow-lg"
                            style={{ color: rankColor(rank) }}
                        >
                            {String(rank).padStart(2, '0')}
                        </span>

                        {/* Song info */}
                        <div className="absolute bottom-0 left-0 right-0 p-4">
                            <p className="font-bold text-white truncate drop-shadow-md group-hover:text-[var(--vermilion)] transition-colors text-base">
                                {title}
                            </p>
                            <p className="text-xs text-white/70 truncate mt-0.5 drop-shadow-md">
                                {artistLabel}
                            </p>
                        </div>

                        {/* Medal glow (top 3) */}
                        {rank <= 3 && (
                            <div
                                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                                style={{ boxShadow: `inset 0 0 20px ${rankColor(rank)}30` }}
                            />
                        )}
                    </Link>
                );
            })}
            <div className="flex-none w-4" />
        </div>
    );
}
