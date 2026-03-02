import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import MosaicCover from '@/components/playlist/MosaicCover';
import FavoritePlaylistButton from '@/components/playlist/FavoritePlaylistButton';
import PlaylistForm from '@/components/playlist/PlaylistForm';
import AddSongToPlaylist from '@/components/playlist/AddSongToPlaylist';
import DeletePlaylistButton from '@/components/playlist/DeletePlaylistButton';
import SharePlaylistButton from '@/components/playlist/SharePlaylistButton';
import PlaylistSongList from '@/components/playlist/PlaylistSongList';

const API = process.env.API_URL_INTERNAL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type Song = {
    song_id: number;
    position: number;
    name_english?: string | null;
    name_japanese?: string | null;
    name_romaji?: string | null;
    youtube_id?: string | null;
    niconico_id?: string | null;
    niconico_thumb_url?: string | null;
    artist_string?: string | null;
    songwriter_string?: string | null;
    vocalist_string?: string | null;
    song_type?: string | null;
};

type Playlist = {
    id: number;
    user_id: number;
    title: string;
    description?: string | null;
    cover_url?: string | null;
    is_public: number;
    song_count: number;
    total_duration_seconds?: number | null;
    favorite_count: number;
    is_favorited: boolean;
    songs: Song[];
    owner?: { id: number; name?: string | null; picture_url?: string | null };
};

async function fetchPlaylist(id: string, token?: string): Promise<Playlist | null> {
    try {
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch(`${API}/playlists/${id}`, { cache: 'no-store', headers });
        if (!res.ok) return null;
        return res.json();
    } catch {
        return null;
    }
}

export default async function PlaylistDetailPage({ params }: { params: Promise<{ id: string; locale: string }> }) {
    const { id, locale } = await params;
    const t = await getTranslations('Playlist');
    const session = await getServerSession(authOptions);
    const apiToken = (session as any)?.apiToken as string | undefined;
    const currentUserId = (session as any)?.userId as number | undefined;
    const playlist = await fetchPlaylist(id, apiToken);

    if (!playlist) notFound();

    const isOwner = !!session && currentUserId === playlist.user_id;

    const formT = {
        create: t('create'),
        edit: t('edit'),
        name_label: t('name_label'),
        name_placeholder: t('name_placeholder'),
        desc_label: t('desc_label'),
        desc_placeholder: t('desc_placeholder'),
        visibility: t('visibility'),
        public: t('public'),
        private: t('private'),
        save: t('save'),
        cancel: t('cancel'),
        cover_upload: t('cover_upload'),
        cover_remove: t('cover_remove'),
        cover_drag_drop: t('cover_drag_drop'),
        cover_browse: t('cover_browse'),
        cover_change: t('cover_change'),
        cover_mosaic_hint: t('cover_mosaic_hint'),
        cover_undo: t('cover_undo'),
        cover_error_type: t('cover_error_type'),
        cover_error_size: t('cover_error_size'),
        cover_crop_title: t('cover_crop_title'),
        cover_crop_apply: t('cover_crop_apply'),
        cover_crop_cancel: t('cover_crop_cancel'),
    };

    return (
        <div className="min-h-screen">
            <div className="max-w-[var(--max-width)] mx-auto px-6 md:px-12 py-8 flex flex-col gap-8">

                {/* Hero row */}
                <div className="flex flex-col md:flex-row gap-8 items-start">
                    {/* Cover */}
                    <div className="w-44 h-44 shrink-0 overflow-hidden border border-[var(--hairline)] relative group">
                        <Link href={`/player?playlist=${playlist.id}`} className="absolute inset-0 z-20 cursor-pointer flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-all">
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="white" className="opacity-0 group-hover:opacity-100 transition-opacity translate-y-4 group-hover:translate-y-0 duration-300 drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                        </Link>
                        <MosaicCover songs={playlist.songs} coverUrl={playlist.cover_url} />
                        {!playlist.is_public && (
                            <div className="absolute top-2 right-2 bg-black/70 px-2 py-0.5 text-[9px] tracking-widest uppercase text-[var(--text-secondary)] z-30">
                                Private
                            </div>
                        )}
                    </div>

                    {/* Meta */}
                    <div className="flex flex-col gap-3 flex-1 min-w-0">
                        <h1 className="text-3xl font-bold text-white">{playlist.title}</h1>
                        {playlist.description && (
                            <p className="text-[var(--text-secondary)] text-sm leading-relaxed break-words whitespace-pre-line">{playlist.description}</p>
                        )}
                        {playlist.owner?.name && (
                            <p className="text-xs text-[var(--text-secondary)] opacity-60">{playlist.owner.name}</p>
                        )}
                        <p className="text-xs text-[var(--text-secondary)]">
                            {t('song_count', { count: playlist.song_count })}
                            {playlist.total_duration_seconds ? (() => {
                                const hrs = Math.floor(playlist.total_duration_seconds / 3600);
                                const mins = Math.floor((playlist.total_duration_seconds % 3600) / 60);
                                const dur = hrs > 0
                                    ? t('duration_hr_min', { hrs, mins })
                                    : t('duration_min_only', { mins: mins || 1 });
                                return <><span className="opacity-40 mx-2">·</span>{dur}</>;
                            })() : null}
                        </p>

                        {/* Row 1: Play All + Favorite + Share */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <Link href={`/player?playlist=${playlist.id}`}
                                className="px-6 py-2.5 text-sm font-medium tracking-[0.12em] text-white border border-[var(--hairline-strong)] hover:border-[var(--vermilion)]/50 hover:text-[var(--vermilion)] transition-all">
                                ▶ {t('play_all')}
                            </Link>

                            <FavoritePlaylistButton
                                playlistId={playlist.id}
                                initialFavorited={playlist.is_favorited}
                                initialCount={playlist.favorite_count}
                                label={t('favorites')}
                            />

                            <SharePlaylistButton label={t('share')} />
                        </div>

                        {/* Row 2: Owner icon buttons */}
                        {isOwner && (
                            <div className="flex items-center gap-2">
                                <PlaylistForm locale={locale} existingPlaylist={playlist} t={formT} iconOnly />
                                <DeletePlaylistButton
                                    playlistId={playlist.id}
                                    ownerId={playlist.user_id}
                                    locale={locale}
                                    label={t('delete')}
                                    confirmLabel={t('delete_confirm')}
                                    cancelLabel={t('cancel')}
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Add song — owner only */}
                {isOwner && (
                    <AddSongToPlaylist
                        playlistId={playlist.id}
                        placeholder={t('add_song_placeholder')}
                        addLabel={t('add_song')}
                        alreadyAddedLabel={t('already_added')}
                        existingSongIds={playlist.songs.map((s: any) => s.song_id)}
                    />
                )}

                {/* Song list */}
                <div className="glass-panel hairline-border overflow-hidden">
                    {playlist.songs.length === 0 ? (
                        <div className="px-8 py-12 text-center text-[var(--text-secondary)] text-sm">{t('no_songs')}</div>
                    ) : (
                        <PlaylistSongList
                            songs={playlist.songs}
                            playlistId={playlist.id}
                            apiToken={(session as any)?.apiToken ?? ''}
                            locale={locale}
                            isOwner={isOwner}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
