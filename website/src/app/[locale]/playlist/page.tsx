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
        const res = await fetch(`${API}/playlists?per_page=40`, { cache: 'no-store' });
        if (!res.ok) return [];
        return res.json();
    } catch {
        return [];
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

export default async function PlaylistPage() {
    const t = await getTranslations('Playlist');
    const locale = await getLocale();
    const session = await getServerSession(authOptions);
    const apiToken = session?.apiToken as string | undefined;

    const [publicPlaylists, myPlaylists, favoritedPlaylists, officialLives] = await Promise.all([
        fetchPublicPlaylists(),
        apiToken ? fetchMyPlaylists(apiToken) : Promise.resolve([]),
        apiToken ? fetchFavoritePlaylists(apiToken) : Promise.resolve([]),
        fetchOfficialLives(),
    ]);

    return (
        <div className="min-h-screen">
            <div className="max-w-[var(--max-width)] mx-auto px-6 md:px-12 pt-4 pb-16 flex flex-col gap-8">

                {/* Header */}
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

                {/* Official Lives — client component so admin controls & modals work */}
                <OfficialLivesSection initialLives={officialLives} />

                {/* My Playlists — collapsible, default open */}
                <CollapsiblePlaylistSection
                    label={t('mine')}
                    storageKey="playlist_section_mine"
                    playlists={myPlaylists}
                    defaultOpen={true}
                />

                {/* Favorited Playlists — collapsible, default open */}
                <CollapsiblePlaylistSection
                    label={t('favorited')}
                    storageKey="playlist_section_favorited"
                    playlists={favoritedPlaylists}
                    defaultOpen={true}
                />

                {/* Browse Playlists with search */}
                <div className="flex flex-col gap-4">
                    <h2 className="text-sm font-semibold text-[var(--text-secondary)] tracking-[0.3em]">
                        {t('browse')}
                    </h2>
                    <PlaylistSearchSection initialPlaylists={publicPlaylists} />
                </div>

            </div>
        </div>
    );
}
