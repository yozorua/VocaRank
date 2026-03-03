import { getSong } from '@/lib/api';
import SongInfo from '@/components/SongInfo';
import SongPlayer from '@/components/SongPlayer';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }): Promise<Metadata> {
    const { locale, id } = await params;
    const songId = parseInt(id, 10);
    if (isNaN(songId)) return {};
    try {
        const song = await getSong(songId);
        const title = (locale === 'ja' || locale === 'zh-TW')
            ? (song.name_japanese || song.name_english || song.name_romaji || 'Song')
            : (song.name_english || song.name_romaji || song.name_japanese || 'Song');
        const description = song.artist_string ? `${title} by ${song.artist_string}` : title;
        const thumb = song.youtube_id
            ? `https://img.youtube.com/vi/${song.youtube_id}/hqdefault.jpg`
            : (song.niconico_thumb_url ?? undefined);
        return {
            title,
            description,
            openGraph: { title, description, images: thumb ? [{ url: thumb }] : [] },
            twitter: { card: 'summary_large_image', images: thumb ? [thumb] : [] },
        };
    } catch {
        return {};
    }
}
import Link from 'next/link'; // Added Link import
import CommentsSection from '@/components/song/CommentsSection';

interface PageProps {
    params: Promise<{
        locale: string;
        id: string;
    }>;
}

export default async function SongDetailPage({ params }: PageProps) {
    const { id, locale } = await params;
    const songId = parseInt(id, 10);
    const t = await getTranslations('SongDetailPage'); // Added t for translations

    if (isNaN(songId)) {
        notFound();
    }

    try {
        const song = await getSong(songId);

        return (
            <div className="max-w-[var(--max-width)] mx-auto px-6 pt-6 pb-8 md:py-8">
                <SongPlayer youtubeId={song.youtube_id} niconicoId={song.niconico_id} />
                <SongInfo song={song} />
                <CommentsSection songId={song.id} />
            </div>
        );
    } catch (e) {
        notFound();
    }
}
