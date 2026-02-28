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

const CARD_W_PX = 640;  // desktop landscape width (4:3 with 480px height)
const CARD_H_PX = 480;   // taller cards
const GAP_PX = 12;
const INTERVAL_MS = 8000;

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
        const max = `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
        const hq = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
        const mq = `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`;
        if (src === max) setSrc(hq);
        else if (src === hq) setSrc(mq);
        else if (src === mq && niconicoThumb) setSrc(niconicoThumb);
    };
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className="absolute inset-0 w-full h-full object-cover" onError={handleError} />;
}

/**
 * Infinite-scroll podium carousel.
 *
 * Strategy: triple the song array […songs…songs…songs…].
 * Start scrolled to the MIDDLE copy. On each interval move to the next card in the middle copy.
 * When we reach the end of the middle copy, instantly (no animation) jump to the same logical
 * position in the middle of the tripled list — seamless loop.
 */
export default function PodiumScroll({ songs }: Props) {
    const n = songs.length;
    // Triple the list for infinite loop
    const tripled = [...songs, ...songs, ...songs];

    const scrollRef = useRef<HTMLDivElement>(null);
    // Current logical index within [0, n) — starts at 0 (#1 song)
    const logicalIdx = useRef(0);
    const timer = useRef<ReturnType<typeof setInterval> | null>(null);
    const isJumping = useRef(false); // suppress interaction pause during silent jump

    // Compute card width responsively (clamped to viewport width)
    const getCardWidth = () => {
        const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
        // On mobile we want the card to be ~90vw so it fills the screen nicely
        return Math.min(CARD_W_PX, Math.floor(vw * 0.88));
    };

    // Scroll to a position in the tripled list — reads actual DOM position so it works
    // on every device/padding/gap combination without hardcoded pixel offsets.
    const scrollToSlot = (copy: number, idx: number, animated: boolean) => {
        const el = scrollRef.current;
        if (!el) return;
        const slotIndex = copy * n + idx;
        const card = el.children[slotIndex] as HTMLElement | undefined;
        if (!card) return;
        const cardLeft = card.offsetLeft;
        const cardW = card.offsetWidth;
        const center = el.clientWidth / 2 - cardW / 2;
        el.scrollTo({
            left: Math.max(0, cardLeft - center),
            behavior: animated ? 'smooth' : 'instant',
        });
    };

    // Start at middle copy, card 0
    useEffect(() => {
        if (n === 0) return;
        // Initial position: middle copy, card 0 (no animation)
        setTimeout(() => scrollToSlot(1, 0, false), 50);

        timer.current = setInterval(() => {
            logicalIdx.current = (logicalIdx.current + 1) % n;
            const nextIdx = logicalIdx.current;

            if (nextIdx === 0) {
                // We just crossed from last card (copy 1, slot n-1) into first card.
                // Scroll RIGHTWARD to the RIGHT copy's card 0 (copy 2, slot 0) — always moves right.
                scrollToSlot(2, 0, true);
                // After animation finishes, invisibly jump to middle copy card 0 (identical visual)
                setTimeout(() => {
                    isJumping.current = true;
                    scrollToSlot(1, 0, false);
                    setTimeout(() => { isJumping.current = false; }, 100);
                }, 700);
            } else {
                // Normal advance: scroll to next card in middle copy (always rightward)
                scrollToSlot(1, nextIdx, true);
            }
        }, INTERVAL_MS);

        return () => { if (timer.current) clearInterval(timer.current); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [n]);

    // When wrapping from last → first, we actually want the visible scroll to come from
    // the RIGHT copy. Rework: instead scroll forward always in the tripled array.
    // Let's use a different approach: track an absolute slot index in [n, 2n) (middle copy),
    // move forward by 1 each tick. When we reach slot 2n-1 → next would be 2n (right copy start).
    // After reaching slot 2n, silently reset to slot n (middle copy start).

    const pause = () => {
        if (isJumping.current) return;
        if (timer.current) { clearInterval(timer.current); timer.current = null; }
    };
    const resume = () => {
        if (timer.current) return;
        timer.current = setInterval(() => {
            logicalIdx.current = (logicalIdx.current + 1) % n;
            const nextIdx = logicalIdx.current;
            if (nextIdx === 0) {
                scrollToSlot(2, 0, true);
                setTimeout(() => {
                    isJumping.current = true;
                    scrollToSlot(1, 0, false);
                    setTimeout(() => { isJumping.current = false; }, 100);
                }, 700);
            } else {
                scrollToSlot(1, nextIdx, true);
            }
        }, INTERVAL_MS);
    };

    return (
        <div
            ref={scrollRef}
            onMouseEnter={pause}
            onMouseLeave={() => setTimeout(resume, 1500)}
            onTouchStart={pause}
            onTouchEnd={() => setTimeout(resume, 3000)}
            className="flex gap-3 overflow-x-auto pb-2"
            style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                paddingLeft: '1rem',
                paddingRight: '1rem',
            } as React.CSSProperties}
        >
            {tripled.map((song, triIdx) => {
                const rank = (triIdx % n) + 1;
                const title = song.name_japanese || song.name_english || song.name_romaji || '—';
                const artistLabel = song.artists?.map(a => a.name).join(' · ') || song.artist_string?.replace(/, /g, ' · ');

                return (
                    <Link
                        key={`${song.id}-${triIdx}`}
                        href={`/song/${song.id}`}
                        draggable={false}
                        className="group flex-none relative overflow-hidden cursor-pointer"
                        style={{
                            width: `min(${CARD_W_PX}px, 88vw)`,
                            height: `min(${CARD_H_PX}px, 62vw)`,
                            minWidth: `min(${CARD_W_PX}px, 88vw)`,
                            border: `1px solid ${rank <= 3 ? `${rankColor(rank)}50` : 'var(--hairline)'}`,
                        }}
                    >
                        <PodiumImage youtubeId={song.youtube_id} niconicoThumb={song.niconico_thumb_url} alt={title} />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                        <span
                            className="absolute top-3 left-4 font-black text-2xl select-none drop-shadow-lg"
                            style={{ color: rankColor(rank) }}
                        >
                            {String(rank).padStart(2, '0')}
                        </span>
                        <div className="absolute bottom-0 left-0 right-0 p-4">
                            <p className="font-bold text-white truncate drop-shadow-md group-hover:text-[var(--vermilion)] transition-colors text-sm md:text-base">
                                {title}
                            </p>
                            <p className="text-xs text-white/70 truncate mt-0.5 drop-shadow-md">
                                {artistLabel}
                            </p>
                        </div>
                        {rank <= 3 && (
                            <div
                                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                                style={{ boxShadow: `inset 0 0 20px ${rankColor(rank)}30` }}
                            />
                        )}
                    </Link>
                );
            })}
        </div>
    );
}
