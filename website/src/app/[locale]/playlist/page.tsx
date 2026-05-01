import { Suspense } from 'react';
import { getTranslations, getLocale } from 'next-intl/server';
import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'Playlist' });
    return {
        title: t('title'),
        description: t('description'),
        openGraph: { title: t('title'), description: t('description') },
    };
}

import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { Link } from '@/i18n/navigation';
import PlaylistSearchSection from '@/components/playlist/PlaylistSearchSection';
import OfficialLivesSection from '@/components/playlist/OfficialLivesSection';
import CollapsiblePlaylistSection from '@/components/playlist/CollapsiblePlaylistSection';

const API = process.env.API_URL_INTERNAL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function fetchPublicPlaylists() {
    try {
        const res = await fetch(`${API}/playlists?per_page=10`, { cache: 'no-store' });
        if (!res.ok) return [];
        return res.json();
    } catch {
        return [];
    }
}

async function fetchPublicPlaylistCount() {
    try {
        const res = await fetch(`${API}/playlists/count`, { cache: 'no-store' });
        if (!res.ok) return 0;
        const data = await res.json();
        return data.total as number;
    } catch {
        return 0;
    }
}

async function fetchMyPlaylists(token: string) {
    try {
        const res = await fetch(`${API}/playlists/mine`, {
            cache: 'no-store',
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return [];
        return res.json();
    } catch {
        return [];
    }
}

async function fetchFavoritePlaylists(token: string) {
    try {
        const res = await fetch(`${API}/playlists/favorites`, {
            cache: 'no-store',
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return [];
        return res.json();
    } catch {
        return [];
    }
}

async function fetchOfficialLives() {
    try {
        const res = await fetch(`${API}/official-lives`, { cache: 'no-store' });
        if (!res.ok) return [];
        return res.json();
    } catch {
        return [];
    }
}

// ── Skeleton shown while a section is streaming in ───────────────────────────

function SectionSkeleton() {
    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-4">
                <div className="h-4 w-32 bg-[var(--hairline)] animate-pulse" />
                <div className="flex-1 h-px bg-[var(--hairline)]" />
            </div>
        </div>
    );
}

function BrowseSkeleton() {
    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
                <div className="h-4 w-36 bg-[var(--hairline)] animate-pulse" />
                <div className="flex-1 h-px bg-[var(--hairline)]" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="aspect-square bg-[var(--hairline)] animate-pulse" />
                ))}
            </div>
        </div>
    );
}

// ── Async server sub-components (each streamed independently) ─────────────────

async function FavoritedSection({ token }: { token: string }) {
    const t = await getTranslations('Playlist');
    const playlists = await fetchFavoritePlaylists(token);
    return (
        <CollapsiblePlaylistSection
            label={t('favorited')}
            storageKey="playlist_section_favorited"
            playlists={playlists}
            defaultOpen={true}
        />
    );
}

async function MyPlaylistsSection({ token }: { token: string }) {
    const t = await getTranslations('Playlist');
    const playlists = await fetchMyPlaylists(token);
    return (
        <CollapsiblePlaylistSection
            label={t('mine')}
            storageKey="playlist_section_mine"
            playlists={playlists}
            defaultOpen={true}
        />
    );
}

async function LivesSection() {
    const lives = await fetchOfficialLives();
    return <OfficialLivesSection initialLives={lives} />;
}

async function BrowseSection() {
    const t = await getTranslations('Playlist');
    const [playlists, count] = await Promise.all([fetchPublicPlaylists(), fetchPublicPlaylistCount()]);
    return (
        <PlaylistSearchSection
            initialPlaylists={playlists}
            initialTotal={count}
            browseLabel={t('browse')}
        />
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PlaylistPage() {
    const t = await getTranslations('Playlist');
    const locale = await getLocale();
    const session = await getServerSession(authOptions);
    const apiToken = session?.apiToken as string | undefined;

    return (
        <div className="min-h-screen">
            <div className="max-w-[var(--max-width)] mx-auto px-6 pt-6 pb-16 flex flex-col gap-8">

                {/* Header — renders immediately, no data dependency */}
                <div className="mb-2 flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold mb-1">{t('title')}</h1>
                        <p className="text-[var(--text-secondary)] text-sm md:text-base">{t('description')}</p>
                    </div>
                    {apiToken ? (
                        <Link
                            href="/playlist/new"
                            title={t('create')}
                            className="shrink-0 w-9 h-9 md:w-auto md:h-auto md:px-5 md:py-2.5 flex items-center justify-center text-sm tracking-[0.12em] text-white border border-[var(--hairline-strong)] hover:text-[var(--vermilion)] hover:border-[var(--vermilion)]/50 transition-all"
                        >
                            <span className="md:hidden text-base">+</span>
                            <span className="hidden md:inline">+ {t('create')}</span>
                        </Link>
                    ) : (
                        <a
                            href={`/api/auth/signin?callbackUrl=/${locale}/playlist/new`}
                            title={t('create')}
                            className="shrink-0 w-9 h-9 md:w-auto md:h-auto md:px-5 md:py-2.5 flex items-center justify-center text-sm tracking-[0.12em] text-white border border-[var(--hairline-strong)] hover:text-[var(--vermilion)] hover:border-[var(--vermilion)]/50 transition-all"
                        >
                            <span className="md:hidden text-base">+</span>
                            <span className="hidden md:inline">+ {t('create')}</span>
                        </a>
                    )}
                </div>

                {/* Personal sections — stream in independently */}
                {apiToken && (
                    <>
                        <Suspense fallback={<SectionSkeleton />}>
                            <FavoritedSection token={apiToken} />
                        </Suspense>
                        <Suspense fallback={<SectionSkeleton />}>
                            <MyPlaylistsSection token={apiToken} />
                        </Suspense>
                    </>
                )}

                {/* Official lives — streams in */}
                <Suspense fallback={<SectionSkeleton />}>
                    <LivesSection />
                </Suspense>

                {/* Separator */}
                <div className="border-t border-[var(--hairline)]" />

                {/* Public browse — streams in */}
                <Suspense fallback={<BrowseSkeleton />}>
                    <BrowseSection />
                </Suspense>

            </div>
        </div>
    );
}
