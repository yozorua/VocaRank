'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

type Props = {
    label: string;
};

export default function SharePlaylistButton({ label }: Props) {
    const [copied, setCopied] = useState(false);
    const t = useTranslations('Playlist');

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { }
    };

    return (
        <button
            onClick={copy}
            title={label}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs border transition-all duration-200 ${copied
                    ? 'border-[var(--vermilion)]/50 text-[var(--vermilion)]'
                    : 'border-[var(--hairline)] text-[var(--text-secondary)] hover:border-[var(--vermilion)]/40 hover:text-white'
                }`}
        >
            {copied ? (
                <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                    {t('copied')}
                </>
            ) : (
                <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
                    </svg>
                    {label}
                </>
            )}
        </button>
    );
}
