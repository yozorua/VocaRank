import { getSong } from '@/lib/api';
import SongInfo from '@/components/SongInfo';
import SongPlayer from '@/components/SongPlayer';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import Link from 'next/link'; // Added Link import

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
                {/* Replaced SongInfo with detailed metadata rendering */}
                <SongInfo song={song} />
            </div>
        );
    } catch (e) {
        notFound();
    }
}
