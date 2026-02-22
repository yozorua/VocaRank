
import { getArtist, getArtistSongs, getArtistSongDates } from '@/lib/api';
import RankingTable from '@/components/RankingTable';
import ArtistSongsClient from '@/components/ArtistSongsClient';
import ArtistPublishHistogram from '@/components/ArtistPublishHistogram';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface ArtistPageProps {
    params: Promise<{ locale: string; id: string }>;
}

export default async function ArtistPage({ params }: ArtistPageProps) {
    const { locale, id } = await params;
    const t = await getTranslations({ locale, namespace: 'ArtistPage' });

    const artistId = parseInt(id);
    if (isNaN(artistId)) notFound();

    try {
        const [artist, songDates, songs] = await Promise.all([
            getArtist(artistId),
            getArtistSongDates(artistId),  // all songs, lightweight — for histogram
            getArtistSongs(artistId, 100)  // top 100 by views — for table
        ]);

        const getArtistName = () => {
            return artist.name_default;
        };

        const thumb = artist.picture_url_original || artist.picture_url_thumb;

        const artistTypeColor: Record<string, string> = {
            Producer: 'text-[var(--vermilion)]',
            Animator: 'text-[var(--vermilion)]',
            Illustrator: 'text-orange-400',
            Lyricist: 'text-yellow-400',
            Composer: 'text-amber-400',
            Arranger: 'text-amber-400',
            OtherIndividual: 'text-gray-400',
            OtherGroup: 'text-purple-400',
            Band: 'text-purple-400',
            Circle: 'text-purple-400',
            Label: 'text-blue-400',
            NicoNicoUser: 'text-pink-400',
            VoiceManipulator: 'text-[var(--miku-teal)]',
            CoverArtist: 'text-pink-400',
            Mixer: 'text-cyan-400',
            Mastering: 'text-teal-400',
            Other: 'text-gray-400',
        };
        const typeColor = artistTypeColor[artist.artist_type] ?? 'text-[var(--miku-teal)]';
        const typeLabel = artist.artist_type.replace(/([a-z])([A-Z])/g, '$1 $2').replace('SynthesizerV', 'Synthesizer V');

        return (
            <div className="max-w-[var(--max-width)] mx-auto px-4 md:px-6 py-8">
                {/* Artist Header Card */}
                <div className="glass-panel p-6 md:p-8 rounded-2xl border border-white/5 mb-8">
                    {/* Top row: Avatar + Info + (desktop) Histogram sidebar */}
                    <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-center md:items-start">
                        {/* Avatar */}
                        <div className="flex-shrink-0">
                            <div className="w-32 h-32 md:w-36 md:h-36 rounded-full overflow-hidden border-4 border-[var(--miku-teal)]/30 shadow-[0_0_30px_rgba(57,197,187,0.2)]">
                                {thumb ? (
                                    <img src={thumb} alt={artist.name_default} className="w-full h-full object-cover object-top" />
                                ) : (
                                    <div className="w-full h-full bg-[#1a1a1a] flex items-center justify-center text-4xl">👤</div>
                                )}
                            </div>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0 text-center md:text-left">
                            <div className={`${typeColor} font-bold uppercase tracking-widest text-sm mb-2`}>{typeLabel}</div>
                            <h1 className="text-3xl md:text-4xl font-black text-white mb-3">{getArtistName()}</h1>

                            {/* Sub Names */}
                            <div className="flex flex-wrap gap-3 justify-center md:justify-start text-gray-400 text-base mb-4 font-medium">
                                {artist.name_english && <span>{artist.name_english}</span>}
                                {artist.name_japanese && <span className="border-l border-gray-600 pl-3">{artist.name_japanese}</span>}
                            </div>

                            {/* Active Range */}
                            {(artist.first_song_date || artist.last_song_date) && (
                                <div className="flex flex-wrap justify-center md:justify-start mb-6">
                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-gray-300">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                        <span className="font-mono">
                                            {artist.first_song_date ? new Date(artist.first_song_date).getFullYear() + '/' + String(new Date(artist.first_song_date).getMonth() + 1).padStart(2, '0') : '?'}
                                            {' - '}
                                            {artist.last_song_date ? new Date(artist.last_song_date).getFullYear() + '/' + String(new Date(artist.last_song_date).getMonth() + 1).padStart(2, '0') : '?'}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Links + inline histogram — desktop */}
                            {artist.external_links && artist.external_links.length > 0 ? (
                                <>
                                    {/* Mobile: links centered */}
                                    <div className="md:hidden flex flex-wrap gap-2 justify-center">
                                        {artist.external_links.map((link, idx) => (
                                            <a key={idx} href={link.url} target="_blank" rel="noopener noreferrer"
                                                className="px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/30 text-xs font-semibold text-gray-300 hover:text-white transition-all">
                                                {link.description}
                                            </a>
                                        ))}
                                    </div>

                                    {/* Desktop: links + inline histogram side by side */}
                                    <div className="hidden md:flex items-stretch gap-4">
                                        <div className="flex flex-wrap gap-2 content-start w-1/2">
                                            {artist.external_links.map((link, idx) => (
                                                <a key={idx} href={link.url} target="_blank" rel="noopener noreferrer"
                                                    className="px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/30 text-xs font-semibold text-gray-300 hover:text-white transition-all h-fit">
                                                    {link.description}
                                                </a>
                                            ))}
                                        </div>
                                        <div className="border-l border-[var(--hairline)] pl-4 w-1/2 flex-shrink-0">
                                            <ArtistPublishHistogram yearCounts={songDates} variant="inline" />
                                        </div>
                                    </div>
                                </>
                            ) : (
                                /* No weblinks: show histogram half-width on desktop, left-aligned */
                                <div className="hidden md:block w-1/2">
                                    <ArtistPublishHistogram yearCounts={songDates} variant="inline" />
                                </div>
                            )}
                        </div>

                    </div>

                    {/* Histogram — mobile only, full width below avatar+info */}
                    <div className="md:hidden mt-6 pt-6 border-t border-[var(--hairline)]">
                        <ArtistPublishHistogram yearCounts={songDates} />
                    </div>
                </div>

                {/* Songs List */}
                <div className="pt-4">
                    <ArtistSongsClient artistId={artistId} initialSongs={songs} />
                </div>
            </div>
        );
    } catch (e) {
        console.error("Failed to fetch artist", e);
        notFound();
    }
}
