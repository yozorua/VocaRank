'use client';

import { useState, useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';

interface Props {
    defaultValue: string;
    placeholder: string;
}

export default function SearchPageInputClient({ defaultValue, placeholder }: Props) {
    const [query, setQuery] = useState(defaultValue);
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        // Skip initial render or external sync
        if (query === (searchParams.get('q') || '')) return;

        const debounceId = setTimeout(() => {
            const params = new URLSearchParams(searchParams.toString());
            if (query.trim()) {
                params.set('q', query.trim());
            } else {
                params.delete('q');
            }
            const search = params.toString();
            router.push(`/search${search ? `?${search}` : ''}`);
        }, 400);

        return () => clearTimeout(debounceId);
    }, [query, router, searchParams]);

    return (
        <div className="relative w-full">
            <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                autoComplete="off"
                className="w-full bg-[var(--bg-dark)] border-b-2 border-[var(--hairline-strong)] text-white text-lg px-2 py-4 pr-10 focus:outline-none focus:border-[var(--vermilion)] transition-colors placeholder:text-[var(--text-secondary)] placeholder:text-sm placeholder:tracking-wider placeholder:font-sans font-bold shadow-none"
            />
            {query && (
                <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-white transition-colors p-1"
                    aria-label="Clear"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            )}
        </div>
    );
}
