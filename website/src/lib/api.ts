const getBaseUrl = () => {
    if (typeof window !== 'undefined') {
        return process.env.NEXT_PUBLIC_API_URL || '/api';
    }
    // Server-side
    return process.env.API_URL_INTERNAL || 'http://localhost:8000';
};
export const API_BASE_URL = getBaseUrl();

import { SongRanking, RankingMode, SongDetail, Artist } from '@/types';
import { getSession } from 'next-auth/react';

export const fetcher = async (url: string, options: RequestInit = {}) => {
    // Attempt to get the NextAuth session to attach our custom API token
    let token = undefined;
    if (typeof window !== 'undefined') {
        const session = await getSession();
        token = session?.apiToken;
    }

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE_URL}${url}`, {
        ...options,
        headers,
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
    if (mode === 'custom') {
        throw new Error("Use getCustomRankings for custom mode.");
    }

    const endpointMap: Record<string, string> = {
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

export const getCustomRankings = async (
    limit: number = 100,
    songType?: string,
    vocaloidOnly?: boolean,
    publishDateStart?: string,
    publishDateEnd?: string,
    viewsMin?: number,
    viewsMax?: number,
    artistIds?: string,
    sortBy?: string
): Promise<SongRanking[]> => {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());

    if (songType) params.append('song_type', songType);
    if (vocaloidOnly !== undefined) params.append('vocaloid_only', vocaloidOnly.toString());
    if (publishDateStart) params.append('publish_date_start', publishDateStart);
    if (publishDateEnd) params.append('publish_date_end', publishDateEnd);
    if (viewsMin !== undefined) params.append('views_min', viewsMin.toString());
    if (viewsMax !== undefined) params.append('views_max', viewsMax.toString());
    if (artistIds) params.append('artist_ids', artistIds);
    if (sortBy) params.append('sort_by', sortBy);

    return fetcher(`/rankings/custom?${params.toString()}`);
};

export const getSong = async (id: number): Promise<SongDetail> => {
    return fetcher(`/songs/${id}`);
};

export const searchSongs = async (query: string, limit: number = 20, vocaloid_only: boolean = true): Promise<SongRanking[]> => {
    return fetcher(`/songs/search?query=${encodeURIComponent(query)}&limit=${limit}&vocaloid_only=${vocaloid_only}`);
};

export const searchArtists = async (query: string, limit: number = 10): Promise<Artist[]> => {
    return fetcher(`/artists/search?query=${encodeURIComponent(query)}&limit=${limit}`);
};

export const getArtist = async (id: number): Promise<Artist> => {
    return fetcher(`/artists/${id}`);
};

export const getArtistSongs = async (id: number, limit: number = 50, sort_by: string = 'total_views'): Promise<SongRanking[]> => {
    return fetcher(`/artists/${id}/songs?limit=${limit}&sort_by=${sort_by}`);
};

export const getArtistSongDates = async (id: number): Promise<{ year: number; count: number }[]> => {
    return fetcher(`/artists/${id}/song-dates`);
};
