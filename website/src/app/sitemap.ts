import { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://vocarank.live';
const API = process.env.API_URL_INTERNAL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const LOCALES = ['en', 'ja', 'zh-TW'];

function localeUrls(path: string, priority = 0.8): MetadataRoute.Sitemap[number] {
    return {
        url: `${BASE_URL}/en${path}`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority,
        alternates: {
            languages: Object.fromEntries(LOCALES.map(l => [l, `${BASE_URL}/${l}${path}`])),
        },
    };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const staticRoutes: MetadataRoute.Sitemap = [
        {
            url: `${BASE_URL}/en`,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 1.0,
            alternates: {
                languages: Object.fromEntries(LOCALES.map(l => [l, `${BASE_URL}/${l}`])),
            },
        },
        localeUrls('/ranking', 0.9),
        localeUrls('/search', 0.8),
        localeUrls('/playlist', 0.8),
        localeUrls('/statistic/vocaloid', 0.7),
        localeUrls('/statistic/producer-network', 0.7),
        localeUrls('/statistic/vocalist-network', 0.7),
    ];

    // Official live pages
    let liveRoutes: MetadataRoute.Sitemap = [];
    try {
        const res = await fetch(`${API}/official-lives`, { next: { revalidate: 86400 } });
        if (res.ok) {
            const lives: { slug: string }[] = await res.json();
            liveRoutes = lives.map(live => ({
                url: `${BASE_URL}/en/playlist/live/${live.slug}`,
                lastModified: new Date(),
                changeFrequency: 'weekly' as const,
                priority: 0.7,
                alternates: {
                    languages: Object.fromEntries(LOCALES.map(l => [l, `${BASE_URL}/${l}/playlist/live/${live.slug}`])),
                },
            }));
        }
    } catch { }

    // Public playlist pages
    let playlistRoutes: MetadataRoute.Sitemap = [];
    try {
        const res = await fetch(`${API}/playlists?per_page=200`, { next: { revalidate: 86400 } });
        if (res.ok) {
            const playlists: { id: number }[] = await res.json();
            playlistRoutes = playlists.map(pl => ({
                url: `${BASE_URL}/en/playlist/${pl.id}`,
                lastModified: new Date(),
                changeFrequency: 'weekly' as const,
                priority: 0.6,
                alternates: {
                    languages: Object.fromEntries(LOCALES.map(l => [l, `${BASE_URL}/${l}/playlist/${pl.id}`])),
                },
            }));
        }
    } catch { }

    return [...staticRoutes, ...liveRoutes, ...playlistRoutes];
}
