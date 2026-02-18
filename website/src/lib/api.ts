const getBaseUrl = () => {
    if (typeof window !== 'undefined') {
        return process.env.NEXT_PUBLIC_API_URL || '/api';
    }
    // Server-side
    return process.env.API_URL_INTERNAL || 'http://localhost:8000';
};

const API_BASE_URL = getBaseUrl();

import { SongRanking, RankingMode, SongDetail } from '@/types';

export const fetcher = async (url: string, options: RequestInit = {}) => {
    const res = await fetch(`${API_BASE_URL}${url}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    if (!res.ok) {
        const error = new Error('An error occurred while fetching the data.');
        // Attach extra info to the error object.
        (error as any).info = await res.json();
        (error as any).status = res.status;
        throw error;
    }

    return res.json();
};

export const getRankings = async (mode: RankingMode = 'daily', limit: number = 100, sortBy: string = 'total'): Promise<SongRanking[]> => {
    const endpointMap: Record<RankingMode, string> = {
        daily: '/rankings/daily',
        weekly: '/rankings/weekly',
        monthly: '/rankings/monthly',
        total: '/rankings/total',
    };

    // Default sort based on mode if not provided or 'total'
    let effectiveSort = sortBy;
    if (mode !== 'total') {
        // For gain rankings, we might want 'increment_total' as default if not specified
        effectiveSort = sortBy === 'total' ? 'increment_total' : sortBy;
    }

    return fetcher(`${endpointMap[mode]}?limit=${limit}&sort_by=${effectiveSort}`);
};

export const getSong = async (id: number): Promise<SongDetail> => {
    return fetcher(`/songs/${id}`);
};

export const searchSongs = async (query: string, limit: number = 20, vocaloid_only: boolean = true): Promise<SongRanking[]> => {
    return fetcher(`/songs/search?query=${encodeURIComponent(query)}&limit=${limit}&vocaloid_only=${vocaloid_only}`);
};
