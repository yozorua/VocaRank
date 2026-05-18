import { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://vocarank.live';
const API = process.env.API_URL_INTERNAL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const LOCALES = ['en', 'zh-TW', 'ja', 'ar', 'es'];

function localeUrls(
    path: string,
    priority = 0.8,
    changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] = 'daily',
): MetadataRoute.Sitemap[number] {
    return {
        url: `${BASE_URL}/en${path}`,
        lastModified: new Date(),
        changeFrequency,
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
        localeUrls('/ranking', 0.9, 'daily'),
        localeUrls('/trending', 0.8, 'daily'),
        localeUrls('/search', 0.8, 'weekly'),
        localeUrls('/playlist', 0.7, 'daily'),
        localeUrls('/about', 0.5, 'monthly'),
        localeUrls('/statistic/vocaloid', 0.6, 'weekly'),
        localeUrls('/statistic/producer-network', 0.6, 'weekly'),
        localeUrls('/statistic/vocalist-network', 0.6, 'weekly'),
    ];

    // Official live pages
    let liveRoutes: MetadataRoute.Sitemap = [];
    try {
        const res = await fetch(`${API}/official-lives`, { cache: 'no-store' });
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
            playlistRoutes = playlists.map(pl => ({
                url: `${BASE_URL}/en/playlist/${pl.id}`,
                lastModified: new Date(),
                changeFrequency: 'weekly' as const,
                priority: 0.6,
                alternates: {
                    languages: Object.fromEntries(LOCALES.map(l => [l, `${BASE_URL}/${l}/playlist/${pl.id}`])),
                },
            }));
        } else {
            console.error(`[sitemap] playlists API returned ${res.status}`);
        }
    } catch (e) {
        console.error('[sitemap] failed to fetch playlists:', e);
    }

    // Top 2000 song pages — most-viewed songs are the primary SEO target
    let songRoutes: MetadataRoute.Sitemap = [];
    try {
        const res = await fetch(
            `${API}/rankings/total?limit=2000&vocaloid_only=false&sort_by=total`,
            { cache: 'no-store' },
        );
        if (res.ok) {
            const songs: { id: number }[] = await res.json();
            songRoutes = songs.map(song => ({
                url: `${BASE_URL}/en/song/${song.id}`,
                lastModified: new Date(),
                changeFrequency: 'weekly' as const,
                priority: 0.8,
                alternates: {
                    languages: Object.fromEntries(LOCALES.map(l => [l, `${BASE_URL}/${l}/song/${song.id}`])),
                },
            }));
        } else {
            console.error(`[sitemap] songs API returned ${res.status}`);
        }
    } catch (e) {
        console.error('[sitemap] failed to fetch songs:', e);
    }

    // Artist pages
    let artistRoutes: MetadataRoute.Sitemap = [];
    try {
        const res = await fetch(`${API}/artists/ids?limit=5000`, { cache: 'no-store' });
        if (res.ok) {
            const ids: number[] = await res.json();
            artistRoutes = ids.map(id => ({
                url: `${BASE_URL}/en/artist/${id}`,
                lastModified: new Date(),
                changeFrequency: 'weekly' as const,
                priority: 0.7,
                alternates: {
                    languages: Object.fromEntries(LOCALES.map(l => [l, `${BASE_URL}/${l}/artist/${id}`])),
                },
            }));
        } else {
            console.error(`[sitemap] artists/ids API returned ${res.status}`);
        }
    } catch (e) {
        console.error('[sitemap] failed to fetch artist ids:', e);
    }

    return [...staticRoutes, ...liveRoutes, ...playlistRoutes, ...songRoutes, ...artistRoutes];
}
