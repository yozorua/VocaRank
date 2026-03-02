'use client';

import { useEffect, useState } from 'react';
import { API_BASE_URL } from '@/lib/api';

type Props = {
    page: string;
    label: string; // localized label
};

export default function FooterPageViews({ page, label }: Props) {
    const [views, setViews] = useState<number | null>(null);

    useEffect(() => {
        const fetchViews = async () => {
            try {
                // Pre-fetch current views
                const getRes = await fetch(`${API_BASE_URL}/statistics/page-views/${page}`);
                if (getRes.ok) {
                    const data = await getRes.json();
                    setViews(data.view_count);
                }
            } catch (err) {
                // Ignore error
            }
        };
        fetchViews();
    }, [page]);

    if (views === null) return null;

    return (
        <p className="text-xs text-[var(--text-secondary)] opacity-40 flex items-baseline gap-1.5 justify-center">
            <span>{label}:</span>
            <span className="font-mono">{views.toLocaleString()}</span>
        </p>
    );
}
