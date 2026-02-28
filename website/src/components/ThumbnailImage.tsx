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
 * 1. YouTube hqdefault
 * 2. YouTube mqdefault
 * 3. Niconico thumbnail    (final fallback, even when youtube_id is present)
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

    // YouTube's hqdefault.jpg has black bars baked into the top and bottom.
    // We apply scale-[1.35] to zoom past the bars, but ONLY if it's the hqdefault image.
    const isHqDefault = src?.includes('hqdefault.jpg');
    const finalClassName = `${className || ''} ${isHqDefault ? 'scale-[1.35]' : ''}`.trim();

    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={src}
            alt={alt}
            className={finalClassName}
            style={{ objectFit: 'cover' }}
            onError={handleError}
        />
    );
}