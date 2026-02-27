'use client';

import { useState } from 'react';

type Props = {
    youtubeId?: string | null;
    niconicoThumb?: string | null;
    alt: string;
    className?: string;
};

/**
 * Priority:
 *  1. YouTube maxresdefault  (if youtube_id present — always prefer for quality)
 *  2. YouTube hqdefault      (fallback when maxres doesn't exist)
 *  3. YouTube mqdefault      (further fallback)
 *  4. Niconico thumbnail     (only if no youtube_id at all)
 */
export default function ThumbnailImage({ youtubeId, niconicoThumb, alt, className }: Props) {
    const buildSrc = () => {
        if (youtubeId) return `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
        if (niconicoThumb) return niconicoThumb;
        return null;
    };

    const [src, setSrc] = useState<string | null>(buildSrc);

    if (!src) return null;

    const handleError = () => {
        if (!youtubeId) return; // niconico already — nothing to fall back to
        const hq = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
        const mq = `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`;
        const max = `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;

        if (src === max) setSrc(hq);
        else if (src === hq) setSrc(mq);
        // mqdefault always exists — stop here
    };

    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className={className} onError={handleError} />
    );
}
