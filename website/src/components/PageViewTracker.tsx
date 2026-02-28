'use client';

import { useEffect } from 'react';
import { API_BASE_URL } from '@/lib/api';

export default function PageViewTracker({ page }: { page: string }) {
    useEffect(() => {
        // Increment page views once on mount
        fetch(`${API_BASE_URL}/statistics/page-views/${page}`, { method: 'POST' }).catch(() => { });
    }, [page]);

    return null;
}
