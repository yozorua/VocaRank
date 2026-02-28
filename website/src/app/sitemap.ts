import { MetadataRoute } from 'next';
import { API_BASE_URL } from '@/lib/api';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://vocarank.live';
const LOCALES = ['en', 'ja', 'zh-TW'];

function localeUrls(path: string): MetadataRoute.Sitemap[number] {
    return {
        url: `${BASE_URL}/en${path}`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 0.8,
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
        localeUrls('/ranking'),
        localeUrls('/search'),
        localeUrls('/playlist'),
        localeUrls('/statistic/vocaloid'),
        localeUrls('/statistic/producer-network'),
        localeUrls('/statistic/vocalist-network'),
    ];

    // Fetch top songs dynamically
    let songRoutes: MetadataRoute.Sitemap = [];
    try {
        const res = await fetch(`${API_BASE_URL}/rankings?limit=500`, { next: { revalidate: 86400 } });
        if (res.ok) {
            const data = await res.json();
            const songs = Array.isArray(data) ? data : (data.songs ?? []);
            songRoutes = songs.slice(0, 500).map((s: { id: number }) => ({
                url: `${BASE_URL}/en/song/${s.id}`,
                lastModified: new Date(),
                changeFrequency: 'weekly' as const,
                priority: 0.6,
                alternates: {
                    languages: Object.fromEntries(LOCALES.map(l => [l, `${BASE_URL}/${l}/song/${s.id}`])),
                },
            }));
        }
    } catch { }

    return [...staticRoutes, ...songRoutes];
}
