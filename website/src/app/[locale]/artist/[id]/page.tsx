
import { getArtist, getArtistSongs } from '@/lib/api';
import RankingTable from '@/components/RankingTable';
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
        const [artist, songs] = await Promise.all([
            getArtist(artistId),
            getArtistSongs(artistId)
        ]);

        const getArtistName = () => {
            if (locale === 'ja') return artist.name_japanese || artist.name_default;
            if (locale === 'en') return artist.name_english || artist.name_default;
            return artist.name_default;
        };

        const thumb = artist.picture_url_original || artist.picture_url_thumb;

        return (
            <div className="max-w-[var(--max-width)] mx-auto px-4 md:px-6 py-8">
                {/* Artist Header */}
                <div className="glass-panel p-6 md:p-8 rounded-2xl border border-white/5 mb-8 flex flex-col md:flex-row gap-8 items-center md:items-start text-center md:text-left">
                    {/* Image */}
                    <div className="flex-shrink-0">
                        <div className="w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden border-4 border-[var(--miku-teal)]/30 shadow-[0_0_30px_rgba(57,197,187,0.2)]">
                            {thumb ? (
                                <img src={thumb} alt={artist.name_default} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-[#1a1a1a] flex items-center justify-center text-4xl">👤</div>
                            )}
                        </div>
                    </div>

                    {/* Info */}
                    <div className="flex-grow min-w-0">
                        <div className="text-[var(--miku-teal)] font-bold uppercase tracking-widest text-sm mb-2">{artist.artist_type.replace('SynthesizerV', 'Synthesizer V')}</div>
                        <h1 className="text-3xl md:text-5xl font-black text-white mb-3">{getArtistName()}</h1>

                        {/* Sub Names */}
                        <div className="flex flex-wrap gap-3 justify-center md:justify-start text-gray-400 text-base mb-6 font-medium">
                            {artist.name_english && <span>{artist.name_english}</span>}
                            {artist.name_japanese && <span className="border-l border-gray-600 pl-3">{artist.name_japanese}</span>}
                        </div>

                        {/* Links */}
                        {artist.external_links && artist.external_links.length > 0 && (
                            <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                                {artist.external_links.map((link, idx) => {
                                    return (
                                        <a
                                            key={idx}
                                            href={link.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/30 text-xs font-semibold text-gray-300 hover:text-white transition-all"
                                        >
                                            {link.description}
                                        </a>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Songs List */}
                <div>
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                        {t('top_songs', { defaultMessage: 'Top Songs' })}
                    </h2>
                    <RankingTable songs={songs} mode="total" showRank={false} />
                </div>
            </div>
        );
    } catch (e) {
        console.error("Failed to fetch artist", e);
        notFound();
    }
}
