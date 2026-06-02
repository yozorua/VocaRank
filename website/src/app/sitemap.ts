import { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://vocarank.live';
const API = process.env.API_URL_INTERNAL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const LOCALES = ['en', 'zh-TW', 'ja', 'ar', 'es'];

function localeUrls(
    path: string,
    priority = 0.8,
    changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] = 'daily',
): MetadataRoute.Sitemap {
    return LOCALES.map(locale => ({
        url: `${BASE_URL}/${locale}${path}`,
        lastModified: new Date(),
        changeFrequency,
        priority,
    }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const staticRoutes: MetadataRoute.Sitemap = [
        ...LOCALES.map(locale => ({
            url: `${BASE_URL}/${locale}`,
            lastModified: new Date(),
            changeFrequency: 'daily' as const,
            priority: 1.0,
        })),
        ...localeUrls('/ranking', 0.9, 'daily'),
        ...localeUrls('/trending', 0.8, 'daily'),
        ...localeUrls('/search', 0.8, 'weekly'),
        ...localeUrls('/playlist', 0.7, 'daily'),
        ...localeUrls('/about', 0.5, 'monthly'),
        ...localeUrls('/statistic/vocaloid', 0.6, 'weekly'),
        ...localeUrls('/statistic/producer-network', 0.6, 'weekly'),
        ...localeUrls('/statistic/vocalist-network', 0.6, 'weekly'),
    ];

    // Official live pages
    let liveRoutes: MetadataRoute.Sitemap = [];
    try {
        const res = await fetch(`${API}/official-lives`, { cache: 'no-store' });
        if (res.ok) {
            const lives: { slug: string }[] = await res.json();
            liveRoutes = lives.flatMap(live =>
                LOCALES.map(locale => ({
                    url: `${BASE_URL}/${locale}/playlist/live/${live.slug}`,
                    lastModified: new Date(),
                    changeFrequency: 'weekly' as const,
                    priority: 0.7,
                }))
            );
        } else {
            console.error(`[sitemap] official-lives API returned ${res.status}`);
        }
    } catch (e) {
        console.error('[sitemap] failed to fetch official-lives:', e);
    }

    // Public playlist pages
    let playlistRoutes: MetadataRoute.Sitemap = [];
    try {
        const res = await fetch(`${API}/playlists?per_page=200`, { cache: 'no-store' });
        if (res.ok) {
            const playlists: { id: number }[] = await res.json();
            playlistRoutes = playlists.flatMap(pl =>
                LOCALES.map(locale => ({
                    url: `${BASE_URL}/${locale}/playlist/${pl.id}`,
                    lastModified: new Date(),
                    changeFrequency: 'weekly' as const,
                    priority: 0.6,
                }))
            );
        } else {
            console.error(`[sitemap] playlists API returned ${res.status}`);
        }
    } catch (e) {
        console.error('[sitemap] failed to fetch playlists:', e);
    }

    // Top 100 songs from total ranking
    let songRoutes: MetadataRoute.Sitemap = [];
    try {
        const res = await fetch(
            `${API}/rankings/total?limit=100&vocaloid_only=false&sort_by=total`,
            { cache: 'no-store' },
        );
        if (res.ok) {
            const songs: { id: number }[] = await res.json();
            songRoutes = songs.flatMap(song =>
                LOCALES.map(locale => ({
                    url: `${BASE_URL}/${locale}/song/${song.id}`,
                    lastModified: new Date(),
                    changeFrequency: 'weekly' as const,
                    priority: 0.8,
                }))
            );
        } else {
            console.error(`[sitemap] songs API returned ${res.status}`);
        }
    } catch (e) {
        console.error('[sitemap] failed to fetch songs:', e);
    }

    return [...staticRoutes, ...liveRoutes, ...playlistRoutes, ...songRoutes];
}
