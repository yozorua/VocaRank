'use client';

import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import { OfficialLive } from '@/types';

type Props = {
    live: OfficialLive;
    onEdit?: (live: OfficialLive) => void;
    onDelete?: (live: OfficialLive) => void;
};

export default function OfficialLiveCard({ live, onEdit, onDelete }: Props) {
    const t = useTranslations('Playlist');
    const { data: session } = useSession();
    const isAdmin = session?.isAdmin;

    return (
        <Link
            href={`/playlist/live/${live.slug}`}
            className="group relative glass-panel hairline-border overflow-hidden hover:border-[var(--vermilion)]/40 hover:scale-[1.02] transition-all duration-300 block"
            style={{ minHeight: '240px' }}
        >
            {/* Full-bleed cover */}
            <div className="absolute inset-0">
                {live.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={live.cover_url}
                        alt={live.name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#1a0808] to-[#0a0a1a] relative">
                        <svg className="absolute inset-0 w-full h-full opacity-[0.07]" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                                <pattern id={`grid-${live.id}`} width="20" height="20" patternUnits="userSpaceOnUse">
                                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--gold)" strokeWidth="0.5" />
                                </pattern>
                            </defs>
                            <rect width="100%" height="100%" fill={`url(#grid-${live.id})`} />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-5xl opacity-10 select-none">♪</span>
                    </div>
                )}
            </div>

            {/* Gradient overlay — bottom to top */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20" />

            {/* Admin buttons — top-right */}
            {isAdmin && (onEdit || onDelete) && (
                <div
                    className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    onClick={e => e.preventDefault()}
                >
                    {onEdit && (
                        <button
                            onClick={e => { e.preventDefault(); e.stopPropagation(); onEdit(live); }}
                            title={t('edit_live')}
                            className="w-7 h-7 flex items-center justify-center bg-black/70 backdrop-blur-sm border border-[var(--hairline)] text-[var(--text-secondary)] hover:text-white hover:border-white/40 transition-all"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                        </button>
                    )}
                    {onDelete && (
                        <button
                            onClick={e => { e.preventDefault(); e.stopPropagation(); onDelete(live); }}
                            title={t('delete_live')}
                            className="w-7 h-7 flex items-center justify-center bg-black/70 backdrop-blur-sm border border-[var(--hairline)] text-[var(--text-secondary)] hover:text-red-400 hover:border-red-400/40 transition-all"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                <path d="M10 11v6M14 11v6" />
                                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                            </svg>
                        </button>
                    )}
                </div>
            )}

            {/* Content — bottom, over gradient */}
            <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
                <p className="text-base font-bold text-white group-hover:text-[var(--gold)] transition-colors leading-snug mb-1">
                    {live.name}
                </p>
                {live.description && (
                    <p className="text-xs text-white/60 leading-snug line-clamp-2 mb-1.5">
                        {live.description}
                    </p>
                )}
                <span className="text-xs text-white/50">
                    {t('live_playlist_count', { count: live.playlist_count })}
                </span>
            </div>
        </Link>
    );
}
