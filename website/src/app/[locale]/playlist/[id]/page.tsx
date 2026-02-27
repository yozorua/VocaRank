import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import MosaicCover from '@/components/playlist/MosaicCover';
import FavoritePlaylistButton from '@/components/playlist/FavoritePlaylistButton';
import PlaylistForm from '@/components/playlist/PlaylistForm';
import ThumbnailImage from '@/components/ThumbnailImage';
import AddSongToPlaylist from '@/components/playlist/AddSongToPlaylist';
import DeletePlaylistButton from '@/components/playlist/DeletePlaylistButton';
import SharePlaylistButton from '@/components/playlist/SharePlaylistButton';

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
    };

    return (
        <div className="min-h-screen">
            <div className="max-w-[var(--max-width)] mx-auto px-6 md:px-12 py-8 flex flex-col gap-8">

                {/* Hero row */}
                <div className="flex flex-col md:flex-row gap-8 items-start">
                    {/* Cover */}
                    <div className="w-44 h-44 shrink-0 overflow-hidden border border-[var(--hairline)] relative">
                        <MosaicCover songs={playlist.songs} coverUrl={playlist.cover_url} />
                        {!playlist.is_public && (
                            <div className="absolute top-2 right-2 bg-black/70 px-2 py-0.5 text-[9px] tracking-widest uppercase text-[var(--text-secondary)]">
                                Private
                            </div>
                        )}
                    </div>

                    {/* Meta */}
                    <div className="flex flex-col gap-3 flex-1 min-w-0">
                        <h1 className="text-3xl font-bold text-white">{playlist.title}</h1>
                        {playlist.description && (
                            <p className="text-[var(--text-secondary)] text-sm leading-relaxed line-clamp-3 overflow-hidden break-words">{playlist.description}</p>
                        )}
                        {playlist.owner?.name && (
                            <p className="text-xs text-[var(--text-secondary)] opacity-60">by {playlist.owner.name}</p>
                        )}
                        <p className="text-xs text-[var(--text-secondary)]">{playlist.song_count} songs</p>

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
                    />
                )}

                {/* Song list */}
                <div className="glass-panel hairline-border">
                    {playlist.songs.length === 0 ? (
                        <div className="px-8 py-12 text-center text-[var(--text-secondary)] text-sm">{t('no_songs')}</div>
                    ) : (
                        <div className="divide-y divide-[var(--hairline)]">
                            {playlist.songs.map((song, idx) => {
                                const title = song.name_japanese || song.name_english || song.name_romaji || '—';
                                const songType = song.song_type;
                                const typeEl = songType === 'Original'
                                    ? <span className="text-[var(--cyan-subtle)] font-bold uppercase text-[10px] tracking-widest">ORIGINAL</span>
                                    : songType === 'Cover'
                                        ? <span className="text-[#E8954A] font-bold uppercase text-[10px] tracking-widest">COVER</span>
                                        : songType === 'Remix'
                                            ? <span className="text-[var(--gold)] font-bold uppercase text-[10px] tracking-widest">REMIX</span>
                                            : songType === 'Remaster'
                                                ? <span className="text-[#B284BE] font-bold uppercase text-[10px] tracking-widest">REMASTER</span>
                                                : songType
                                                    ? <span className="text-[var(--text-secondary)] font-bold uppercase text-[10px] tracking-widest">{songType.toUpperCase()}</span>
                                                    : null;
                                return (
                                    <Link key={song.song_id} href={`/song/${song.song_id}`}
                                        className="flex items-center gap-4 px-5 py-3.5 hover:bg-[var(--hairline)] transition-colors group">
                                        {/* Rank number */}
                                        <span className="font-mono text-xs text-[var(--text-secondary)] w-6 shrink-0 text-right tabular-nums opacity-50">{idx + 1}</span>
                                        {/* Thumbnail — 96×64 like ranking table */}
                                        {(song.youtube_id || song.niconico_thumb_url) ? (
                                            <ThumbnailImage
                                                youtubeId={song.youtube_id}
                                                niconicoThumb={song.niconico_thumb_url}
                                                alt={title}
                                                className="w-24 h-16 object-cover shrink-0 border border-[var(--hairline)]"
                                            />
                                        ) : (
                                            <div className="w-24 h-16 bg-white/5 border border-[var(--hairline)] shrink-0" />
                                        )}
                                        {/* Title + producers + vocals — ranking table layout */}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-white text-base line-clamp-1 group-hover:text-[var(--vermilion)] transition-colors tracking-wide mb-1.5">{title}</p>
                                            <div className="flex flex-col gap-1">
                                                {/* Type + producers row */}
                                                <div className="text-[11px] text-[var(--text-secondary)] flex items-center gap-2 min-w-0">
                                                    <div className="w-[72px] flex-shrink-0">{typeEl}</div>
                                                    <div className="truncate min-w-0">{song.songwriter_string || song.artist_string}</div>
                                                </div>
                                                {/* Vocals row */}
                                                {song.vocalist_string && (
                                                    <div className="text-[11px] text-[var(--text-secondary)] flex items-center gap-2 min-w-0">
                                                        <div className="w-[72px] flex-shrink-0 text-[9px] uppercase tracking-widest text-white/40">VOCALS</div>
                                                        <div className="truncate min-w-0">{song.vocalist_string}</div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {/* Arrow */}
                                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-[var(--hairline-strong)] group-hover:text-[var(--vermilion)] transition-colors">
                                            <polyline points="9 18 15 12 9 6" />
                                        </svg>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
