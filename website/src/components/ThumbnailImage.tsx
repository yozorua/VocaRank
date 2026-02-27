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
 *  1. YouTube hqdefault
 *  2. YouTube mqdefault
 *  3. Niconico thumbnail    (final fallback, even when youtube_id is present)
 */
export default function ThumbnailImage({ youtubeId, niconicoThumb, alt, className }: Props) {
    const buildSrc = () => {
        if (youtubeId) return `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
        if (niconicoThumb) return niconicoThumb;
        return null;
    };

    const [src, setSrc] = useState<string | null>(buildSrc);

    if (!src) return null;

    const handleError = () => {
        if (!youtubeId) return;
        const hq = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
        const mq = `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`;

        if (src === hq) setSrc(mq);
        else if (src === mq && niconicoThumb) setSrc(niconicoThumb);
    };

    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className={className} onError={handleError} />
    );
}
