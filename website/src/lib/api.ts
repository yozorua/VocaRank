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

    if (res.status === 204) return null;
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
    artistExclusive?: boolean,
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
    if (artistExclusive) params.append('artist_exclusive', 'true');
    if (sortBy) params.append('sort_by', sortBy);

    return fetcher(`/rankings/custom?${params.toString()}`);
};

export const getSong = async (id: number): Promise<SongDetail> => {
    return fetcher(`/songs/${id}`);
};

export interface SearchSongsFilters {
    limit?: number;
    vocaloid_only?: boolean;
    songwriter_type?: string;
    vocalist_ids?: string;
    vocalist_exclusive?: boolean;
    song_type?: string;
    sort_by?: string;
    publish_date_start?: string;
    publish_date_end?: string;
}

export const searchSongs = async (query: string, filters: SearchSongsFilters = {}): Promise<SongRanking[]> => {
    const {
        limit = 20,
        vocaloid_only = true,
        vocalist_ids,
        vocalist_exclusive,
        song_type,
        sort_by,
        publish_date_start,
        publish_date_end,
    } = filters;
    const params = new URLSearchParams();
    params.append('query', query);
    params.append('limit', limit.toString());
    params.append('vocaloid_only', vocaloid_only.toString());
    if (vocalist_ids) params.append('vocalist_ids', vocalist_ids);
    if (vocalist_exclusive) params.append('vocalist_exclusive', 'true');
    if (song_type) params.append('song_type', song_type);
    if (sort_by) params.append('sort_by', sort_by);
    if (publish_date_start) params.append('publish_date_start', publish_date_start);
    if (publish_date_end) params.append('publish_date_end', publish_date_end);
    return fetcher(`/songs/search?${params.toString()}`);
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

// ── About page ────────────────────────────────────────────────────────────────

export const getFounder = () => fetcher('/about/founder');
export const getAnnouncements = () => fetcher('/about/announcements');
export const createAnnouncement = (data: { title: string; content: string; pinned: boolean }) =>
    fetcher('/about/announcements', { method: 'POST', body: JSON.stringify(data) });
export const updateAnnouncement = (id: number, data: { title?: string; content?: string; pinned?: boolean }) =>
    fetcher(`/about/announcements/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteAnnouncement = (id: number) =>
    fetcher(`/about/announcements/${id}`, { method: 'DELETE' });

export const getRoadmap = () => fetcher('/about/roadmap');
export const createRoadmapItem = (data: { title: string; description?: string; status: string; display_order: number; event_date?: string; title_zh_tw?: string; title_ja?: string; description_zh_tw?: string; description_ja?: string }) =>
    fetcher('/about/roadmap', { method: 'POST', body: JSON.stringify(data) });
export const updateRoadmapItem = (id: number, data: { title?: string; description?: string; status?: string; display_order?: number; event_date?: string; title_zh_tw?: string; title_ja?: string; description_zh_tw?: string; description_ja?: string }) =>
    fetcher(`/about/roadmap/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteRoadmapItem = (id: number) =>
    fetcher(`/about/roadmap/${id}`, { method: 'DELETE' });

export const getReports = (type?: string) =>
    fetcher(`/about/reports${type ? `?report_type=${type}` : ''}`);
export const getMyUpvotes = () => fetcher('/about/reports/me');
export const createReport = (data: { report_type: string; title: string; description?: string }) =>
    fetcher('/about/reports', { method: 'POST', body: JSON.stringify(data) });
export const toggleReportUpvote = (id: number) =>
    fetcher(`/about/reports/${id}/upvote`, { method: 'POST' });
export const updateReportStatus = (id: number, status: string) =>
    fetcher(`/about/reports/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
export const deleteReport = (id: number) =>
    fetcher(`/about/reports/${id}`, { method: 'DELETE' });
export const updateFounder = (data: { contact_email?: string; social_x?: string; social_instagram?: string; social_facebook?: string; social_discord?: string; about_title?: string; paypal_url?: string }) =>
    fetcher('/about/founder', { method: 'PATCH', body: JSON.stringify(data) });

export const getContributors = () => fetcher('/about/contributors');
export const createContributor = (data: { user_id: number; role?: string; display_order?: number }) =>
    fetcher('/about/contributors', { method: 'POST', body: JSON.stringify(data) });
export const updateContributor = (id: number, data: { role?: string; display_order?: number }) =>
    fetcher(`/about/contributors/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteContributor = (id: number) =>
    fetcher(`/about/contributors/${id}`, { method: 'DELETE' });
