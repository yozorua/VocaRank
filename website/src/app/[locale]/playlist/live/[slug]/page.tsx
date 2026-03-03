import { getTranslations } from 'next-intl/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import LiveDetailClient from './LiveDetailClient';
import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params;
    try {
        const live = await fetchLive(slug);
        if (!live) return {};
        return {
            title: live.name,
            description: live.description || undefined,
            openGraph: {
                title: live.name,
                description: live.description || undefined,
                images: live.cover_url ? [{ url: live.cover_url }] : [],
            },
        };
    } catch {
        return {};
    }
}

const API = process.env.API_URL_INTERNAL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function fetchLive(slug: string) {
    try {
        const res = await fetch(`${API}/official-lives/${slug}`, { cache: 'no-store' });
        if (!res.ok) return null;
        return res.json();
    } catch {
        return null;
    }
}

async function fetchLivePlaylists(slug: string) {
    try {
        const res = await fetch(`${API}/official-lives/${slug}/playlists`, { cache: 'no-store' });
        if (!res.ok) return [];
        return res.json();
    } catch {
        return [];
    }
}

export default async function LiveDetailPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const t = await getTranslations('Playlist');
    const session = await getServerSession(authOptions);
    const isAdmin = session?.isAdmin ?? false;

    const [live, playlists] = await Promise.all([
        fetchLive(slug),
        fetchLivePlaylists(slug),
    ]);

    if (!live) notFound();

    return (
        <div className="min-h-screen">
            <div className="max-w-[var(--max-width)] mx-auto px-6 md:px-12 pt-6 pb-16 flex flex-col gap-8">

                {/* Back link */}
                <Link
                    href="/playlist"
                    className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-white transition-colors w-fit"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    {t('title')}
                </Link>

                {/* Hero */}
                <div className="relative overflow-hidden glass-panel hairline-border">
                    {live.cover_url && (
                        <img
                            src={live.cover_url}
                            alt={live.name}
                            className="absolute inset-0 w-full h-full object-cover opacity-20 blur-sm scale-105"
                        />
                    )}
                    <div className="relative z-10 px-8 py-10 flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight">
                                    {live.name}
                                </h1>
                                {live.description && (
                                    <p className="mt-2 text-[var(--text-secondary)] text-sm md:text-base max-w-2xl">
                                        {live.description}
                                    </p>
                                )}
                                <div className="mt-4 inline-flex items-center gap-2 border border-[var(--hairline)] px-3 py-1 text-xs text-[var(--text-secondary)]">
                                    <span className="text-[var(--text-secondary)]">♪</span>
                                    {t('live_playlist_count', { count: playlists.length })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Playlist grid (client for admin controls) */}
                <LiveDetailClient
                    slug={slug}
                    liveId={live.id}
                    initialPlaylists={playlists}
                    isAdmin={isAdmin}
                    apiToken={session?.apiToken}
                />

            </div>
        </div>
    );
}
