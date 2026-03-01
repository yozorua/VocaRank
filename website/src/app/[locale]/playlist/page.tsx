import { getTranslations, getLocale } from 'next-intl/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { Link } from '@/i18n/navigation';
import PlaylistCard from '@/components/playlist/PlaylistCard';

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

export default async function PlaylistPage() {
    const t = await getTranslations('Playlist');
    const locale = await getLocale();
    const session = await getServerSession(authOptions);
    const apiToken = (session as any)?.apiToken as string | undefined;

    const [publicPlaylists, myPlaylists, favoritedPlaylists] = await Promise.all([
        fetchPublicPlaylists(),
        apiToken ? fetchMyPlaylists(apiToken) : Promise.resolve([]),
        apiToken ? fetchFavoritePlaylists(apiToken) : Promise.resolve([]),
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
                            <span className="md:hidden text-base leading-none">+</span>
                            <span className="hidden md:inline">+ {t('create')}</span>
                        </Link>
                    ) : (
                        <a
                            href={`/api/auth/signin?callbackUrl=/${locale}/playlist/new`}
                            title={t('create')}
                            className="shrink-0 w-9 h-9 md:w-auto md:h-auto md:px-5 md:py-2.5 flex items-center justify-center text-sm tracking-[0.12em] text-white border border-[var(--hairline-strong)] hover:text-[var(--vermilion)] hover:border-[var(--vermilion)]/50 transition-all"
                        >
                            <span className="md:hidden text-base leading-none">+</span>
                            <span className="hidden md:inline">+ {t('create')}</span>
                        </a>
                    )}
                </div>

                {/* My Playlists */}
                {myPlaylists.length > 0 && (
                    <div className="flex flex-col gap-4">
                        <h2 className="text-sm font-semibold text-[var(--text-secondary)] tracking-[0.3em] uppercase">
                            {t('mine')}
                        </h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {myPlaylists.map((pl: Parameters<typeof PlaylistCard>[0]['playlist']) => (
                                <PlaylistCard key={pl.id} playlist={pl} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Favorited Playlists */}
                {favoritedPlaylists.length > 0 && (
                    <div className="flex flex-col gap-4">
                        <h2 className="text-sm font-semibold text-[var(--text-secondary)] tracking-[0.3em] uppercase">
                            {t('favorited')}
                        </h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {favoritedPlaylists.map((pl: Parameters<typeof PlaylistCard>[0]['playlist']) => (
                                <PlaylistCard key={pl.id} playlist={pl} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Public grid */}
                <div className="flex flex-col gap-4">
                    {myPlaylists.length > 0 && (
                        <h2 className="text-sm font-semibold text-[var(--text-secondary)] tracking-[0.3em] uppercase">
                            {t('browse')}
                        </h2>
                    )}
                    {publicPlaylists.length === 0 ? (
                        <div className="glass-panel hairline-border px-8 py-12 text-center text-[var(--text-secondary)] text-sm">
                            {t('no_playlists')}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {publicPlaylists.map((pl: Parameters<typeof PlaylistCard>[0]['playlist']) => (
                                <PlaylistCard key={pl.id} playlist={pl} />
                            ))}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
